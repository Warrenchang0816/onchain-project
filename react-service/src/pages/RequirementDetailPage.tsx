import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRequirementDetail, type TenantRequirement } from "@/api/tenantApi";
import SiteLayout from "@/layouts/SiteLayout";

function formatBudget(item: TenantRequirement) {
    return `NT$ ${item.budgetMin.toLocaleString()} - ${item.budgetMax.toLocaleString()}`;
}

function statusLabel(status: TenantRequirement["status"]) {
    if (status === "OPEN") return "開放中";
    if (status === "PAUSED") return "暫停";
    return "已關閉";
}

export default function RequirementDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const requirementId = Number(id);
    const hasValidId = Number.isFinite(requirementId);
    const [item, setItem] = useState<TenantRequirement | null>(null);
    const [loading, setLoading] = useState(hasValidId);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!hasValidId) {
            return;
        }
        getRequirementDetail(requirementId)
            .then(setItem)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取租屋需求失敗"))
            .finally(() => setLoading(false));
    }, [hasValidId, requirementId]);

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12">
                <button type="button" onClick={() => navigate("/requirements")} className="self-start bg-transparent text-sm text-on-surface-variant hover:text-primary-container">
                    返回需求列表
                </button>

                {!hasValidId ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <h1 className="text-2xl font-bold text-on-surface">需求編號無效</h1>
                    </section>
                ) : loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取中...</div>
                ) : error || !item ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <h1 className="text-2xl font-bold text-on-surface">找不到租屋需求</h1>
                        <p className="mt-2 text-sm text-on-surface-variant">{error || "這筆需求可能已關閉或無法查看。"}</p>
                    </section>
                ) : (
                    <>
                        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs font-bold text-tertiary">{statusLabel(item.status)}</span>
                                    <h1 className="mt-5 text-4xl font-extrabold text-on-surface">{item.targetDistrict || "租屋需求"}</h1>
                                    <p className="mt-3 text-xl font-bold text-on-surface">{formatBudget(item)}</p>
                                </div>
                                {item.hasAdvancedData ? <span className="rounded-full bg-primary-container/15 px-4 py-2 text-xs font-bold text-primary-container">進階租客資料</span> : null}
                            </div>
                            <p className="mt-8 whitespace-pre-wrap text-sm leading-[1.9] text-on-surface-variant">{item.layoutNote || "租客尚未填寫格局或生活需求。"}</p>
                        </section>

                        <section className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl bg-surface-container-lowest p-5">
                                <p className="text-sm text-on-surface-variant">入住日期</p>
                                <p className="mt-2 text-lg font-bold text-on-surface">{item.moveInDate ?? "未設定"}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-lowest p-5">
                                <p className="text-sm text-on-surface-variant">寵物需求</p>
                                <p className="mt-2 text-lg font-bold text-on-surface">{item.petFriendlyNeeded ? "需要可養寵物" : "未設定"}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-lowest p-5">
                                <p className="text-sm text-on-surface-variant">車位需求</p>
                                <p className="mt-2 text-lg font-bold text-on-surface">{item.parkingNeeded ? "需要車位" : "未設定"}</p>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                            <h2 className="text-xl font-bold text-on-surface">進階租客資料</h2>
                            {item.hasAdvancedData ? (
                                <div className="mt-4 grid gap-4 md:grid-cols-3">
                                    <div>
                                        <p className="text-xs text-on-surface-variant">職業類型</p>
                                        <p className="mt-1 font-bold text-on-surface">{item.occupationType ?? "未提供"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-on-surface-variant">收入範圍</p>
                                        <p className="mt-1 font-bold text-on-surface">{item.incomeRange ?? "未提供"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-on-surface-variant">入住時程</p>
                                        <p className="mt-1 font-bold text-on-surface">{item.moveInTimeline ?? "未提供"}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="mt-3 text-sm leading-[1.8] text-on-surface-variant">租客尚未提供進階資料，或目前身分無法查看。</p>
                            )}
                        </section>
                    </>
                )}
            </main>
        </SiteLayout>
    );
}
