import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSaleListing, type SaleListing } from "../api/saleListingApi";
import SiteLayout from "../layouts/SiteLayout";

const BUILDING_TYPE_LABEL: Record<string, string> = {
    APARTMENT: "公寓", BUILDING: "大樓", TOWNHOUSE: "透天", STUDIO: "套房",
};
const PARKING_TYPE_LABEL: Record<string, string> = {
    NONE: "無停車位", RAMP: "坡道式", MECHANICAL: "機械式", TOWER: "塔式", UNDERGROUND: "地下室",
};
const SECURITY_TYPE_LABEL: Record<string, string> = {
    NONE: "無安管", PARTTIME: "兼職安管", FULLTIME: "全天安管",
};

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-4">
            <dt className="text-xs font-semibold text-on-surface-variant">{label}</dt>
            <dd className="text-sm font-bold text-on-surface">{value}</dd>
        </div>
    );
}

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
                        <div className="mt-4 flex flex-wrap gap-2">
                            {p.building_type ? <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{BUILDING_TYPE_LABEL[p.building_type] ?? p.building_type}</span> : null}
                            {p.floor != null ? <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{p.floor}F / {p.total_floors}F</span> : null}
                            {p.rooms != null ? <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{p.rooms}房{p.living_rooms}廳{p.bathrooms}衛</span> : null}
                            {p.is_corner_unit ? <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs font-semibold text-tertiary">邊間</span> : null}
                            {p.security_type && p.security_type !== "NONE" ? <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{SECURITY_TYPE_LABEL[p.security_type] ?? p.security_type}</span> : null}
                        </div>
                    ) : null}
                </section>

                {p ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <h2 className="mb-6 text-xl font-bold text-on-surface">物件基本資料</h2>
                        <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {p.main_area != null ? <InfoRow label="主建物" value={`${p.main_area} 坪`} /> : null}
                            {p.auxiliary_area != null ? <InfoRow label="附屬建物" value={`${p.auxiliary_area} 坪`} /> : null}
                            {p.balcony_area != null ? <InfoRow label="陽台" value={`${p.balcony_area} 坪`} /> : null}
                            {p.building_age != null ? <InfoRow label="屋齡" value={`${p.building_age} 年`} /> : null}
                            {p.building_orientation ? <InfoRow label="建物朝向" value={p.building_orientation} /> : null}
                            {p.window_orientation ? <InfoRow label="落地窗朝向" value={p.window_orientation} /> : null}
                            {p.parking_type ? <InfoRow label="停車類型" value={PARKING_TYPE_LABEL[p.parking_type] ?? p.parking_type} /> : null}
                            {p.management_fee != null ? <InfoRow label="管理費" value={`NT$ ${p.management_fee.toLocaleString()} / 月`} /> : null}
                            {p.security_type ? <InfoRow label="警衛管理" value={SECURITY_TYPE_LABEL[p.security_type] ?? p.security_type} /> : null}
                        </dl>
                    </section>
                ) : null}

                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-6 text-xl font-bold text-on-surface">出售條件</h2>
                    <dl className="grid gap-4 md:grid-cols-2">
                        <InfoRow label="總價" value={`NT$ ${listing.total_price.toLocaleString()}`} />
                        {listing.unit_price_per_ping != null ? <InfoRow label="建坪單價" value={`NT$ ${listing.unit_price_per_ping.toLocaleString()} / 坪`} /> : null}
                        {listing.parking_type ? <InfoRow label="車位類型" value={PARKING_TYPE_LABEL[listing.parking_type] ?? listing.parking_type} /> : null}
                        {listing.parking_price != null ? <InfoRow label="車位價格" value={`NT$ ${listing.parking_price.toLocaleString()}`} /> : null}
                        {listing.expires_at ? <InfoRow label="刊登到期" value={new Date(listing.expires_at).toLocaleDateString("zh-TW")} /> : null}
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
