import type { Task, TaskDetailResponse, TaskListResponse } from "../types/task";

const API_BASE_URL =
    import.meta.env.VITE_API_GO_SERVICE_URL || "http://localhost:8081/api";

export type CreateTaskPayload = {
    title: string;
    description: string;
    priority: string;
    dueDate: string | null;
    rewardAmount?: string;
    paymentAssetType?: "NATIVE" | "ERC20";
    paymentTokenAddress?: string | null;
    paymentTokenSymbol?: string;
    paymentTokenDecimals?: number;
};

export type UpdateTaskPayload = {
    title: string;
    description: string;
    priority: string;
    dueDate: string | null;
};

export async function getTask(id: number): Promise<Task> {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
        method: "GET",
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch task: ${response.status}`);
    }

    const result: TaskDetailResponse = await response.json();

    if (!result.success) {
        throw new Error(result.message || "Failed to fetch task");
    }

    return result.data;
}

export async function getTasks(): Promise<Task[]> {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
        method: "GET",
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.status}`);
    }

    const result: TaskListResponse = await response.json();

    if (!result.success) {
        throw new Error(result.message || "Failed to fetch tasks");
    }

    return result.data;
}

export async function createTask(payload: CreateTaskPayload): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
            title: payload.title,
            description: payload.description,
            priority: payload.priority,
            dueDate: payload.dueDate,
            rewardAmount: payload.rewardAmount ?? "0",
            paymentAssetType: payload.paymentAssetType ?? "NATIVE",
            paymentTokenAddress: payload.paymentTokenAddress ?? null,
            paymentTokenSymbol: payload.paymentTokenSymbol ?? "ETH",
            paymentTokenDecimals: payload.paymentTokenDecimals ?? 18,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to create task: ${response.status}`);
    }
}

export async function updateTask(id: number, payload: UpdateTaskPayload): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Failed to update task: ${response.status}`);
    }
}

export async function cancelTask(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}/cancel`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(`Failed to cancel task: ${response.status}`);
    }
}

export async function acceptTask(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}/accept`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
    });

    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Failed to accept task: ${response.status}`);
    }
}

export type SubmitTaskPayload = {
    resultContent: string;
    resultFileUrl?: string;
    resultHash?: string;
};

export async function submitTask(id: number, payload: SubmitTaskPayload): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}/submissions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
            resultContent: payload.resultContent,
            resultFileUrl: payload.resultFileUrl ?? "",
            resultHash: payload.resultHash ?? "",
        }),
    });

    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Failed to submit task: ${response.status}`);
    }
}

export async function approveTask(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}/approve`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
    });

    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || `Failed to approve task: ${response.status}`);
    }
}

export async function claimReward(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}/claim`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(`Failed to claim reward: ${response.status}`);
    }
}

export type BlockchainLog = {
    id: number;
    taskId: string;
    walletAddress: string;
    action: string;
    txHash: string;
    chainId: number;
    contractAddress: string;
    status: string;
    createdAt: string;
};

export async function getBlockchainLogs(): Promise<BlockchainLog[]> {
    const response = await fetch(`${API_BASE_URL}/blockchain-logs`, {
        method: "GET",
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch blockchain logs: ${response.status}`);
    }

    const result: { success: boolean; data: BlockchainLog[]; message: string } = await response.json();

    if (!result.success) {
        throw new Error(result.message || "Failed to fetch blockchain logs");
    }

    return result.data;
}
