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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/55 px-6 py-8 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="cred-dialog-title"
                aria-describedby="cred-dialog-desc"
                className="w-full max-w-[520px] rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-7 shadow-[0_24px_80px_rgba(15,23,42,0.2)] md:p-8"
            >
                <div className="space-y-4">
                    <h2 id="cred-dialog-title" className="text-2xl font-extrabold tracking-tight text-on-surface">
                        {props.title}
                    </h2>
                    <p id="cred-dialog-desc" className="text-sm leading-[1.9] text-on-surface-variant">
                        {props.description}
                    </p>
                </div>

                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={props.onCancel}
                        disabled={props.busy}
                        className="inline-flex items-center justify-center rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {props.cancelLabel ?? "取消"}
                    </button>
                    <button
                        type="button"
                        onClick={props.onConfirm}
                        disabled={props.busy}
                        className="inline-flex items-center justify-center rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {props.busy ? "處理中..." : props.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
