import { useEffect, useState } from "react";
import type { Listing } from "../../types/listing";
import type {
    CreateListingPayload,
    UpdateListingPayload,
} from "../../api/listingApi";
import AppButton from "../common/AppButton";

type TaskFormMode = "create" | "edit";

interface TaskFormProps {
    mode: TaskFormMode;
    initialTask?: Listing | null;
    onSubmit: (
        payload: CreateListingPayload | UpdateListingPayload,
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

const resolveTokenKeyFromTask = (task: Listing): "NATIVE" | "USDT" | "PTK" => {
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

// This form is the current compatibility editor for listing/base content fields.
// The backend record is still task-shaped, so we keep the component name stable
// while presenting housing-platform language in the UI.
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

                const payload: CreateListingPayload = {
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

            const payload: UpdateListingPayload = {
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
                <label htmlFor="title">房源標題</label>
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
                <label htmlFor="description">房源說明</label>
                <textarea
                    id="description"
                    name="description"
                    value={formValues.description}
                    onChange={handleChange}
                    rows={4}
                />
            </div>

            <div className="form-field">
                <label htmlFor="priority">委託優先度</label>
                <select
                    id="priority"
                    name="priority"
                    value={formValues.priority}
                    onChange={handleChange}
                >
                    <option value="LOW">低</option>
                    <option value="MEDIUM">一般</option>
                    <option value="HIGH">高</option>
                </select>
            </div>

            {mode === "create" && (
                <>
                    <div className="form-field">
                        <label htmlFor="rewardAmount">委託預算</label>
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
                        <label htmlFor="paymentTokenKey">付款幣別</label>
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
                <label htmlFor="dueDate">預計截止時間</label>
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
                    取消
                </AppButton>

                <AppButton type="submit" disabled={isSubmitting}>
                    {isSubmitting
                        ? "儲存中..."
                        : mode === "create"
                            ? "建立房源委託"
                            : "儲存變更"}
                </AppButton>
            </div>
        </form>
    );
};

export default TaskForm;
