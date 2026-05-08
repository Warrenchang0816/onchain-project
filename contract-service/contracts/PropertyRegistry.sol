// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IdentityNFT.sol";

/**
 * @title PropertyRegistry
 * @notice 可信房屋媒合平台 — 物件憑證鏈上登錄
 *
 * 架構原則（Blockchain ↔ Frontend ↔ Backend ↔ DB）：
 *   - 後端不持有錢包，不呼叫合約
 *   - 屋主自主行為（登記、加持有人、更新揭露）→ 屋主 MetaMask 直接呼叫
 *   - 平台審核行為（核驗、拒絕）→ 管理員 MetaMask（Admin 前端）呼叫
 *
 * 屋主直接呼叫的函式：
 *   registerProperty()         — 登記物件（需持有 IdentityNFT）
 *   addOwner()                 — 新增共同持有人
 *   setPrimaryOperator()       — 指定主操作人（限現有持有人呼叫）
 *   updateDisclosureHash()     — 更新揭露義務 hash（限主操作人）
 *
 * 管理員（Admin 前端）呼叫的函式：
 *   verifyOwner()              — 強屋主驗證通過
 *   verifyProperty()           — 物件核驗通過（進入市場）
 *   rejectProperty()           — 核驗不通過
 *   updatePropertyStatus()     — 更新物件狀態
 *
 * 後端職責（無錢包）：
 *   → 提供 API 查詢物件資訊（從 DB）
 *   → 監聽合約 event，同步物件記錄到 DB
 */
