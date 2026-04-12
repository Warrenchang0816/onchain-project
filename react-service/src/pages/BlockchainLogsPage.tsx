import { useEffect, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { getBlockchainLogs, type BlockchainLog } from "../api/taskApi";
import { getAuthMe } from "../api/authApi";

const ACTION_LABELS: Record<string, string> = {
    FUND: "Fund",
    ASSIGN_WORKER: "Assign Worker",
    APPROVE_TASK: "Approve",
    CLAIM_REWARD: "Claim Reward",
};

const BlockchainLogsPage = () => {
    const [logs, setLogs] = useState<BlockchainLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isPlatformWallet, setIsPlatformWallet] = useState(false);
    const [walletAddress, setWalletAddress] = useState<string | undefined>(undefined);

    useEffect(() => {
        const init = async () => {
            try {
                const [logsData, authData] = await Promise.all([
                    getBlockchainLogs(),
                    getAuthMe(),
                ]);
                setLogs(logsData);
                setIsPlatformWallet(authData.isPlatformWallet);
                setWalletAddress(authData.address);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to load.");
            } finally {
                setLoading(false);
            }
        };
        void init();
    }, []);

    const displayedLogs =
        isPlatformWallet
            ? logs
            : logs.filter(
                (l) => walletAddress && l.walletAddress.toLowerCase() === walletAddress.toLowerCase()
            );

    const totalLogs = displayedLogs.length;
    const successLogs = displayedLogs.filter((l) => l.status === "SUCCESS").length;
    const successRate = totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 0;

    return (
        <AppLayout>
            <div className="page-container">
                <div className="page-heading page-heading-row">
                    <div>
                        <h2>Transaction History</h2>
                        <p style={{ color: "#6b7280", marginTop: "4px" }}>
                            {isPlatformWallet ? "All on-chain transactions recorded by the platform" : "Your on-chain transaction records"}
                        </p>
                    </div>
                </div>

                {!loading && !error && (
                    <div className="logs-stats-grid">
                        <div className="logs-stat-card">
                            <h3>Total Transactions</h3>
                            <p>{totalLogs}</p>
                        </div>
                        <div className="logs-stat-card">
                            <h3>Successful</h3>
                            <p>{successLogs}</p>
                        </div>
                        <div className="logs-stat-card">
                            <h3>Success Rate</h3>
                            <p>{successRate}%</p>
                        </div>
                    </div>
                )}

                {loading && <p>Loading...</p>}
                {error && <p style={{ color: "#dc2626" }}>{error}</p>}

                {!loading && !error && displayedLogs.length === 0 && (
                    <p style={{ color: "#6b7280" }}>No transactions recorded yet.</p>
                )}

                {!loading && displayedLogs.length > 0 && (
                    <div className="logs-table-wrapper">
                        <table className="logs-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Task ID</th>
                                    <th>Action</th>
                                    <th>Tx Hash</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="logs-td-time">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </td>
                                        <td className="logs-td-taskid" title={log.taskId}>
                                            {log.taskId}
                                        </td>
                                        <td>
                                            <span className={`log-action-badge log-action-${log.action.toLowerCase().replace(/_/g, "-")}`}>
                                                {ACTION_LABELS[log.action] ?? log.action}
                                            </span>
                                        </td>
                                        <td className="logs-td-hash">
                                            <a
                                                href={`https://sepolia.basescan.org/tx/${log.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="tx-hash-link"
                                                title={log.txHash}
                                            >
                                                {log.txHash.slice(0, 10)}…{log.txHash.slice(-8)}
                                            </a>
                                        </td>
                                        <td>
                                            <span className={`log-status-badge log-status-${log.status.toLowerCase()}`}>
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

export default BlockchainLogsPage;
