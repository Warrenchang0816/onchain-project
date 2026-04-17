import { useState } from "react";
import AppButton from "../common/AppButton";
import AppModal from "../common/AppModal";
import type { SubmitCaseProgressPayload } from "../../api/caseApi";

interface TaskSubmitModalProps {
    isOpen: boolean;
    onSubmit: (payload: SubmitCaseProgressPayload) => Promise<void>;
    onCancel: () => void;
}

interface SubmitFormValues {
    resultContent: string;
    resultFileUrl: string;
}

const TaskSubmitModal = ({ isOpen, onSubmit, onCancel }: TaskSubmitModalProps) => {
    const [values, setValues] = useState<SubmitFormValues>({
        resultContent: "",
        resultFileUrl: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        const { name, value } = e.target;
        setValues((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!values.resultContent.trim()) {
            setError("請填寫本次委託處理進度。");
            return;
        }

        setError("");
        setIsSubmitting(true);

        try {
            await onSubmit({
                resultContent: values.resultContent.trim(),
                resultFileUrl: values.resultFileUrl.trim() || undefined,
            });
            setValues({ resultContent: "", resultFileUrl: "" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setValues({ resultContent: "", resultFileUrl: "" });
        setError("");
        onCancel();
    };

    return (
        <AppModal isOpen={isOpen} title="提交委託進度" onClose={handleClose}>
            <form className="task-form" onSubmit={handleSubmit}>
                <div className="form-field">
                    <label htmlFor="resultContent">處理說明 *</label>
                    <textarea
                        id="resultContent"
                        name="resultContent"
                        value={values.resultContent}
                        onChange={handleChange}
                        rows={4}
                        placeholder="例如：已完成帶看、已補件、已和屋主確認條件..."
                        required
                    />
                    {error && <p className="form-error">{error}</p>}
                </div>

                <div className="form-field">
                    <label htmlFor="resultFileUrl">補充連結（選填）</label>
                    <input
                        id="resultFileUrl"
                        name="resultFileUrl"
                        type="url"
                        value={values.resultFileUrl}
                        onChange={handleChange}
                        placeholder="https://..."
                    />
                </div>

                <div className="form-actions">
                    <AppButton type="button" variant="secondary" onClick={handleClose}>
                        取消
                    </AppButton>
                    <AppButton type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "提交中..." : "送出進度"}
                    </AppButton>
                </div>
            </form>
        </AppModal>
    );
};

export default TaskSubmitModal;
