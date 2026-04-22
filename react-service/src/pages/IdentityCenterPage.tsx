import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAuthMe } from "@/api/authApi";
import { getKYCStatus, type KYCStatus, type KYCStatusResponse } from "@/api/kycApi";
import SiteLayout from "../layouts/SiteLayout";

type IdentityCenterState = {
    loading: boolean;
    authenticated: boolean;
    address?: string;
    kyc?: KYCStatusResponse;
    error?: string;
};

type ActionConfig = {
    label: string;
    description: string;
    disabled?: boolean;
    onClick?: () => void;
};

const KYC_STATUS_LABEL: Record<KYCStatus, string> = {
    UNVERIFIED: "Unverified",
    PENDING: "Pending review",
    VERIFIED: "Verified",
    REJECTED: "Rejected",
};

function statusBadgeClass(status: KYCStatus): string {
    if (status === "VERIFIED") return "bg-tertiary/10 text-tertiary border-tertiary/20";
    if (status === "PENDING") return "bg-amber-700/10 text-amber-700 border-amber-700/20";
    if (status === "REJECTED") return "bg-error/10 text-error border-error/20";
    return "bg-surface-container text-on-surface-variant border-outline-variant/20";
}

function shortenAddress(address?: string): string {
    if (!address) return "Not connected";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function ActionButton(props: ActionConfig) {
    return (
        <button
            type="button"
            disabled={props.disabled}
            onClick={props.onClick}
            className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                props.disabled
                    ? "cursor-not-allowed border border-outline-variant/20 bg-surface-container text-on-surface-variant"
                    : "bg-primary-container text-on-primary-container hover:opacity-90"
            }`}
        >
            {props.label}
        </button>
    );
}

function RoleCard(props: {
    icon: string;
    title: string;
    stateLabel: string;
    description: string;
    action: ActionConfig;
}) {
    return (
        <section className="flex flex-col gap-6 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/10">
                    <span
                        className="material-symbols-outlined text-2xl text-primary-container"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                        {props.icon}
                    </span>
                </div>
                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                    {props.stateLabel}
                </span>
            </div>
            <div className="space-y-2">
                <h3 className="text-xl font-bold text-on-surface">{props.title}</h3>
                <p className="text-sm leading-[1.75] text-on-surface-variant">{props.description}</p>
            </div>
            <div className="space-y-3">
                <ActionButton {...props.action} />
                <p className="text-xs leading-[1.75] text-on-surface-variant">{props.action.description}</p>
            </div>
        </section>
    );
}

export default function IdentityCenterPage() {
    const navigate = useNavigate();
    const [state, setState] = useState<IdentityCenterState>({ loading: true, authenticated: false });

    useEffect(() => {
        const load = async () => {
            try {
                const auth = await getAuthMe();
                if (!auth.authenticated) {
                    setState({ loading: false, authenticated: false });
                    return;
                }

                const kyc = await getKYCStatus().catch((error) => {
                    setState({
                        loading: false,
                        authenticated: true,
                        address: auth.address,
                        kyc: { kycStatus: "UNVERIFIED", credentials: [] },
                        error: error instanceof Error ? error.message : "Failed to load KYC status.",
                    });
                    return null;
                });

                if (!kyc) return;

                setState({
                    loading: false,
                    authenticated: true,
                    address: auth.address,
                    kyc,
                });
            } catch (error) {
                setState({
                    loading: false,
                    authenticated: false,
                    error: error instanceof Error ? error.message : "Failed to load identity center.",
                });
            }
        };

        void load();
    }, []);

    if (!state.loading && !state.authenticated) {
        return (
            <SiteLayout>
                <main className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-20 md:px-12">
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10">
                        <h1 className="font-headline text-4xl font-extrabold text-on-surface">Identity center</h1>
                        <p className="mt-4 text-sm leading-[1.8] text-on-surface-variant">
                            Log in first to check KYC status, see any issued credentials, and access the live Gate 0 owner and tenant actions.
                        </p>
                        {state.error ? <p className="mt-4 text-sm text-error">{state.error}</p> : null}
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link
                                to="/login"
                                className="rounded-xl bg-primary-container px-6 py-3 text-sm font-bold text-on-primary-container hover:opacity-90 transition-opacity"
                            >
                                Go to login
                            </Link>
                            <Link
                                to="/kyc"
                                className="rounded-xl border border-outline-variant/25 bg-surface-container-low px-6 py-3 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors"
                            >
                                Open KYC flow
                            </Link>
                        </div>
                    </div>
                </main>
            </SiteLayout>
        );
    }

    const kycStatus = state.kyc?.kycStatus ?? "UNVERIFIED";
    const credentials = state.kyc?.credentials ?? [];
    const isVerified = kycStatus === "VERIFIED";
    const hasOwner = credentials.includes("OWNER");
    const hasTenant = credentials.includes("TENANT");
    const hasAgent = credentials.includes("AGENT");

    const ownerAction: ActionConfig = hasOwner
        ? {
              label: "Manage listings",
              description: "A formal OWNER credential is already present, but Gate 0 still uses the live listing flow as the mainline surface.",
              onClick: () => navigate("/listings"),
          }
        : isVerified
          ? {
                label: "Create draft listing",
                description: "Current backend behavior grants listing creation to KYC VERIFIED users even before Gate 1 OWNER minting exists.",
                onClick: () => navigate("/listings/new"),
            }
          : {
                label: "Complete KYC first",
                description: "Listing creation is blocked until your KYC status becomes VERIFIED.",
                disabled: true,
            };

    const tenantAction: ActionConfig = hasTenant
        ? {
              label: "Browse listings",
              description: "TENANT credential exists, but Gate 0 viewing flow still runs through the public listing and appointment surfaces.",
              onClick: () => navigate("/listings"),
          }
        : isVerified
          ? {
                label: "Start booking viewings",
                description: "Verified users can already open listings and submit real viewing appointments in Gate 0.",
                onClick: () => navigate("/listings"),
            }
          : {
                label: "Complete KYC first",
                description: "Viewing appointment booking is currently gated by KYC VERIFIED status.",
                disabled: true,
            };

    const agentAction: ActionConfig = hasAgent
        ? {
              label: "View profile",
              description: "Existing AGENT credential can be reviewed from the profile surface until the Gate 1 agent center is implemented.",
              onClick: () => navigate("/profile"),
          }
        : {
              label: "Opens in Gate 1",
              description: "AGENT onboarding, review, and minting intentionally stay disabled until Gate 1 APIs and pages exist.",
              disabled: true,
          };

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-12 px-6 py-12 md:px-12 md:py-20">
                <section className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
                    <div className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8 md:p-10">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                            Gate 0 capability overview
                        </div>
                        <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
                            Identity center
                        </h1>
                        <p className="mt-4 max-w-3xl text-base leading-[1.8] text-on-surface-variant">
                            This page is now explicit about the current baseline: KYC VERIFIED unlocks live listing creation and viewing actions today.
                            Formal OWNER, TENANT, and AGENT credential application flows arrive in Gate 1.
                        </p>

                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl bg-surface-container-low p-5">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Wallet</div>
                                <div className="mt-2 text-lg font-bold text-on-surface">{shortenAddress(state.address)}</div>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-5">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">KYC status</div>
                                <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-bold ${statusBadgeClass(kycStatus)}`}>
                                    {KYC_STATUS_LABEL[kycStatus]}
                                </div>
                            </div>
                            <div className="rounded-2xl bg-surface-container-low p-5">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Identity NFT</div>
                                <div className="mt-2 text-lg font-bold text-on-surface">
                                    {state.kyc?.identityNftTokenId !== undefined ? `#${state.kyc.identityNftTokenId}` : "Not minted yet"}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 text-sm leading-[1.8] text-on-surface-variant">
                            <strong className="text-on-surface">Current rule:</strong> the backend currently checks{" "}
                            <code>KYC VERIFIED</code> before allowing listing creation and viewing appointments.
                            It does not yet require OWNER or TENANT credentials for those Gate 0 actions.
                        </div>
                        {state.error ? (
                            <div className="mt-4 rounded-2xl border border-error/20 bg-error-container p-4 text-sm text-on-error-container">
                                {state.error}
                            </div>
                        ) : null}
                    </div>

                    <aside className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-2xl font-bold text-on-surface">Next recommended step</h2>
                            <span className="material-symbols-outlined text-on-surface-variant">bolt</span>
                        </div>
                        <div className="mt-6 space-y-4">
                            {isVerified ? (
                                <>
                                    <p className="text-sm leading-[1.8] text-on-surface-variant">
                                        Your current baseline is ready for the live owner or tenant flow. Gate 1 will add formal credential application on top of this.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => navigate("/listings/new")}
                                        className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container hover:opacity-90 transition-opacity"
                                    >
                                        Create draft listing
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navigate("/listings")}
                                        className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors"
                                    >
                                        Browse listings
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm leading-[1.8] text-on-surface-variant">
                                        Finish the KYC flow first. After verification, listing creation and viewing appointment actions become available immediately.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => navigate("/kyc")}
                                        className="w-full rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container hover:opacity-90 transition-opacity"
                                    >
                                        Continue KYC
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => navigate("/profile")}
                                className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-low px-5 py-3 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors"
                            >
                                Open profile
                            </button>
                        </div>
                    </aside>
                </section>

                {state.loading ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-sm text-on-surface-variant">
                        Loading identity center...
                    </section>
                ) : (
                    <>
                        <section className="grid gap-6 md:grid-cols-3">
                            <RoleCard
                                icon="home"
                                title="Owner"
                                stateLabel={hasOwner ? "Credential present" : isVerified ? "Live via KYC" : "KYC required"}
                                description="Gate 0 live flow: verified users can already create and manage draft listings. Formal OWNER credential application and minting arrive in Gate 1."
                                action={ownerAction}
                            />
                            <RoleCard
                                icon="key"
                                title="Tenant"
                                stateLabel={hasTenant ? "Credential present" : isVerified ? "Live via KYC" : "KYC required"}
                                description="Gate 0 live flow: verified users can browse listings and book viewings. Formal TENANT credential application and minting arrive in Gate 1."
                                action={tenantAction}
                            />
                            <RoleCard
                                icon="work"
                                title="Agent"
                                stateLabel={hasAgent ? "Credential present" : "Gate 1 pending"}
                                description="AGENT onboarding is intentionally deferred. This stays disabled until Gate 1 APIs, review flow, and pages exist."
                                action={agentAction}
                            />
                        </section>

                        <section className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
                            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                                <div className="flex items-center justify-between gap-4">
                                    <h2 className="text-2xl font-bold text-on-surface">Issued credentials</h2>
                                    <span className="material-symbols-outlined text-on-surface-variant">badge</span>
                                </div>
                                {credentials.length > 0 ? (
                                    <div className="mt-6 flex flex-wrap gap-3">
                                        {credentials.map((credential) => (
                                            <span
                                                key={credential}
                                                className="rounded-full border border-tertiary/20 bg-tertiary/10 px-4 py-2 text-sm font-bold text-tertiary"
                                            >
                                                {credential}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-6 text-sm leading-[1.8] text-on-surface-variant">
                                        No role credential has been minted yet. That is still expected in Gate 0.
                                    </p>
                                )}
                            </div>

                            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                                <div className="flex items-center justify-between gap-4">
                                    <h2 className="text-2xl font-bold text-on-surface">On-chain history</h2>
                                    <span className="material-symbols-outlined text-on-surface-variant">history</span>
                                </div>
                                {state.kyc?.txHistory && state.kyc.txHistory.length > 0 ? (
                                    <div className="mt-6 space-y-4">
                                        {state.kyc.txHistory.map((tx, index) => (
                                            <div key={`${tx.txHash ?? tx.event}-${index}`} className="rounded-2xl bg-surface-container-low p-4">
                                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                                                    {new Date(tx.timestamp).toLocaleString("zh-TW")}
                                                </div>
                                                <div className="mt-2 text-base font-bold text-on-surface">{tx.event}</div>
                                                {tx.txHash ? (
                                                    <a
                                                        href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mt-2 inline-flex items-center gap-1 text-sm text-secondary hover:underline"
                                                    >
                                                        {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}
                                                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                                    </a>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-6 text-sm leading-[1.8] text-on-surface-variant">
                                        No credential mint history has been recorded yet. That is normal until Gate 1 role issuance is connected.
                                    </p>
                                )}
                            </div>
                        </section>
                    </>
                )}
            </main>
        </SiteLayout>
    );
}
