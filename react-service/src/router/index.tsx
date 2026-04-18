import { createBrowserRouter } from "react-router-dom";
import HomePage from "../pages/HomePage";
import ListingListPage from "../pages/ListingListPage";
import ListingDetailPage from "../pages/ListingDetailPage";
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
        element: <ListingListPage />,
    },
    {
        path: "/listings/:id",
        element: <ListingDetailPage />,
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
