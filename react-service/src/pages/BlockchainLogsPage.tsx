import { useEffect, useMemo, useState } from "react";
import { getAuthMe } from "@/api/authApi";
import { getBlockchainLogs, type BlockchainLog } from "../api/listingApi";
import SiteLayout from "@/layouts/SiteLayout";

const ACTION_LABELS: Record<string, string> = {
    FUND: "資金入帳",
    ASSIGN_WORKER: "指派處理",
    APPROVE_TASK: "核准任務",
    CLAIM_REWARD: "領取獎勵",
};

const STATUS_LABELS: Record<string, string> = {
    SUCCESS: "成功",
    PENDING: "處理中",
    FAILED: "失敗",
};

const PAGE_SIZE = 10;
const BASESCAN_URL = "https://sepolia.basescan.org/tx/";

function formatAction(action: string): string {
    return ACTION_LABELS[action] ?? action;
}

function formatWallet(address?: string): string {
    if (!address) return "未知錢包";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function statusBadgeClass(status: string): string {
    if (status === "SUCCESS") return "bg-tertiary/10 text-tertiary";
    if (status === "PENDING") return "bg-amber-700/10 text-amber-700";
    return "bg-error/10 text-error";
}

export default function BlockchainLogsPage() {
    const [logs, setLogs] = useState<BlockchainLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isPlatformWallet, setIsPlatformWallet] = useState(false);
    const [walletAddress, setWalletAddress] = useState<string | undefined>(undefined);
    const [actionFilter, setActionFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState("");
    const [page, setPage] = useState(0);

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const [logsData, authData] = await Promise.all([
                getBlockchainLogs(),
                getAuthMe().catch(() => ({
                    authenticated: false,
                    address: undefined,
                    chainId: undefined,
                    isPlatformWallet: false,
                })),
            ]);
            setLogs(logsData);
            setIsPlatformWallet(authData.isPlatformWallet);
            setWalletAddress(authData.address);
        } catch (e) {
            setError(e instanceof Error ? e.message : "讀取鏈上紀錄失敗。");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const visibleLogs = useMemo(() => {
        let result = logs;
        if (walletAddress && !isPlatformWallet) {
            result = result.filter((log) => log.walletAddress.toLowerCase() === walletAddress.toLowerCase());
        }
        if (actionFilter !== "all") {
            result = result.filter((log) => log.action === actionFilter);
        }
        if (dateFilter) {
            result = result.filter((log) => new Date(log.createdAt).toISOString().slice(0, 10) === dateFilter);
        }
        return result;
    }, [actionFilter, dateFilter, isPlatformWallet, logs, walletAddress]);

    const totalPages = Math.max(1, Math.ceil(visibleLogs.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const paged = visibleLogs.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
    const availableActions = Array.from(new Set(logs.map((log) => log.action))).sort();

    const updateActionFilter = (value: string) => {
        setActionFilter(value);
        setPage(0);
    };

    const updateDateFilter = (value: string) => {
        setDateFilter(value);
        setPage(0);
    };

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 py-12 md:px-12 md:py-20">
                <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                    <div>
                        <span className="inline-flex rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface-variant">
                            舊版除錯紀錄
                        </span>
                        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">鏈上紀錄</h1>
                        <p className="mt-4 max-w-3xl text-base leading-[1.8] text-on-surface-variant">
                            此頁目前保留給營運與遷移檢查使用，尚不是後續 Property、Agency、Case、Stake 的正式使用者證明頁。
                        </p>
                    </div>

                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                        <p className="text-xs font-semibold text-on-surface-variant">可見範圍</p>
                        <h2 className="mt-3 text-lg font-bold text-on-surface">
                            {walletAddress ? (isPlatformWallet ? "平台錢包視角" : "目前錢包視角") : "公開舊版紀錄"}
                        </h2>
                        <p className="mt-3 text-sm leading-[1.75] text-on-surface-variant">
                            非平台錢包只會看到與自己錢包相符的紀錄。
                        </p>
                    </div>
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
                        <p className="text-xs font-semibold text-on-surface-variant">可見紀錄</p>
                        <p className="mt-2 text-2xl font-bold text-on-surface">{visibleLogs.length}</p>
                    </div>
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
                        <p className="text-xs font-semibold text-on-surface-variant">資料備註</p>
                        <p className="mt-2 text-sm leading-[1.75] text-on-surface-variant">後端仍保留舊欄位 <code>taskId</code>，此頁只把它當作參考編號。</p>
                    </div>
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
                        <p className="text-xs font-semibold text-on-surface-variant">重新整理</p>
                        <button type="button" onClick={() => void load()} className="mt-2 rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90">
                            重新讀取
                        </button>
                    </div>
                </section>

                <section className="sticky top-[80px] z-40 flex flex-col gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest/90 p-4 shadow-[0_8px_32px_rgba(28,25,23,0.04)] backdrop-blur-md md:flex-row md:items-center">
                    <label className="w-full text-xs font-semibold text-on-surface-variant md:w-72">
                        動作篩選
                        <select value={actionFilter} onChange={(event) => updateActionFilter(event.target.value)} className="mt-2 w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container">
                            <option value="all">全部動作</option>
                            {availableActions.map((action) => (
                                <option key={action} value={action}>{formatAction(action)}</option>
                            ))}
                        </select>
                    </label>
                    <label className="w-full text-xs font-semibold text-on-surface-variant md:w-64">
                        日期篩選
                        <input type="date" value={dateFilter} onChange={(event) => updateDateFilter(event.target.value)} className="mt-2 w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container" />
                    </label>
                </section>

                <section className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest">
                    {loading ? (
                        <div className="p-12 text-sm text-on-surface-variant">讀取鏈上紀錄中...</div>
                    ) : error ? (
                        <div className="p-12 text-sm text-error">{error}</div>
                    ) : paged.length === 0 ? (
                        <div className="p-12">
                            <h2 className="text-2xl font-bold text-on-surface">目前沒有紀錄</h2>
                            <p className="mt-3 max-w-2xl text-sm leading-[1.8] text-on-surface-variant">目前篩選條件沒有符合的舊版鏈上事件。</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-surface-container bg-surface-container-low text-xs font-semibold text-on-surface-variant">
                                        <th className="px-6 py-5">狀態</th>
                                        <th className="px-6 py-5">動作</th>
                                        <th className="px-6 py-5">錢包</th>
                                        <th className="px-6 py-5">參考編號</th>
                                        <th className="px-6 py-5">時間</th>
                                        <th className="px-6 py-5">交易 Hash</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paged.map((log) => (
                                        <tr key={log.id} className="border-b border-surface-container/70 transition-colors hover:bg-surface-container-low">
                                            <td className="px-6 py-5">
                                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass(log.status)}`}>
                                                    {STATUS_LABELS[log.status] ?? log.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <p className="font-bold text-on-surface">{formatAction(log.action)}</p>
                                                <p className="mt-1 text-xs text-on-surface-variant">{log.action}</p>
                                            </td>
                                            <td className="px-6 py-5 text-sm text-on-surface">{formatWallet(log.walletAddress)}</td>
                                            <td className="px-6 py-5 font-mono text-sm text-on-surface">{log.taskId || "無"}</td>
                                            <td className="px-6 py-5 text-sm text-on-surface-variant">{new Date(log.createdAt).toLocaleString("zh-TW")}</td>
                                            <td className="px-6 py-5">
                                                <a href={`${BASESCAN_URL}${log.txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 font-mono text-sm text-secondary hover:underline">
                                                    {log.txHash.slice(0, 6)}...{log.txHash.slice(-4)}
                                                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {!loading && !error && visibleLogs.length > 0 ? (
                        <div className="flex items-center justify-between border-t border-surface-container bg-surface-container-low px-6 py-4">
                            <span className="text-sm text-on-surface-variant">
                                顯示 {safePage * PAGE_SIZE + 1}-{Math.min((safePage + 1) * PAGE_SIZE, visibleLogs.length)}，共 {visibleLogs.length} 筆
                            </span>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={safePage === 0} className="rounded-lg border border-outline-variant/20 px-4 py-2 text-sm text-on-surface disabled:opacity-50">
                                    上一頁
                                </button>
                                <button type="button" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={safePage >= totalPages - 1} className="rounded-lg border border-outline-variant/20 px-4 py-2 text-sm text-on-surface disabled:opacity-50">
                                    下一頁
                                </button>
                            </div>
                        </div>
                    ) : null}
                </section>
            </main>
        </SiteLayout>
    );
}
