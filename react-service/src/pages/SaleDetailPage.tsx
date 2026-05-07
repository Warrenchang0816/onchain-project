import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSaleListing, type SaleListing } from "../api/saleListingApi";
import SiteLayout from "../layouts/SiteLayout";

export default function SaleDetailPage() {
    const { id } = useParams<{ id: string }>();
    const listingId = id ? parseInt(id, 10) : NaN;
    const [listing, setListing] = useState<SaleListing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isNaN(listingId)) return;
        getSaleListing(listingId)
            .then(setListing)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取失敗"))
            .finally(() => setLoading(false));
    }, [listingId]);

    if (loading) return <SiteLayout><div className="p-12 text-sm text-on-surface-variant">載入中...</div></SiteLayout>;
    if (error || !listing) return <SiteLayout><div className="p-12 text-sm text-error">{error || "找不到此刊登"}</div></SiteLayout>;

    const p = listing.property;

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-12 md:px-12">
                <Link to="/sale" className="text-sm text-on-surface-variant hover:text-primary-container">← 出售物件列表</Link>

                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h1 className="text-3xl font-extrabold text-on-surface">{p?.title ?? `出售 #${listing.id}`}</h1>
                    <p className="mt-2 text-sm text-on-surface-variant">{p?.address ?? ""}</p>
                    {p ? (
                        <div className="mt-4 flex flex-wrap gap-4 text-sm text-on-surface-variant">
                            {p.building_type ? <span>{p.building_type}</span> : null}
                            {p.floor != null ? <span>{p.floor}F / {p.total_floors}F</span> : null}
                            {p.main_area != null ? <span>主建物 {p.main_area} 坪</span> : null}
                            {p.rooms != null ? <span>{p.rooms}房{p.living_rooms}廳{p.bathrooms}衛</span> : null}
                            {p.building_age != null ? <span>屋齡 {p.building_age} 年</span> : null}
                            {p.building_orientation ? <span>朝向 {p.building_orientation}</span> : null}
                        </div>
                    ) : null}
                </section>

                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-6 text-xl font-bold text-on-surface">出售條件</h2>
                    <dl className="grid gap-4 md:grid-cols-2">
                        {[
                            ["總價", `NT$ ${listing.total_price.toLocaleString()}`],
                            ...(listing.unit_price_per_ping != null ? [["單坪價", `NT$ ${listing.unit_price_per_ping.toLocaleString()}`]] : []),
                            ...(listing.parking_type ? [["車位類型", listing.parking_type]] : []),
                            ...(listing.parking_price != null ? [["車位價格", `NT$ ${listing.parking_price.toLocaleString()}`]] : []),
                            ...(listing.expires_at ? [["刊登到期", new Date(listing.expires_at).toLocaleDateString("zh-TW")]] : []),
                        ].map(([label, value]) => (
                            <div key={label as string} className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-4">
                                <dt className="text-xs font-semibold text-on-surface-variant">{label}</dt>
                                <dd className="text-sm font-bold text-on-surface">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    {listing.notes ? (
                        <div className="mt-4 rounded-lg bg-surface-container-low p-4">
                            <p className="text-xs font-semibold text-on-surface-variant">備注</p>
                            <p className="mt-1 text-sm text-on-surface">{listing.notes}</p>
                        </div>
                    ) : null}
                </section>
            </main>
        </SiteLayout>
    );
}
