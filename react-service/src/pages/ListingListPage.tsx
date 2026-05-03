import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAuthMe } from "../api/authApi";
import { getKYCStatus, type KYCStatus } from "../api/kycApi";
import { getListings, getTaiwanDistricts, type Listing, type TaiwanDistrictOption } from "../api/listingApi";
import ListingResultCard from "../components/listing/ListingResultCard";
import ListingSearchBar, { type ListingSearchState } from "../components/listing/ListingSearchBar";
import { buildListingDisplayModel } from "../components/listing/listingDisplayModel";
import SiteLayout from "../layouts/SiteLayout";

type TypeFilter = ListingSearchState["mode"];

function resolveTypeFilter(value: string | null): TypeFilter {
    if (value === "RENT" || value === "SALE") return value;
    return "ALL";
}

function sortListings(listings: Listing[], sort: string): Listing[] {
    const sorted = [...listings];
    if (sort === "newest") {
        sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    if (sort === "priceAsc") {
        sorted.sort((a, b) => a.price - b.price);
    }
    if (sort === "priceDesc") {
        sorted.sort((a, b) => b.price - a.price);
    }
    if (sort === "areaDesc") {
        sorted.sort((a, b) => (b.area_ping ?? 0) - (a.area_ping ?? 0));
    }
    return sorted;
}

function filterListings(listings: Listing[], state: ListingSearchState): Listing[] {
    return listings.filter((listing) => {
        const keyword = state.keyword.trim().toLowerCase();
        const layout = state.layout;

        if (keyword) {
            const searchable = [listing.title, listing.address, listing.district, String(listing.id)].join(" ").toLowerCase();
            if (!searchable.includes(keyword)) return false;
        }

        if (layout) {
            const rooms = listing.room_count ?? 0;
            if (layout === "1" && rooms !== 1) return false;
            if (layout === "2" && rooms !== 2) return false;
            if (layout === "3" && rooms < 3) return false;
        }

        if (state.priceBand) {
            const price = listing.rent_details?.monthly_rent || listing.sale_details?.sale_total_price || listing.price;
            const isRent = state.mode === "RENT" || listing.list_type === "RENT";
            if (state.priceBand === "low" && price > (isRent ? 20000 : 10000000)) return false;
            if (state.priceBand === "mid" && (price <= (isRent ? 20000 : 10000000) || price > (isRent ? 50000 : 30000000))) return false;
            if (state.priceBand === "high" && price <= (isRent ? 50000 : 30000000)) return false;
        }

        return true;
    });
}

export default function ListingListPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [listings, setListings] = useState<Listing[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [isOwner, setIsOwner] = useState(false);
    const [districtOptions, setDistrictOptions] = useState<TaiwanDistrictOption[]>([]);

    const typeFilter = resolveTypeFilter(searchParams.get("type"));
    const districtFilter = searchParams.get("district")?.trim() ?? "";
    const [searchState, setSearchState] = useState<ListingSearchState>({
        mode: typeFilter,
        district: districtFilter,
        keyword: "",
        priceBand: "",
        layout: "",
        sort: "default",
        mapSelected: false,
    });

    useEffect(() => {
        setSearchState((current) => ({
            ...current,
            mode: typeFilter,
            district: districtFilter,
        }));
    }, [districtFilter, typeFilter]);

    useEffect(() => {
        const load = async () => {
            try {
                setIsLoading(true);
                setLoadError("");
                const params = {
                    ...(typeFilter !== "ALL" ? { type: typeFilter } : {}),
                    ...(districtFilter ? { district: districtFilter } : {}),
                };
                const [publicListings, districts, auth] = await Promise.all([
                    getListings(Object.keys(params).length > 0 ? params : undefined),
                    getTaiwanDistricts(),
                    getAuthMe().catch(() => ({ authenticated: false })),
                ]);
                setListings(publicListings);
                setDistrictOptions(districts);
                if (auth.authenticated) {
                    const kyc = await getKYCStatus().catch(() => ({ kycStatus: "UNVERIFIED" as KYCStatus, credentials: [] as string[] }));
                    setIsOwner(kyc.credentials?.includes("OWNER") ?? false);
                } else {
                    setIsOwner(false);
                }
            } catch (err) {
                setLoadError(err instanceof Error ? err.message : "讀取刊登列表失敗");
            } finally {
                setIsLoading(false);
            }
        };
        void load();
    }, [districtFilter, typeFilter]);

    const applySearch = () => {
        const nextParams = new URLSearchParams(searchParams);
        if (searchState.mode === "ALL") nextParams.delete("type");
        else nextParams.set("type", searchState.mode);
        if (searchState.district.trim()) nextParams.set("district", searchState.district.trim());
        else nextParams.delete("district");
        setSearchParams(nextParams);
    };

    const visibleListings = sortListings(filterListings(listings, searchState), searchState.sort);
    const pageTitle = typeFilter === "RENT" ? "出租物件" : typeFilter === "SALE" ? "賣屋物件" : "房源列表";
    const pageDescription =
        typeFilter === "RENT"
            ? "用租金、區域與租客條件快速篩選出租物件。"
            : typeFilter === "SALE"
              ? "用區域、總價與格局比較可出售物件。"
              : "瀏覽平台上已公開的出售與出租房源。";

    return (
        <SiteLayout>
            <section className="w-full bg-gradient-to-r from-surface to-surface-container-low py-12 md:py-16">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">{pageTitle}</h1>
                    <p className="max-w-2xl text-base leading-[1.75] text-on-surface-variant md:text-lg">{pageDescription}</p>
                    {districtFilter ? (
                        <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-sm text-on-surface">
                            <span>目前區域：{districtFilter}</span>
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

            <section className="sticky top-[64px] z-40 w-full border-b border-outline-variant/10 bg-surface-container-lowest">
                <div className="mx-auto max-w-[1440px] px-6 py-4 md:px-12">
                    <ListingSearchBar
                        state={searchState}
                        districtOptions={districtOptions}
                        onChange={setSearchState}
                        onSearch={applySearch}
                    />
                    {isOwner ? (
                        <button
                            type="button"
                            onClick={() => navigate("/my/listings")}
                            className="mt-4 flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-on-primary-container transition-opacity hover:opacity-90"
                        >
                            <span className="material-symbols-outlined text-sm">home_work</span>
                            <span className="text-sm font-medium">我的刊登</span>
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
                    ) : visibleListings.length === 0 ? (
                        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                            <h2 className="text-2xl font-bold text-on-surface">目前沒有符合條件的物件</h2>
                            <p className="mt-2 text-sm text-on-surface-variant">請調整搜尋條件，或稍後再回來查看。</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5">
                            {visibleListings.map((listing) => (
                                <ListingResultCard
                                    key={listing.id}
                                    listing={buildListingDisplayModel(listing)}
                                    onClick={() => navigate(`/listings/${listing.id}`)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </SiteLayout>
    );
}
