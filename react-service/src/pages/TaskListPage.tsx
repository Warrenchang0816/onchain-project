import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
    getTasks,
    createTask,
    updateTask,
    cancelTask,
    acceptTask,
    submitTask,
    approveTask,
    claimReward,
    type CreateTaskPayload,
    type UpdateTaskPayload,
    type SubmitTaskPayload,
} from "../api/taskApi";
import { getAuthMe } from "../api/authApi";
import type { Task } from "../types/task";
import { useAccount } from "wagmi";

import AppButton from "../components/common/AppButton";
import AppModal from "../components/common/AppModal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import EmptyState from "../components/common/EmptyState";
import FilterTabs from "../components/common/FilterTabs";
import PageLoading from "../components/common/PageLoading";
import TaskCard from "../components/task/TaskCard";
import TaskForm from "../components/task/TaskForm";
import TaskSubmitModal from "../components/task/TaskSubmitModal";
import AppLayout from "../layouts/AppLayout";

interface TaskListPageState {
    successMessage?: string;
}

type TaskFilter = "ALL" | "COMPLETED" | "OPEN";

type TaskModalMode = "create" | "edit";
type TaskActionType = "cancel" | "accept" | "approve" | "claim";

const TASK_FILTER_OPTIONS: { label: string; value: TaskFilter }[] = [
    { label: "All", value: "ALL" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Pending", value: "OPEN" },
];



const TaskListPage = () => {
    const location = useLocation();
    const pageState = location.state as TaskListPageState | null;

    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

    const [filter, setFilter] = useState<TaskFilter>("ALL");
    const [successMessage, setSuccessMessage] = useState<string>(
        pageState?.successMessage ?? "",
    );
    const [errorMessage, setErrorMessage] = useState<string>("");

    const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
    const [taskModalMode, setTaskModalMode] = useState<TaskModalMode>("create");
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const [isActionDialogOpen, setIsActionDialogOpen] = useState<boolean>(false);
    const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
    const [taskPendingAction, setTaskPendingAction] = useState<Task | null>(null);
    const [pendingActionType, setPendingActionType] = useState<TaskActionType | null>(null);

    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
    const [taskPendingSubmit, setTaskPendingSubmit] = useState<Task | null>(null);

    const { address, isConnected } = useAccount();

    const canOperateTasks = Boolean(isAuthenticated && isConnected && address);

    const loadTasks = async () => {
        try {
            setErrorMessage("");
            setIsLoading(true);

            const data = await getTasks();
            console.log("tasks", data);
            setTasks(data);
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to load tasks.",
            );
        } finally {
            setIsLoading(false);
        }
    };

    const loadAuthStatus = async () => {
        try {
            setIsAuthLoading(true);
            const authMe = await getAuthMe();
            setIsAuthenticated(authMe.authenticated);
        } catch {
            setIsAuthenticated(false);
        } finally {
            setIsAuthLoading(false);
        }
    };

    useEffect(() => {
        void Promise.all([loadTasks(), loadAuthStatus()]);
    }, []);

    const filteredTasks = useMemo(() => {
        if (filter === "ALL") {
            return tasks;
        }

        if (filter === "COMPLETED") {
            return tasks.filter((task) => task.status === "COMPLETED");
        }

        return tasks.filter((task) =>
            ["OPEN", "IN_PROGRESS", "SUBMITTED", "APPROVED"].includes(task.status),
        );
    }, [tasks, filter]);

    const openCreateModal = () => {
        if (!canOperateTasks) {
            return;
        }

        setTaskModalMode("create");
        setSelectedTask(null);
        setIsTaskModalOpen(true);
    };

    const openEditModal = (task: Task) => {
        if (!canOperateTasks) {
            return;
        }

        setTaskModalMode("edit");
        setSelectedTask(task);
        setIsTaskModalOpen(true);
    };

    const closeTaskModal = () => {
        setIsTaskModalOpen(false);
        setSelectedTask(null);
    };

    const openActionDialog = (task: Task, actionType: TaskActionType) => {
        if (!canOperateTasks) {
            return;
        }

        setTaskPendingAction(task);
        setPendingActionType(actionType);
        setIsActionDialogOpen(true);
    };

    const closeActionDialog = () => {
        setTaskPendingAction(null);
        setPendingActionType(null);
        setIsActionDialogOpen(false);
        setIsActionLoading(false);
    };

    const handleTaskSubmit = async (
        payload: CreateTaskPayload | UpdateTaskPayload,
    ) => {
        try {
            setErrorMessage("");

            if (taskModalMode === "create") {
                await createTask(payload as CreateTaskPayload);
                await loadTasks();
                setSuccessMessage("Task created successfully.");
                closeTaskModal();
                return;
            }

            if (!selectedTask) {
                return;
            }

            await updateTask(selectedTask.id, payload as UpdateTaskPayload);
            await loadTasks();
            setSuccessMessage("Task updated successfully.");
            closeTaskModal();
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to submit task.",
            );
        }
    };

    const openSubmitModal = (task: Task) => {
        if (!canOperateTasks) return;
        setTaskPendingSubmit(task);
        setIsSubmitModalOpen(true);
    };

    const closeSubmitModal = () => {
        setTaskPendingSubmit(null);
        setIsSubmitModalOpen(false);
    };

    const handleSubmitConfirm = async (payload: SubmitTaskPayload) => {
        if (!taskPendingSubmit) return;
        try {
            setErrorMessage("");
            await submitTask(taskPendingSubmit.id, payload);
            setSuccessMessage("Task submitted successfully.");
            await loadTasks();
            closeSubmitModal();
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to submit task.",
            );
        }
    };

    const handleActionConfirm = async () => {
        if (!taskPendingAction || !pendingActionType) {
            return;
        }

        try {
            setErrorMessage("");
            setIsActionLoading(true);

            if (pendingActionType === "cancel") {
                await cancelTask(taskPendingAction.id);
                setSuccessMessage("Task cancelled successfully.");
            }

            if (pendingActionType === "accept") {
                await acceptTask(taskPendingAction.id);
                setSuccessMessage("Task accepted successfully.");
            }

            if (pendingActionType === "approve") {
                await approveTask(taskPendingAction.id);
                setSuccessMessage("Task approved successfully.");
            }

            if (pendingActionType === "claim") {
                await claimReward(taskPendingAction.id);
                setSuccessMessage("Reward claimed successfully.");
            }

            await loadTasks();
            closeActionDialog();
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to process task action.",
            );
        } finally {
            setIsActionLoading(false);
        }
    };
    

    const actionDialogTitle =
        pendingActionType === "cancel"
            ? "Cancel Task"
            : pendingActionType === "accept"
            ? "Accept Task"
            : pendingActionType === "approve"
            ? "Approve Task"
            : "Claim Reward";

    const actionDialogDescription =
        pendingActionType === "cancel"
            ? "Are you sure you want to cancel this task?"
            : pendingActionType === "accept"
            ? "Are you sure you want to accept this task?"
            : pendingActionType === "approve"
            ? "Are you sure you want to approve this task?"
            : "Are you sure you want to claim this reward?";

    const actionDialogConfirmText =
        pendingActionType === "cancel"
            ? "Cancel Task"
            : pendingActionType === "accept"
            ? "Accept Task"
            : pendingActionType === "approve"
            ? "Approve Task"
            : "Claim Reward";

    return (
        <AppLayout>
            <section className="page-section">
                <div className="page-heading page-heading-row">
                    <div>
                        <h1>Tasks</h1>
                        <p>Review your current on-chain task records.</p>
                    </div>

                    {!isAuthLoading && canOperateTasks ? (
                        <AppButton type="button" onClick={openCreateModal}>
                            Create Task
                        </AppButton>
                    ) : null}
                </div>

                {successMessage ? (
                    <div className="feedback-banner success-banner">
                        <p>{successMessage}</p>
                    </div>
                ) : null}

                {errorMessage ? (
                    <div className="feedback-banner error-banner">
                        <p>{errorMessage}</p>
                    </div>
                ) : null}

                <FilterTabs
                    options={TASK_FILTER_OPTIONS}
                    value={filter}
                    onChange={setFilter}
                />

                {isLoading || isAuthLoading ? (
                    <PageLoading message="Loading tasks..." />
                ) : filteredTasks.length === 0 ? (
                    <EmptyState
                        title="No matching tasks"
                        description={
                            isAuthenticated
                                ? "Try another filter or create a new task."
                                : "Browse the current tasks. Login to create or edit tasks."
                        }
                    />
                ) : (
                    <div className="task-list">
                        {filteredTasks.map((task) => (
                            <div key={task.id} className="task-list-item">
                                <TaskCard
                                    task={task}
                                    onEdit={canOperateTasks && task.canEdit ? openEditModal : undefined}
                                    onDelete={canOperateTasks && task.canCancel ? (target) => openActionDialog(target, "cancel") : undefined}
                                    onAccept={canOperateTasks && task.canAccept ? (target) => openActionDialog(target, "accept") : undefined}
                                    onSubmit={canOperateTasks && task.canSubmit ? openSubmitModal : undefined}
                                    onApprove={canOperateTasks && task.canApprove ? (target) => openActionDialog(target, "approve") : undefined}
                                    onClaim={canOperateTasks && task.canClaim && !task.canClaimOnchain ? (target) => openActionDialog(target, "claim") : undefined}
                                />

                                {task.status === "SUBMITTED" && task.isOwner && !task.canApprove && Number(task.rewardAmount) > 0 && (
                                    <div className="task-onchain-actions">
                                        <span className="task-flow-hint">
                                            {task.onchainStatus === "NOT_FUNDED" ? "⚠ 需先在詳情頁完成 Fund 才能 Approve" : "⚠ 等待鏈上 Assign 完成才能 Approve"}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <AppModal
                isOpen={isTaskModalOpen}
                title={taskModalMode === "create" ? "Create Task" : "Edit Task"}
                onClose={closeTaskModal}
            >
                <TaskForm
                    mode={taskModalMode}
                    initialTask={selectedTask}
                    onSubmit={handleTaskSubmit}
                    onCancel={closeTaskModal}
                />
            </AppModal>

            <ConfirmDialog
                isOpen={isActionDialogOpen}
                title={actionDialogTitle}
                description={actionDialogDescription}
                confirmText={actionDialogConfirmText}
                cancelText="Back"
                isLoading={isActionLoading}
                onConfirm={handleActionConfirm}
                onCancel={closeActionDialog}
            />

            <TaskSubmitModal
                isOpen={isSubmitModalOpen}
                onSubmit={handleSubmitConfirm}
                onCancel={closeSubmitModal}
            />
        </AppLayout>
    );
};

export default TaskListPage;