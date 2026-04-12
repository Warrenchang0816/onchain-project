// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract TaskRewardVault is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    uint256 public immutable feeBps;
    address public feeTreasury;
    uint256 public accumulatedFees;

    enum TaskEscrowStatus {
        NONE,
        FUNDED,
        ASSIGNED,
        APPROVED,
        CLAIMED,
        REFUNDED
    }

    struct TaskEscrow {
        bytes32 taskId;
        address poster;
        address worker;
        uint256 rewardAmount;
        uint256 platformFee;
        uint256 workerAmount;
        TaskEscrowStatus status;
        bool exists;
    }

    mapping(bytes32 => TaskEscrow) public tasks;

    event TaskFunded(bytes32 indexed taskId, address indexed poster, uint256 rewardAmount);
    event WorkerAssigned(bytes32 indexed taskId, address indexed worker);
    event TaskApproved(bytes32 indexed taskId);
    event RewardClaimed(bytes32 indexed taskId, address indexed worker, uint256 workerAmount, uint256 platformFee);
    event TaskRefunded(bytes32 indexed taskId, address indexed poster, uint256 amount);
    event PlatformFeesWithdrawn(address indexed to, uint256 amount);

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
        _grantRole(OPERATOR_ROLE, operator);
        _grantRole(TREASURY_ROLE, treasury);

        feeTreasury = treasury;
        feeBps = _feeBps;
    }

    function createAndFundTask(bytes32 taskId, address poster) external payable {
        require(taskId != bytes32(0), "invalid taskId");
        require(poster != address(0), "invalid poster");
        require(msg.value > 0, "reward required");
        require(!tasks[taskId].exists, "task exists");

        uint256 platformFee = (msg.value * feeBps) / 10000;
        uint256 workerAmount = msg.value - platformFee;

        tasks[taskId] = TaskEscrow({
            taskId: taskId,
            poster: poster,
            worker: address(0),
            rewardAmount: msg.value,
            platformFee: platformFee,
            workerAmount: workerAmount,
            status: TaskEscrowStatus.FUNDED,
            exists: true
        });

        emit TaskFunded(taskId, poster, msg.value);
    }

    function assignWorker(bytes32 taskId, address worker) external onlyRole(OPERATOR_ROLE) {
        TaskEscrow storage task = tasks[taskId];
        require(task.exists, "task not found");
        require(task.status == TaskEscrowStatus.FUNDED, "invalid status");
        require(worker != address(0), "invalid worker");

        task.worker = worker;
        task.status = TaskEscrowStatus.ASSIGNED;

        emit WorkerAssigned(taskId, worker);
    }

    function approveTask(bytes32 taskId) external onlyRole(OPERATOR_ROLE) {
        TaskEscrow storage task = tasks[taskId];
        require(task.exists, "task not found");
        require(task.status == TaskEscrowStatus.ASSIGNED, "invalid status");
        require(task.worker != address(0), "worker not assigned");

        task.status = TaskEscrowStatus.APPROVED;

        emit TaskApproved(taskId);
    }

    function claimReward(bytes32 taskId) external {
        TaskEscrow storage task = tasks[taskId];
        require(task.exists, "task not found");
        require(task.status == TaskEscrowStatus.APPROVED, "invalid status");
        require(task.worker == msg.sender, "not worker");

        uint256 workerAmount = task.workerAmount;
        uint256 platformFee = task.platformFee;

        task.status = TaskEscrowStatus.CLAIMED;
        accumulatedFees += platformFee;

        (bool success, ) = payable(task.worker).call{value: workerAmount}("");
        require(success, "worker transfer failed");

        emit RewardClaimed(taskId, task.worker, workerAmount, platformFee);
    }

    function refundTask(bytes32 taskId) external onlyRole(OPERATOR_ROLE) {
        TaskEscrow storage task = tasks[taskId];
        require(task.exists, "task not found");
        require(task.status == TaskEscrowStatus.FUNDED, "only funded task refundable");

        uint256 refundAmount = task.rewardAmount;
        address poster = task.poster;

        task.status = TaskEscrowStatus.REFUNDED;

        (bool success, ) = payable(poster).call{value: refundAmount}("");
        require(success, "refund failed");

        emit TaskRefunded(taskId, poster, refundAmount);
    }

    function withdrawPlatformFees(address to, uint256 amount) external onlyRole(TREASURY_ROLE) {
        require(to != address(0), "invalid to");
        require(amount > 0, "invalid amount");
        require(amount <= accumulatedFees, "insufficient fees");

        accumulatedFees -= amount;

        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "withdraw failed");

        emit PlatformFeesWithdrawn(to, amount);
    }

    function getTask(bytes32 taskId) external view returns (TaskEscrow memory) {
        return tasks[taskId];
    }
}