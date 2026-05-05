import { useState, type ReactNode } from "react";
import type { TenantRequirementPayload } from "../../api/tenantApi";
import type { TaiwanDistrictOption } from "../../api/listingApi";
import DistrictMultiSelect from "../location/DistrictMultiSelect";
import {
    toRequirementPayload,
    type RequirementFormValues,
} from "./requirementFormValues";

type TenantRequirementFormProps = {
    districtOptions: TaiwanDistrictOption[];
    initialValues: RequirementFormValues;
    submitting: boolean;
    submitLabel: string;
    onSubmit: (payload: TenantRequirementPayload) => Promise<void> | void;
    onCancel?: () => void;
};

const inputCls = "rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container";
const labelCls = "text-xs font-bold text-on-surface-variant";

function Field(props: { label: string; children: ReactNode }) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className={labelCls}>{props.label}</span>
            {props.children}
        </label>
    );
}

export default function TenantRequirementForm({
    districtOptions,
    initialValues,
    submitting,
    submitLabel,
    onSubmit,
    onCancel,
}: TenantRequirementFormProps) {
    const [form, setForm] = useState<RequirementFormValues>(initialValues);
    const [error, setError] = useState("");

    const setField = <K extends keyof RequirementFormValues>(key: K, value: RequirementFormValues[K]) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const handleSubmit = async () => {
        try {
            setError("");
            if (form.districts.length === 0) throw new Error("請至少選擇一個行政區。");
            if (Number(form.budgetMax || 0) <= 0) throw new Error("請填寫最高租金。");
            if (Number(form.budgetMin || 0) > Number(form.budgetMax || 0)) throw new Error("最低租金不可高於最高租金。");
            await onSubmit(toRequirementPayload(form));
        } catch (err) {
            setError(err instanceof Error ? err.message : "儲存租屋需求失敗。");
        }
    };

    return (
        <div className="flex flex-col gap-5">
            <Field label="希望區域">
                <DistrictMultiSelect options={districtOptions} value={form.districts} onChange={(next) => setField("districts", next)} />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
                <Field label="最低租金">
                    <input className={inputCls} type="number" min={0} value={form.budgetMin} onChange={(event) => setField("budgetMin", event.target.value)} />
                </Field>
                <Field label="最高租金">
                    <input className={inputCls} type="number" min={0} value={form.budgetMax} onChange={(event) => setField("budgetMax", event.target.value)} />
                </Field>
                <Field label="最小坪數">
                    <input className={inputCls} type="number" min={0} step="0.1" value={form.areaMinPing} onChange={(event) => setField("areaMinPing", event.target.value)} />
                </Field>
                <Field label="最大坪數">
                    <input className={inputCls} type="number" min={0} step="0.1" value={form.areaMaxPing} onChange={(event) => setField("areaMaxPing", event.target.value)} />
                </Field>
                <Field label="至少房數">
                    <input className={inputCls} type="number" min={0} value={form.roomMin} onChange={(event) => setField("roomMin", event.target.value)} />
                </Field>
                <Field label="至少衛浴">
                    <input className={inputCls} type="number" min={0} value={form.bathroomMin} onChange={(event) => setField("bathroomMin", event.target.value)} />
                </Field>
                <Field label="入住日期">
                    <input className={inputCls} type="date" value={form.moveInDate} onChange={(event) => setField("moveInDate", event.target.value)} />
                </Field>
                <Field label="入住時程">
                    <input className={inputCls} value={form.moveInTimeline} onChange={(event) => setField("moveInTimeline", event.target.value)} placeholder="例如：一個月內、可等兩個月" />
                </Field>
                <Field label="最短租期（月）">
                    <input className={inputCls} type="number" min={0} value={form.minimumLeaseMonths} onChange={(event) => setField("minimumLeaseMonths", event.target.value)} />
                </Field>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-on-surface-variant">
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.petFriendlyNeeded} onChange={(event) => setField("petFriendlyNeeded", event.target.checked)} />
                    需要可寵物
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.parkingNeeded} onChange={(event) => setField("parkingNeeded", event.target.checked)} />
                    需要車位
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.canCookNeeded} onChange={(event) => setField("canCookNeeded", event.target.checked)} />
                    需要可開伙
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.canRegisterHouseholdNeeded} onChange={(event) => setField("canRegisterHouseholdNeeded", event.target.checked)} />
                    需要可設籍
                </label>
            </div>

            <Field label="格局與空間需求">
                <textarea className={inputCls} rows={3} value={form.layoutNote} onChange={(event) => setField("layoutNote", event.target.value)} />
            </Field>
            <Field label="生活型態備註">
                <textarea className={inputCls} rows={3} value={form.lifestyleNote} onChange={(event) => setField("lifestyleNote", event.target.value)} />
            </Field>
            <Field label="必要條件">
                <textarea className={inputCls} rows={3} value={form.mustHaveNote} onChange={(event) => setField("mustHaveNote", event.target.value)} />
            </Field>

            {error ? <p className="text-sm text-error">{error}</p> : null}

            <div className="flex flex-wrap justify-end gap-3">
                {onCancel ? (
                    <button type="button" onClick={onCancel} className="rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface">
                        取消編輯
                    </button>
                ) : null}
                <button type="button" disabled={submitting} onClick={() => void handleSubmit()} className="rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container disabled:opacity-60">
                    {submitting ? "儲存中..." : submitLabel}
                </button>
            </div>
        </div>
    );
}
