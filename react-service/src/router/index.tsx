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
import MyListingsPage from "../pages/MyListingsPage";
import TenantProfilePage from "../pages/TenantProfilePage";
import MyRequirementsPage from "../pages/MyRequirementsPage";
import RequirementsPage from "../pages/RequirementsPage";
import RequirementDetailPage from "../pages/RequirementDetailPage";
import MyAgentProfilePage from "../pages/MyAgentProfilePage";
import FavoritesPage from "../pages/FavoritesPage";

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
        path: "/my/listings",
        element: (
            <RequireCredential requiredRole="OWNER">
                <MyListingsPage />
            </RequireCredential>
        ),
    },
    {
        path: "/my/tenant-profile",
        element: (
            <RequireCredential requiredRole="TENANT">
                <TenantProfilePage />
            </RequireCredential>
        ),
    },
    {
        path: "/my/requirements",
        element: (
            <RequireCredential requiredRole="TENANT">
                <MyRequirementsPage />
            </RequireCredential>
        ),
    },
    {
        path: "/requirements",
        element: (
            <RequireCredential anyOf={["OWNER", "AGENT"]}>
                <RequirementsPage />
            </RequireCredential>
        ),
    },
    {
        path: "/requirements/:id",
        element: (
            <RequireCredential anyOf={["OWNER", "AGENT"]}>
                <RequirementDetailPage />
            </RequireCredential>
        ),
    },
    {
        path: "/my/agent-profile",
        element: (
            <RequireCredential requiredRole="AGENT">
                <MyAgentProfilePage />
            </RequireCredential>
        ),
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
        path: "/favorites",
        element: <FavoritesPage />,
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
