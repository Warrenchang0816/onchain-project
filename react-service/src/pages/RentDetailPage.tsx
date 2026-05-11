import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRentalListing, type RentalListing } from "../api/rentalListingApi";
import { getAuthMe } from "@/api/authApi";
import HeartButton from "@/components/common/HeartButton";
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
const FEE_PAYER_LABEL: Record<string, string> = {
    TENANT: "租客負擔", OWNER: "房東負擔", SPLIT: "各半",
};
const GENDER_LABEL: Record<string, string> = {
    NONE: "不限", MALE: "限男性", FEMALE: "限女性",
};

type FurnishingKey = "has_sofa" | "has_bed" | "has_wardrobe" | "has_tv" | "has_fridge" |
    "has_ac" | "has_washer" | "has_water_heater" | "has_gas" | "has_internet" | "has_cable_tv";
type NearbyKey = "near_school" | "near_supermarket" | "near_convenience_store" | "near_park";

const FURNISHINGS: { key: FurnishingKey; label: string }[] = [
    { key: "has_sofa", label: "沙發" },
    { key: "has_bed", label: "床組" },
    { key: "has_wardrobe", label: "衣櫃" },
    { key: "has_tv", label: "電視" },
    { key: "has_fridge", label: "冰箱" },
    { key: "has_ac", label: "冷氣" },
    { key: "has_washer", label: "洗衣機" },
    { key: "has_water_heater", label: "熱水器" },
    { key: "has_gas", label: "天然瓦斯" },
    { key: "has_internet", label: "網路" },
    { key: "has_cable_tv", label: "第四台" },
];

const NEARBY: { key: NearbyKey; label: string }[] = [
    { key: "near_school", label: "近學校" },
    { key: "near_supermarket", label: "近超市" },
    { key: "near_convenience_store", label: "近便利商店" },
    { key: "near_park", label: "近公園" },
];

function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex flex-col gap-1">
            <dt className="text-xs font-semibold text-on-surface-variant">{label}</dt>
            <dd className="text-sm font-bold text-on-surface">{value ?? "—"}</dd>
        </div>
    );
}

function StatItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col items-center gap-0.5 px-4 first:pl-0">
            <span className="text-base font-bold text-on-surface">{value}</span>
            <span className="text-xs text-on-surface-variant">{label}</span>
        </div>
    );
}

