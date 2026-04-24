import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAgentList, type AgentListItem } from "../api/agentApi";
import SiteLayout from "../layouts/SiteLayout";

function formatWallet(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
}

export default function AgentListPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [agents, setAgents] = useState<AgentListItem[]>([]);
    const [serviceArea, setServiceArea] = useState("");
    const [profileFilter, setProfileFilter] = useState<"all" | "complete" | "incomplete">("all");

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setError("");
                const resp = await getAgentList({
                    serviceArea: serviceArea.trim() || undefined,
                    profile: profileFilter === "all" ? undefined : profileFilter,
                });
                setAgents(resp.items);
            } catch (err) {
                setError(err instanceof Error ? err.message : "讀取仲介列表失敗。");
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [profileFilter, serviceArea]);

    return (
        <SiteLayout>
            <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="space-y-3">
                    <h1 className="text-4xl font-extrabold text-on-surface">認證仲介列表</h1>
                    <p className="max-w-3xl text-sm leading-[1.8] text-on-surface-variant">
                        這裡列出已啟用仲介身份 NFT 的會員。專頁資訊由仲介自行維護，平台協助揭露鏈上狀態與服務範圍。
                    </p>
                </header>

                <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 md:flex-row md:items-center">
                    <input
                        className="rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                        value={serviceArea}
                        onChange={(e) => setServiceArea(e.target.value)}
                        placeholder="篩選服務區域，例如：台北市"
                    />
                    <select
                        className="rounded-lg border-0 bg-surface-container-low px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                        value={profileFilter}
                        onChange={(e) => setProfileFilter(e.target.value as "all" | "complete" | "incomplete")}
                    >
                        <option value="all">全部專頁</option>
                        <option value="complete">專頁完整</option>
                        <option value="incomplete">專頁未完整</option>
                    </select>
                </section>

                {loading ? (
                    <div className="flex justify-center py-24">
                        <span className="animate-pulse text-sm text-on-surface-variant">讀取中...</span>
                    </div>
                ) : error ? (
                    <div className="rounded-xl border border-error/20 bg-error-container p-8 text-sm text-on-error-container">
                        {error}
                    </div>
                ) : agents.length === 0 ? (
                    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <p className="text-sm text-on-surface-variant">目前沒有符合條件的認證仲介。</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {agents.map((agent) => (
                            <Link
                                key={agent.walletAddress}
                                to={`/agents/${agent.walletAddress}`}
                                className="block rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
                            >
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-2xl text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
                                            verified_user
                                        </span>
                                        <div>
                                            <p className="text-sm font-bold text-on-surface">
                                                {agent.displayName ?? formatWallet(agent.walletAddress)}
                                            </p>
                                            <p className="font-mono text-xs text-on-surface-variant">
                                                {formatWallet(agent.walletAddress)}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${agent.isProfileComplete ? "bg-tertiary/10 text-tertiary" : "bg-surface-container-low text-on-surface-variant"}`}>
                                        {agent.isProfileComplete ? "專頁完整" : "待補資料"}
                                    </span>
                                </div>
                                <p className="min-h-10 text-sm leading-[1.75] text-on-surface-variant">
                                    {agent.headline ?? "此仲介尚未填寫服務介紹。"}
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {agent.serviceAreas.slice(0, 4).map((area) => (
                                        <span key={area} className="rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">{area}</span>
                                    ))}
                                </div>
                                <div className="mt-5 flex items-center justify-between text-xs text-on-surface-variant">
                                    <span>NFT #{agent.nftTokenId}</span>
                                    <span>啟用於 {formatDate(agent.activatedAt)}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </SiteLayout>
    );
}
