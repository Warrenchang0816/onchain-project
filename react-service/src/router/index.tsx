import { createBrowserRouter } from "react-router-dom";
import HomePage from "../pages/HomePage";
import TaskListPage from "../pages/TaskListPage";
import TaskDetailPage from "../pages/TaskDetailPage";
import BlockchainLogsPage from "../pages/BlockchainLogsPage";

const router = createBrowserRouter([
    {
        path: "/",
        element: <HomePage />,
    },
    {
        path: "/tasks",
        element: <TaskListPage />,
    },
    {
        path: "/tasks/:id",
        element: <TaskDetailPage />,
    },
    {
        path: "/logs",
        element: <BlockchainLogsPage />,
    },
]);

export default router;
