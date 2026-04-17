import { createBrowserRouter } from "react-router-dom";
import HomePage from "../pages/HomePage";
import TaskListPage from "../pages/TaskListPage";
import TaskDetailPage from "../pages/TaskDetailPage";
import BlockchainLogsPage from "../pages/BlockchainLogsPage";
import OnboardingPage from "../pages/OnboardingPage";
import IdentityCenterPage from "../pages/IdentityCenterPage";
import SettingsPage from "../pages/SettingsPage";
import LoginPage from "../pages/LoginPage";
import MemberProfilePage from "../pages/MemberProfilePage";

const router = createBrowserRouter([
    {
        path: "/",
        element: <HomePage />,
    },
    {
        path: "/listings",
        element: <TaskListPage />,
    },
    {
        path: "/listings/:id",
        element: <TaskDetailPage />,
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
    {
        path: "/kyc",
        element: <OnboardingPage />,
    },
    {
        path: "/member",
        element: <IdentityCenterPage />,
    },
    {
        path: "/settings",
        element: <SettingsPage />,
    },
    {
        path: "/login",
        element: <LoginPage />,
    },
    {
        path: "/profile",
        element: <MemberProfilePage />,
    },
]);

export default router;
