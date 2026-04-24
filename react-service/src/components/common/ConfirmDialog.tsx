import AppButton from "./AppButton";
import AppModal from "./AppModal";

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    isLoading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmDialog = ({
    isOpen,
    title,
    description,
    confirmText = "確認",
    cancelText = "取消",
    isLoading = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) => {
    return (
        <AppModal isOpen={isOpen} title={title} onClose={onCancel}>
            <div className="confirm-dialog">
                <p>{description}</p>

                <div className="confirm-dialog-actions">
                    <AppButton type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
                        {cancelText}
                    </AppButton>

                    <AppButton type="button" onClick={onConfirm} disabled={isLoading}>
                        {isLoading ? "處理中..." : confirmText}
                    </AppButton>
                </div>
            </div>
        </AppModal>
    );
};

export default ConfirmDialog;
