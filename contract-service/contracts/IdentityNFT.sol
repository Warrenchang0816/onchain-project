// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title IdentityNFT
 * @notice 可信房屋媒合平台 — 多角色身份 SBT（ERC-1155 Soulbound Token）
 *
 * Token ID 定義：
 *   1 = NATURAL_PERSON  自然人（eKYC + 錢包綁定）
 *   2 = OWNER           屋主（產權文件驗證）
 *   3 = TENANT          租客（收入/工作證明）
 *   4 = AGENT           仲介（不動產證照）
 *
 * 設計原則：
 *   - SBT：所有 token 不可轉讓（持有人無法 transfer）
 *   - 一人一自然人：referenceId（identity hash）全局唯一，同一身份不可綁定第二個錢包
 *   - 一個錢包每種角色最多持有 1 枚
 *   - OPERATOR 可執行 mint / revoke / rebind（換錢包）
 *   - 平台不儲存任何個資，僅上鏈 referenceId（身份 hash）
 *
 * 角色：
 *   DEFAULT_ADMIN_ROLE — OZ 角色管理（不用於業務操作）
 *   OPERATOR_ROLE      — 平台後端，負責 mint / revoke / rebind
 */
contract IdentityNFT is ERC1155, AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ── Token ID 常數 ────────────────────────────────────────
    uint256 public constant NATURAL_PERSON = 1;
    uint256 public constant OWNER          = 2;
    uint256 public constant TENANT         = 3;
    uint256 public constant AGENT          = 4;

    // ── 自然人 SBT 的身份資訊（只存在 tokenId=1）────────────
    struct IdentityInfo {
        string  provider;       // "eKYC"
        bytes32 referenceId;    // SHA-256(person_hash + wallet)，不含原始個資
        bytes32 identityHash;   // 同上（冗餘存放，保持向後相容）
        uint256 mintedAt;
    }

    // wallet → tokenId → IdentityInfo（目前只有 NATURAL_PERSON 有 info）
    mapping(address => mapping(uint256 => IdentityInfo)) public identities;

    // referenceId → wallet（自然人唯一性保證）
    mapping(bytes32 => address) public referenceToWallet;

    // ── Events ───────────────────────────────────────────────
    event IdentityMinted(
        address indexed owner,
        uint256 indexed tokenId,
        string  provider,
        bytes32 referenceId,
        uint256 mintedAt
    );
    event CredentialMinted(
        address indexed owner,
        uint256 indexed tokenId,
        uint256 mintedAt
    );
    event TokenRevoked(
        address indexed owner,
        uint256 indexed tokenId,
        string  reason,
        uint256 revokedAt
    );
    event WalletRebound(
        address indexed oldOwner,
        address indexed newOwner,
        bytes32 referenceId,
        uint256 reboundAt
    );

    // ── Constructor ──────────────────────────────────────────
    constructor(address admin, address operator)
        ERC1155("")
    {
        require(admin    != address(0), "invalid admin");
        require(operator != address(0), "invalid operator");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);
    }

    // ── SBT 核心：禁止一般轉讓 ──────────────────────────────

    /**
     * @dev 覆寫 ERC-1155 transfer，所有持有人轉讓全部攔截。
     *      rebind() 是唯一合法的 "移動" 路徑，由 OPERATOR 控制。
     */
    function safeTransferFrom(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure override {
        revert("IdentityNFT: SBT is non-transferable");
    }

    function safeBatchTransferFrom(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public pure override {
        revert("IdentityNFT: SBT is non-transferable");
    }

    // ── Internal helpers ────────────────────────────────────

    /**
     * @dev SBT 專用 mint — 直接呼叫 _update，不執行 ERC1155Receiver 安全檢查。
     *
     * 背景：ERC1155._mint 在 OZ v5 會呼叫 _updateWithAcceptanceCheck，
     * 進而呼叫 checkOnERC1155Received。對於 EIP-7702 Smart Account（如 MetaMask
     * Smart Account 模式）這會 revert，因為這類合約未實作 IERC1155Receiver。
     *
     * SBT 場景下 receiver check 沒有意義：
     *   - SBT 不可轉讓，token 不會「永久卡住」，隨時可由 OPERATOR 執行 revoke
     *   - mint 對象已通過 eKYC，地址合法性由業務層保證
     */
    function _mintSBT(address to, uint256 tokenId) private {
        uint256[] memory ids = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        ids[0] = tokenId;
        amounts[0] = 1;
        _update(address(0), to, ids, amounts);
    }

    // ── OPERATOR 操作 ────────────────────────────────────────

    /**
     * @notice Mint 自然人 SBT（eKYC 通過後由後端呼叫）
     * @param to           使用者錢包地址
     * @param provider     驗證來源，如 "eKYC"
     * @param referenceId  SHA-256(person_hash + wallet)（bytes32）
     * @param identityHash 同 referenceId（保持 interface 相容）
     */
    function mint(
        address         to,
        string calldata provider,
        bytes32         referenceId,
        bytes32         identityHash
    ) external onlyRole(OPERATOR_ROLE) returns (uint256) {
        require(to           != address(0), "invalid address");
        require(referenceId  != bytes32(0), "invalid referenceId");
        require(identityHash != bytes32(0), "invalid identityHash");

        // 一人一帳號：同一身份不可綁定第二個錢包
        require(
            referenceToWallet[referenceId] == address(0),
            "identity already bound to another wallet"
        );
        // 一個錢包只能有一枚自然人 SBT
        require(
            balanceOf(to, NATURAL_PERSON) == 0,
            "wallet already has a natural person token"
        );

        identities[to][NATURAL_PERSON] = IdentityInfo({
            provider:     provider,
            referenceId:  referenceId,
            identityHash: identityHash,
            mintedAt:     block.timestamp
        });
        referenceToWallet[referenceId] = to;

        _mintSBT(to, NATURAL_PERSON);

        emit IdentityMinted(to, NATURAL_PERSON, provider, referenceId, block.timestamp);
        return NATURAL_PERSON;
    }

    /**
     * @notice Mint 角色憑證 SBT（屋主 / 租客 / 仲介，行政審核通過後呼叫）
     * @param to      使用者錢包地址（需已持有 NATURAL_PERSON）
     * @param tokenId 2=OWNER | 3=TENANT | 4=AGENT
     */
    function mintCredential(
        address to,
        uint256 tokenId
    ) external onlyRole(OPERATOR_ROLE) {
        require(to != address(0), "invalid address");
        require(
            tokenId == OWNER || tokenId == TENANT || tokenId == AGENT,
            "invalid credential tokenId"
        );
        // 必須先持有自然人 SBT
        require(
            balanceOf(to, NATURAL_PERSON) > 0,
            "must hold NATURAL_PERSON token first"
        );
        // 每種角色每個錢包最多一枚
        require(
            balanceOf(to, tokenId) == 0,
            "credential already issued"
        );

        _mintSBT(to, tokenId);

        emit CredentialMinted(to, tokenId, block.timestamp);
    }

    /**
     * @notice 撤銷任意 token（違規處置）
     * @param wallet  持有人錢包
     * @param tokenId 要撤銷的 token ID
     * @param reason  撤銷原因（上鏈記錄）
     */
    function revoke(
        address         wallet,
        uint256         tokenId,
        string calldata reason
    ) external onlyRole(OPERATOR_ROLE) {
        require(wallet != address(0), "invalid wallet");
        require(balanceOf(wallet, tokenId) > 0, "token not held");

        _burn(wallet, tokenId, 1);

        // 若撤銷自然人 SBT，同步清除 referenceId 索引
        if (tokenId == NATURAL_PERSON) {
            bytes32 refId = identities[wallet][NATURAL_PERSON].referenceId;
            if (refId != bytes32(0)) {
                referenceToWallet[refId] = address(0);
            }
            delete identities[wallet][NATURAL_PERSON];
        }

        emit TokenRevoked(wallet, tokenId, reason, block.timestamp);
    }

    /**
     * @notice 換錢包（Wallet Rebind）— 重新 eKYC 後由 OPERATOR 執行
     *         將指定 referenceId 下的所有 token 遷移至新錢包
     * @param referenceId  原 identity hash（用於查找舊持有人）
     * @param newOwner     新錢包地址
     */
    function rebind(
        bytes32 referenceId,
        address newOwner
    ) external onlyRole(OPERATOR_ROLE) {
        require(newOwner    != address(0), "invalid newOwner");
        require(referenceId != bytes32(0), "invalid referenceId");

        address oldOwner = referenceToWallet[referenceId];
        require(oldOwner != address(0), "identity not found");
        require(oldOwner != newOwner,   "same wallet");
        require(
            balanceOf(newOwner, NATURAL_PERSON) == 0,
            "new wallet already has identity"
        );

        // 轉移自然人 SBT
        _burn(oldOwner, NATURAL_PERSON, 1);
        _mintSBT(newOwner, NATURAL_PERSON);

        // 移轉角色憑證
        uint256[3] memory roleIds = [OWNER, TENANT, AGENT];
        for (uint256 i = 0; i < roleIds.length; i++) {
            if (balanceOf(oldOwner, roleIds[i]) > 0) {
                _burn(oldOwner, roleIds[i], 1);
                _mintSBT(newOwner, roleIds[i]);
            }
        }

        // 更新 identity info 與索引
        identities[newOwner][NATURAL_PERSON] = identities[oldOwner][NATURAL_PERSON];
        delete identities[oldOwner][NATURAL_PERSON];
        referenceToWallet[referenceId] = newOwner;

        emit WalletRebound(oldOwner, newOwner, referenceId, block.timestamp);
    }

    // ── View ─────────────────────────────────────────────────

    /// @notice 是否通過自然人認證
    function isVerified(address wallet) external view returns (bool) {
        return balanceOf(wallet, NATURAL_PERSON) > 0;
    }

    /// @notice 取得自然人 identity info
    function getIdentityByWallet(address wallet) external view returns (IdentityInfo memory) {
        require(balanceOf(wallet, NATURAL_PERSON) > 0, "no identity token");
        return identities[wallet][NATURAL_PERSON];
    }

    /// @notice 批次查詢某錢包持有哪些憑證（回傳各 tokenId 的 balance）
    function getCredentials(address wallet)
        external
        view
        returns (uint256 naturalPerson, uint256 owner, uint256 tenant, uint256 agent)
    {
        return (
            balanceOf(wallet, NATURAL_PERSON),
            balanceOf(wallet, OWNER),
            balanceOf(wallet, TENANT),
            balanceOf(wallet, AGENT)
        );
    }

    // ── supportsInterface ────────────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
