// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract TaskRewardVaultERC20 is AccessControl {
    bytes32 public constant OPERATOR_ROLE  = keccak256("OPERATOR_ROLE");
    bytes32 public constant TREASURY_ROLE  = keccak256("TREASURY_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    uint256 public immutable feeBps;
    address public feeTreasury;

    enum TaskEscrowStatus {
        NONE,
        FUNDED,
        ASSIGNED,
        APPROVED,
        CLAIMED,
        REFUNDED
    }

    struct TaskEscrowERC20 {
        bytes32 taskId;
        address poster;
        address worker;
        address token;
        uint256 rewardAmount;
        uint256 platformFee;
        uint256 workerAmount;
        TaskEscrowStatus status;
        bool exists;
    }

    mapping(bytes32 => TaskEscrowERC20) public tasks;
    mapping(address => uint256) public accumulatedFeesByToken;

    event TaskFunded(bytes32 indexed taskId, address indexed poster, address indexed token, uint256 rewardAmount);
    event WorkerAssigned(bytes32 indexed taskId, address indexed worker);
    event TaskApproved(bytes32 indexed taskId);
    event RewardClaimed(bytes32 indexed taskId, address indexed worker, address indexed token, uint256 workerAmount, uint256 platformFee);
    event TaskRefunded(bytes32 indexed taskId, address indexed poster, address indexed token, uint256 amount);
    event PlatformFeesWithdrawn(address indexed token, address indexed to, uint256 amount);
    event EmergencyWithdrawToken(address indexed token, address indexed to, uint256 amount);

    constructor(
        address admin,
        address operator,
        address treasury,
        uint256 _feeBps
    ) {
        require(admin != address(0), "invalid admin");
        require(operator != address(0), "invalid operator");
        require(treasury != address(0), "invalid treasury");
        require(_feeBps <= 1000, "fee too high");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE,  operator);
        _grantRole(TREASURY_ROLE,  treasury);
        _grantRole(EMERGENCY_ROLE, admin);

        feeTreasury = treasury;
        feeBps = _feeBps;
    }

    function fundTask(bytes32 taskId, address token, uint256 amount, address poster) external {
        require(taskId != bytes32(0), "invalid taskId");
        require(token != address(0), "invalid token");
        require(amount > 0, "reward required");
        require(poster != address(0), "invalid poster");
        require(!tasks[taskId].exists, "task exists");

        uint256 platformFee = (amount * feeBps) / 10000;
        uint256 workerAmount = amount - platformFee;

        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "transferFrom failed");

        tasks[taskId] = TaskEscrowERC20({
            taskId: taskId,
            poster: poster,
            worker: address(0),
            token: token,
            rewardAmount: amount,
            platformFee: platformFee,
            workerAmount: workerAmount,
            status: TaskEscrowStatus.FUNDED,
            exists: true
        });

        emit TaskFunded(taskId, poster, token, amount);
    }

    function assignWorker(bytes32 taskId, address worker) external onlyRole(OPERATOR_ROLE) {
        TaskEscrowERC20 storage task = tasks[taskId];
        require(task.exists, "task not found");
        require(task.status == TaskEscrowStatus.FUNDED, "invalid status");
        require(worker != address(0), "invalid worker");

        task.worker = worker;
        task.status = TaskEscrowStatus.ASSIGNED;

        emit WorkerAssigned(taskId, worker);
    }

    function approveTask(bytes32 taskId) external onlyRole(OPERATOR_ROLE) {
        TaskEscrowERC20 storage task = tasks[taskId];
        require(task.exists, "task not found");
        require(task.status == TaskEscrowStatus.ASSIGNED, "invalid status");
        require(task.worker != address(0), "worker not assigned");

        task.status = TaskEscrowStatus.APPROVED;

        emit TaskApproved(taskId);
    }

    function claimReward(bytes32 taskId) external {
        TaskEscrowERC20 storage task = tasks[taskId];
        require(task.exists, "task not found");
        require(task.status == TaskEscrowStatus.APPROVED, "invalid status");
        require(task.worker == msg.sender, "not worker");

        task.status = TaskEscrowStatus.CLAIMED;
        accumulatedFeesByToken[task.token] += task.platformFee;

        require(IERC20(task.token).transfer(task.worker, task.workerAmount), "worker transfer failed");

        emit RewardClaimed(taskId, task.worker, task.token, task.workerAmount, task.platformFee);
    }

    function refundTask(bytes32 taskId) external onlyRole(OPERATOR_ROLE) {
        TaskEscrowERC20 storage task = tasks[taskId];
        require(task.exists, "task not found");
        require(task.status == TaskEscrowStatus.FUNDED, "only funded task refundable");

        task.status = TaskEscrowStatus.REFUNDED;
        require(IERC20(task.token).transfer(task.poster, task.rewardAmount), "refund failed");

        emit TaskRefunded(taskId, task.poster, task.token, task.rewardAmount);
    }

    function withdrawPlatformFees(address token, address to, uint256 amount) external onlyRole(TREASURY_ROLE) {
        require(token != address(0), "invalid token");
        require(to != address(0), "invalid to");
        require(amount > 0, "invalid amount");
        require(amount <= accumulatedFeesByToken[token], "insufficient fees");

        accumulatedFeesByToken[token] -= amount;
        require(IERC20(token).transfer(to, amount), "withdraw failed");

        emit PlatformFeesWithdrawn(token, to, amount);
    }

    /**
     * @notice 緊急提領：將合約內指定 token 的全部餘額轉至指定地址
     * @dev 僅限 DEFAULT_ADMIN_ROLE，用於合約升級、意外轉入的 token 救援等緊急情境
     *      ⚠️ 此函式會提走指定 token 的全部餘額（包含鎖倉中的任務資金），謹慎使用
     * @param token 要提領的 ERC20 token 合約地址
     * @param to    提領目標地址
     */
    function emergencyWithdrawToken(address token, address to) external onlyRole(EMERGENCY_ROLE) {
        require(token != address(0), "invalid token");
        require(to != address(0), "invalid to");

        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "nothing to withdraw");

        // 重置此 token 的累計手續費，避免狀態不一致
        accumulatedFeesByToken[token] = 0;

        require(IERC20(token).transfer(to, balance), "emergency withdraw failed");

        emit EmergencyWithdrawToken(token, to, balance);
    }
}