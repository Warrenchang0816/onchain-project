import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useIdentity } from "../../hooks/useIdentity";
import PageLoading from "./PageLoading";

type CredentialType = "OWNER" | "TENANT" | "AGENT";

interface RequireCredentialProps {
    requiredRole?: CredentialType;
    anyOf?: CredentialType[];
    children: ReactNode;
}

function GateFallback(props: { title: string; description: string; actionLabel: string; actionPath: string }) {
    const navigate = useNavigate();
    return (
        <div className="flex min-h-[60vh] items-center justify-center px-6">
            <div className="w-full max-w-md rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-10 text-center shadow-sm">
                <span className="material-symbols-outlined mb-4 block text-5xl text-on-surface-variant/40" style={{ fontVariationSettings: "'FILL' 0" }}>
                    lock
                </span>
                <h2 className="mb-2 text-xl font-bold text-on-surface">{props.title}</h2>
                <p className="mb-8 text-sm leading-relaxed text-on-surface-variant">{props.description}</p>
                <button
                    type="button"
                    onClick={() => navigate(props.actionPath)}
                    className="w-full rounded-xl bg-primary-container px-6 py-3 font-bold text-on-primary-container transition-opacity hover:opacity-90"
                >
                    {props.actionLabel}
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
                description="這個頁面需要會員身份，登入後才能繼續操作。"
                actionLabel="前往登入"
                actionPath="/login"
            />
        );
    }

    if (kycStatus !== "VERIFIED") {
        return (
            <GateFallback
                title="請先完成 KYC"
                description="平台需要先確認自然人身份，完成後才能啟用屋主、租客或仲介角色。"
                actionLabel="前往身份驗證"
                actionPath="/kyc"
            />
        );
    }

    const roleGranted = requiredRole ? hasRole(requiredRole) : anyOf ? hasAnyRole(anyOf) : true;

    if (!roleGranted) {
        return (
            <GateFallback
                title="尚未啟用對應身份"
                description="此功能需要先在身份中心啟用對應角色。平台只負責揭露狀態，實際合作仍由各方自行確認。"
                actionLabel="前往身份中心"
                actionPath="/member"
            />
        );
    }

    return <>{children}</>;
}
