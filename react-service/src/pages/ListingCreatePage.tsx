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
            navigate(`/my/listings/${created.id}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-grow flex-col gap-8 px-6 py-12 md:px-12">
                <div className="flex flex-col gap-2">
                    <Link to="/my/listings" className="text-sm text-on-surface-variant transition-colors hover:text-primary-container">
                        返回我的房源
                    </Link>
                    <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-background">
                        建立房源草稿
                    </h1>
                    <p className="leading-[1.75] text-on-surface-variant">
                        房源草稿應由屋主身分智能審核通過後建立。這個頁面只用於補齊草稿欄位，完整度達 100% 後才可上架。
                    </p>
                </div>

                <section className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <ListingEditorForm
                        mode="create"
                        initialValues={createListingEditorInitialValues()}
                        submitting={submitting}
                        submitLabel="建立草稿"
                        onSubmit={handleSubmit}
                    />
                </section>
            </main>
        </SiteLayout>
    );
}
