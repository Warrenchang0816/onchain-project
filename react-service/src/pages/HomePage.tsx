import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRecentTasks, getTaskSummary } from "../api/dashboardApi";
import { getTasks } from "../api/taskApi";
import AppButton from "../components/common/AppButton";
import EmptyState from "../components/common/EmptyState";
import PageLoading from "../components/common/PageLoading";
import SummaryCard from "../components/common/SummaryCard";
import TaskCard from "../components/task/TaskCard";
import AppLayout from "../layouts/AppLayout";
import type { Task } from "../types/task";


const HomePage = () => {
    const navigate = useNavigate();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadTasks = async () => {
            try {
                const data = await getTasks();
                setTasks(data);
            } finally {
                setIsLoading(false);
            }
        };

        void loadTasks();
    }, []);

    const summary = getTaskSummary(tasks);
    const recentTasks = getRecentTasks(tasks, 3);

    return (
        <AppLayout>
            <section className="hero-section">
                <h1>Manage your on-chain tasks with clarity</h1>
                <p>
                    建立任務、追蹤完成狀態，並完成鏈上獎勵結算。
                </p>

                <div className="hero-actions">
                    <AppButton type="button" onClick={() => navigate("/tasks")}>
                        View Tasks
                    </AppButton>
                </div>
            </section>

            {isLoading ? (
                <PageLoading message="Loading dashboard summary..." />
            ) : (
                <>
                    <section className="summary-section">
                        <SummaryCard title="Total Tasks" value={summary.total} variant="default" />
                        <SummaryCard title="Completed" value={summary.completed} variant="success" />
                        <SummaryCard title="Pending" value={summary.pending} variant="info" />
                    </section>

                    <section className="page-section dashboard-section">
                        <div className="page-heading">
                            <h2>Recent Tasks</h2>
                            <p>Quickly review the latest task records.</p>
                        </div>

                        {recentTasks.length === 0 ? (
                            <EmptyState
                                title="No recent tasks"
                                description="Create a task to see it appear on your dashboard."
                            />
                        ) : (
                            <div className="task-list">
                                {recentTasks.map((task) => (
                                    <TaskCard key={task.id} task={task} />
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}
        </AppLayout>
    );
};

export default HomePage;