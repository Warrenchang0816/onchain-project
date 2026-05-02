import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getListing, type Listing } from "../api/listingApi";
import ListingCoverPreview from "../components/listing/ListingCoverPreview";
import ListingPrintBook from "../components/listing/ListingPrintBook";
import { buildListingDisplayModel } from "../components/listing/listingDisplayModel";
import SiteLayout from "../layouts/SiteLayout";

export default function ListingPrintPage() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const [listing, setListing] = useState<Listing | null>(null);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const output = searchParams.get("output") === "cover" ? "cover" : "book";
    const listingId = id ? parseInt(id, 10) : Number.NaN;

    useEffect(() => {
        const load = async () => {
            if (Number.isNaN(listingId)) {
                setError("物件編號不正確");
                setIsLoading(false);
                return;
            }
            try {
                setIsLoading(true);
                setError("");
                setListing(await getListing(listingId));
            } catch (err) {
                setError(err instanceof Error ? err.message : "讀取物件失敗");
            } finally {
                setIsLoading(false);
            }
        };
        void load();
    }, [listingId]);

    if (isLoading) {
        return (
            <SiteLayout>
                <main className="px-6 py-20 text-center text-sm text-on-surface-variant">產生預覽內容中...</main>
            </SiteLayout>
        );
    }

    if (!listing) {
        return (
            <SiteLayout>
                <main className="mx-auto max-w-[960px] px-6 py-20">
                    <div className="rounded-2xl border border-error/20 bg-error-container p-8 text-sm text-on-error-container">{error || "找不到物件"}</div>
                </main>
            </SiteLayout>
        );
    }

    const model = buildListingDisplayModel(listing);

    return (
        <SiteLayout>
            <main className="bg-surface py-8 print:bg-white print:py-0">
                <div className="mx-auto mb-6 flex max-w-[960px] justify-end gap-3 px-6 print:hidden">
                    <button type="button" onClick={() => window.print()} className="rounded-xl bg-primary-container px-4 py-2 text-sm font-bold text-on-primary-container">
                        列印 / 另存 PDF
                    </button>
                </div>
                {output === "cover" ? <ListingCoverPreview model={model} /> : <ListingPrintBook model={model} />}
            </main>
        </SiteLayout>
    );
}
