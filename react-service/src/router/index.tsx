import { createBrowserRouter, Navigate } from "react-router-dom";
import HomePage from "../pages/HomePage";
import ListingDetailPage from "../pages/ListingDetailPage";
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
import ListingPrintPage from "../pages/ListingPrintPage";
import TenantProfilePage from "../pages/TenantProfilePage";
import MyRequirementsPage from "../pages/MyRequirementsPage";
import RequirementsPage from "../pages/RequirementsPage";
import RequirementDetailPage from "../pages/RequirementDetailPage";
import MyAgentProfilePage from "../pages/MyAgentProfilePage";
import FavoritesPage from "../pages/FavoritesPage";
import MyPropertiesPage from "../pages/MyPropertiesPage";
import PropertyCreatePage from "../pages/PropertyCreatePage";
import PropertyEditPage from "../pages/PropertyEditPage";
import RentalListingPage from "../pages/RentalListingPage";
import SaleListingPage from "../pages/SaleListingPage";
import RentListPage from "../pages/RentListPage";
import RentDetailPage from "../pages/RentDetailPage";
import SaleListPage from "../pages/SaleListPage";
import SaleDetailPage from "../pages/SaleDetailPage";

const router = createBrowserRouter([
    {
        path: "/",
        element: <HomePage />,
    },
    { path: "/listings", element: <Navigate to="/sale" replace /> },
    { path: "/my/listings/new", element: <Navigate to="/my/properties/new" replace /> },
    { path: "/listings/:id", element: <Navigate to="/sale" replace /> },
    {
        path: "/my/listings/:id",
        element: (
            <RequireCredential requiredRole="OWNER">
                <ListingDetailPage />
            </RequireCredential>
        ),
    },
    {
        path: "/my/listings/:id/print",
        element: (
            <RequireCredential requiredRole="OWNER">
                <ListingPrintPage />
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
    { path: "/my/listings", element: <Navigate to="/my/properties" replace /> },
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
    // Public — sale & rent
    { path: "/sale", element: <SaleListPage /> },
    { path: "/sale/:id", element: <SaleDetailPage /> },
    { path: "/rent", element: <RentListPage /> },
    { path: "/rent/:id", element: <RentDetailPage /> },
    // Owner — properties
    {
        path: "/my/properties",
        element: (
            <RequireCredential requiredRole="OWNER">
                <MyPropertiesPage />
            </RequireCredential>
        ),
    },
    {
        path: "/my/properties/new",
        element: (
            <RequireCredential requiredRole="OWNER">
                <PropertyCreatePage />
            </RequireCredential>
        ),
    },
    {
        path: "/my/properties/:id",
        element: (
            <RequireCredential requiredRole="OWNER">
                <PropertyEditPage />
            </RequireCredential>
        ),
    },
    {
        path: "/my/properties/:id/rent",
        element: (
            <RequireCredential requiredRole="OWNER">
                <RentalListingPage />
            </RequireCredential>
        ),
    },
    {
        path: "/my/properties/:id/sale",
        element: (
            <RequireCredential requiredRole="OWNER">
                <SaleListingPage />
            </RequireCredential>
        ),
    },
]);

export default router;
