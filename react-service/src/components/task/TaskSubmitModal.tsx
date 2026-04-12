import { useState } from "react";
import AppButton from "../common/AppButton";
import AppModal from "../common/AppModal";
import type { SubmitTaskPayload } from "../../api/taskApi";

interface TaskSubmitModalProps {
    isOpen: boolean;
    onSubmit: (payload: SubmitTaskPayload) => Promise<void>;
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
            setError("Please describe your result.");
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
        <AppModal isOpen={isOpen} title="Submit Task" onClose={handleClose}>
            <form className="task-form" onSubmit={handleSubmit}>
                <div className="form-field">
                    <label htmlFor="resultContent">Result Description *</label>
                    <textarea
                        id="resultContent"
                        name="resultContent"
                        value={values.resultContent}
                        onChange={handleChange}
                        rows={4}
                        placeholder="Describe what you completed..."
                        required
                    />
                    {error && <p className="form-error">{error}</p>}
                </div>

                <div className="form-field">
                    <label htmlFor="resultFileUrl">Result Link (optional)</label>
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
                        Cancel
                    </AppButton>
                    <AppButton type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Submitting..." : "Submit"}
                    </AppButton>
                </div>
            </form>
        </AppModal>
    );
};

export default TaskSubmitModal;
