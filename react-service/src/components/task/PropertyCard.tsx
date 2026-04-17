import { Link } from "react-router-dom";
import type { Listing } from "../../types/listing";

interface PropertyCardProps {
    task: Listing;
}

const statusLabelMap: Record<string, string> = {
    OPEN: "待媒合",
    IN_PROGRESS: "處理中",
    SUBMITTED: "待確認",
    APPROVED: "已核准",
    COMPLETED: "已完成",
    CANCELLED: "已取消",
};

const priorityLabelMap: Record<string, string> = {
    LOW: "低優先",
    MEDIUM: "一般",
    HIGH: "高優先",
    URGENT: "急件",
};

const PropertyCard = ({ task }: PropertyCardProps) => {
    const priceLabel = Number(task.rewardAmount) > 0 ? `${task.rewardAmount} ${task.paymentTokenSymbol || "ETH"}` : "價格面議";

    return (
        <article className="property-card">
            <div className="property-card-cover">
                <span className="property-card-badge">{statusLabelMap[task.status] ?? task.status}</span>
                <span className="property-card-chip">{priorityLabelMap[task.priority] ?? task.priority}</span>
            </div>

            <div className="property-card-body">
                <div className="property-card-price">{priceLabel}</div>
                <h3>
                    <Link className="property-card-link" to={`/listings/${task.id}`}>
                        {task.title}
                    </Link>
                </h3>
                <p>{task.description}</p>

                <div className="property-card-meta">
                    <span>{task.paymentAssetType === "NATIVE" ? "原生資產" : "ERC20"}</span>
                    {task.dueDate ? <span>{new Date(task.dueDate).toLocaleDateString("zh-TW")}</span> : null}
                    <span>{task.paymentTokenSymbol || "ETH"}</span>
                </div>
            </div>
        </article>
    );
};

export default PropertyCard;
