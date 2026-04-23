import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SiteLayout from "../layouts/SiteLayout";
import { getAgentDetail, type AgentDetailResponse } from "../api/agentApi";

function formatWallet(addr: string): string {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "載入失敗"))
            .finally(() => setLoading(false));
    }, [wallet]);

    return (
        <SiteLayout>
            <div className="mx-auto max-w-2xl px-6 py-12">
                {loading ? (
                    <div className="flex justify-center py-24">
                        <span className="animate-pulse text-sm text-on-surface-variant">載入中…</span>
                    </div>
                ) : error || !agent ? (
                    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <p className="text-on-surface-variant text-sm mb-4">找不到此仲介</p>
                        <button
                            type="button"
                            onClick={() => navigate("/agents")}
                            className="text-sm text-[#006c4a] hover:underline bg-transparent"
                        >
                            返回仲介列表
                        </button>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-8 shadow-sm">
                        <div className="inline-flex items-center gap-2 rounded-full bg-tertiary/10 px-3 py-1 text-xs font-bold text-tertiary mb-6">
                            <span className="material-symbols-outlined text-base"
                                style={{ fontVariationSettings: "'FILL' 1" }}>
                                verified_user
                            </span>
                            鏈上認證仲介
                        </div>

                        <h1 className="text-2xl font-extrabold text-on-surface mb-1">
                            {agent.displayName ?? formatWallet(agent.walletAddress)}
                        </h1>
                        <p className="font-mono text-sm text-on-surface-variant mb-8">
                            {agent.walletAddress}
                        </p>

                        <dl className="space-y-4 text-sm">
                            <div className="flex justify-between border-b border-surface-container pb-3">
                                <dt className="text-on-surface-variant">認證日期</dt>
                                <dd className="font-medium text-on-surface">{formatDate(agent.activatedAt)}</dd>
                            </div>
                            <div className="flex justify-between border-b border-surface-container pb-3">
                                <dt className="text-on-surface-variant">NFT Token ID</dt>
                                <dd className="font-mono text-on-surface">#{agent.nftTokenId}</dd>
                            </div>
                            {agent.txHash && (
                                <div className="flex justify-between pb-3">
                                    <dt className="text-on-surface-variant">鏈上交易</dt>
                                    <dd className="font-mono text-xs text-on-surface truncate max-w-[200px]">
                                        {agent.txHash.slice(0, 10)}…{agent.txHash.slice(-6)}
                                    </dd>
                                </div>
                            )}
                        </dl>

                        <p className="mt-8 text-xs text-on-surface-variant/60 text-center">
                            完整仲介主頁（服務區域、履歷、評價）將於後續版本開放
                        </p>
                    </div>
                )}
            </div>
        </SiteLayout>
    );
}
