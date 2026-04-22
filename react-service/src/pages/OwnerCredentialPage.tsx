import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAuthMe } from "@/api/authApi";
import {
    activateCredentialSubmission,
    analyzeCredentialSubmission,
    createCredentialSubmission,
    getCredentialCenter,
    requestManualCredentialReview,
    type CredentialCenterItem,
    type CredentialCenterResponse,
    type CredentialType,
    uploadCredentialFiles,
} from "@/api/credentialApi";
import CredentialApplicationShell from "@/components/credential/CredentialApplicationShell";
import SiteLayout from "@/layouts/SiteLayout";

const CREDENTIAL_TYPE: CredentialType = "OWNER";

const OWNER_FIELDS = [
    { key: "holderName", label: "權利人姓名", placeholder: "請填寫權狀或證明文件上的姓名" },
    { key: "propertyAddress", label: "物件地址", placeholder: "請填寫權狀或證明文件上的地址" },
    { key: "ownershipDocNo", label: "權狀字號", placeholder: "若文件可辨識，可填寫字號供比對" },
];

type PageState = {
    loading: boolean;
    authenticated: boolean;
    center?: CredentialCenterResponse;
    error?: string;
};

export default function OwnerCredentialPage() {
    const [state, setState] = useState<PageState>({ loading: true, authenticated: false });

    useEffect(() => {
        const load = async () => {
            try {
                const auth = await getAuthMe().catch(() => ({ authenticated: false }));
                if (!auth.authenticated) {
                    setState({ loading: false, authenticated: false });
                    return;
                }

                const center = await getCredentialCenter();
                setState({ loading: false, authenticated: true, center });
            } catch (error) {
                setState({
                    loading: false,
                    authenticated: true,
                    error: error instanceof Error ? error.message : "無法載入屋主身份頁面。",
                });
            }
        };

        void load();
    }, []);

    const refreshCenter = async () => {
        const center = await getCredentialCenter();
        setState((current) => ({ ...current, center, error: undefined }));
    };

    const mergeItem = (item: CredentialCenterItem) => {
        setState((current) => {
            const center = current.center;
            if (!center) return current;

            const nextItems = center.items.some((entry) => entry.credentialType === item.credentialType)
                ? center.items.map((entry) => (entry.credentialType === item.credentialType ? item : entry))
                : [...center.items, item];

            return {
                ...current,
                center: { ...center, items: nextItems },
                error: undefined,
            };
        });
    };

    const handleSubmitSmart = async (formPayload: Record<string, string>, notes: string, mainDoc: File, supportDoc?: File) => {
        const created = await createCredentialSubmission(CREDENTIAL_TYPE, {
            route: "SMART",
            formPayload,
            notes,
        });
        await uploadCredentialFiles(CREDENTIAL_TYPE, created.submissionId, mainDoc, supportDoc);
        const item = await analyzeCredentialSubmission(CREDENTIAL_TYPE, created.submissionId);
        mergeItem(item);
    };

    const handleRequestManual = async (formPayload: Record<string, string>, notes: string, mainDoc: File, supportDoc?: File) => {
        const created = await createCredentialSubmission(CREDENTIAL_TYPE, {
            route: "MANUAL",
            formPayload,
            notes,
        });
        await uploadCredentialFiles(CREDENTIAL_TYPE, created.submissionId, mainDoc, supportDoc);
        const item = await requestManualCredentialReview(CREDENTIAL_TYPE, created.submissionId);
        mergeItem(item);
    };

    const handleActivate = async (submissionId: number) => {
        await activateCredentialSubmission(CREDENTIAL_TYPE, submissionId);
        await refreshCenter();
    };

    const handleRetrySmart = async (submissionId: number) => {
        const item = await analyzeCredentialSubmission(CREDENTIAL_TYPE, submissionId);
        mergeItem(item);
    };

    const handleSwitchToManual = async (submissionId: number) => {
        const item = await requestManualCredentialReview(CREDENTIAL_TYPE, submissionId);
        mergeItem(item);
    };

    const currentItem = state.center?.items.find((item) => item.credentialType === CREDENTIAL_TYPE);
    const isVerified = state.center?.kycStatus === "VERIFIED";

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12 md:py-16">
                <Link to="/member" className="text-sm text-on-surface-variant transition-colors hover:text-primary-container">
                    返回身份中心
                </Link>

                {!state.loading && !state.authenticated ? (
                    <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <h1 className="text-3xl font-extrabold text-on-surface">請先登入</h1>
                        <p className="mt-3 text-sm leading-[1.8] text-on-surface-variant">
                            你需要先登入，才能查看或申請屋主身份認證。
                        </p>
                        <div className="mt-6">
                            <Link
                                to="/login"
                                className="inline-flex rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90"
                            >
                                前往登入
                            </Link>
                        </div>
                    </section>
                ) : null}

                {state.loading ? (
                    <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8 text-sm text-on-surface-variant">
                        載入屋主身份資料中...
                    </section>
                ) : null}

                {state.authenticated && !isVerified ? (
                    <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <h1 className="text-3xl font-extrabold text-on-surface">請先完成 KYC</h1>
                        <p className="mt-3 text-sm leading-[1.8] text-on-surface-variant">
                            屋主身份認證建立在自然人 KYC 驗證之上。先完成 KYC，之後才能送出屋主身份申請。
                        </p>
                        {state.error ? <p className="mt-3 text-sm text-error">{state.error}</p> : null}
                        <div className="mt-6">
                            <Link
                                to="/kyc"
                                className="inline-flex rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90"
                            >
                                前往 KYC
                            </Link>
                        </div>
                    </section>
                ) : null}

                {state.authenticated && isVerified ? (
                    <CredentialApplicationShell
                        credentialType={CREDENTIAL_TYPE}
                        title="屋主身份認證"
                        description="上傳權狀或可證明持有權的文件後，系統會先走智能審核；如果你不採用智能結果，也可以改送人工審核。審核通過後是否啟用 NFT 憑證，由你自己決定。"
                        primaryFields={OWNER_FIELDS}
                        currentItem={currentItem}
                        onSubmitSmart={handleSubmitSmart}
                        onRequestManual={handleRequestManual}
                        onRetrySmart={handleRetrySmart}
                        onSwitchToManual={handleSwitchToManual}
                        onActivate={handleActivate}
                    />
                ) : null}
            </main>
        </SiteLayout>
    );
}
