import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SiteLayout from "@/layouts/SiteLayout";
import CredentialApplicationShell from "./CredentialApplicationShell";
import { getAuthMe } from "@/api/authApi";
import { getCredentialCenter, getLatestCredentialSubmission } from "@/api/credentialApi";
import { getUserProfile, type UserProfile } from "@/api/userApi";
import type { CredentialType, CredentialCenterResponse, CredentialSubmissionDetail } from "@/api/credentialApi";

type Props = {
    credentialType: CredentialType;
    title: string;
    description: string;
    primaryFields: Array<{ key: string; label: string; placeholder: string }>;
    declarations?: Array<{ key: string; text: string }>;
    mainDocRequired?: boolean;
};

type PageState = {
    loading: boolean;
    authenticated: boolean;
    center?: CredentialCenterResponse;
    detail?: CredentialSubmissionDetail | null;
    profile?: UserProfile;
    error?: string;
};

export default function CredentialRolePage(props: Props) {
    const [state, setState] = useState<PageState>({ loading: true, authenticated: false });

    const refresh = async () => {
        const [center, detail, profile] = await Promise.all([
            getCredentialCenter(),
            getLatestCredentialSubmission(props.credentialType),
            getUserProfile(),
        ]);
        setState((prev) => ({ ...prev, loading: false, authenticated: true, center, detail, profile, error: undefined }));
    };

    useEffect(() => {
        const load = async () => {
            try {
                const auth = await getAuthMe();
                if (!auth.authenticated) {
                    setState({ loading: false, authenticated: false });
                    return;
                }
                await refresh();
            } catch {
                setState({ loading: false, authenticated: false });
            }
        };
        void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const currentItem = state.center?.items.find((item) => item.credentialType === props.credentialType);
    const isVerified = state.center?.kycStatus === "VERIFIED";

    if (state.loading) {
        return (
            <SiteLayout>
                <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12 md:py-16">
                    <div className="text-sm text-on-surface-variant">載入中…</div>
                </main>
            </SiteLayout>
        );
    }

    if (!state.authenticated || !isVerified) {
        return (
            <SiteLayout>
                <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12 md:py-16">
                    <Link to="/member" className="text-sm text-on-surface-variant hover:text-primary-container">返回身份中心</Link>
                    <p className="text-sm text-on-surface-variant">請先完成 KYC 身份驗證才能申請角色憑證。</p>
                </main>
            </SiteLayout>
        );
    }

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12 md:py-16">
                <Link to="/member" className="text-sm text-on-surface-variant transition-colors hover:text-primary-container">
                    返回身份中心
                </Link>
                <CredentialApplicationShell
                    credentialType={props.credentialType}
                    title={props.title}
                    description={props.description}
                    primaryFields={props.primaryFields}
                    declarations={props.declarations}
                    mainDocRequired={props.mainDocRequired}
                    kycDisplayName={state.profile?.displayName}
                    currentItem={currentItem}
                    currentDetail={state.detail ?? undefined}
                    onRefresh={refresh}
                />
            </main>
        </SiteLayout>
    );
}
