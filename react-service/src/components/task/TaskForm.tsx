import { useEffect, useState } from "react";
import type { Task } from "../../types/task";
import type {
    CreateTaskPayload,
    UpdateTaskPayload,
} from "../../api/taskApi";
import AppButton from "../common/AppButton";

type TaskFormMode = "create" | "edit";

interface TaskFormProps {
    mode: TaskFormMode;
    initialTask?: Task | null;
    onSubmit: (
        payload: CreateTaskPayload | UpdateTaskPayload,
    ) => Promise<void>;
    onCancel: () => void;
}

interface TaskFormValues {
    title: string;
    description: string;
    priority: string;
    dueDate: string;
    rewardAmount: string;
    paymentTokenKey: "NATIVE" | "USDT" | "PTK";
}

const defaultFormValues: TaskFormValues = {
    title: "",
    description: "",
    priority: "MEDIUM",
    dueDate: "",
    rewardAmount: "0",
    paymentTokenKey: "NATIVE",
};

const TOKEN_OPTIONS = {
    NATIVE: {
        paymentAssetType: "NATIVE" as const,
        paymentTokenAddress: null,
        paymentTokenSymbol: "ETH",
        paymentTokenDecimals: 18,
    },
    USDT: {
        paymentAssetType: "ERC20" as const,
        paymentTokenAddress: import.meta.env.VITE_USDT_ADDRESS || "",
        paymentTokenSymbol: "USDT",
        paymentTokenDecimals: 6,
    },
    PTK: {
        paymentAssetType: "ERC20" as const,
        paymentTokenAddress: import.meta.env.VITE_PLATFORM_TOKEN_ADDRESS || "",
        paymentTokenSymbol: "PTK",
        paymentTokenDecimals: 18,
    },
};

const resolveTokenKeyFromTask = (task: Task): "NATIVE" | "USDT" | "PTK" => {
    if (task.paymentAssetType === "NATIVE") {
        return "NATIVE";
    }

    if (task.paymentTokenSymbol === "USDT") {
        return "USDT";
    }

    if (task.paymentTokenSymbol === "PTK") {
        return "PTK";
    }

    return "NATIVE";
};

const TaskForm = ({
    mode,
    initialTask,
    onSubmit,
    onCancel,
}: TaskFormProps) => {
    const [formValues, setFormValues] = useState<TaskFormValues>(defaultFormValues);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    useEffect(() => {
        if (mode === "edit" && initialTask) {
            setFormValues({
                title: initialTask.title ?? "",
                description: initialTask.description ?? "",
                priority: initialTask.priority ?? "MEDIUM",
                dueDate: initialTask.dueDate
                    ? initialTask.dueDate.slice(0, 16)
                    : "",
                rewardAmount: initialTask.rewardAmount ?? "0",
                paymentTokenKey: resolveTokenKeyFromTask(initialTask),
            });
            return;
        }

        setFormValues(defaultFormValues);
    }, [mode, initialTask]);

    const handleChange = (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => {
        const { name, value } = event.target;

        setFormValues((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        setIsSubmitting(true);

        try {
            if (mode === "create") {
                const selectedToken = TOKEN_OPTIONS[formValues.paymentTokenKey];

                const payload: CreateTaskPayload = {
                    title: formValues.title.trim(),
                    description: formValues.description.trim(),
                    priority: formValues.priority,
                    dueDate: formValues.dueDate
                        ? new Date(formValues.dueDate).toISOString()
                        : null,
                    rewardAmount: formValues.rewardAmount.trim() || "0",
                    paymentAssetType: selectedToken.paymentAssetType,
                    paymentTokenAddress: selectedToken.paymentTokenAddress,
                    paymentTokenSymbol: selectedToken.paymentTokenSymbol,
                    paymentTokenDecimals: selectedToken.paymentTokenDecimals,
                };

                await onSubmit(payload);
                return;
            }

            const payload: UpdateTaskPayload = {
                title: formValues.title.trim(),
                description: formValues.description.trim(),
                priority: formValues.priority,
                dueDate: formValues.dueDate
                    ? new Date(formValues.dueDate).toISOString()
                    : null,
            };

            await onSubmit(payload);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className="task-form" onSubmit={handleSubmit}>
            <div className="form-field">
                <label htmlFor="title">Title</label>
                <input
                    id="title"
                    name="title"
                    type="text"
                    value={formValues.title}
                    onChange={handleChange}
                    required
                />
            </div>

            <div className="form-field">
                <label htmlFor="description">Description</label>
                <textarea
                    id="description"
                    name="description"
                    value={formValues.description}
                    onChange={handleChange}
                    rows={4}
                />
            </div>

            <div className="form-field">
                <label htmlFor="priority">Priority</label>
                <select
                    id="priority"
                    name="priority"
                    value={formValues.priority}
                    onChange={handleChange}
                >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                </select>
            </div>

            {mode === "create" && (
                <>
                    <div className="form-field">
                        <label htmlFor="rewardAmount">Reward Amount</label>
                        <input
                            id="rewardAmount"
                            name="rewardAmount"
                            type="number"
                            min="0"
                            step="0.00000001"
                            value={formValues.rewardAmount}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="paymentTokenKey">Payment Token</label>
                        <select
                            id="paymentTokenKey"
                            name="paymentTokenKey"
                            value={formValues.paymentTokenKey}
                            onChange={handleChange}
                        >
                            <option value="NATIVE">ETH</option>
                            <option value="USDT">USDT</option>
                            <option value="PTK">PTK</option>
                        </select>
                    </div>
                </>
            )}

            <div className="form-field">
                <label htmlFor="dueDate">Due Date</label>
                <input
                    id="dueDate"
                    name="dueDate"
                    type="datetime-local"
                    value={formValues.dueDate}
                    onChange={handleChange}
                />
            </div>

            <div className="form-actions">
                <AppButton type="button" variant="secondary" onClick={onCancel}>
                    Cancel
                </AppButton>

                <AppButton type="submit" disabled={isSubmitting}>
                    {isSubmitting
                        ? "Submitting..."
                        : mode === "create"
                            ? "Create Task"
                            : "Save Changes"}
                </AppButton>
            </div>
        </form>
    );
};

export default TaskForm;