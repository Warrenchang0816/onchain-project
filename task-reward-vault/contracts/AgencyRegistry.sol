// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./PropertyRegistry.sol";

/**
 * @title AgencyRegistry
 * @notice 可信房屋媒合平台 — 委託授權鏈上登錄
 *
 * 架構原則（Blockchain ↔ Frontend ↔ Backend ↔ DB）：
 *   - 後端不持有錢包，不呼叫合約
 *   - 授權 / 撤銷由屋主 MetaMask 直接簽名送出（屋主意志由屋主錢包代表）
 *   - 合約內透過 PropertyRegistry.isOwner() 驗證 msg.sender 身份
 *   - 管理員 OPERATOR（Admin 前端）負責：
 *       1. 緊急強制撤銷
 *       2. 案件進入 MATCHED 後鎖定解約條件（lockForMutualConsent）
 *
 * 委託合約核心條款（grantAuthorization 時雙方確認）：
 *   - serviceFeeRate   仲介服務費率（basis points，e.g. 100 = 1%）
 *   - mandateDuration  委託期限（秒）
 *   - penaltyAmount    違約金（wei 或 token 單位）
 *
 * 解約規則（對應產品設計）：
 *   - 未進入媒合（mutualConsentRequired = false）：屋主可單方撤銷
 *   - 已進入媒合（mutualConsentRequired = true）：需 OPERATOR 呼叫 revokeWithConsent
 *     （後端確認雙方同意後執行）
 *
 * 角色：
 *   DEFAULT_ADMIN_ROLE — OZ 角色管理機制（不用於業務操作）
 *   OPERATOR_ROLE      — Admin 前端（鎖定 / 強制撤銷）
 *
 * 正常流程（使用者直接呼叫）：
 *   屋主 MetaMask → grantAuthorization()  → 授權仲介（含合約條款）
 *   屋主 MetaMask → revokeAuthorization() → 單方撤銷（未媒合時）
 *
 * 後端職責（無錢包）：
 *   → 提供 API 查詢授權狀態（從 DB）
 *   → 監聽合約 event，同步授權記錄到 DB
 *   → 案件進入 MATCHED 時呼叫 lockForMutualConsent
 */
