import { useEffect, useState } from "react";
import SiteLayout from "../layouts/SiteLayout";
import { getBlockchainLogs, type BlockchainLog } from "../api/taskApi";
import { getAuthMe } from "../api/authApi";

const ACTION_LABELS: Record<string, string> = {
    FUND: "注資",
    ASSIGN_WORKER: "指派",
    APPROVE_TASK: "核准",
    CLAIM_REWARD: "請款",
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
        void init();
    }, []);

    const displayedLogs = isPlatformWallet
        ? logs
        : logs.filter((log) => walletAddress && log.walletAddress.toLowerCase() === walletAddress.toLowerCase());

    const totalLogs = displayedLogs.length;
    const successLogs = displayedLogs.filter((log) => log.status === "SUCCESS").length;
    const successRate = totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 0;

    return (
        <SiteLayout>
            <section className="page-section">
                <div className="page-heading page-heading-row">
                    <div>
                        <h1>鏈上足跡</h1>
                        <p>{isPlatformWallet ? "顯示平台目前所有鏈上交易紀錄" : "顯示你目前可查看的鏈上交易紀錄"}</p>
                    </div>
                </div>

                {!loading && !error && (
                    <div className="logs-stats-grid">
                        <div className="logs-stat-card">
                            <h3>總交易數</h3>
                            <p>{totalLogs}</p>
                        </div>
                        <div className="logs-stat-card">
                            <h3>成功筆數</h3>
                            <p>{successLogs}</p>
                        </div>
                        <div className="logs-stat-card">
                            <h3>成功率</h3>
                            <p>{successRate}%</p>
                        </div>
                    </div>
                )}

                {loading ? <div className="page-state"><p>載入中...</p></div> : null}
                {error ? <div className="feedback-banner error-banner"><p>{error}</p></div> : null}

                {!loading && !error && displayedLogs.length === 0 ? (
                    <div className="page-state"><p>目前還沒有鏈上紀錄。</p></div>
                ) : null}

                {!loading && !error && displayedLogs.length > 0 ? (
                    <div className="logs-table-wrapper">
                        <table className="logs-table">
                            <thead>
                                <tr>
                                    <th>時間</th>
                                    <th>任務 ID</th>
                                    <th>動作</th>
                                    <th>交易雜湊</th>
                                    <th>狀態</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="logs-td-time">{new Date(log.createdAt).toLocaleString("zh-TW")}</td>
                                        <td className="logs-td-taskid" title={log.taskId}>{log.taskId}</td>
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
                                                {`${log.txHash.slice(0, 10)}...${log.txHash.slice(-8)}`}
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
                ) : null}
            </section>
        </SiteLayout>
    );
};

export default BlockchainLogsPage;
