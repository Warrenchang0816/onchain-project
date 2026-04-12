import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    getTask,
    submitTask,
    updateTask,
    cancelTask,
    acceptTask,
    approveTask,
    claimReward,
    type UpdateTaskPayload,
    type SubmitTaskPayload,
} from "../api/taskApi";
import { getAuthMe } from "../api/authApi";
import type { Task } from "../types/task";
import { useAccount } from "wagmi";

import AppButton from "../components/common/AppButton";
import AppModal from "../components/common/AppModal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import PageLoading from "../components/common/PageLoading";
import TaskForm from "../components/task/TaskForm";
import TaskSubmitModal from "../components/task/TaskSubmitModal";
import FundTaskButton from "../components/task/FundTaskButton";
import ClaimOnchainButton from "../components/task/ClaimOnchainButton";
import AppLayout from "../layouts/AppLayout";

type TaskActionType = "cancel" | "accept" | "approve" | "claim";

const PRIORITY_LABEL: Record<string, string> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    URGENT: "Urgent",
};

const ONCHAIN_STATUS_LABEL: Record<string, string> = {
    NOT_FUNDED: "Not Funded",
    FUNDED: "Funded",
    ASSIGNED: "Assigned",
    APPROVED: "Approved",
    CLAIMED: "Claimed",
};

const TaskDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [task, setTask] = useState<Task | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

    const [successMessage, setSuccessMessage] = useState<string>("");
    const [errorMessage, setErrorMessage] = useState<string>("");

    const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

    const [isActionDialogOpen, setIsActionDialogOpen] = useState<boolean>(false);
    const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
    const [pendingActionType, setPendingActionType] = useState<TaskActionType | null>(null);

    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);

    const { address, isConnected } = useAccount();

    const canOperateTasks = Boolean(isAuthenticated && isConnected && address);

    const taskId = id ? parseInt(id, 10) : NaN;

    const loadTask = async () => {
        if (isNaN(taskId)) {
            setErrorMessage("Invalid task ID.");
            setIsLoading(false);
            return;
        }

        try {
            setErrorMessage("");
            setIsLoading(true);
            const data = await getTask(taskId);
            setTask(data);
            
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to load task.",
            );
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const fetchInitial = async () => {
            if (isNaN(taskId)) {
                setErrorMessage("Invalid task ID.");
                setIsLoading(false);
                setIsAuthLoading(false);
                return;
            }

            await Promise.all([
                (async () => {
                    try {
                        setErrorMessage("");
                        setIsLoading(true);
                        const data = await getTask(taskId);
                        setTask(data);
                    } catch (error) {
                        setErrorMessage(
                            error instanceof Error ? error.message : "Failed to load task.",
                        );
                    } finally {
                        setIsLoading(false);
                    }
                })(),
                (async () => {
                    try {
                        setIsAuthLoading(true);
                        const authMe = await getAuthMe();
                        setIsAuthenticated(authMe.authenticated);
                    } catch {
                        setIsAuthenticated(false);
                    } finally {
                        setIsAuthLoading(false);
                    }
                })(),
            ]);
        };

        void fetchInitial();
    }, [taskId]);

    const openActionDialog = (actionType: TaskActionType) => {
        if (!canOperateTasks) return;
        setPendingActionType(actionType);
        setIsActionDialogOpen(true);
    };

    const closeActionDialog = () => {
        setPendingActionType(null);
        setIsActionDialogOpen(false);
        setIsActionLoading(false);
    };

    const handleActionConfirm = async () => {
        if (!task || !pendingActionType) return;

        try {
            setErrorMessage("");
            setIsActionLoading(true);

            if (pendingActionType === "cancel") {
                await cancelTask(task.id);
                setSuccessMessage("Task cancelled successfully.");
            } else if (pendingActionType === "accept") {
                await acceptTask(task.id);
                setSuccessMessage("Task accepted successfully.");
            } else if (pendingActionType === "approve") {
                await approveTask(task.id);
                setSuccessMessage("Task approved successfully.");
            } else if (pendingActionType === "claim") {
                await claimReward(task.id);
                setSuccessMessage("Reward claimed successfully.");
            }

            await loadTask();
            closeActionDialog();
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to process action.",
            );
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleEditSubmit = async (payload: UpdateTaskPayload) => {
        if (!task) return;

        try {
            setErrorMessage("");
            await updateTask(task.id, payload as UpdateTaskPayload);
            setSuccessMessage("Task updated successfully.");
            setIsEditModalOpen(false);
            await loadTask();
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to update task.",
            );
        }
    };

    const handleSubmitConfirm = async (payload: SubmitTaskPayload) => {
        if (!task) return;

        try {
            setErrorMessage("");
            await submitTask(task.id, payload);
            setSuccessMessage("Task submitted successfully.");
            setIsSubmitModalOpen(false);
            await loadTask();
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to submit task.",
            );
        }
    };

    const actionDialogTitle =
        pendingActionType === "cancel" ? "Cancel Task"
        : pendingActionType === "accept" ? "Accept Task"
        : pendingActionType === "approve" ? "Approve Task"
        : "Claim Reward";

    const actionDialogDescription =
        pendingActionType === "cancel" ? "Are you sure you want to cancel this task?"
        : pendingActionType === "accept" ? "Are you sure you want to accept this task?"
        : pendingActionType === "approve" ? "Are you sure you want to approve this task?"
        : "Are you sure you want to claim this reward?";

    return (
        <AppLayout>
            <section className="page-section">
                <div className="page-heading page-heading-row">
                    <div>
                        <AppButton
                            type="button"
                            variant="secondary"
                            onClick={() => navigate("/tasks")}
                        >
                            ← Back to Tasks
                        </AppButton>
                    </div>
                </div>

                {successMessage && (
                    <div className="feedback-banner success-banner">
                        <p>{successMessage}</p>
                    </div>
                )}

                {errorMessage && (
                    <div className="feedback-banner error-banner">
                        <p>{errorMessage}</p>
                    </div>
                )}

                {!isLoading && !isAuthLoading && task &&
                    task.status === "SUBMITTED" &&
                    task.isOwner &&
                    !task.canApprove &&
                    Number(task.rewardAmount) > 0 && (
                    <div className="feedback-banner warning-banner">
                        <p>
                            此任務有獎勵金（{task.rewardAmount} {task.paymentTokenSymbol || "ETH"}）
                            {task.onchainStatus === "NOT_FUNDED" && " ① 點 Fund 完成鏈上付款 → ② 等待 Assignee 重新接受任務（鏈上 Assign）"}
                            {task.onchainStatus === "FUNDED" && " 等待 Assignee 重新接受任務（鏈上 Assign）"}
                        </p>
                    </div>
                )}

                {isLoading || isAuthLoading ? (
                    <PageLoading message="Loading task..." />
                ) : !task ? (
                    <p>Task not found.</p>
                ) : (
                    <div className="task-detail">
                        <div className="task-detail-header">
                            <h1>{task.title}</h1>
                            <div className="task-detail-badges">
                                <span className={`task-status ${task.status.toLowerCase().replace("_", "-")}`}>
                                    {task.status}
                                </span>
                                <span className="task-onchain-badge">
                                    {ONCHAIN_STATUS_LABEL[task.onchainStatus] ?? task.onchainStatus}
                                </span>
                            </div>
                        </div>

                        <div className="task-detail-body">
                            <p className="task-detail-description">{task.description}</p>

                            <dl className="task-detail-meta">
                                <dt>Priority</dt>
                                <dd>{PRIORITY_LABEL[task.priority] ?? task.priority}</dd>

                                <dt>Reward</dt>
                                <dd>
                                    {task.rewardAmount} {task.paymentTokenSymbol || "ETH"}
                                </dd>

                                <dt>Owner</dt>
                                <dd className="task-detail-address">{task.walletAddress}</dd>

                                {task.assigneeWalletAddress && (
                                    <>
                                        <dt>Assignee</dt>
                                        <dd className="task-detail-address">{task.assigneeWalletAddress}</dd>
                                    </>
                                )}

                                {task.dueDate && (
                                    <>
                                        <dt>Due Date</dt>
                                        <dd>{new Date(task.dueDate).toLocaleDateString()}</dd>
                                    </>
                                )}

                                <dt>Created</dt>
                                <dd>{new Date(task.createdAt).toLocaleString()}</dd>

                                {task.fundTxHash && (
                                    <>
                                        <dt>Fund Tx</dt>
                                        <dd className="task-detail-address">{task.fundTxHash}</dd>
                                    </>
                                )}
                                {task.approveTxHash && (
                                    <>
                                        <dt>Approve Tx</dt>
                                        <dd className="task-detail-address">{task.approveTxHash}</dd>
                                    </>
                                )}
                                {task.claimTxHash && (
                                    <>
                                        <dt>Claim Tx</dt>
                                        <dd className="task-detail-address">{task.claimTxHash}</dd>
                                    </>
                                )}
                                {task.cancelTxHash && (
                                    <>
                                        <dt>Cancel Tx</dt>
                                        <dd className="task-detail-address">{task.cancelTxHash}</dd>
                                    </>
                                )}
                            </dl>
                        </div>

                        {canOperateTasks && (
                            <div className="task-detail-actions">
                                
                                {canOperateTasks &&
                                    task.paymentAssetType === "ERC20" &&
                                    task.isOwner &&
                                    task.onchainStatus === "NOT_FUNDED" &&
                                    Number(task.rewardAmount) > 0 && (
                                    <div className="feedback-banner warning-banner">
                                        <p>
                                            此任務使用 {task.paymentTokenSymbol} 作為獎勵資產，ERC20 funding flow 尚在接入中，
                                            目前不可使用原本的 ETH Fund 流程。
                                        </p>
                                    </div>
                                )}

                                {task.canEdit && (
                                    <AppButton
                                        type="button"
                                        variant="secondary"
                                        onClick={() => setIsEditModalOpen(true)}
                                    >
                                        Edit
                                    </AppButton>
                                )}
                                {task.canCancel && (
                                    <AppButton
                                        type="button"
                                        variant="secondary"
                                        onClick={() => openActionDialog("cancel")}
                                    >
                                        Cancel
                                    </AppButton>
                                )}
                                {task.canAccept && (
                                    <AppButton
                                        type="button"
                                        onClick={() => openActionDialog("accept")}
                                    >
                                        Accept
                                    </AppButton>
                                )}
                                {task.canSubmit && (
                                    <AppButton
                                        type="button"
                                        onClick={() => setIsSubmitModalOpen(true)}
                                    >
                                        Submit
                                    </AppButton>
                                )}
                                {task.canApprove && (
                                    <AppButton
                                        type="button"
                                        onClick={() => openActionDialog("approve")}
                                    >
                                        Approve
                                    </AppButton>
                                )}
                                {task.canClaim && !task.canClaimOnchain && (
                                    <AppButton
                                        type="button"
                                        onClick={() => openActionDialog("claim")}
                                    >
                                        Claim
                                    </AppButton>
                                )}
                                <FundTaskButton task={task} onSuccess={loadTask} />
                                <ClaimOnchainButton task={task} onSuccess={loadTask} />
                            </div>
                        )}
                    </div>
                )}
            </section>

            <AppModal
                isOpen={isEditModalOpen}
                title="Edit Task"
                onClose={() => setIsEditModalOpen(false)}
            >
                <TaskForm
                    mode="edit"
                    initialTask={task}
                    onSubmit={handleEditSubmit}
                    onCancel={() => setIsEditModalOpen(false)}
                />
            </AppModal>

            <ConfirmDialog
                isOpen={isActionDialogOpen}
                title={actionDialogTitle}
                description={actionDialogDescription}
                confirmText={actionDialogTitle}
                cancelText="Back"
                isLoading={isActionLoading}
                onConfirm={handleActionConfirm}
                onCancel={closeActionDialog}
            />

            <TaskSubmitModal
                isOpen={isSubmitModalOpen}
                onSubmit={handleSubmitConfirm}
                onCancel={() => setIsSubmitModalOpen(false)}
            />
        </AppLayout>
    );
};

export default TaskDetailPage;
