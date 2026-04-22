type Props = {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    busy?: boolean;
};

export default function CredentialConfirmDialog(props: Props) {
    if (!props.open) return null;
    return (
        <div className="credential-dialog-overlay" aria-hidden="true">
            <div
                className="credential-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cred-dialog-title"
                aria-describedby="cred-dialog-desc"
            >
                <h2 id="cred-dialog-title" className="credential-dialog__title">{props.title}</h2>
                <p id="cred-dialog-desc" className="credential-dialog__desc">{props.description}</p>
                <div className="credential-dialog__actions">
                    <button type="button" onClick={props.onCancel} className="btn-secondary">
                        {props.cancelLabel ?? "取消"}
                    </button>
                    <button type="button" disabled={props.busy} onClick={props.onConfirm} className="btn-primary">
                        {props.busy ? "處理中..." : props.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
