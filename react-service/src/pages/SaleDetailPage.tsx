import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSaleListing, type SaleListing } from "../api/saleListingApi";
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

function formatWan(price: number): string {
    const wan = Math.round(price / 10000);
    return `${wan.toLocaleString("zh-TW")}萬`;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-4">
            <dt className="text-xs font-semibold text-on-surface-variant">{label}</dt>
            <dd className="text-sm font-bold text-on-surface">{value ?? "—"}</dd>
        </div>
    );
}

function StatItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="flex flex-1 flex-col items-center px-2 py-3">
            <span className="text-xs text-on-surface-variant">{label}</span>
            <span className="mt-1 text-sm font-bold text-on-surface">{value}</span>
            {sub && <span className="text-xs text-on-surface-variant">{sub}</span>}
        </div>
    );
}

export default function SaleDetailPage() {
    const { id } = useParams<{ id: string }>();
    const listingId = id ? parseInt(id, 10) : NaN;
    const [listing, setListing] = useState<SaleListing | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        getAuthMe().then((r) => setAuthenticated(r.authenticated)).catch(() => undefined);
    }, []);

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
    const totalArea = p
        ? (p.main_area ?? 0) + (p.auxiliary_area ?? 0) + (p.balcony_area ?? 0)
        : 0;
    const hasAreaBreakdown = p && (p.main_area != null || p.auxiliary_area != null || p.balcony_area != null);
    const hasBuildingDetail = p && (
        p.building_structure != null || p.exterior_material != null ||
        p.units_on_floor != null || p.building_usage != null || p.zoning != null
    );

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-12 md:px-12">
                <Link to="/sale" className="text-sm text-on-surface-variant hover:text-primary">← 出售物件列表</Link>

                {/* ── Hero ── */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <div className="flex items-start justify-between">
                        <h1 className="text-3xl font-extrabold text-on-surface">{p?.title ?? `出售 #${listing.id}`}</h1>
                        {listing && <HeartButton listingType="SALE" listingId={listing.id} authenticated={authenticated} />}
                    </div>
                    <p className="mt-1 text-sm text-on-surface-variant">{p?.address ?? ""}</p>

                    <div className="mt-4">
                        <p className="text-4xl font-black text-primary">{formatWan(listing.total_price)}</p>
                        {listing.unit_price_per_ping != null && (
                            <p className="mt-1 text-sm text-on-surface-variant">
                                建坪單價 {(listing.unit_price_per_ping / 10000).toFixed(1)} 萬/坪
                            </p>
                        )}
                    </div>

                    {p && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {p.building_type && (
                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                    {BUILDING_TYPE_LABEL[p.building_type] ?? p.building_type}
                                </span>
                            )}
                            {p.floor != null && (
                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                    {p.floor}F / {p.total_floors}F
                                </span>
                            )}
                            {p.rooms != null && (
                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                    {p.rooms}房{p.living_rooms}廳{p.bathrooms}衛
                                </span>
                            )}
                            {p.is_corner_unit && (
                                <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs font-semibold text-tertiary">邊間</span>
                            )}
                            {p.security_type && p.security_type !== "NONE" && (
                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                    {SECURITY_TYPE_LABEL[p.security_type] ?? p.security_type}
                                </span>
                            )}
                        </div>
                    )}

                    {/* 快速統計條 */}
                    {p && (p.main_area != null || p.rooms != null || p.building_age != null || p.floor != null) && (
                        <div className="mt-5 flex divide-x divide-outline-variant/20 overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-low">
                            {totalArea > 0 && (
                                <StatItem label="建坪" value={`${totalArea.toFixed(1)} 坪`} />
                            )}
                            {p.rooms != null && (
                                <StatItem label="格局" value={`${p.rooms}房${p.living_rooms}廳${p.bathrooms}衛`} />
                            )}
                            {p.building_age != null && (
                                <StatItem
                                    label="屋齡"
                                    value={`${p.building_age} 年`}
                                    sub={p.building_type ? (BUILDING_TYPE_LABEL[p.building_type] ?? p.building_type) : undefined}
                                />
                            )}
                            {p.floor != null && (
                                <StatItem label="樓層" value={`${p.floor}/${p.total_floors} 樓`} />
                            )}
                            {p.parking_type && p.parking_type !== "NONE" && (
                                <StatItem label="車位" value={PARKING_TYPE_LABEL[p.parking_type] ?? p.parking_type} />
                            )}
                        </div>
                    )}
                </section>

                {/* ── 基本資料 ── */}
                {p && (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <h2 className="mb-6 text-xl font-bold text-on-surface">基本資料</h2>
                        <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {totalArea > 0 && <InfoRow label="建坪（登記）" value={`${totalArea.toFixed(1)} 坪`} />}
                            <InfoRow label="地坪" value={p.land_area != null ? `${p.land_area} 坪` : null} />

                            {/* 面積拆解方程式 */}
                            {hasAreaBreakdown && (
                                <div className="col-span-full rounded-lg bg-surface-container-low p-4">
                                    <dt className="text-xs font-semibold text-on-surface-variant">主建物面積拆解</dt>
                                    <dd className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-on-surface">
                                        {p.main_area != null && (
                                            <span>{p.main_area} 坪 <span className="text-xs font-normal text-on-surface-variant">主建物</span></span>
                                        )}
                                        {p.auxiliary_area != null && (
                                            <><span className="font-normal text-on-surface-variant">＋</span>
                                            <span>{p.auxiliary_area} 坪 <span className="text-xs font-normal text-on-surface-variant">附屬建物</span></span></>
                                        )}
                                        {p.balcony_area != null && (
                                            <><span className="font-normal text-on-surface-variant">＋</span>
                                            <span>{p.balcony_area} 坪 <span className="text-xs font-normal text-on-surface-variant">陽台</span></span></>
                                        )}
                                        <span className="font-normal text-on-surface-variant">＝</span>
                                        <span className="text-primary">{totalArea.toFixed(1)} 坪 <span className="text-xs font-normal text-on-surface-variant">合計</span></span>
                                    </dd>
                                </div>
                            )}

                            <InfoRow label="共有部份" value={p.shared_area != null ? `${p.shared_area} 坪` : null} />
                            <InfoRow label="雨遮" value={p.awning_area != null ? `${p.awning_area} 坪` : null} />
                            {p.building_age != null && <InfoRow label="屋齡" value={`${p.building_age} 年`} />}
                            {p.rooms != null && (
                                <InfoRow label="格局" value={`${p.rooms}房 ${p.living_rooms}廳 ${p.bathrooms}衛`} />
                            )}
                            {p.building_type && (
                                <InfoRow label="建物類型" value={BUILDING_TYPE_LABEL[p.building_type] ?? p.building_type} />
                            )}
                            {p.floor != null && <InfoRow label="樓層" value={`${p.floor}F / ${p.total_floors}F`} />}
                            <InfoRow
                                label="邊間 / 暗房"
                                value={`${p.is_corner_unit ? "是" : "否"} / ${p.has_dark_room ? "是" : "否"}`}
                            />
                            {p.building_orientation && <InfoRow label="建物朝向" value={p.building_orientation} />}
                            {p.window_orientation && <InfoRow label="落地窗朝向" value={p.window_orientation} />}
                            {p.security_type && (
                                <InfoRow label="警衛管理" value={SECURITY_TYPE_LABEL[p.security_type] ?? p.security_type} />
                            )}
                            {p.management_fee != null && (
                                <InfoRow label="管理費" value={`NT$ ${p.management_fee.toLocaleString()} / 月`} />
                            )}
                            {p.parking_type && (
                                <InfoRow label="車位類型" value={PARKING_TYPE_LABEL[p.parking_type] ?? p.parking_type} />
                            )}
                        </dl>
                    </section>
                )}

                {/* ── 建物詳情 ── */}
                {p && hasBuildingDetail && (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                        <h2 className="mb-6 text-xl font-bold text-on-surface">建物詳情</h2>
                        <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <InfoRow label="建物結構" value={p.building_structure} />
                            <InfoRow label="外牆建材" value={p.exterior_material} />
                            <InfoRow label="該層戶數" value={p.units_on_floor != null ? `${p.units_on_floor} 戶` : null} />
                            <InfoRow label="謄本用途" value={p.building_usage} />
                            <InfoRow label="使用分區" value={p.zoning} />
                        </dl>
                    </section>
                )}

                {/* ── 出售條件 ── */}
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <h2 className="mb-6 text-xl font-bold text-on-surface">出售條件</h2>
                    <dl className="grid gap-4 md:grid-cols-2">
                        <InfoRow label="總價" value={`NT$ ${listing.total_price.toLocaleString()}`} />
                        {listing.unit_price_per_ping != null && (
                            <InfoRow label="建坪單價" value={`NT$ ${listing.unit_price_per_ping.toLocaleString()} / 坪`} />
                        )}
                        {listing.parking_type && (
                            <InfoRow label="車位類型" value={PARKING_TYPE_LABEL[listing.parking_type] ?? listing.parking_type} />
                        )}
                        {listing.parking_price != null && (
                            <InfoRow label="車位價格" value={`NT$ ${listing.parking_price.toLocaleString()}`} />
                        )}
                        {listing.expires_at && (
                            <InfoRow label="刊登到期" value={new Date(listing.expires_at).toLocaleDateString("zh-TW")} />
                        )}
                    </dl>
                    {listing.notes && (
                        <div className="mt-4 rounded-lg bg-surface-container-low p-4">
                            <p className="text-xs font-semibold text-on-surface-variant">備注</p>
                            <p className="mt-1 text-sm text-on-surface">{listing.notes}</p>
                        </div>
                    )}
                </section>
            </main>
        </SiteLayout>
    );
}
