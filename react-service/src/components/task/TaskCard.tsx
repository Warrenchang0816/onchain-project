import { Link } from "react-router-dom";
import type { Task } from "../../types/task";
import AppButton from "../common/AppButton";

interface TaskCardProps {
    task: Task;
    onEdit?: (task: Task) => void;
    onDelete?: (task: Task) => void;
    onAccept?: (task: Task) => void;
    onSubmit?: (task: Task) => void;
    onApprove?: (task: Task) => void;
    onClaim?: (task: Task) => void;
}

const TaskCard = ({
    task,
    onEdit,
    onDelete,
    onAccept,
    onSubmit,
    onApprove,
    onClaim,
}: TaskCardProps) => {
    const shouldShowActions =
        (task.canEdit && onEdit) ||
        (task.canCancel && onDelete) ||
        (task.canAccept && onAccept) ||
        (task.canSubmit && onSubmit) ||
        (task.canApprove && onApprove) ||
        (task.canClaim && onClaim);

    const statusClassName =
        task.status === "COMPLETED"
            ? "task-status completed"
            : task.status === "CANCELLED"
              ? "task-status cancelled"
              : task.status === "IN_PROGRESS"
                ? "task-status in-progress"
                : task.status === "SUBMITTED"
                  ? "task-status submitted"
                  : task.status === "APPROVED"
                    ? "task-status approved"
                    : "task-status created";

    return (
        <div className="task-card">
            <div className="task-card-header">
                <h3>
                    <Link className="task-card-title-link" to={`/tasks/${task.id}`}>
                        {task.title}
                    </Link>
                </h3>
                <span className={statusClassName}>{task.status}</span>
            </div>

            <p>{task.description}</p>

            <div className="task-card-meta">
                <div className="task-card-meta">
                    <span className={`task-priority task-priority--${task.priority.toLowerCase()}`}>
                        {task.priority}
                    </span>
                    <span className="task-meta-item">
                        {task.paymentAssetType === "NATIVE" ? "Native" : "ERC20"}
                    </span>
                    {Number(task.rewardAmount) > 0 && (
                        <span className="task-meta-item">
                            {task.rewardAmount} {task.paymentTokenSymbol || "ETH"}
                        </span>
                    )}
                    {task.dueDate && (
                        <span className="task-meta-item">
                            Due {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                    )}
                </div>
                <span className="task-meta-item">
                    {task.paymentAssetType === "NATIVE" ? "Native" : "ERC20"}
                </span>
                {Number(task.rewardAmount) > 0 && (
                    <span className="task-meta-item">
                        {task.rewardAmount} {task.paymentTokenSymbol || "ETH"}
                    </span>
                )}
                {task.dueDate && (
                    <span className="task-meta-item">
                        Due {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                )}
            </div>

            {shouldShowActions && (
                <div className="task-card-actions">
                    {task.canEdit && onEdit && (
                        <AppButton
                            type="button"
                            variant="secondary"
                            onClick={() => onEdit(task)}
                        >
                            Edit
                        </AppButton>
                    )}

                    {task.canCancel && onDelete && (
                        <AppButton
                            type="button"
                            variant="secondary"
                            onClick={() => onDelete(task)}
                        >
                            Cancel
                        </AppButton>
                    )}

                    {task.canAccept && onAccept && (
                        <AppButton
                            type="button"
                            onClick={() => onAccept(task)}
                        >
                            Accept
                        </AppButton>
                    )}

                    {task.canSubmit && onSubmit && (
                        <AppButton
                            type="button"
                            onClick={() => onSubmit(task)}
                        >
                            Submit
                        </AppButton>
                    )}

                    {task.canApprove && onApprove && (
                        <AppButton
                            type="button"
                            onClick={() => onApprove(task)}
                        >
                            Approve
                        </AppButton>
                    )}

                    {task.canClaim && !task.canClaimOnchain && onClaim && (
                        <AppButton
                            type="button"
                            onClick={() => onClaim(task)}
                        >
                            Claim
                        </AppButton>
                    )}
                </div>
            )}
        </div>
    );
};

export default TaskCard;
