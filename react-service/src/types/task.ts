export type TaskStatus =
    | "OPEN"
    | "IN_PROGRESS"
    | "SUBMITTED"
    | "APPROVED"
    | "CANCELLED"
    | "COMPLETED";

// Backend still returns the legacy task-shaped record.
// In the current housing-platform UI this record temporarily carries both:
// 1. listing/base content fields
// 2. mandate/case workflow flags
// Keep this file as the compatibility layer until listing/case are split server-side.

export interface CreateTaskPayload {
    title: string;
    description: string;
    priority: string;
    dueDate: string | null;
    rewardAmount?: string;
    status?: TaskStatus;
    paymentAssetType?: "NATIVE" | "ERC20";
    paymentTokenAddress?: string | null;
    paymentTokenSymbol?: string;
    paymentTokenDecimals?: number;
}


export interface UpdateTaskPayload {
    title: string;
    description: string;
    priority: string;
    dueDate: string | null;
    status?: TaskStatus;
}

export interface Task {
    id: number;
    taskId: string;
    walletAddress: string;
    assigneeWalletAddress?: string | null;
    title: string;
    description: string;
    status: TaskStatus;
    priority: string;
    rewardAmount: string;
    feeBps: number;

    paymentAssetType: "NATIVE" | "ERC20";
    paymentTokenAddress?: string | null;
    paymentTokenSymbol: string;
    paymentTokenDecimals: number;

    onchainStatus: string;
    fundTxHash?: string | null;
    approveTxHash?: string | null;
    claimTxHash?: string | null;
    cancelTxHash?: string | null;
    dueDate?: string | null;
    createdAt: string;
    updatedAt: string;
    isOwner: boolean;
    isAssignee: boolean;
    canEdit: boolean;
    canCancel: boolean;
    canAccept: boolean;
    canSubmit: boolean;
    canApprove: boolean;
    canClaim: boolean;
    canClaimOnchain: boolean;
    canFund: boolean;
}

export type TaskListResponse = {
    success: boolean;
    data: Task[];
    message: string;
};

export type TaskDetailResponse = {
    success: boolean;
    data: Task;
    message: string;
};
