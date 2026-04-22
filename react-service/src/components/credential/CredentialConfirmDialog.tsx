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
        <div className="credential-dialog-overlay">
            <div className="credential-dialog">
                <h2 className="credential-dialog__title">{props.title}</h2>
                <p className="credential-dialog__desc">{props.description}</p>
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