contract PropertyRegistry is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IdentityNFT public immutable identityNFT;

    enum PropertyStatus {
        REGISTERED,
        VERIFIED,
        REJECTED,
        UNDER_CONTRACT,
        CLOSED
    }

    struct PropertyInfo {
        bytes32        propertyId;
        bytes32        deedHash;          // SHA-256(產權文件)
        bytes32        disclosureHash;    // SHA-256(揭露資料)
        address        primaryOperator;   // 主操作人
        PropertyStatus status;
        uint256        registeredAt;
        uint256        verifiedAt;
        bool           exists;
    }

    struct PropertyOwner {
        address owner;
        uint16  shareBps;   // 持分(bps)，全體合計應 = 10000
        bool    verified;   // 強屋主驗證
    }

    mapping(bytes32 => PropertyInfo)    public properties;
    mapping(bytes32 => PropertyOwner[]) public propertyOwners;
    mapping(bytes32 => bytes32)         public deedHashToPropertyId;

    // --------------------------------------------------------
    // Events
    // --------------------------------------------------------
    event PropertyRegistered(bytes32 indexed propertyId, bytes32 deedHash, address indexed owner, uint256 registeredAt);
    event OwnerAdded(bytes32 indexed propertyId, address indexed owner, uint16 shareBps);
    event PrimaryOperatorSet(bytes32 indexed propertyId, address indexed primaryOperator);
    event OwnerVerified(bytes32 indexed propertyId, address indexed owner);
    event DisclosureUpdated(bytes32 indexed propertyId, bytes32 disclosureHash);
    event PropertyVerified(bytes32 indexed propertyId, uint256 verifiedAt);
    event PropertyRejected(bytes32 indexed propertyId, string reason);
    event PropertyStatusUpdated(bytes32 indexed propertyId, PropertyStatus oldStatus, PropertyStatus newStatus);

    // --------------------------------------------------------
    // Constructor
    // --------------------------------------------------------
    constructor(address admin, address operator, address identityNFTAddr) {
        require(admin          != address(0), "invalid admin");
        require(operator       != address(0), "invalid operator");
        require(identityNFTAddr != address(0), "invalid identityNFT");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);

        identityNFT = IdentityNFT(identityNFTAddr);
    }

    // --------------------------------------------------------
    // 屋主直接呼叫（msg.sender = 屋主 MetaMask）
    // --------------------------------------------------------

    /**
     * @notice 屋主登記物件
     * @dev    需持有 IdentityNFT（已通過 KYC）
     * @param propertyId 後端產生的 property ID（bytes32）
     * @param deedHash   SHA-256(產權文件)，全局唯一
     */
    function registerProperty(
        bytes32 propertyId,
        bytes32 deedHash
    ) external {
        require(propertyId != bytes32(0), "invalid propertyId");
        require(deedHash   != bytes32(0), "invalid deedHash");
        require(!properties[propertyId].exists,              "property already registered");
        require(deedHashToPropertyId[deedHash] == bytes32(0), "deed already registered");

        // 必須持有 IdentityNFT（已完成 KYC）
        require(identityNFT.isVerified(msg.sender), "KYC required");

        deedHashToPropertyId[deedHash] = propertyId;

        properties[propertyId] = PropertyInfo({
            propertyId:      propertyId,
            deedHash:        deedHash,
            disclosureHash:  bytes32(0),
            primaryOperator: msg.sender,
            status:          PropertyStatus.REGISTERED,
            registeredAt:    block.timestamp,
            verifiedAt:      0,
            exists:          true
        });

        // 登記者自動成為第一位持有人（100% 持分）
        propertyOwners[propertyId].push(PropertyOwner({
            owner:    msg.sender,
            shareBps: 10000,
            verified: false
        }));

        emit PropertyRegistered(propertyId, deedHash, msg.sender, block.timestamp);
        emit OwnerAdded(propertyId, msg.sender, 10000);
    }

    /**
     * @notice 新增共同持有人（限主操作人呼叫）
     * @param shareBps 新持有人的持分(bps)
     */
    function addOwner(
        bytes32 propertyId,
        address owner,
        uint16  shareBps
    ) external {
        require(properties[propertyId].exists,                "property not found");
        require(properties[propertyId].primaryOperator == msg.sender, "not primary operator");
        require(owner    != address(0), "invalid owner");
        require(shareBps  > 0,         "shareBps must be > 0");

        // 確認不重複
        PropertyOwner[] storage owners = propertyOwners[propertyId];
        for (uint256 i = 0; i < owners.length; i++) {
            require(owners[i].owner != owner, "owner already exists");
        }

        owners.push(PropertyOwner({
            owner:    owner,
            shareBps: shareBps,
            verified: false
        }));

        emit OwnerAdded(propertyId, owner, shareBps);
    }

    /**
     * @notice 指定主操作人（限現有持有人呼叫）
     */
    function setPrimaryOperator(
        bytes32 propertyId,
        address newOperator
    ) external {
        require(properties[propertyId].exists, "property not found");
        require(isOwner(propertyId, msg.sender),     "caller is not an owner");
        require(isOwner(propertyId, newOperator),    "newOperator is not an owner");

        properties[propertyId].primaryOperator = newOperator;
        emit PrimaryOperatorSet(propertyId, newOperator);
    }

    /**
     * @notice 更新揭露義務 hash（限主操作人呼叫）
     * @param disclosureHash SHA-256(揭露資料 JSON)
     */
    function updateDisclosureHash(
        bytes32 propertyId,
        bytes32 disclosureHash
    ) external {
        require(properties[propertyId].exists,                "property not found");
        require(properties[propertyId].primaryOperator == msg.sender, "not primary operator");
        require(disclosureHash != bytes32(0),                 "invalid disclosureHash");

        properties[propertyId].disclosureHash = disclosureHash;
        emit DisclosureUpdated(propertyId, disclosureHash);
    }

    // --------------------------------------------------------
    // 管理員（Admin 前端）呼叫
    // --------------------------------------------------------

    /**
     * @notice 強屋主驗證通過（確認該錢包對物件有合法產權）
     */
    function verifyOwner(
        bytes32 propertyId,
        address owner
    ) external onlyRole(OPERATOR_ROLE) {
        PropertyOwner[] storage owners = propertyOwners[propertyId];
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i].owner == owner) {
                owners[i].verified = true;
                emit OwnerVerified(propertyId, owner);
                return;
            }
        }
        revert("owner not found in property");
    }

    /**
     * @notice 物件核驗通過（進入市場）
     * 前提：disclosureHash 不為空（揭露義務已完成）
     */
    function verifyProperty(bytes32 propertyId) external onlyRole(OPERATOR_ROLE) {
        PropertyInfo storage p = properties[propertyId];
        require(p.exists,                              "property not found");
        require(p.status == PropertyStatus.REGISTERED, "invalid status");
        require(p.disclosureHash != bytes32(0),        "disclosure not completed");

        p.status     = PropertyStatus.VERIFIED;
        p.verifiedAt = block.timestamp;
        emit PropertyVerified(propertyId, block.timestamp);
    }

    /**
     * @notice 核驗不通過
     */
    function rejectProperty(
        bytes32         propertyId,
        string calldata reason
    ) external onlyRole(OPERATOR_ROLE) {
        PropertyInfo storage p = properties[propertyId];
        require(p.exists,                              "property not found");
        require(p.status == PropertyStatus.REGISTERED, "invalid status");
        p.status = PropertyStatus.REJECTED;
        emit PropertyRejected(propertyId, reason);
    }

    /**
     * @notice 更新物件狀態（VERIFIED → UNDER_CONTRACT → CLOSED 等）
     */
    function updatePropertyStatus(
        bytes32        propertyId,
        PropertyStatus newStatus
    ) external onlyRole(OPERATOR_ROLE) {
        PropertyInfo storage p = properties[propertyId];
        require(p.exists, "property not found");
        PropertyStatus oldStatus = p.status;
        p.status = newStatus;
        emit PropertyStatusUpdated(propertyId, oldStatus, newStatus);
    }

    // --------------------------------------------------------
    // View
    // --------------------------------------------------------

    function getProperty(bytes32 propertyId) external view returns (PropertyInfo memory) {
        return properties[propertyId];
    }

    function getOwners(bytes32 propertyId) external view returns (PropertyOwner[] memory) {
        return propertyOwners[propertyId];
    }

    function isVerified(bytes32 propertyId) external view returns (bool) {
        return properties[propertyId].status == PropertyStatus.VERIFIED;
    }

    function isOwner(bytes32 propertyId, address wallet) public view returns (bool) {
        PropertyOwner[] storage owners = propertyOwners[propertyId];
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i].owner == wallet) return true;
        }
        return false;
    }
}
