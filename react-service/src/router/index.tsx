import { createBrowserRouter } from "react-router-dom";
import HomePage from "../pages/HomePage";
import ListingListPage from "../pages/ListingListPage";
import ListingDetailPage from "../pages/ListingDetailPage";
import ListingCreatePage from "../pages/ListingCreatePage";
import BlockchainLogsPage from "../pages/BlockchainLogsPage";
import OnboardingPage from "../pages/OnboardingPage";
import IdentityCenterPage from "../pages/IdentityCenterPage";
import SettingsPage from "../pages/SettingsPage";
import LoginPage from "../pages/LoginPage";
import MemberProfilePage from "../pages/MemberProfilePage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import OwnerCredentialPage from "../pages/OwnerCredentialPage";
import TenantCredentialPage from "../pages/TenantCredentialPage";
import AgentCredentialPage from "../pages/AgentCredentialPage";
import RequireCredential from "../components/common/RequireCredential";
import AgentListPage from "../pages/AgentListPage";
import AgentDetailPage from "../pages/AgentDetailPage";

const router = createBrowserRouter([
    {
        path: "/",
        element: <HomePage />,
    },
    {
        path: "/listings",
        element: <ListingListPage />,
    },
    {
        path: "/listings/new",
        element: (
            <RequireCredential requiredRole="OWNER">
                <ListingCreatePage />
            </RequireCredential>
        ),
    },
    {
        path: "/listings/:id",
        element: (
            <RequireCredential anyOf={["OWNER", "TENANT", "AGENT"]}>
                <ListingDetailPage />
            </RequireCredential>
        ),
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
    {
        path: "/credential/owner",
        element: <OwnerCredentialPage />,
    },
    {
        path: "/credential/tenant",
        element: <TenantCredentialPage />,
    },
    {
        path: "/credential/agent",
        element: <AgentCredentialPage />,
    },
    {
        path: "/forgot-password",
        element: <ForgotPasswordPage />,
    },
    {
        path: "/agents",
        element: <AgentListPage />,
    },
    {
        path: "/agents/:wallet",
        element: <AgentDetailPage />,
    },
]);

export default router;
