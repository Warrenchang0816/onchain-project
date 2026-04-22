import { useEffect, useMemo, useState } from "react";
import SiteLayout from "@/layouts/SiteLayout";
import { getBlockchainLogs, type BlockchainLog } from "../api/listingApi";
import { getAuthMe } from "@/api/authApi";

const ACTION_LABELS: Record<string, string> = {
    FUND: "Funding",
    ASSIGN_WORKER: "Assignment",
    APPROVE_TASK: "Approval",
    CLAIM_REWARD: "Claim",
};

const LEGACY_BANNER =
    "This page is a legacy/operator debug feed. It is not yet the user-facing on-chain proof surface for Property, Agency, Case, or Stake.";

const PAGE_SIZE = 10;
const BASESCAN_URL = "https://sepolia.basescan.org/tx/";

function formatAction(action: string): string {
    return ACTION_LABELS[action] ?? action;
}

function formatWallet(address?: string): string {
    if (!address) return "Unknown wallet";
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
            setError(e instanceof Error ? e.message : "Failed to load legacy logs.");
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

    useEffect(() => {
        setPage(0);
    }, [actionFilter, dateFilter]);

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 py-12 md:px-12 md:py-20">
                <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                            Legacy debug surface
                        </div>
                        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
                            Blockchain log feed
                        </h1>
                        <p className="mt-4 max-w-3xl text-base leading-[1.8] text-on-surface-variant">
                            This view is kept only as an operator and migration aid. It does not represent the future user-facing proof layers planned for the housing platform.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Access scope</div>
                        <div className="mt-3 text-lg font-bold text-on-surface">
                            {walletAddress
                                ? isPlatformWallet
                                    ? "Platform wallet view"
                                    : "Wallet-scoped view"
                                : "Public legacy view"}
                        </div>
                        <p className="mt-3 text-sm leading-[1.75] text-on-surface-variant">
                            {walletAddress && !isPlatformWallet
                                ? "Because this wallet is not marked as a platform wallet, only logs that match the current wallet are shown."
                                : "When no scoped wallet rule applies, the page shows the available legacy log feed."}
                        </p>
                    </div>
                </section>

                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 text-sm leading-[1.8] text-on-surface-variant">
                    {LEGACY_BANNER}
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Visible records</div>
                        <div className="mt-2 text-2xl font-bold text-on-surface">{visibleLogs.length}</div>
                    </div>
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Current schema note</div>
                        <div className="mt-2 text-sm leading-[1.75] text-on-surface-variant">
                            The backend still emits <code>taskId</code>. This UI now treats it as a legacy reference ID only.
                        </div>
                    </div>
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Refresh</div>
                        <button
                            type="button"
                            onClick={() => void load()}
                            className="mt-2 rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container hover:opacity-90 transition-opacity"
                        >
                            Reload logs
                        </button>
                    </div>
                </section>

                <section className="sticky top-[80px] z-40 flex flex-col gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest/90 p-4 shadow-[0_8px_32px_rgba(28,25,23,0.04)] backdrop-blur-md md:flex-row md:items-center">
                    <div className="w-full md:w-72">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                            Action filter
                        </label>
                        <select
                            value={actionFilter}
                            onChange={(event) => setActionFilter(event.target.value)}
                            className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                        >
                            <option value="all">All legacy actions</option>
                            {availableActions.map((action) => (
                                <option key={action} value={action}>
                                    {formatAction(action)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="w-full md:w-64">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                            Date filter
                        </label>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(event) => setDateFilter(event.target.value)}
                            className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                        />
                    </div>
                </section>

                <section className="overflow-hidden rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest">
                    {loading ? (
                        <div className="p-12 text-sm text-on-surface-variant">Loading legacy debug events...</div>
                    ) : error ? (
                        <div className="p-12 text-sm text-error">{error}</div>
                    ) : paged.length === 0 ? (
                        <div className="p-12">
                            <h2 className="text-2xl font-bold text-on-surface">No legacy debug events yet</h2>
                            <p className="mt-3 max-w-2xl text-sm leading-[1.8] text-on-surface-variant">
                                The current filter did not match any stored legacy chain events. That does not block Gate 0 housing flows.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-surface-container bg-surface-container-low text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                                        <th className="px-6 py-5">Status</th>
                                        <th className="px-6 py-5">Action</th>
                                        <th className="px-6 py-5">Wallet</th>
                                        <th className="px-6 py-5">Reference ID</th>
                                        <th className="px-6 py-5">Timestamp</th>
                                        <th className="px-6 py-5">Tx hash</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paged.map((log) => (
                                        <tr key={log.id} className="border-b border-surface-container/70 transition-colors hover:bg-surface-container-low">
                                            <td className="px-6 py-5">
                                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass(log.status)}`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="font-bold text-on-surface">{formatAction(log.action)}</div>
                                                <div className="mt-1 text-xs text-on-surface-variant">{log.action}</div>
                                            </td>
                                            <td className="px-6 py-5 text-sm text-on-surface">{formatWallet(log.walletAddress)}</td>
                                            <td className="px-6 py-5">
                                                <div className="font-mono text-sm text-on-surface">{log.taskId || "N/A"}</div>
                                            </td>
                                            <td className="px-6 py-5 text-sm text-on-surface-variant">
                                                {new Date(log.createdAt).toLocaleString("zh-TW")}
                                            </td>
                                            <td className="px-6 py-5">
                                                <a
                                                    href={`${BASESCAN_URL}${log.txHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm font-mono text-secondary hover:underline"
                                                >
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
                                Showing {safePage * PAGE_SIZE + 1}-{Math.min((safePage + 1) * PAGE_SIZE, visibleLogs.length)} of {visibleLogs.length}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                                    disabled={safePage === 0}
                                    className="rounded-lg border border-outline-variant/20 px-4 py-2 text-sm text-on-surface disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                                    disabled={safePage >= totalPages - 1}
                                    className="rounded-lg border border-outline-variant/20 px-4 py-2 text-sm text-on-surface disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    ) : null}
                </section>
            </main>
        </SiteLayout>
    );
}
