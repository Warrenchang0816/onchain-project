// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ListingStakeVault
 * @notice 可信房屋媒合平台 — 刊登行為押金（Stake）與服務費（Fee）管理
 *
 * 設計原則：
 *   - 支援 ETH 與白名單 ERC20（USDC、USDT 等穩定幣）
 *   - address(0) 代表 ETH，其餘為 ERC20 token 地址
 *   - 刊登者直接呼叫 createListing() 鎖倉押金（On-chain 可驗）
 *   - 服務費由案件雙方直接呼叫 payServiceFee() 上鏈支付（透明可追溯）
 *   - OPERATOR 控制釋放 / 沒收
 *   - TREASURY 提領累積款項
 *
 * 角色：
 *   DEFAULT_ADMIN_ROLE — OZ 角色管理機制（不用於業務操作）
 *   EMERGENCY_ROLE      — 緊急操作專用冷錢包（合約升級/緊急提領）
 *   OPERATOR_ROLE      — 平台後端（控制釋放 / 沒收）
 *   TREASURY_ROLE      — 財務帳戶（提領累積款項）
 *
 * 押金流程：
 *   createListing(token=0, amount=0) + msg.value → ETH 押金
 *   createListing(token=USDC, amount=N)          → USDC 押金
 *   releaseStake()  → OPERATOR：正常結案，退還押金
 *   slashStake()    → OPERATOR：違規，沒收押金
 *
 * 服務費流程：
 *   payServiceFee() → 案件雙方直接上鏈支付（ETH 或白名單 token）
 *   withdrawPlatformFees(token) → TREASURY 提領
 *   withdrawSlashedFunds(token) → TREASURY 提領
 */
