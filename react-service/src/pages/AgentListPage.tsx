import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteLayout from "../layouts/SiteLayout";
import { getAgentList, type AgentListItem } from "../api/agentApi";

function formatWallet(addr: string): string {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
}

export default function AgentListPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [agents, setAgents] = useState<AgentListItem[]>([]);

    useEffect(() => {
        getAgentList()
            .then((resp) => setAgents(resp.items))
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "載入失敗"))
            .finally(() => setLoading(false));
    }, []);

    return (
        <SiteLayout>
            <section className="mx-auto max-w-[1440px] px-6 md:px-12 py-12">
                <h1 className="text-3xl font-extrabold text-on-surface mb-2">認證仲介列表</h1>
                <p className="text-on-surface-variant text-sm mb-10">
                    以下仲介已通過 IdentityNFT 鏈上認證，身份可公開驗證。
                </p>

                {loading ? (
                    <div className="flex justify-center py-24">
                        <span className="animate-pulse text-sm text-on-surface-variant">載入中…</span>
                    </div>
                ) : error ? (
                    <div className="rounded-xl border border-error/20 bg-error-container p-8 text-sm text-on-error-container">
                        {error}
                    </div>
                ) : agents.length === 0 ? (
                    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <p className="text-on-surface-variant text-sm">目前尚無認證仲介</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {agents.map((agent) => (
                            <Link
                                key={agent.walletAddress}
                                to={`/agents/${agent.walletAddress}`}
                                className="block rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 hover:-translate-y-0.5 transition-transform"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="material-symbols-outlined text-2xl text-[#E8B800]"
                                        style={{ fontVariationSettings: "'FILL' 1" }}>
                                        verified_user
                                    </span>
                                    <div>
                                        <p className="font-bold text-on-surface text-sm">
                                            {agent.displayName ?? formatWallet(agent.walletAddress)}
                                        </p>
                                        <p className="font-mono text-xs text-on-surface-variant">
                                            {formatWallet(agent.walletAddress)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs text-on-surface-variant">
                                    <span>NFT #{agent.nftTokenId}</span>
                                    <span>認證於 {formatDate(agent.activatedAt)}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </SiteLayout>
    );
}
