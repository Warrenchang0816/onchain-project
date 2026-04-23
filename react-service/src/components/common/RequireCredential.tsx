import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import PageLoading from "./PageLoading";
import { useIdentity } from "../../hooks/useIdentity";

type CredentialType = "OWNER" | "TENANT" | "AGENT";

interface RequireCredentialProps {
    requiredRole?: CredentialType;
    anyOf?: CredentialType[];
    children: ReactNode;
}

function GateFallback({ title, description, actionLabel, actionPath }: {
    title: string;
    description: string;
    actionLabel: string;
    actionPath: string;
}) {
    const navigate = useNavigate();
    return (
        <div className="flex min-h-[60vh] items-center justify-center px-6">
            <div className="max-w-md w-full rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-10 text-center shadow-sm">
                <span
                    className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4 block"
                    style={{ fontVariationSettings: "'FILL' 0" }}
                >
                    lock
                </span>
                <h2 className="text-xl font-bold text-on-surface mb-2">{title}</h2>
                <p className="text-sm text-on-surface-variant leading-relaxed mb-8">{description}</p>
                <button
                    type="button"
                    onClick={() => navigate(actionPath)}
                    className="w-full rounded-xl bg-[#E8B800] py-3 px-6 font-bold text-[#1C1917] hover:brightness-105 transition-all"
                >
                    {actionLabel}
                </button>
            </div>
        </div>
    );
}

export default function RequireCredential({ requiredRole, anyOf, children }: RequireCredentialProps) {
    const { loading, authenticated, kycStatus, hasRole, hasAnyRole } = useIdentity();

    if (loading) return <PageLoading />;

    if (!authenticated) {
        return (
            <GateFallback
                title="請先登入"
                description="你需要登入才能繼續查看此頁面的內容。"
                actionLabel="前往登入"
                actionPath="/login"
            />
        );
    }

    if (kycStatus !== "VERIFIED") {
        return (
            <GateFallback
                title="請先完成身份驗證"
                description="查看此頁面需要先通過 KYC 身份驗證。"
                actionLabel="前往身份驗證"
                actionPath="/kyc"
            />
        );
    }

    const roleGranted = requiredRole
        ? hasRole(requiredRole)
        : anyOf
          ? hasAnyRole(anyOf)
          : true;

    if (!roleGranted) {
        return (
            <GateFallback
                title="需要角色認證"
                description="此功能需要先在身份中心完成對應的角色認證並啟用身份。"
                actionLabel="前往身份中心"
                actionPath="/member"
            />
        );
    }

    return <>{children}</>;
}