contract ListingStakeVault is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE  = keccak256("OPERATOR_ROLE");
    bytes32 public constant TREASURY_ROLE  = keccak256("TREASURY_ROLE");
    // 合約層緊急操作專用（冷錢包持有，正常情況不使用）
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // 平台支援的支付幣種（建構時固定，不可動態修改）
    // address(0) = ETH；其餘為穩定幣合約地址
    address public immutable USDC;  // 0x0 表示「不支援」
    address public immutable USDT;  // 0x0 表示「不支援」

    // 各 token 累積的服務費
    mapping(address => uint256) public accumulatedFeesByToken;
    // 各 token 累積的沒收押金
    mapping(address => uint256) public accumulatedSlashByToken;

    enum ListingStatus {
        NONE,
        ACTIVE,   // 刊登中，押金鎖倉
        CLOSED,   // 正常結案，押金已退還
        SLASHED   // 違規，押金已沒收
    }

    struct ListingStake {
        bytes32       listingId;
        bytes32       propertyId;
        address       staker;       // 刊登者（屋主或授權仲介）
        address       token;        // address(0) = ETH
        uint256       stakeAmount;  // 押金金額
        ListingStatus status;
        uint256       createdAt;
        bool          exists;
    }

    mapping(bytes32 => ListingStake) public listings;

    // --------------------------------------------------------
    // Events
    // --------------------------------------------------------
    event ListingCreated(
        bytes32 indexed listingId,
        bytes32 indexed propertyId,
        address indexed staker,
        address token,
        uint256 stakeAmount
    );
    event StakeReleased(
        bytes32 indexed listingId,
        address indexed staker,
        address token,
        uint256 amount
    );
    event StakeSlashed(
        bytes32 indexed listingId,
        address indexed staker,
        address token,
        uint256 amount,
        string reason
    );
    event ServiceFeePaid(
        bytes32 indexed caseId,
        address indexed payer,
        address token,
        uint256 amount
    );
    event PlatformFeesWithdrawn(address indexed token, address indexed to, uint256 amount);
    event SlashedFundsWithdrawn(address indexed token, address indexed to, uint256 amount);
    event EmergencyWithdrawETH(address indexed to, uint256 amount);
    event EmergencyWithdrawToken(address indexed token, address indexed to, uint256 amount);

    // --------------------------------------------------------
    // Constructor
    // --------------------------------------------------------
    constructor(
        address admin,
        address operator,
        address treasury,
        address usdc,   // Circle USDC 合約地址；傳 address(0) 表示本平台不支援
        address usdt    // Tether USDT 合約地址；傳 address(0) 表示本平台不支援
    ) {
        require(admin    != address(0), "invalid admin");
        require(operator != address(0), "invalid operator");
        require(treasury != address(0), "invalid treasury");

        _grantRole(DEFAULT_ADMIN_ROLE, admin); // OZ 角色管理機制，不用於業務
        _grantRole(OPERATOR_ROLE,  operator);
        _grantRole(TREASURY_ROLE,  treasury);
        _grantRole(EMERGENCY_ROLE, admin);     // 緊急操作，與 DEFAULT_ADMIN_ROLE 同一地址

        // 支援的穩定幣地址在部署時固定，之後不可更改
        USDC = usdc;
        USDT = usdt;
    }

    // --------------------------------------------------------
    // 刊登者：創建刊登（ETH 或穩定幣）
    // --------------------------------------------------------

    /**
     * @notice ETH 押金上架
     * @param listingId  listing 的 bytes32 ID
     * @param propertyId 對應物件 ID
     */
    function createListing(
        bytes32 listingId,
        bytes32 propertyId
    ) external payable {
        require(listingId  != bytes32(0), "invalid listingId");
        require(propertyId != bytes32(0), "invalid propertyId");
        require(msg.value   > 0,          "ETH stake required");
        require(!listings[listingId].exists, "listing already exists");

        listings[listingId] = ListingStake({
            listingId:   listingId,
            propertyId:  propertyId,
            staker:      msg.sender,
            token:       address(0),
            stakeAmount: msg.value,
            status:      ListingStatus.ACTIVE,
            createdAt:   block.timestamp,
            exists:      true
        });

        emit ListingCreated(listingId, propertyId, msg.sender, address(0), msg.value);
    }

    /**
     * @notice 穩定幣押金上架（USDC 或 USDT）
     * @param listingId  listing 的 bytes32 ID
     * @param propertyId 對應物件 ID
     * @param token      USDC 或 USDT 合約地址
     * @param amount     押金金額（token decimals）
     */
    function createListingWithToken(
        bytes32 listingId,
        bytes32 propertyId,
        address token,
        uint256 amount
    ) external {
        require(listingId  != bytes32(0),  "invalid listingId");
        require(propertyId != bytes32(0),  "invalid propertyId");
        require(token      != address(0),  "use createListing() for ETH");
        require(_isSupportedToken(token),  "token not supported");
        require(amount      > 0,           "stake amount required");
        require(!listings[listingId].exists, "listing already exists");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        listings[listingId] = ListingStake({
            listingId:   listingId,
            propertyId:  propertyId,
            staker:      msg.sender,
            token:       token,
            stakeAmount: amount,
            status:      ListingStatus.ACTIVE,
            createdAt:   block.timestamp,
            exists:      true
        });

        emit ListingCreated(listingId, propertyId, msg.sender, token, amount);
    }

    // --------------------------------------------------------
    // OPERATOR：押金操作
    // --------------------------------------------------------

    /**
     * @notice 正常結案：退還押金給刊登者（自動依 token 類型退還）
     */
    function releaseStake(bytes32 listingId) external onlyRole(OPERATOR_ROLE) {
        ListingStake storage s = listings[listingId];
        require(s.exists,                         "listing not found");
        require(s.status == ListingStatus.ACTIVE, "listing not active");

        address staker = s.staker;
        address token  = s.token;
        uint256 amount = s.stakeAmount;
        s.status = ListingStatus.CLOSED;

        _transfer(token, staker, amount);

        emit StakeReleased(listingId, staker, token, amount);
    }

    /**
     * @notice 違規：沒收押金（假案 / 檢舉成立）
     * @param reason 沒收原因（上鏈記錄，公開可追溯）
     */
    function slashStake(
        bytes32         listingId,
        string calldata reason
    ) external onlyRole(OPERATOR_ROLE) {
        ListingStake storage s = listings[listingId];
        require(s.exists,                         "listing not found");
        require(s.status == ListingStatus.ACTIVE, "listing not active");

        address token  = s.token;
        uint256 amount = s.stakeAmount;
        s.status = ListingStatus.SLASHED;
        accumulatedSlashByToken[token] += amount;

        emit StakeSlashed(listingId, s.staker, token, amount, reason);
    }

    // --------------------------------------------------------
    // 任何人：直接上鏈支付服務費（透明可追溯）
    // --------------------------------------------------------

    /**
     * @notice ETH 支付服務費
     * @param caseId 對應案件 ID
     */
    function payServiceFeeETH(bytes32 caseId) external payable {
        require(caseId    != bytes32(0), "invalid caseId");
        require(msg.value  > 0,          "fee required");

        accumulatedFeesByToken[address(0)] += msg.value;
        emit ServiceFeePaid(caseId, msg.sender, address(0), msg.value);
    }

    /**
     * @notice ERC20 支付服務費（USDC / USDT 等）
     * @param caseId 對應案件 ID
     * @param token  ERC20 token 地址（須在白名單內）
     * @param amount 費用金額
     */
    function payServiceFeeToken(
        bytes32 caseId,
        address token,
        uint256 amount
    ) external {
        require(caseId != bytes32(0),       "invalid caseId");
        require(token  != address(0),       "use payServiceFeeETH() for ETH");
        require(_isSupportedToken(token),   "token not supported");
        require(amount  > 0,                "fee required");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        accumulatedFeesByToken[token] += amount;
        emit ServiceFeePaid(caseId, msg.sender, token, amount);
    }

    // --------------------------------------------------------
    // TREASURY：提領
    // --------------------------------------------------------

    /**
     * @notice 提領服務費
     * @param token  address(0) = ETH；其餘 = ERC20
     * @param to     提領目標地址
     * @param amount 提領金額
     */
    function withdrawPlatformFees(
        address token,
        address to,
        uint256 amount
    ) external onlyRole(TREASURY_ROLE) {
        require(to     != address(0),                   "invalid to");
        require(amount  > 0,                            "invalid amount");
        require(amount <= accumulatedFeesByToken[token], "insufficient fees");

        accumulatedFeesByToken[token] -= amount;
        _transfer(token, to, amount);
        emit PlatformFeesWithdrawn(token, to, amount);
    }

    /**
     * @notice 提領沒收押金
     * @param token  address(0) = ETH；其餘 = ERC20
     * @param to     提領目標地址
     * @param amount 提領金額
     */
    function withdrawSlashedFunds(
        address token,
        address to,
        uint256 amount
    ) external onlyRole(TREASURY_ROLE) {
        require(to     != address(0),                    "invalid to");
        require(amount  > 0,                             "invalid amount");
        require(amount <= accumulatedSlashByToken[token], "insufficient slashed");

        accumulatedSlashByToken[token] -= amount;
        _transfer(token, to, amount);
        emit SlashedFundsWithdrawn(token, to, amount);
    }

    // --------------------------------------------------------
    // ADMIN：緊急提領
    // --------------------------------------------------------

    /**
     * @notice 緊急提領合約內所有 ETH
     * @dev ⚠️ 包含活躍押金，僅限合約升級 / 緊急情境使用
     */
    function emergencyWithdrawETH(address to) external onlyRole(EMERGENCY_ROLE) {
        require(to != address(0), "invalid to");
        uint256 balance = address(this).balance;
        require(balance > 0, "nothing to withdraw");

        accumulatedFeesByToken[address(0)]  = 0;
        accumulatedSlashByToken[address(0)] = 0;

        (bool ok, ) = payable(to).call{value: balance}("");
        require(ok, "emergency withdraw failed");
        emit EmergencyWithdrawETH(to, balance);
    }

    /**
     * @notice 緊急提領合約內指定 ERC20 token 的全部餘額
     * @dev ⚠️ 包含活躍押金，僅限合約升級 / 緊急情境使用
     */
    function emergencyWithdrawToken(
        address token,
        address to
    ) external onlyRole(EMERGENCY_ROLE) {
        require(token != address(0), "use emergencyWithdrawETH for ETH");
        require(to    != address(0), "invalid to");
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "nothing to withdraw");

        accumulatedFeesByToken[token]  = 0;
        accumulatedSlashByToken[token] = 0;

        IERC20(token).safeTransfer(to, balance);
        emit EmergencyWithdrawToken(token, to, balance);
    }

    // --------------------------------------------------------
    // View
    // --------------------------------------------------------

    function getListing(bytes32 listingId) external view returns (ListingStake memory) {
        return listings[listingId];
    }

    function getBalance(address token) external view returns (uint256) {
        if (token == address(0)) return address(this).balance;
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @notice 回傳此合約支援的所有支付幣種
     * @return tokens  支援的 token 地址陣列（address(0) = ETH）
     * @return symbols 對應的符號（前端顯示用）
     */
    function supportedTokens()
        external
        view
        returns (address[] memory tokens, string[] memory symbols)
    {
        uint256 count = 1; // ETH 永遠支援
        if (USDC != address(0)) count++;
        if (USDT != address(0)) count++;

        tokens  = new address[](count);
        symbols = new string[](count);

        uint256 i = 0;
        tokens[i] = address(0); symbols[i] = "ETH"; i++;
        if (USDC != address(0)) { tokens[i] = USDC; symbols[i] = "USDC"; i++; }
        if (USDT != address(0)) { tokens[i] = USDT; symbols[i] = "USDT"; }
    }

    // --------------------------------------------------------
    // Internal
    // --------------------------------------------------------

    /// @dev 判斷 token 是否為平台支援的穩定幣（不含 ETH）
    function _isSupportedToken(address token) internal view returns (bool) {
        return (USDC != address(0) && token == USDC) ||
               (USDT != address(0) && token == USDT);
    }

    function _transfer(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool ok, ) = payable(to).call{value: amount}("");
            require(ok, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
}
