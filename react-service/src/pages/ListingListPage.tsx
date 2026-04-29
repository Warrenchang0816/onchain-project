import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAuthMe } from "../api/authApi";
import { getKYCStatus, type KYCStatus } from "../api/kycApi";
import { getListings, type Listing, type ListingType } from "../api/listingApi";
import SiteLayout from "../layouts/SiteLayout";

type TypeFilter = "ALL" | Exclude<ListingType, "UNSET">;

const STATUS_LABEL: Record<string, string> = {
    DRAFT: "草稿",
    ACTIVE: "上架中",
    NEGOTIATING: "媒合中",
    LOCKED: "已鎖定",
    SIGNING: "簽約中",
    CLOSED: "已結案",
    EXPIRED: "已到期",
    REMOVED: "已下架",
    SUSPENDED: "已暫停",
};

function formatPrice(listing: Listing): string {
    if (listing.price <= 0) return "價格未設定";
    if (listing.list_type === "RENT") return `NT$ ${listing.price.toLocaleString()} / 月`;
    return `NT$ ${listing.price.toLocaleString()}`;
}

function ListingCard(props: { listing: Listing; onClick: () => void }) {
    const { listing, onClick } = props;
    return (
        <article
            onClick={onClick}
            className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-lowest transition-transform duration-300 hover:-translate-y-1"
        >
            <div className="relative h-56 w-full overflow-hidden bg-surface-variant">
                {listing.image_url ? (
                    <img src={listing.image_url} alt={listing.title} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <span className="material-symbols-outlined text-7xl text-on-surface-variant/20" style={{ fontVariationSettings: "'FILL' 1" }}>
                            home
                        </span>
                    </div>
                )}
                <div className="absolute left-4 top-4 rounded-full bg-surface-container-lowest px-3 py-1 text-xs font-bold text-on-surface">
                    {STATUS_LABEL[listing.status] ?? listing.status}
                </div>
            </div>
            <div className="flex flex-grow flex-col p-6">
                <div className="mb-2 flex items-start justify-between gap-4">
                    <h3 className="text-xl font-bold leading-tight text-on-surface">{listing.title || "未命名房源"}</h3>
                    <div className="shrink-0 text-lg font-bold text-primary-container">{formatPrice(listing)}</div>
                </div>
                <p className="mb-6 text-sm leading-[1.75] text-on-surface-variant">
                    {listing.district ? `${listing.district}，` : ""}
                    {listing.address}
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                    {listing.area_ping !== undefined ? <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">{listing.area_ping} 坪</span> : null}
                    {listing.room_count !== undefined ? (
                        <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">
                            {listing.room_count} 房{listing.bathroom_count !== undefined ? ` / ${listing.bathroom_count} 衛` : ""}
                        </span>
                    ) : null}
                    {listing.floor !== undefined && listing.total_floors !== undefined ? (
                        <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">
                            {listing.floor}F / {listing.total_floors}F
                        </span>
                    ) : null}
                </div>
            </div>
        </article>
    );
}

export default function ListingListPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [listings, setListings] = useState<Listing[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [isOwner, setIsOwner] = useState(false);

    const typeParam = searchParams.get("type");
    const typeFilter: TypeFilter = typeParam === "RENT" || typeParam === "SALE" ? typeParam : "ALL";
    const districtFilter = searchParams.get("district")?.trim() ?? "";

    useEffect(() => {
        const load = async () => {
            try {
                setIsLoading(true);
                setLoadError("");
                const params = {
                    ...(typeFilter !== "ALL" ? { type: typeFilter } : {}),
                    ...(districtFilter ? { district: districtFilter } : {}),
                };
                const [publicListings, auth] = await Promise.all([
                    getListings(Object.keys(params).length > 0 ? params : undefined),
                    getAuthMe().catch(() => ({ authenticated: false })),
                ]);
                setListings(publicListings);
                if (auth.authenticated) {
                    const kyc = await getKYCStatus().catch(() => ({ kycStatus: "UNVERIFIED" as KYCStatus, credentials: [] as string[] }));
                    setIsOwner(kyc.credentials?.includes("OWNER") ?? false);
                } else {
                    setIsOwner(false);
                }
            } catch (err) {
                setLoadError(err instanceof Error ? err.message : "讀取房源失敗。");
            } finally {
                setIsLoading(false);
            }
        };
        void load();
    }, [districtFilter, typeFilter]);

    const setType = (next: TypeFilter) => {
        const nextParams = new URLSearchParams(searchParams);
        if (next === "ALL") nextParams.delete("type");
        else nextParams.set("type", next);
        setSearchParams(nextParams);
    };

    const tabCls = (active: boolean) =>
        active
            ? "border-b-2 border-primary-container bg-transparent pb-1 text-lg font-bold text-primary-container"
            : "bg-transparent pb-1 text-lg font-medium text-on-surface-variant transition-colors hover:text-on-surface";

    return (
        <SiteLayout>
            <section className="w-full bg-gradient-to-r from-surface to-surface-container-low py-12 md:py-16">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">房源列表</h1>
                    <p className="max-w-2xl text-base leading-[1.75] text-on-surface-variant md:text-lg">
                        這裡只顯示已上架的公開房源；屋主草稿會保留在私人工作區，不會出現在公開列表。
                    </p>
                    {districtFilter ? (
                        <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-sm text-on-surface">
                            <span>區域篩選：{districtFilter}</span>
                            <button
                                type="button"
                                onClick={() => {
                                    const nextParams = new URLSearchParams(searchParams);
                                    nextParams.delete("district");
                                    setSearchParams(nextParams);
                                }}
                                className="bg-transparent text-on-surface-variant transition-colors hover:text-on-surface"
                            >
                                清除
                            </button>
                        </div>
                    ) : null}
                </div>
            </section>

            <section className="sticky top-[64px] z-40 w-full bg-surface-container-lowest">
                <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-4 px-6 py-4 md:flex-row md:items-center md:px-12">
                    <div className="flex items-center gap-6">
                        <button type="button" onClick={() => setType("ALL")} className={tabCls(typeFilter === "ALL")}>全部</button>
                        <button type="button" onClick={() => setType("RENT")} className={tabCls(typeFilter === "RENT")}>出租</button>
                        <button type="button" onClick={() => setType("SALE")} className={tabCls(typeFilter === "SALE")}>出售</button>
                    </div>
                    {isOwner ? (
                        <button
                            type="button"
                            onClick={() => navigate("/my/listings")}
                            className="flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-on-primary-container transition-opacity hover:opacity-90"
                        >
                            <span className="material-symbols-outlined text-sm">home_work</span>
                            <span className="text-sm font-medium">我的房源</span>
                        </button>
                    ) : null}
                </div>
            </section>

            <section className="w-full bg-surface py-12">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-32">
                            <span className="animate-pulse text-sm text-on-surface-variant">讀取房源中...</span>
                        </div>
                    ) : loadError ? (
                        <div className="rounded-xl border border-error/20 bg-error-container p-8 text-sm text-on-error-container">{loadError}</div>
                    ) : listings.length === 0 ? (
                        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                            <h2 className="text-2xl font-bold text-on-surface">目前沒有符合條件的房源</h2>
                            <p className="mt-2 text-sm text-on-surface-variant">屋主可先建立草稿，資料完善後再公開上架。</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 md:gap-12">
                            {listings.map((listing) => (
                                <ListingCard key={listing.id} listing={listing} onClick={() => navigate(`/listings/${listing.id}`)} />
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </SiteLayout>
    );
}
