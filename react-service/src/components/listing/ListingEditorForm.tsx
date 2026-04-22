import { useMemo, useState, type ReactNode } from "react";
import type {
    CreateListingPayload,
    UpdateListingPayload,
} from "../../api/listingApi";
import type { ListingEditorValues } from "./listingEditorValues";

type ListingEditorMode = "create" | "edit";

type ListingEditorPayload = CreateListingPayload | UpdateListingPayload;

type ListingEditorFormProps = {
    mode: ListingEditorMode;
    initialValues: ListingEditorValues;
    submitting: boolean;
    submitLabel: string;
    onSubmit: (payload: ListingEditorPayload) => Promise<void> | void;
    onCancel?: () => void;
};

const inputCls =
    "block w-full px-4 py-3 bg-surface-container-low text-on-surface rounded-lg border-0 " +
    "focus:ring-2 focus:ring-primary-container transition-colors text-sm outline-none placeholder:text-outline";

const checkboxLabelCls = "flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer";

function toOptionalNumber(value: string): number | undefined {
    if (value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function Field(props: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface-variant">{props.label}</label>
            {props.children}
        </div>
    );
}

export default function ListingEditorForm(props: ListingEditorFormProps) {
    const [form, setForm] = useState<ListingEditorValues>(props.initialValues);
    const [error, setError] = useState("");

    const canSubmit = useMemo(() => {
        return form.title.trim() !== "" && form.address.trim() !== "" && Number(form.price) > 0;
    }, [form]);

    const setField = <K extends keyof ListingEditorValues>(key: K, value: ListingEditorValues[K]) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const handleSubmit = async () => {
        try {
            setError("");
            const base = {
                title: form.title.trim(),
                description: form.description.trim() || undefined,
                address: form.address.trim(),
                district: form.district.trim() || undefined,
                price: Number(form.price),
                area_ping: toOptionalNumber(form.areaPing),
                floor: toOptionalNumber(form.floor),
                total_floors: toOptionalNumber(form.totalFloors),
                room_count: toOptionalNumber(form.roomCount),
                bathroom_count: toOptionalNumber(form.bathroomCount),
                is_pet_allowed: form.isPetAllowed,
                is_parking_included: form.isParkingIncluded,
            };

            if (props.mode === "create") {
                await props.onSubmit({
                    ...base,
                    list_type: form.listType,
                    duration_days: Number(form.durationDays || "30"),
                } satisfies CreateListingPayload);
                return;
            }

            await props.onSubmit(base satisfies UpdateListingPayload);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save listing.");
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <Field label="Listing type">
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled={props.mode === "edit"}
                        onClick={() => setField("listType", "RENT")}
                        className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                            form.listType === "RENT"
                                ? "bg-primary-container text-on-primary-container"
                                : "bg-surface-container-low text-on-surface"
                        } ${props.mode === "edit" ? "cursor-not-allowed opacity-70" : ""}`}
                    >
                        Rent
                    </button>
                    <button
                        type="button"
                        disabled={props.mode === "edit"}
                        onClick={() => setField("listType", "SALE")}
                        className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                            form.listType === "SALE"
                                ? "bg-primary-container text-on-primary-container"
                                : "bg-surface-container-low text-on-surface"
                        } ${props.mode === "edit" ? "cursor-not-allowed opacity-70" : ""}`}
                    >
                        Sale
                    </button>
                </div>
            </Field>

            <Field label="Title">
                <input className={inputCls} value={form.title} onChange={(e) => setField("title", e.target.value)} />
            </Field>

            <Field label="Address">
                <input className={inputCls} value={form.address} onChange={(e) => setField("address", e.target.value)} />
            </Field>

            <Field label="District">
                <input className={inputCls} value={form.district} onChange={(e) => setField("district", e.target.value)} />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Price (NTD)">
                    <input
                        type="number"
                        min={1}
                        className={inputCls}
                        value={form.price}
                        onChange={(e) => setField("price", e.target.value)}
                    />
                </Field>
                {props.mode === "create" ? (
                    <Field label="Publish duration (days)">
                        <input
                            type="number"
                            min={7}
                            max={180}
                            className={inputCls}
                            value={form.durationDays}
                            onChange={(e) => setField("durationDays", e.target.value)}
                        />
                    </Field>
                ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Area (ping)">
                    <input className={inputCls} type="number" value={form.areaPing} onChange={(e) => setField("areaPing", e.target.value)} />
                </Field>
                <Field label="Floor">
                    <input className={inputCls} type="number" value={form.floor} onChange={(e) => setField("floor", e.target.value)} />
                </Field>
                <Field label="Total floors">
                    <input className={inputCls} type="number" value={form.totalFloors} onChange={(e) => setField("totalFloors", e.target.value)} />
                </Field>
                <Field label="Rooms">
                    <input className={inputCls} type="number" value={form.roomCount} onChange={(e) => setField("roomCount", e.target.value)} />
                </Field>
                <Field label="Bathrooms">
                    <input className={inputCls} type="number" value={form.bathroomCount} onChange={(e) => setField("bathroomCount", e.target.value)} />
                </Field>
            </div>

            <div className="flex flex-wrap items-center gap-6">
                <label className={checkboxLabelCls}>
                    <input
                        type="checkbox"
                        checked={form.isPetAllowed}
                        onChange={(e) => setField("isPetAllowed", e.target.checked)}
                    />
                    Pet friendly
                </label>
                <label className={checkboxLabelCls}>
                    <input
                        type="checkbox"
                        checked={form.isParkingIncluded}
                        onChange={(e) => setField("isParkingIncluded", e.target.checked)}
                    />
                    Parking included
                </label>
            </div>

            <Field label="Description">
                <textarea
                    className={inputCls}
                    rows={5}
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                />
            </Field>

            {error ? <p className="text-sm text-error">{error}</p> : null}

            <div className="flex justify-end gap-3">
                {props.onCancel ? (
                    <button
                        type="button"
                        onClick={props.onCancel}
                        className="px-5 py-2.5 rounded-lg text-sm font-medium text-on-surface border border-outline-variant/50 bg-transparent hover:bg-surface-container transition-colors"
                    >
                        Cancel
                    </button>
                ) : null}
                <button
                    type="button"
                    disabled={props.submitting || !canSubmit}
                    onClick={() => void handleSubmit()}
                    className="px-5 py-2.5 rounded-lg text-sm font-bold bg-primary-container text-on-surface hover:bg-inverse-primary transition-colors disabled:opacity-50"
                >
                    {props.submitting ? "Saving..." : props.submitLabel}
                </button>
            </div>
        </div>
    );
}
