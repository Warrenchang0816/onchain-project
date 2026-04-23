import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createListing, type CreateListingPayload, type UpdateListingPayload } from "../api/listingApi";
import ListingEditorForm from "../components/listing/ListingEditorForm";
import { createListingEditorInitialValues } from "../components/listing/listingEditorValues";
import SiteLayout from "../layouts/SiteLayout";

export default function ListingCreatePage() {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);

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
                        Verified owners can create a draft listing, then publish it from the detail page.
                    </p>
                </div>

                <section className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <ListingEditorForm
                        mode="create"
                        initialValues={createListingEditorInitialValues()}
                        submitting={submitting}
                        submitLabel="Create draft listing"
                        onSubmit={handleSubmit}
                    />
                </section>
            </main>
        </SiteLayout>
    );
}
