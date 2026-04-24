import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRequirementDetail, type TenantRequirement } from "@/api/tenantApi";
import SiteLayout from "@/layouts/SiteLayout";

function formatBudget(item: TenantRequirement) {
    return `NT$ ${item.budgetMin.toLocaleString()} - ${item.budgetMax.toLocaleString()}`;
}

export default function RequirementDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const requirementId = Number(id);
    const hasValidId = Number.isFinite(requirementId);
    const [item, setItem] = useState<TenantRequirement | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!hasValidId) {
            return;
        }
        getRequirementDetail(requirementId)
            .then(setItem)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取租屋需求失敗。"))
            .finally(() => setLoading(false));
    }, [hasValidId, requirementId]);

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12">
                <button type="button" onClick={() => navigate("/requirements")} className="self-start bg-transparent text-sm text-on-surface-variant hover:text-primary-container">
                    返回租屋需求列表
                </button>

                {!hasValidId ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <h1 className="text-2xl font-bold text-on-surface">租屋需求編號不正確</h1>
                    </section>
                ) : loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取中...</div>
                ) : error || !item ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <h1 className="text-2xl font-bold text-on-surface">找不到租屋需求</h1>
                        <p className="mt-2 text-sm text-on-surface-variant">{error || "此需求可能已關閉。"}</p>
                    </section>
                ) : (
                    <>
                        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs font-bold text-tertiary">
                                        {item.status === "OPEN" ? "開放媒合" : item.status === "PAUSED" ? "暫停" : "已關閉"}
                                    </span>
                                    <h1 className="mt-5 text-4xl font-extrabold text-on-surface">{item.targetDistrict}</h1>
                                    <p className="mt-3 text-xl font-bold text-on-surface">{formatBudget(item)}</p>
                                </div>
                                {item.hasAdvancedData ? (
                                    <span className="rounded-full bg-primary-container/15 px-4 py-2 text-xs font-bold text-primary-container">租客資料較完整</span>
                                ) : null}
                            </div>
                            <p className="mt-8 whitespace-pre-wrap text-sm leading-[1.9] text-on-surface-variant">
                                {item.layoutNote || "租客尚未補充格局或生活機能需求。"}
                            </p>
                        </section>

                        <section className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl bg-surface-container-lowest p-5">
                                <p className="text-sm text-on-surface-variant">可入住日期</p>
                                <p className="mt-2 text-lg font-bold text-on-surface">{item.moveInDate ?? "未指定"}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-lowest p-5">
                                <p className="text-sm text-on-surface-variant">寵物需求</p>
                                <p className="mt-2 text-lg font-bold text-on-surface">{item.petFriendlyNeeded ? "需要可養寵物" : "未指定"}</p>
                            </div>
                            <div className="rounded-2xl bg-surface-container-lowest p-5">
                                <p className="text-sm text-on-surface-variant">車位需求</p>
                                <p className="mt-2 text-lg font-bold text-on-surface">{item.parkingNeeded ? "需要車位" : "未指定"}</p>
                            </div>
                        </section>

                        {item.hasAdvancedData ? (
                            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                                <h2 className="text-xl font-bold text-on-surface">租客補充資料</h2>
                                <div className="mt-4 grid gap-4 md:grid-cols-3">
                                    <div>
                                        <p className="text-xs text-on-surface-variant">職業類型</p>
                                        <p className="mt-1 font-bold text-on-surface">{item.occupationType ?? "未提供"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-on-surface-variant">收入區間</p>
                                        <p className="mt-1 font-bold text-on-surface">{item.incomeRange ?? "未提供"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-on-surface-variant">搬入時程</p>
                                        <p className="mt-1 font-bold text-on-surface">{item.moveInTimeline ?? "未提供"}</p>
                                    </div>
                                </div>
                            </section>
                        ) : null}
                    </>
                )}
            </main>
        </SiteLayout>
    );
}
