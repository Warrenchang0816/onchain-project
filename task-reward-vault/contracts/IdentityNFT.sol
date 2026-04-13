// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title IdentityNFT
 * @notice 可信房屋媒合平台 — 身份憑證 SBT（Soulbound Token）
 *
 * 設計原則：
 *   - KYC 不自建，採第三方身份驗證（第一階段：TWID）
 *   - 平台接收驗證結果後，Mint 一枚 SBT 作為鏈上身份憑證
 *   - SBT = 不可轉讓的 NFT（靈魂綁定）
 *   - 不存原始個資，只存 provider、referenceId、identityHash
 *
 *   一人一帳號規則：
 *   - referenceId（TWID 參考識別碼）全局唯一
 *   - 同一 referenceId 不可 bind 第二個錢包
 *
 *   換錢包流程（Wallet Rebind）：
 *   - 使用者重新透過 TWID 驗證
 *   - OPERATOR 呼叫 rebind()：burn 舊 token → mint 新 token 到新地址
 *
 * 角色：
 *   DEFAULT_ADMIN_ROLE — OZ 角色管理機制（不用於業務操作）
 *   OPERATOR_ROLE      — 平台後端，接收 TWID callback 後 mint / rebind / revoke
 *
 * 流程（對應後端）：
 *   1. 使用者 SIWE 登入 → 後端記錄 wallet
 *   2. 前端跳轉 TWID → 使用者完成身份驗證
 *   3. TWID callback 到後端 → 取得 referenceId + verified 結果
 *   4. 後端 OPERATOR 呼叫 mint()
 *   5. 使用者取得 SBT，KYC 狀態完成
 */
contract IdentityNFT is ERC721, AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    uint256 private _nextTokenId;

    struct IdentityInfo {
        string  provider;       // TWID | bank-kyc | telecom（未來擴充）
        bytes32 referenceId;    // provider 回傳的參考識別碼（hashed）
        bytes32 identityHash;   // platform 計算之 hash（不含原始個資）
        uint256 mintedAt;
    }

    // tokenId → identity info
    mapping(uint256 => IdentityInfo) public identities;

    // wallet address → tokenId（0 表示未持有）
    mapping(address => uint256) public walletToTokenId;

    // referenceId → wallet（確保一人一帳號）
    mapping(bytes32 => address) public referenceToWallet;

    // --------------------------------------------------------
    // Events
    // --------------------------------------------------------
    event IdentityMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string  provider,
        bytes32 referenceId,
        uint256 mintedAt
    );
    event IdentityRebound(
        uint256 indexed tokenId,
        address indexed oldOwner,
        address indexed newOwner,
        uint256 reboundAt
    );
    event IdentityRevoked(
        uint256 indexed tokenId,
        address indexed owner,
        string  reason,
        uint256 revokedAt
    );

    // --------------------------------------------------------
    // Constructor
    // --------------------------------------------------------
    constructor(address admin, address operator)
        ERC721("Platform Identity", "PIDENTITY")
    {
        require(admin    != address(0), "invalid admin");
        require(operator != address(0), "invalid operator");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);
    }

    // --------------------------------------------------------
    // SBT：禁止一般轉讓
    // --------------------------------------------------------

    /**
     * @dev 覆寫 transferFrom，禁止使用者主動轉讓（SBT 核心限制）
     *      rebind() 是唯一合法的 "轉移" 路徑，由 OPERATOR 控制
     */
    function transferFrom(
        address,
        address,
        uint256
    ) public pure override {
        revert("IdentityNFT: SBT is non-transferable");
    }

    function safeTransferFrom(
        address,
        address,
        uint256,
        bytes memory
    ) public pure override {
        revert("IdentityNFT: SBT is non-transferable");
    }

    // --------------------------------------------------------
    // OPERATOR 操作
    // --------------------------------------------------------

    /**
     * @notice Mint 身份 SBT（TWID 驗證通過後由後端呼叫）
     * @param to           使用者錢包地址
     * @param provider     驗證 provider（如 "TWID"）
     * @param referenceId  TWID 回傳的參考識別碼（bytes32 hash）
     * @param identityHash platform 端計算的 identity hash
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

        // 一人一帳號：同一 referenceId 不可綁定第二個 wallet
        require(
            referenceToWallet[referenceId] == address(0),
            "identity already bound to another wallet"
        );
        // 一個 wallet 只能有一個 SBT
        require(
            walletToTokenId[to] == 0,
            "wallet already has an identity token"
        );

        uint256 tokenId = ++_nextTokenId;

        identities[tokenId] = IdentityInfo({
            provider:     provider,
            referenceId:  referenceId,
            identityHash: identityHash,
            mintedAt:     block.timestamp
        });

        walletToTokenId[to]          = tokenId;
        referenceToWallet[referenceId] = to;

        _safeMint(to, tokenId);

        emit IdentityMinted(tokenId, to, provider, referenceId, block.timestamp);
        return tokenId;
    }

    /**
     * @notice 換錢包（Wallet Rebind）
     * 使用者重新透過 TWID 驗證後，OPERATOR 將 SBT 從舊錢包遷移到新錢包
     * @param referenceId 原 TWID reference（用於查找舊 token）
     * @param newOwner    新錢包地址
     */
    function rebind(
        bytes32 referenceId,
        address newOwner
    ) external onlyRole(OPERATOR_ROLE) {
        require(newOwner    != address(0), "invalid newOwner");
        require(referenceId != bytes32(0), "invalid referenceId");

        address oldOwner = referenceToWallet[referenceId];
        require(oldOwner != address(0),  "identity not found");
        require(oldOwner != newOwner,    "same wallet");
        require(walletToTokenId[newOwner] == 0, "new wallet already has identity");

        uint256 tokenId = walletToTokenId[oldOwner];
        require(tokenId != 0, "token not found");

        // 直接修改持有人（繞過 SBT 限制，只有 OPERATOR 可執行）
        _transfer(oldOwner, newOwner, tokenId);

        // 更新索引
        walletToTokenId[newOwner] = tokenId;
        walletToTokenId[oldOwner] = 0;
        referenceToWallet[referenceId] = newOwner;

        emit IdentityRebound(tokenId, oldOwner, newOwner, block.timestamp);
    }

    /**
     * @notice 撤銷 SBT（違規處置）
     * @param referenceId 原 TWID reference
     * @param reason      撤銷原因（上鏈記錄）
     */
    function revoke(
        bytes32         referenceId,
        string calldata reason
    ) external onlyRole(OPERATOR_ROLE) {
        require(referenceId != bytes32(0), "invalid referenceId");

        address owner   = referenceToWallet[referenceId];
        require(owner != address(0), "identity not found");

        uint256 tokenId = walletToTokenId[owner];
        require(tokenId != 0, "token not found");

        emit IdentityRevoked(tokenId, owner, reason, block.timestamp);

        // 清除索引
        walletToTokenId[owner]           = 0;
        referenceToWallet[referenceId]   = address(0);

        _burn(tokenId);
    }

    // --------------------------------------------------------
    // View
    // --------------------------------------------------------

    function isVerified(address wallet) external view returns (bool) {
        return walletToTokenId[wallet] != 0;
    }

    function getIdentityByWallet(address wallet) external view returns (IdentityInfo memory) {
        uint256 tokenId = walletToTokenId[wallet];
        require(tokenId != 0, "no identity token");
        return identities[tokenId];
    }

    function getIdentityByToken(uint256 tokenId) external view returns (IdentityInfo memory) {
        return identities[tokenId];
    }

    // --------------------------------------------------------
    // supportsInterface（ERC721 + AccessControl）
    // --------------------------------------------------------
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
