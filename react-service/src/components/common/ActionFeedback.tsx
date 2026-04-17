/**
 * ActionFeedback — 動作進行中的統一回饋元件
 *
 * 用途：取代各頁面散落的 isBusy / errorMessage / statusMessage 手刻 div。
 *
 * 用法：
 *   <ActionFeedback status="loading" message="上傳中，請稍候..." />
 *   <ActionFeedback status="success" message="操作成功！" />
 *   <ActionFeedback status="error"   message={errorMessage} />
 *   <ActionFeedback status="idle" />   ← 不顯示任何內容
 */

export type ActionStatus = "idle" | "loading" | "success" | "error";

interface ActionFeedbackProps {
    status: ActionStatus;
    message?: string;
    /** 額外的子內容，顯示在訊息下方（例如 reset 提示連結） */
    children?: React.ReactNode;
}

const Spinner = () => (
    <span className="action-feedback-spinner" aria-hidden="true" />
);

const ActionFeedback = ({ status, message, children }: ActionFeedbackProps) => {
    if (status === "idle" || (!message && !children)) return null;

    return (
        <div className={`action-feedback action-feedback--${status}`} role={status === "error" ? "alert" : "status"}>
            <div className="action-feedback-body">
                {status === "loading" ? <Spinner /> : null}
                {message ? <span className="action-feedback-message">{message}</span> : null}
            </div>
            {children ? <div className="action-feedback-extra">{children}</div> : null}
        </div>
    );
};

export default ActionFeedback;