export default function RentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const listingId = id ? parseInt(id, 10) : NaN;
    const [listing, setListing] = useState<RentalListing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        getAuthMe().then((r) => setAuthenticated(r.authenticated)).catch(() => undefined);
    }, []);

    useEffect(() => {
        if (isNaN(listingId)) return;
        getRentalListing(listingId)
            .then(setListing)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取失敗"))
            .finally(() => setLoading(false));
    }, [listingId]);

    if (loading) return <SiteLayout><div className="p-12 text-sm text-on-surface-variant">載入中...</div></SiteLayout>;
    if (error || !listing) return <SiteLayout><div className="p-12 text-sm text-error">{error || "找不到此刊登"}</div></SiteLayout>;

    const p = listing.property;
    const areas = p ? [p.main_area, p.auxiliary_area, p.balcony_area].filter((v): v is number => v != null) : [];
    const totalArea = areas.length > 0 ? areas.reduce((a, b) => a + b, 0) : null;
    const areaParts = p ? [
        p.main_area != null ? `主建物 ${p.main_area} 坪` : null,
        p.auxiliary_area != null ? `附屬 ${p.auxiliary_area} 坪` : null,
        p.balcony_area != null ? `陽台 ${p.balcony_area} 坪` : null,
    ].filter(Boolean).join(" + ") : null;
    const nearbyActive = NEARBY.filter(n => listing[n.key]);

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-12 md:px-12">
                <Link to="/rent" className="text-sm text-on-surface-variant hover:text-primary">← 出租物件列表</Link>

                {/* Hero */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <div className="flex items-start justify-between">
                        <h1 className="text-2xl font-extrabold text-on-surface">{p?.title ?? `出租 #${listing.id}`}</h1>
                        {listing && <HeartButton listingType="RENT" listingId={listing.id} authenticated={authenticated} />}
                    </div>
                    <p className="mt-1 text-sm text-on-surface-variant">{p?.address ?? ""}</p>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-4xl font-black text-primary">NT$ {listing.monthly_rent.toLocaleString()}</span>
                        <span className="text-sm text-on-surface-variant">/ 月</span>
                    </div>
                    <p className="mt-1 text-sm text-on-surface-variant">押金 {listing.deposit_months} 個月</p>
                    {p && (
                        <div className="mt-5 flex flex-wrap items-center divide-x divide-outline-variant/30 border-y border-outline-variant/15 py-4">
                            {totalArea != null && <StatItem label="坪數" value={`${totalArea.toFixed(1)} 坪`} />}
                            {p.rooms != null && p.living_rooms != null && p.bathrooms != null && (
                                <StatItem label="格局" value={`${p.rooms}房${p.living_rooms}廳${p.bathrooms}衛`} />
                            )}
                            {p.floor != null && <StatItem label="樓層" value={`${p.floor}F / ${p.total_floors}F`} />}
                        </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                        {p?.building_type && (
                            <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                {BUILDING_TYPE_LABEL[p.building_type] ?? p.building_type}
                            </span>
                        )}
                        {listing.allow_pets && (
                            <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs font-semibold text-tertiary">可養寵物</span>
                        )}
                        {listing.allow_cooking && (
                            <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs font-semibold text-tertiary">可炊煮</span>
                        )}
                        {listing.gender_restriction && listing.gender_restriction !== "NONE" && (
                            <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                {GENDER_LABEL[listing.gender_restriction] ?? listing.gender_restriction}
                            </span>
                        )}
                    </div>
                </section>

                {/* 出租條件 */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-6 text-xl font-bold text-on-surface">出租條件</h2>
                    <dl className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-3">
                        <InfoRow label="月租金" value={`NT$ ${listing.monthly_rent.toLocaleString()} / 月`} />
                        <InfoRow label="押金" value={`${listing.deposit_months} 個月`} />
                        <InfoRow label="最短租期" value={`${listing.min_lease_months} 個月`} />
                        <InfoRow label="管理費負擔" value={FEE_PAYER_LABEL[listing.management_fee_payer] ?? listing.management_fee_payer} />
                        <InfoRow label="開伙" value={listing.allow_cooking ? "可" : "不可"} />
                        <InfoRow label="寵物" value={listing.allow_pets ? "可" : "不可"} />
                        <InfoRow
                            label="性別限制"
                            value={listing.gender_restriction ? (GENDER_LABEL[listing.gender_restriction] ?? listing.gender_restriction) : null}
                        />
                    </dl>
                    {listing.notes && (
                        <div className="mt-6 rounded-lg bg-surface-container-low p-4">
                            <p className="text-xs font-semibold text-on-surface-variant">特色說明</p>
                            <p className="mt-1 text-sm leading-relaxed text-on-surface">{listing.notes}</p>
                        </div>
                    )}
                </section>

                {/* 物件資料 */}
                {p && (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <h2 className="mb-6 text-xl font-bold text-on-surface">物件資料</h2>
                        <dl className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-3">
                            {areaParts && totalArea !== null && (
                                <div className="col-span-full flex flex-col gap-1">
                                    <dt className="text-xs font-semibold text-on-surface-variant">坪數</dt>
                                    <dd className="text-sm font-bold text-on-surface">
                                        <span className="text-on-surface-variant">{areaParts}</span>
                                        <span className="mx-2 text-on-surface-variant">=</span>
                                        <span className="text-primary">{totalArea.toFixed(1)} 坪</span>
                                    </dd>
                                </div>
                            )}
                            <InfoRow label="屋齡" value={p.building_age != null ? `${p.building_age} 年` : null} />
                            <InfoRow label="樓層" value={p.floor != null ? `${p.floor} / ${p.total_floors} 樓` : null} />
                            <InfoRow label="建物朝向" value={p.building_orientation ?? null} />
                            <InfoRow label="管理費" value={p.management_fee != null ? `NT$ ${p.management_fee.toLocaleString()} / 月` : null} />
                            <InfoRow label="警衛管理" value={p.security_type ? (SECURITY_TYPE_LABEL[p.security_type] ?? p.security_type) : null} />
                            <InfoRow label="停車位" value={p.parking_type ? (PARKING_TYPE_LABEL[p.parking_type] ?? p.parking_type) : null} />
                        </dl>
                    </section>
                )}

                {/* 傢俱設備 */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-6 text-xl font-bold text-on-surface">傢俱設備</h2>
                    <div className="flex flex-wrap gap-3">
                        {FURNISHINGS.map(f => {
                            const has = listing[f.key];
                            return (
                                <span
                                    key={f.key}
                                    className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold ${has ? "bg-primary/10 text-primary" : "bg-surface-container-low text-on-surface-variant/40 line-through"}`}
                                >
                                    {f.label}
                                </span>
                            );
                        })}
                    </div>
                </section>

                {/* 周邊環境 */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-6 text-xl font-bold text-on-surface">周邊環境</h2>
                    {nearbyActive.length > 0 ? (
                        <div className="mb-6 flex flex-wrap gap-2">
                            {nearbyActive.map(n => (
                                <span key={n.key} className="rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-semibold text-primary">
                                    {n.label}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="mb-6 text-sm text-on-surface-variant">暫無資料</p>
                    )}
                    <div className="rounded-lg bg-surface-container-low p-4">
                        <p className="text-xs font-semibold text-on-surface-variant">交通資訊</p>
                        <p className="mt-1 text-sm text-on-surface-variant">—</p>
                    </div>
                </section>
            </main>
        </SiteLayout>
    );
}
