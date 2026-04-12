import type { Task } from "../types/task";

export interface TaskSummary {
    total: number;
    completed: number;
    pending: number;
}

export const getTaskSummary = (tasks: Task[]): TaskSummary => {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.status === "COMPLETED").length;
    const pending = tasks.filter((task) => task.status === "OPEN").length;

    return {
        total,
        completed,
        pending,
    };
};

export const getRecentTasks = (tasks: Task[], limit = 3): Task[] => {
    return [...tasks].slice(0, limit);
};