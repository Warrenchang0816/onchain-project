import { useEffect, useState } from "react";
import SiteLayout from "@/layouts/SiteLayout";
import { getBlockchainLogs, type BlockchainLog } from "../api/listingApi";
import { getAuthMe } from "@/api/authApi";

const ACTION_LABELS: Record<string, string> = {
    FUND:          "注資",
    ASSIGN_WORKER: "指派",
    APPROVE_TASK:  "核准",
    CLAIM_REWARD:  "請款",
};

const ACTION_SUBTITLE: Record<string, string> = {
    FUND:          "Fund Injection",
    ASSIGN_WORKER: "Worker Assigned",
    APPROVE_TASK:  "Task Approved",
    CLAIM_REWARD:  "Reward Claimed",
};

const SEPOLIA_BASE_SCAN = "https://sepolia.basescan.org/tx/";

const PAGE_SIZE = 10;

const BlockchainLogsPage = () => {
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
        try {
            const [logsData, authData] = await Promise.all([getBlockchainLogs(), getAuthMe()]);
            setLogs(logsData);
            setIsPlatformWallet(authData.isPlatformWallet);
            setWalletAddress(authData.address);
        } catch (e) {
            setError(e instanceof Error ? e.message : "載入鏈上紀錄失敗");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const filtered = (() => {
        let result = isPlatformWallet
            ? logs
            : logs.filter((log) => walletAddress && log.walletAddress.toLowerCase() === walletAddress.toLowerCase());

        if (actionFilter !== "all") {
            result = result.filter((log) => log.action === actionFilter);
        }
        if (dateFilter) {
            result = result.filter((log) => {
                const d = new Date(log.createdAt).toISOString().slice(0, 10);
                return d === dateFilter;
            });
        }
        return result;
    })();

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return (
        <SiteLayout>
            <main className="flex-grow w-full max-w-[1440px] mx-auto px-6 md:px-12 py-12 md:py-20">
                {/* Page Header */}
                <div className="mb-12">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-on-surface mb-4 tracking-tight leading-tight">鏈上足跡</h1>
                    <p className="text-lg text-on-surface-variant max-w-2xl leading-[1.75]">
                        透明、不可篡改的交易與互動紀錄。每一筆活動都在區塊鏈上留下永恆的印記。
                    </p>
                </div>

                {/* Filter Bar */}
                <section className="mb-8 flex flex-col md:flex-row gap-4 bg-surface-container-lowest p-4 rounded-xl shadow-[0_8px_32px_rgba(28,25,23,0.04)] sticky top-[80px] z-40 backdrop-blur-md bg-opacity-80">
                    {/* Action Type Dropdown */}
                    <div className="relative w-full md:w-64">
                        <select
                            value={actionFilter}
                            onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
                            className="w-full appearance-none bg-surface-container-low border-none text-on-surface text-sm font-medium rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-primary-container outline-none transition-shadow cursor-pointer"
                        >
                            <option value="all">所有活動 (All Activities)</option>
                            <option value="FUND">注資 (Fund)</option>
                            <option value="ASSIGN_WORKER">指派 (Assign)</option>
                            <option value="APPROVE_TASK">核准 (Approve)</option>
                            <option value="CLAIM_REWARD">請款 (Claim)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-on-surface-variant">
                            <span className="material-symbols-outlined text-xl">expand_more</span>
                        </div>
                    </div>

                    {/* Date Filter */}
                    <div className="relative w-full md:w-64">
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => { setDateFilter(e.target.value); setPage(0); }}
                            className="w-full appearance-none bg-surface-container-low border-none text-on-surface text-sm font-medium rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-container outline-none transition-shadow cursor-pointer"
                        />
                    </div>

                    <div className="flex-grow" />

                    {/* Actions */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => void load()}
                            className="p-3 bg-surface-container-low rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors flex items-center justify-center"
                            title="Refresh"
                        >
                            <span className="material-symbols-outlined">refresh</span>
                        </button>
                        <button
                            type="button"
                            className="px-4 py-3 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-on-surface text-sm font-medium hover:bg-surface-container-low transition-colors flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[18px]">download</span>
                            匯出紀錄
                        </button>
                    </div>
                </section>

                {/* Table */}
                <section className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(28,25,23,0.03)]">
                    {loading ? (
                        <div className="px-6 py-20 text-center text-on-surface-variant text-sm animate-pulse">載入中...</div>
                    ) : error ? (
                        <div className="px-6 py-20 text-center text-error text-sm">{error}</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider font-semibold border-b border-surface-variant/50">
                                        <th className="px-6 py-5 w-[60px]">狀態</th>
                                        <th className="px-6 py-5 min-w-[180px]">活動類型</th>
                                        <th className="px-6 py-5 min-w-[200px]">標的 / 關聯</th>
                                        <th className="px-6 py-5 min-w-[140px]">時間戳記</th>
                                        <th className="px-6 py-5 min-w-[180px]">交易哈希 (Tx Hash)</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm font-medium text-on-surface">
                                    {paged.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center justify-center text-on-surface-variant">
                                                    <span className="material-symbols-outlined text-4xl mb-4 opacity-50">receipt_long</span>
                                                    <p className="text-lg font-bold mb-1">尚無鏈上足跡</p>
                                                    <p className="text-sm">當您開始進行交易或簽署合約時，紀錄將顯示於此。</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : paged.map((log) => (
                                        <tr key={log.id} className="border-b border-surface-variant/30 hover:bg-[#FFFBEB] transition-colors duration-200 group">
                                            {/* Status */}
                                            <td className="px-6 py-5">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${log.status === "SUCCESS" ? "bg-tertiary/10 text-tertiary" : "bg-error/10 text-error"}`}>
                                                    <span className="material-symbols-outlined text-[18px]">
                                                        {log.status === "SUCCESS" ? "check_circle" : "error"}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Action type */}
                                            <td className="px-6 py-5">
                                                <div className="font-bold text-base text-on-surface">
                                                    {ACTION_LABELS[log.action] ?? log.action}
                                                </div>
                                                <div className="text-xs text-on-surface-variant mt-0.5">
                                                    {ACTION_SUBTITLE[log.action] ?? log.action}
                                                </div>
                                            </td>

                                            {/* Target */}
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant shrink-0">
                                                        <span className="material-symbols-outlined">person</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold block">
                                                            {log.walletAddress
                                                                ? `${log.walletAddress.slice(0, 6)}...${log.walletAddress.slice(-4)}`
                                                                : "—"}
                                                        </span>
                                                        <span className="text-xs text-on-surface-variant">任務 {log.taskId}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Timestamp */}
                                            <td className="px-6 py-5 text-on-surface-variant whitespace-nowrap">
                                                {new Date(log.createdAt).toLocaleString("zh-TW")}
                                            </td>

                                            {/* Tx Hash */}
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[#E8B800] bg-primary-container/10 px-2 py-1 rounded">
                                                        {`${log.txHash.slice(0, 6)}...${log.txHash.slice(-4)}`}
                                                    </span>
                                                    <a
                                                        href={`${SEPOLIA_BASE_SCAN}${log.txHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-on-surface-variant hover:text-secondary transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                                    </a>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {!loading && !error && filtered.length > 0 && (
                        <div className="bg-surface-container-low px-6 py-4 flex items-center justify-between border-t border-surface-variant/50">
                            <span className="text-sm text-on-surface-variant">
                                顯示 {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, filtered.length)} 筆，共 {filtered.length} 筆紀錄
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="p-2 bg-transparent rounded hover:bg-surface-variant text-on-surface-variant disabled:opacity-50 transition-colors"
                                >
                                    <span className="material-symbols-outlined">chevron_left</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1}
                                    className="p-2 bg-transparent rounded hover:bg-surface-variant text-on-surface-variant disabled:opacity-50 transition-colors"
                                >
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </SiteLayout>
    );
};

export default BlockchainLogsPage;
