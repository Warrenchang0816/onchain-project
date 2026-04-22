import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAuthMe } from "../api/authApi";
import { getKYCStatus } from "../api/kycApi";
import { createListing, type CreateListingPayload, type UpdateListingPayload } from "../api/listingApi";
import ListingEditorForm from "../components/listing/ListingEditorForm";
import { createListingEditorInitialValues } from "../components/listing/listingEditorValues";
import SiteLayout from "../layouts/SiteLayout";

type LoadState = "loading" | "ready" | "unauthenticated" | "kyc-required";

export default function ListingCreatePage() {
    const navigate = useNavigate();
    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [submitting, setSubmitting] = useState(false);
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                setLoadError("");
                const auth = await getAuthMe().catch(() => ({ authenticated: false }));
                if (!auth.authenticated) {
                    setLoadState("unauthenticated");
                    return;
                }

                const kyc = await getKYCStatus();
                setLoadState(kyc.kycStatus === "VERIFIED" ? "ready" : "kyc-required");
            } catch (err) {
                setLoadError(err instanceof Error ? err.message : "Failed to check access.");
                setLoadState("kyc-required");
            }
        };

        void load();
    }, []);

    const handleSubmit = async (payload: CreateListingPayload | UpdateListingPayload) => {
        setSubmitting(true);
        try {
            const created = await createListing(payload as CreateListingPayload);
            navigate(`/listings/${created.id}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SiteLayout>
            <main className="flex-grow w-full max-w-[960px] mx-auto px-6 md:px-12 py-12 flex flex-col gap-8">
                <div className="flex flex-col gap-2">
                    <Link to="/listings" className="text-sm text-on-surface-variant hover:text-primary-container transition-colors">
                        Back to listings
                    </Link>
                    <h1 className="text-4xl font-extrabold text-on-background tracking-tight font-headline">
                        Create listing
                    </h1>
                    <p className="text-on-surface-variant leading-[1.75]">
                        Gate 0 uses the live listing API. Verified users can create a draft first, then publish it from the detail page.
                    </p>
                </div>

                {loadState === "loading" ? (
                    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-8 text-sm text-on-surface-variant">
                        Checking access...
                    </div>
                ) : null}

                {loadState === "unauthenticated" ? (
                    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-8 flex flex-col gap-4">
                        <h2 className="text-2xl font-bold text-on-background">Login required</h2>
                        <p className="text-sm text-on-surface-variant">
                            You need to log in before creating a listing.
                        </p>
                        <div>
                            <Link to="/login" className="px-5 py-2.5 bg-primary-container text-on-surface rounded-lg font-bold text-sm">
                                Go to login
                            </Link>
                        </div>
                    </div>
                ) : null}

                {loadState === "kyc-required" ? (
                    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-8 flex flex-col gap-4">
                        <h2 className="text-2xl font-bold text-on-background">KYC required</h2>
                        <p className="text-sm text-on-surface-variant">
                            The current backend requires `KYC VERIFIED` before a listing can be created.
                        </p>
                        {loadError ? <p className="text-sm text-error">{loadError}</p> : null}
                        <div>
                            <Link to="/kyc" className="px-5 py-2.5 bg-primary-container text-on-surface rounded-lg font-bold text-sm">
                                Complete KYC
                            </Link>
                        </div>
                    </div>
                ) : null}

                {loadState === "ready" ? (
                    <section className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <ListingEditorForm
                            mode="create"
                            initialValues={createListingEditorInitialValues()}
                            submitting={submitting}
                            submitLabel="Create draft listing"
                            onSubmit={handleSubmit}
                        />
                    </section>
                ) : null}
            </main>
        </SiteLayout>
    );
}
