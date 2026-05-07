import { useEffect, useMemo, useState } from "react";
import { getTaiwanDistricts, type TaiwanDistrictOption } from "@/api/listingApi";
import {
    createRequirement,
    getMyRequirements,
    updateRequirement,
    updateRequirementStatus,
    type TenantRequirement,
    type TenantRequirementPayload,
    type TenantRequirementStatus,
} from "@/api/tenantApi";
import TenantRequirementForm from "@/components/tenant/TenantRequirementForm";
import {
    createRequirementFormInitialValues,
    requirementToFormValues,
    type RequirementFormValues,
} from "@/components/tenant/requirementFormValues";
import { getDistrictSelectionSummary, type DistrictSelection } from "@/components/location/districtSelection";
import SiteLayout from "@/layouts/SiteLayout";

const statusLabel: Record<TenantRequirementStatus, string> = {
    OPEN: "開放中",
    PAUSED: "暫停",
    CLOSED: "已結案",
};

function requirementDistrictSelections(item: TenantRequirement): DistrictSelection[] {
    return item.districts.map((district) => ({
        county: district.county,
        district: district.district,
        postalCode: district.zipCode,
    }));
}

function formatDistricts(item: TenantRequirement): string {
    const selections = requirementDistrictSelections(item);
    return selections.length > 0 ? getDistrictSelectionSummary(selections) : item.targetDistrict || "未設定行政區";
}

function formatBudget(item: TenantRequirement): string {
    return `NT$ ${item.budgetMin.toLocaleString()} - ${item.budgetMax.toLocaleString()}`;
}

function conditionChips(item: TenantRequirement): string[] {
    const chips: string[] = [];
    if (item.roomMin > 0) chips.push(`至少 ${item.roomMin} 房`);
    if (item.bathroomMin > 0) chips.push(`至少 ${item.bathroomMin} 衛`);
    if (item.areaMinPing || item.areaMaxPing) {
        const min = item.areaMinPing ? `${item.areaMinPing} 坪` : "不限";
        const max = item.areaMaxPing ? `${item.areaMaxPing} 坪` : "不限";
        chips.push(`${min} - ${max}`);
    }
    if (item.petFriendlyNeeded) chips.push("需可寵物");
    if (item.parkingNeeded) chips.push("需車位");
    if (item.canCookNeeded) chips.push("需可開伙");
    if (item.canRegisterHouseholdNeeded) chips.push("需可設籍");
    return chips;
}

export default function MyRequirementsPage() {
    const [items, setItems] = useState<TenantRequirement[]>([]);
    const [districtOptions, setDistrictOptions] = useState<TaiwanDistrictOption[]>([]);
    const [form, setForm] = useState<RequirementFormValues>(createRequirementFormInitialValues());
    const [editingId, setEditingId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const refresh = async () => setItems(await getMyRequirements());

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setError("");
                const [districts] = await Promise.all([
                    getTaiwanDistricts(),
                    refresh(),
                ]);
                setDistrictOptions(districts);
            } catch (err) {
                setError(err instanceof Error ? err.message : "讀取租屋需求失敗。");
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    const counts = useMemo(() => ({
        open: items.filter((item) => item.status === "OPEN").length,
        paused: items.filter((item) => item.status === "PAUSED").length,
        closed: items.filter((item) => item.status === "CLOSED").length,
    }), [items]);

    const resetForm = () => {
        setForm(createRequirementFormInitialValues());
        setEditingId(null);
    };

    const startEdit = (item: TenantRequirement) => {
        setEditingId(item.id);
        setForm(requirementToFormValues(item));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSubmit = async (payload: TenantRequirementPayload) => {
        setSaving(true);
        setError("");
        try {
            if (editingId) {
                await updateRequirement(editingId, payload);
            } else {
                await createRequirement(payload);
            }
            resetForm();
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "儲存租屋需求失敗。");
        } finally {
            setSaving(false);
        }
    };

    const handleStatus = async (id: number, status: TenantRequirementStatus) => {
        setSaving(true);
        setError("");
        try {
            await updateRequirementStatus(id, status);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "更新需求狀態失敗。");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="space-y-3">
                    <h1 className="text-4xl font-extrabold text-on-surface">我的租屋需求</h1>
                    <p className="max-w-3xl text-sm leading-[1.8] text-on-surface-variant">
                        建立可媒合的租屋需求，讓房東與仲介能用地區、租金、坪數、房型與必要條件判斷是否合適。
                    </p>
                </header>

                <section className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl bg-surface-container-lowest p-5">開放中 <strong className="ml-2 text-2xl">{counts.open}</strong></div>
                    <div className="rounded-2xl bg-surface-container-lowest p-5">暫停 <strong className="ml-2 text-2xl">{counts.paused}</strong></div>
                    <div className="rounded-2xl bg-surface-container-lowest p-5">已結案 <strong className="ml-2 text-2xl">{counts.closed}</strong></div>
                </section>

                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                    <h2 className="text-xl font-bold text-on-surface">{editingId ? "編輯租屋需求" : "建立租屋需求草稿"}</h2>
                    <div className="mt-5">
                        <TenantRequirementForm
                            key={editingId ?? "new"}
                            districtOptions={districtOptions}
                            initialValues={form}
                            submitting={saving}
                            submitLabel={editingId ? "儲存需求" : "建立需求"}
                            onSubmit={handleSubmit}
                            onCancel={editingId ? resetForm : undefined}
                        />
                    </div>
                    {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}
                </section>

                {loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取中...</div>
                ) : (
                    <section className="grid gap-4">
                        {items.map((item) => (
                            <article key={item.id} className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-on-surface-variant">{statusLabel[item.status]}</span>
                                        <h2 className="mt-3 text-xl font-bold text-on-surface">{formatDistricts(item)}</h2>
                                        <p className="mt-1 text-sm font-semibold text-on-surface">{formatBudget(item)}</p>
                                        <p className="mt-2 max-w-2xl text-sm leading-[1.75] text-on-surface-variant">{item.layoutNote || "尚未填寫格局需求。"}</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {conditionChips(item).map((chip) => (
                                                <span key={chip} className="rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">{chip}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" onClick={() => startEdit(item)} className="rounded-lg border border-outline-variant/25 bg-surface-container-low px-4 py-2 text-sm text-on-surface">編輯</button>
                                        <button type="button" onClick={() => void handleStatus(item.id, "OPEN")} className="rounded-lg bg-tertiary/10 px-4 py-2 text-sm font-bold text-tertiary">開放</button>
                                        <button type="button" onClick={() => void handleStatus(item.id, "PAUSED")} className="rounded-lg bg-surface-container-low px-4 py-2 text-sm text-on-surface">暫停</button>
                                        <button type="button" onClick={() => void handleStatus(item.id, "CLOSED")} className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">結案</button>
                                    </div>
                                </div>
                            </article>
                        ))}
                        {items.length === 0 ? (
                            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center text-sm text-on-surface-variant">
                                目前還沒有租屋需求。
                            </div>
                        ) : null}
                    </section>
                )}
            </main>
        </SiteLayout>
    );
}