contract AgencyRegistry is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    PropertyRegistry public immutable propertyRegistry;

    enum AuthStatus { ACTIVE, REVOKED }

    struct AuthInfo {
        bytes32    authId;
        bytes32    propertyId;
        address    owner;
        address    agent;
        string     purpose;              // RENT | SALE | BOTH

        // 委託合約核心條款
        uint256    serviceFeeRate;       // basis points（e.g. 100 = 1%）
        uint256    mandateDuration;      // 委託期限（秒）
        uint256    penaltyAmount;        // 違約金（wei，或穩定幣 token units）

        // 解約管制
        bool       mutualConsentRequired;
        // false = 屋主可單方撤銷
        // true  = 案件進入 MATCHED 後由 OPERATOR 設定，之後需雙方合意才可解約

        AuthStatus status;
        uint256    authorizedAt;
        uint256    expiresAt;            // authorizedAt + mandateDuration（0 = 不限期）
        uint256    revokedAt;
        bool       exists;
    }

    // authId → AuthInfo
    mapping(bytes32 => AuthInfo) public authorizations;

    // propertyId + agent → authId（快速查詢）
    mapping(bytes32 => mapping(address => bytes32)) public activeAuth;

    // --------------------------------------------------------
    // Events
    // --------------------------------------------------------
    event AuthorizationGranted(
        bytes32 indexed authId,
        bytes32 indexed propertyId,
        address indexed owner,
        address         agent,
        string          purpose,
        uint256         serviceFeeRate,
        uint256         mandateDuration,
        uint256         penaltyAmount,
        uint256         expiresAt,
        uint256         authorizedAt
    );
    event AuthorizationRevoked(
        bytes32 indexed authId,
        bytes32 indexed propertyId,
        address indexed revokedBy,
        bool            wasMutualConsent,
        uint256         revokedAt
    );
    event MutualConsentLocked(
        bytes32 indexed authId,
        bytes32 indexed propertyId,
        uint256         lockedAt
    );

    // --------------------------------------------------------
    // Constructor
    // --------------------------------------------------------
    constructor(address admin, address operator, address propertyRegistryAddr) {
        require(admin                != address(0), "invalid admin");
        require(operator             != address(0), "invalid operator");
        require(propertyRegistryAddr != address(0), "invalid propertyRegistry");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);

        propertyRegistry = PropertyRegistry(propertyRegistryAddr);
    }

    // --------------------------------------------------------
    // 屋主直接呼叫（msg.sender = 屋主 MetaMask）
    // --------------------------------------------------------

    /**
     * @notice 屋主授權仲介操作指定物件（含委託合約核心條款）
     * @dev    msg.sender 必須是 propertyId 的持有人（PropertyRegistry 驗證）
     * @param authId          唯一授權 ID（前端產生，傳給後端做 DB 索引）
     * @param propertyId      目標物件 ID
     * @param agent           仲介錢包地址
     * @param purpose         RENT | SALE | BOTH
     * @param serviceFeeRate  仲介服務費率（basis points）
     * @param mandateDuration 委託期限（秒，0 = 不限期）
     * @param penaltyAmount   違約金（wei，0 = 無違約金）
     */
    function grantAuthorization(
        bytes32         authId,
        bytes32         propertyId,
        address         agent,
        string calldata purpose,
        uint256         serviceFeeRate,
        uint256         mandateDuration,
        uint256         penaltyAmount
    ) external {
        require(authId     != bytes32(0), "invalid authId");
        require(propertyId != bytes32(0), "invalid propertyId");
        require(agent      != address(0), "invalid agent");
        require(agent      != msg.sender, "cannot authorize yourself");
        require(!authorizations[authId].exists, "authId already exists");
        require(serviceFeeRate <= 10000, "serviceFeeRate exceeds 100%");

        // 驗證 msg.sender 是此物件的持有人
        require(
            propertyRegistry.isOwner(propertyId, msg.sender),
            "caller is not property owner"
        );

        // 若已有 ACTIVE 授權，先標記為 REVOKED
        bytes32 existingAuthId = activeAuth[propertyId][agent];
        if (existingAuthId != bytes32(0)) {
            AuthInfo storage existing = authorizations[existingAuthId];
            if (existing.status == AuthStatus.ACTIVE) {
                existing.status    = AuthStatus.REVOKED;
                existing.revokedAt = block.timestamp;
                emit AuthorizationRevoked(
                    existingAuthId,
                    propertyId,
                    msg.sender,
                    false,
                    block.timestamp
                );
            }
        }

        uint256 expiresAt = mandateDuration > 0
            ? block.timestamp + mandateDuration
            : 0;

        authorizations[authId] = AuthInfo({
            authId:               authId,
            propertyId:           propertyId,
            owner:                msg.sender,
            agent:                agent,
            purpose:              purpose,
            serviceFeeRate:       serviceFeeRate,
            mandateDuration:      mandateDuration,
            penaltyAmount:        penaltyAmount,
            mutualConsentRequired: false,
            status:               AuthStatus.ACTIVE,
            authorizedAt:         block.timestamp,
            expiresAt:            expiresAt,
            revokedAt:            0,
            exists:               true
        });

        activeAuth[propertyId][agent] = authId;

        emit AuthorizationGranted(
            authId,
            propertyId,
            msg.sender,
            agent,
            purpose,
            serviceFeeRate,
            mandateDuration,
            penaltyAmount,
            expiresAt,
            block.timestamp
        );
    }

    /**
     * @notice 屋主單方撤銷授權（僅限案件尚未進入媒合時）
     * @dev    若 mutualConsentRequired = true，此函式會 revert
     *         需改由 OPERATOR 呼叫 revokeWithConsent（後端確認雙方同意後執行）
     */
    function revokeAuthorization(bytes32 authId) external {
        AuthInfo storage auth = authorizations[authId];
        require(auth.exists,                       "auth not found");
        require(auth.status == AuthStatus.ACTIVE,  "auth not active");
        require(auth.owner  == msg.sender,         "caller is not authorization owner");
        require(
            !auth.mutualConsentRequired,
            "case in progress: mutual consent required to revoke"
        );

        auth.status    = AuthStatus.REVOKED;
        auth.revokedAt = block.timestamp;
        activeAuth[auth.propertyId][auth.agent] = bytes32(0);

        emit AuthorizationRevoked(authId, auth.propertyId, msg.sender, false, block.timestamp);
    }

    // --------------------------------------------------------
    // OPERATOR（Admin 前端）操作
    // --------------------------------------------------------

    /**
     * @notice 鎖定解約條件（案件進入 MATCHED 時由後端呼叫）
     * @dev    鎖定後屋主無法單方撤銷，需雙方合意（revokeWithConsent）
     * @param authId 目標授權 ID
     */
    function lockForMutualConsent(bytes32 authId) external onlyRole(OPERATOR_ROLE) {
        AuthInfo storage auth = authorizations[authId];
        require(auth.exists,                      "auth not found");
        require(auth.status == AuthStatus.ACTIVE, "auth not active");
        require(!auth.mutualConsentRequired,      "already locked");

        auth.mutualConsentRequired = true;

        emit MutualConsentLocked(authId, auth.propertyId, block.timestamp);
    }

    /**
     * @notice 雙方合意解約（後端確認雙方同意後由 OPERATOR 執行）
     * @dev    適用於 mutualConsentRequired = true 的情況
     */
    function revokeWithConsent(bytes32 authId) external onlyRole(OPERATOR_ROLE) {
        AuthInfo storage auth = authorizations[authId];
        require(auth.exists,                      "auth not found");
        require(auth.status == AuthStatus.ACTIVE, "auth not active");

        auth.status    = AuthStatus.REVOKED;
        auth.revokedAt = block.timestamp;
        activeAuth[auth.propertyId][auth.agent] = bytes32(0);

        emit AuthorizationRevoked(authId, auth.propertyId, msg.sender, true, block.timestamp);
    }

    /**
     * @notice 強制撤銷授權（平台緊急處置，不需屋主呼叫）
     */
    function forceRevoke(bytes32 authId) external onlyRole(OPERATOR_ROLE) {
        AuthInfo storage auth = authorizations[authId];
        require(auth.exists,                      "auth not found");
        require(auth.status == AuthStatus.ACTIVE, "auth not active");

        auth.status    = AuthStatus.REVOKED;
        auth.revokedAt = block.timestamp;
        activeAuth[auth.propertyId][auth.agent] = bytes32(0);

        emit AuthorizationRevoked(authId, auth.propertyId, msg.sender, false, block.timestamp);
    }

    // --------------------------------------------------------
    // View
    // --------------------------------------------------------

    function isAuthorized(bytes32 propertyId, address agent) external view returns (bool) {
        bytes32 authId = activeAuth[propertyId][agent];
        if (authId == bytes32(0)) return false;
        AuthInfo storage auth = authorizations[authId];
        if (auth.status != AuthStatus.ACTIVE) return false;
        // 到期檢查
        if (auth.expiresAt > 0 && block.timestamp > auth.expiresAt) return false;
        return true;
    }

    function getAuthorization(bytes32 authId) external view returns (AuthInfo memory) {
        return authorizations[authId];
    }

    function isMutualConsentRequired(bytes32 authId) external view returns (bool) {
        return authorizations[authId].mutualConsentRequired;
    }
}
