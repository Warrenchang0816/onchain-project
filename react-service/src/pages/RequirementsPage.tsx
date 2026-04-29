import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getRequirementList, type TenantRequirement, type TenantRequirementStatus } from "@/api/tenantApi";
import SiteLayout from "@/layouts/SiteLayout";

const statusLabel: Record<TenantRequirementStatus, string> = {
    OPEN: "開放媒合",
    PAUSED: "暫停",
    CLOSED: "已關閉",
};

function formatBudget(item: TenantRequirement) {
    return `NT$ ${item.budgetMin.toLocaleString()} - ${item.budgetMax.toLocaleString()}`;
}

export default function RequirementsPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [items, setItems] = useState<TenantRequirement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const district = searchParams.get("district") ?? "";
    const status = (searchParams.get("status") ?? "OPEN") as TenantRequirementStatus;

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setError("");
                setItems(await getRequirementList({ district: district.trim() || undefined, status }));
            } catch (err) {
                setError(err instanceof Error ? err.message : "讀取租屋需求失敗。");
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [district, status]);

    const updateFilter = (key: string, value: string) => {
        const next = new URLSearchParams(searchParams);
        if (value) next.set(key, value);
        else next.delete(key);
        setSearchParams(next);
    };

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="space-y-3">
                    <h1 className="text-4xl font-extrabold text-on-surface">租屋需求列表</h1>
                    <p className="max-w-3xl text-sm leading-[1.8] text-on-surface-variant">
                        屋主與仲介可瀏覽租客自行公開的需求條件。進一步媒合前，仍需由各方自行確認資料與意願。
                    </p>
                </header>

                <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 md:flex-row md:items-center">
                    <input
                        className="rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                        value={district}
                        onChange={(e) => updateFilter("district", e.target.value)}
                        placeholder="篩選區域，例如：信義區"
                    />
                    <select
                        className="rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                        value={status}
                        onChange={(e) => updateFilter("status", e.target.value)}
                    >
                        <option value="OPEN">開放媒合</option>
                        <option value="PAUSED">暫停</option>
                    </select>
                    <button type="button" onClick={() => setSearchParams(new URLSearchParams({ status: "OPEN" }))} className="rounded-lg border border-outline-variant/25 bg-transparent px-4 py-3 text-sm text-on-surface">
                        清除篩選
                    </button>
                </section>

                {loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取中...</div>
                ) : error ? (
                    <div className="rounded-xl border border-error/20 bg-error-container p-6 text-sm text-on-error-container">{error}</div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center text-sm text-on-surface-variant">
                        目前沒有符合條件的租屋需求。
                    </div>
                ) : (
                    <section className="grid gap-4 md:grid-cols-2">
                        {items.map((item) => (
                            <article key={item.id} className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5" onClick={() => navigate(`/requirements/${item.id}`)}>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs font-bold text-tertiary">{statusLabel[item.status]}</span>
                                        <h2 className="mt-4 text-xl font-bold text-on-surface">{item.targetDistrict}</h2>
                                    </div>
                                    {item.hasAdvancedData ? (
                                        <span className="rounded-full bg-primary-container/15 px-3 py-1 text-xs font-bold text-primary-container">資料較完整</span>
                                    ) : null}
                                </div>
                                <p className="mt-4 text-lg font-extrabold text-on-surface">{formatBudget(item)}</p>
                                <p className="mt-2 line-clamp-2 text-sm leading-[1.75] text-on-surface-variant">{item.layoutNote || "租客尚未補充格局需求。"}</p>
                                <div className="mt-4 flex flex-wrap gap-2 text-xs text-on-surface-variant">
                                    {item.moveInDate ? <span className="rounded-full bg-surface-container-low px-3 py-1">可入住：{item.moveInDate}</span> : null}
                                    {item.petFriendlyNeeded ? <span className="rounded-full bg-surface-container-low px-3 py-1">需可養寵物</span> : null}
                                    {item.parkingNeeded ? <span className="rounded-full bg-surface-container-low px-3 py-1">需車位</span> : null}
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </main>
        </SiteLayout>
    );
}
