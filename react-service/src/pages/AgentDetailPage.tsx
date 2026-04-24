import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAgentDetail, type AgentDetailResponse } from "../api/agentApi";
import SiteLayout from "../layouts/SiteLayout";

function formatWallet(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
}

export default function AgentDetailPage() {
    const { wallet } = useParams<{ wallet: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [agent, setAgent] = useState<AgentDetailResponse | null>(null);

    useEffect(() => {
        if (!wallet) return;
        getAgentDetail(wallet)
            .then(setAgent)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取仲介詳情失敗。"))
            .finally(() => setLoading(false));
    }, [wallet]);

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-6 py-12 md:px-12">
                <button type="button" onClick={() => navigate("/agents")} className="self-start bg-transparent text-sm text-on-surface-variant hover:text-primary-container">
                    返回仲介列表
                </button>

                {loading ? (
                    <div className="flex justify-center py-24">
                        <span className="animate-pulse text-sm text-on-surface-variant">讀取中...</span>
                    </div>
                ) : error || !agent ? (
                    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <p className="mb-4 text-sm text-on-surface-variant">找不到此仲介。</p>
                        <p className="text-xs text-error">{error}</p>
                    </div>
                ) : (
                    <>
                        <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-8 shadow-sm">
                            <div className="mb-6 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-2 rounded-full bg-tertiary/10 px-3 py-1 text-xs font-bold text-tertiary">
                                    <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        verified_user
                                    </span>
                                    鏈上認證仲介
                                </span>
                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${agent.isProfileComplete ? "bg-primary-container/15 text-primary-container" : "bg-surface-container-low text-on-surface-variant"}`}>
                                    {agent.isProfileComplete ? "專頁完整" : "專頁待補"}
                                </span>
                            </div>

                            <h1 className="text-3xl font-extrabold text-on-surface">
                                {agent.displayName ?? formatWallet(agent.walletAddress)}
                            </h1>
                            {agent.headline ? <p className="mt-3 text-lg font-bold text-on-surface">{agent.headline}</p> : null}
                            <p className="mt-3 break-all font-mono text-sm text-on-surface-variant">{agent.walletAddress}</p>

                            <dl className="mt-8 grid gap-4 text-sm md:grid-cols-3">
                                <div className="rounded-xl bg-surface-container-low p-4">
                                    <dt className="text-on-surface-variant">啟用日期</dt>
                                    <dd className="mt-2 font-bold text-on-surface">{formatDate(agent.activatedAt)}</dd>
                                </div>
                                <div className="rounded-xl bg-surface-container-low p-4">
                                    <dt className="text-on-surface-variant">NFT Token ID</dt>
                                    <dd className="mt-2 font-mono font-bold text-on-surface">#{agent.nftTokenId}</dd>
                                </div>
                                <div className="rounded-xl bg-surface-container-low p-4">
                                    <dt className="text-on-surface-variant">交易 Hash</dt>
                                    <dd className="mt-2 truncate font-mono text-xs text-on-surface">{agent.txHash ? `${agent.txHash.slice(0, 10)}...${agent.txHash.slice(-6)}` : "未提供"}</dd>
                                </div>
                            </dl>
                        </section>

                        {agent.bio ? (
                            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                                <h2 className="text-xl font-bold text-on-surface">服務介紹</h2>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-[1.8] text-on-surface-variant">{agent.bio}</p>
                            </section>
                        ) : null}

                        {agent.serviceAreas.length > 0 ? (
                            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                                <h2 className="text-xl font-bold text-on-surface">服務區域</h2>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {agent.serviceAreas.map((area) => (
                                        <span key={area} className="rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">{area}</span>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        {agent.licenseNote ? (
                            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                                <h2 className="text-xl font-bold text-on-surface">證照與經歷備註</h2>
                                <p className="mt-3 text-sm leading-[1.8] text-on-surface-variant">{agent.licenseNote}</p>
                            </section>
                        ) : null}
                    </>
                )}
            </main>
        </SiteLayout>
    );
}
