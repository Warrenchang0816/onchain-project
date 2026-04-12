export const taskRewardVaultAbi = [
    {
        type: "function",
        name: "createAndFundTask",
        stateMutability: "payable",
        inputs: [
            { name: "taskId", type: "bytes32" },
            { name: "poster", type: "address" },
        ],
        outputs: [],
    },
    {
        type: "function",
        name: "claimReward",
        stateMutability: "nonpayable",
        inputs: [{ name: "taskId", type: "bytes32" }],
        outputs: [],
    },
    {
        type: "function",
        name: "getTask",
        stateMutability: "view",
        inputs: [{ name: "taskId", type: "bytes32" }],
        outputs: [
            {
                type: "tuple",
                components: [
                    { name: "taskId", type: "bytes32" },
                    { name: "poster", type: "address" },
                    { name: "worker", type: "address" },
                    { name: "rewardAmount", type: "uint256" },
                    { name: "platformFee", type: "uint256" },
                    { name: "workerAmount", type: "uint256" },
                    { name: "status", type: "uint8" },
                    { name: "exists", type: "bool" },
                ],
            },
        ],
    },
] as const;