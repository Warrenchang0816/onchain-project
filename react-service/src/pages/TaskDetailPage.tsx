import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    getListing,
    updateListing,
    cancelListing,
    type UpdateListingPayload,
} from "../api/listingApi";
import {
    acceptListingMandate,
    approveCaseProgress,
    claimCaseReward,
    submitCaseProgress,
    type SubmitCaseProgressPayload,
} from "../api/caseApi";
import { getAuthMe } from "../api/authApi";
import type { Listing } from "../types/listing";
import { useAccount } from "wagmi";
import AppButton from "../components/common/AppButton";
import AppModal from "../components/common/AppModal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import PageLoading from "../components/common/PageLoading";
import TaskForm from "../components/task/TaskForm";
import TaskSubmitModal from "../components/task/TaskSubmitModal";
import FundTaskButton from "../components/task/FundTaskButton";
import ClaimOnchainButton from "../components/task/ClaimOnchainButton";
import SiteLayout from "../layouts/SiteLayout";

type TaskActionType = "cancel" | "accept" | "approve" | "claim";

const PRIORITY_LABEL: Record<string, string> = {
    LOW: "低優先",
    MEDIUM: "一般",
    HIGH: "高優先",
    URGENT: "急件",
};

const ONCHAIN_STATUS_LABEL: Record<string, string> = {
    NOT_FUNDED: "未注資",
    FUNDED: "已注資",
    ASSIGNED: "已指派",
    APPROVED: "已核准",
    CLAIMED: "已請款",
};

const TaskDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { address, isConnected } = useAccount();

    const [task, setTask] = useState<Listing | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [pendingActionType, setPendingActionType] = useState<TaskActionType | null>(null);

    const taskId = id ? parseInt(id, 10) : NaN;
    const canOperateTasks = Boolean(isAuthenticated && isConnected && address);

    const loadTask = async () => {
        if (isNaN(taskId)) {
            setErrorMessage("房源 ID 無效");
            setIsLoading(false);
            return;
        }

        try {
            setErrorMessage("");
            setIsLoading(true);
            const data = await getListing(taskId);
            setTask(data);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "載入房源失敗");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadTask();
        const loadAuth = async () => {
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
        void loadAuth();
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
                await cancelListing(task.id);
                setSuccessMessage("房源委託已取消");
            } else if (pendingActionType === "accept") {
                await acceptListingMandate(task.id);
                setSuccessMessage("已承接這筆委託");
            } else if (pendingActionType === "approve") {
                await approveCaseProgress(task.id);
                setSuccessMessage("委託進度已核准");
            } else if (pendingActionType === "claim") {
                await claimCaseReward(task.id);
                setSuccessMessage("款項已申請撥付");
            }

            await loadTask();
            closeActionDialog();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "處理委託流程失敗");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleEditSubmit = async (payload: UpdateListingPayload) => {
        if (!task) return;

        try {
            setErrorMessage("");
            await updateListing(task.id, payload);
            setSuccessMessage("房源資料已更新");
            setIsEditModalOpen(false);
            await loadTask();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "更新房源資料失敗");
        }
    };

    const handleSubmitConfirm = async (payload: SubmitCaseProgressPayload) => {
        if (!task) return;

        try {
            setErrorMessage("");
            await submitCaseProgress(task.id, payload);
            setSuccessMessage("委託進度已送出");
            setIsSubmitModalOpen(false);
            await loadTask();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "提交委託進度失敗");
        }
    };

    const actionDialogTitle = pendingActionType === "cancel"
        ? "取消房源委託"
        : pendingActionType === "accept"
          ? "承接委託"
          : pendingActionType === "approve"
            ? "核准進度"
            : "申請撥款";

    const actionDialogDescription = pendingActionType === "cancel"
        ? "確定要取消這筆房源委託嗎？"
        : pendingActionType === "accept"
          ? "確定要承接這筆房源委託嗎？"
          : pendingActionType === "approve"
            ? "確定要核准這次委託進度嗎？"
            : "確定要送出這筆款項申請嗎？";

    return (
        <SiteLayout>
            <section className="page-section">
                <div className="page-heading page-heading-row">
                    <div>
                        <AppButton type="button" variant="secondary" onClick={() => navigate("/listings")}>
                            返回列表
                        </AppButton>
                    </div>
                </div>

                {successMessage ? <div className="feedback-banner success-banner"><p>{successMessage}</p></div> : null}
                {errorMessage ? <div className="feedback-banner error-banner"><p>{errorMessage}</p></div> : null}

                {task && task.status === "SUBMITTED" && task.isOwner && !task.canApprove && Number(task.rewardAmount) > 0 ? (
                    <div className="feedback-banner warning-banner">
                        <p>
                            此房源委託目前待處理金額為 {task.rewardAmount} {task.paymentTokenSymbol || "ETH"}，請依鏈上狀態決定是否繼續注資、指派或等待進度提交結果。
                        </p>
                    </div>
                ) : null}

                {isLoading || isAuthLoading ? (
                    <PageLoading message="Loading listing..." />
                ) : !task ? (
                    <div className="page-state"><p>找不到這筆房源資料。</p></div>
                ) : (
                    <div className="task-detail">
                        <div className="task-detail-header">
                            <h1>{task.title}</h1>
                            <div className="task-detail-badges">
                                <span className={`task-status ${task.status.toLowerCase().replace("_", "-")}`}>{task.status}</span>
                                <span className="task-onchain-badge">{ONCHAIN_STATUS_LABEL[task.onchainStatus] ?? task.onchainStatus}</span>
                            </div>
                        </div>

                        <div className="task-detail-body">
                            <p className="task-detail-description">{task.description}</p>

                            <dl className="task-detail-meta">
                                <dt>委託優先度</dt>
                                <dd>{PRIORITY_LABEL[task.priority] ?? task.priority}</dd>

                                <dt>委託預算</dt>
                                <dd>{task.rewardAmount} {task.paymentTokenSymbol || "ETH"}</dd>

                                <dt>刊登者錢包</dt>
                                <dd className="task-detail-address">{task.walletAddress}</dd>

                                {task.assigneeWalletAddress ? (
                                    <>
                                        <dt>承辦錢包</dt>
                                        <dd className="task-detail-address">{task.assigneeWalletAddress}</dd>
                                    </>
                                ) : null}

                                {task.dueDate ? (
                                    <>
                                        <dt>預計截止日</dt>
                                        <dd>{new Date(task.dueDate).toLocaleDateString("zh-TW")}</dd>
                                    </>
                                ) : null}

                                <dt>建立時間</dt>
                                <dd>{new Date(task.createdAt).toLocaleString("zh-TW")}</dd>

                                {task.fundTxHash ? (
                                    <>
                                        <dt>注資交易</dt>
                                        <dd className="task-detail-address">{task.fundTxHash}</dd>
                                    </>
                                ) : null}
                                {task.approveTxHash ? (
                                    <>
                                        <dt>核准交易</dt>
                                        <dd className="task-detail-address">{task.approveTxHash}</dd>
                                    </>
                                ) : null}
                                {task.claimTxHash ? (
                                    <>
                                        <dt>請款交易</dt>
                                        <dd className="task-detail-address">{task.claimTxHash}</dd>
                                    </>
                                ) : null}
                                {task.cancelTxHash ? (
                                    <>
                                        <dt>取消交易</dt>
                                        <dd className="task-detail-address">{task.cancelTxHash}</dd>
                                    </>
                                ) : null}
                            </dl>
                        </div>

                        {canOperateTasks ? (
                            <div className="task-detail-actions">
                                {task.canEdit ? <AppButton type="button" variant="secondary" onClick={() => setIsEditModalOpen(true)}>編輯房源</AppButton> : null}
                                {task.canCancel ? <AppButton type="button" variant="secondary" onClick={() => openActionDialog("cancel")}>取消委託</AppButton> : null}
                                {task.canAccept ? <AppButton type="button" onClick={() => openActionDialog("accept")}>承接委託</AppButton> : null}
                                {task.canSubmit ? <AppButton type="button" onClick={() => setIsSubmitModalOpen(true)}>提交進度</AppButton> : null}
                                {task.canApprove ? <AppButton type="button" onClick={() => openActionDialog("approve")}>核准進度</AppButton> : null}
                                {task.canClaim && !task.canClaimOnchain ? <AppButton type="button" onClick={() => openActionDialog("claim")}>申請撥款</AppButton> : null}
                                <FundTaskButton task={task} onSuccess={loadTask} />
                                <ClaimOnchainButton task={task} onSuccess={loadTask} />
                            </div>
                        ) : null}
                    </div>
                )}
            </section>

            <AppModal isOpen={isEditModalOpen} title="編輯房源資料" onClose={() => setIsEditModalOpen(false)}>
                <TaskForm mode="edit" initialTask={task} onSubmit={handleEditSubmit} onCancel={() => setIsEditModalOpen(false)} />
            </AppModal>

            <ConfirmDialog
                isOpen={isActionDialogOpen}
                title={actionDialogTitle}
                description={actionDialogDescription}
                confirmText={actionDialogTitle}
                cancelText="返回"
                isLoading={isActionLoading}
                onConfirm={handleActionConfirm}
                onCancel={closeActionDialog}
            />

            <TaskSubmitModal isOpen={isSubmitModalOpen} onSubmit={handleSubmitConfirm} onCancel={() => setIsSubmitModalOpen(false)} />
        </SiteLayout>
    );
};

export default TaskDetailPage;
