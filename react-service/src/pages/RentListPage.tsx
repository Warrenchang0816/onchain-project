import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getTaiwanDistricts, type TaiwanDistrictOption } from "@/api/listingApi";
import { getRentalListings, type RentalListing } from "@/api/rentalListingApi";
import ListingSearchFilters, { type ListingSearchFilterValues } from "@/components/search/ListingSearchFilters";
import { districtOptionToSelection, encodeDistrictToken, type DistrictSelection } from "@/components/location/districtSelection";
import SiteLayout from "@/layouts/SiteLayout";
import { getAuthMe } from "@/api/authApi";
import HeartButton from "@/components/common/HeartButton";

const BUILDING_TYPE_LABEL: Record<string, string> = {
    APARTMENT: "公寓", BUILDING: "大樓", TOWNHOUSE: "透天", STUDIO: "套房",
};

function formatLayout(rl: RentalListing): string {
    const p = rl.property;
    if (!p) return "";
    const parts = [];
    if (p.rooms != null) parts.push(`${p.rooms}房`);
    if (p.living_rooms != null) parts.push(`${p.living_rooms}廳`);
    if (p.bathrooms != null) parts.push(`${p.bathrooms}衛`);
    return parts.join("");
}

function readSelectedDistricts(options: TaiwanDistrictOption[], tokens: string[]): DistrictSelection[] {
    const optionMap = new Map(options.map((o) => [encodeDistrictToken(o), o]));
    return tokens
        .map((t) => optionMap.get(t))
        .filter((o): o is TaiwanDistrictOption => Boolean(o))
        .map(districtOptionToSelection);
}

function matchesRent(
    item: RentalListing,
    districts: DistrictSelection[],
    keyword: string,
    priceMin: string,
    priceMax: string,
): boolean {
    const addr = item.property?.address?.toLowerCase() ?? "";
    const title = item.property?.title?.toLowerCase() ?? "";
    if (keyword.trim()) {
        const kw = keyword.toLowerCase().trim();
        if (!addr.includes(kw) && !title.includes(kw)) return false;
    }
    if (districts.length > 0) {
        const hit = districts.some((d) => addr.includes(d.district));
        if (!hit) return false;
    }
    const min = Number(priceMin);
    const max = Number(priceMax);
    if (priceMin && Number.isFinite(min) && item.monthly_rent < min) return false;
    if (priceMax && Number.isFinite(max) && item.monthly_rent > max) return false;
    return true;
}

export default function RentListPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [districtOptions, setDistrictOptions] = useState<TaiwanDistrictOption[]>([]);
    const [allItems, setAllItems] = useState<RentalListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [authenticated, setAuthenticated] = useState(false);

    const selectedDistricts = useMemo(
        () => readSelectedDistricts(districtOptions, searchParams.getAll("district")),
        [districtOptions, searchParams],
    );
    const keyword = searchParams.get("keyword") ?? "";
    const priceMin = searchParams.get("priceMin") ?? "";
    const priceMax = searchParams.get("priceMax") ?? "";

    const [filters, setFilters] = useState<ListingSearchFilterValues>({
        districts: [], keyword: "", priceMin: "", priceMax: "",
    });

    useEffect(() => {
        const update = async () => {
            setFilters({ districts: selectedDistricts, keyword, priceMin, priceMax });
        };
        void update();
    }, [selectedDistricts, keyword, priceMin, priceMax]);

    useEffect(() => {
        const loadDistricts = async () => {
            try { setDistrictOptions(await getTaiwanDistricts()); } catch { setDistrictOptions([]); }
        };
        void loadDistricts();
    }, []);

    useEffect(() => {
        getRentalListings()
            .then(setAllItems)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取租屋列表失敗"))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        getAuthMe().then((r) => setAuthenticated(r.authenticated)).catch(() => undefined);
    }, []);

    const items = useMemo(
        () => allItems.filter((item) => matchesRent(item, selectedDistricts, keyword, priceMin, priceMax)),
        [allItems, selectedDistricts, keyword, priceMin, priceMax],
    );

    const applyFilters = () => {
        const next = new URLSearchParams();
        filters.districts.forEach((d) => next.append("district", encodeDistrictToken(d)));
        if (filters.keyword.trim()) next.set("keyword", filters.keyword.trim());
        if (filters.priceMin.trim()) next.set("priceMin", filters.priceMin.trim());
        if (filters.priceMax.trim()) next.set("priceMax", filters.priceMax.trim());
        setSearchParams(next);
    };

    const resetFilters = () => setSearchParams(new URLSearchParams());

    return (
        <SiteLayout>
            <section className="w-full bg-gradient-to-r from-surface to-surface-container-low py-12 md:py-16">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">出租物件</h1>
                    <p className="max-w-2xl text-base leading-[1.75] text-on-surface-variant md:text-lg">
                        瀏覽平台上已公開的出租房源，快速找到合適物件。
                    </p>
                </div>
            </section>

            <section className="w-full bg-surface py-12">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    <div className="mb-6 grid gap-3">
                        <ListingSearchFilters
                            districtOptions={districtOptions}
                            values={filters}
                            submitLabel="搜尋出租"
                            keywordPlaceholder="地址、社區、捷運站"
                            pricePlaceholderMin="最低月租"
                            pricePlaceholderMax="最高月租"
                            onChange={setFilters}
                            onSubmit={applyFilters}
                            onReset={resetFilters}
                        />
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-32">
                            <span className="animate-pulse text-sm text-on-surface-variant">讀取租屋中...</span>
                        </div>
                    ) : error ? (
                        <div className="rounded-xl border border-error/20 bg-error-container p-8 text-sm text-on-error-container">{error}</div>
                    ) : items.length === 0 ? (
                        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                            <h2 className="text-2xl font-bold text-on-surface">目前沒有符合條件的租屋物件</h2>
                            <p className="mt-2 text-sm text-on-surface-variant">請調整搜尋條件，或稍後再回來查看。</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5">
                            {items.map((item) => (
                                <article
                                    key={item.id}
                                    className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
                                    onClick={() => navigate(`/rent/${item.id}`)}
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="flex-1">
                                            <div className="mb-2 flex flex-wrap gap-2">
                                                {item.property?.building_type ? (
                                                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                                        {BUILDING_TYPE_LABEL[item.property.building_type] ?? item.property.building_type}
                                                    </span>
                                                ) : null}
                                                {formatLayout(item) ? (
                                                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{formatLayout(item)}</span>
                                                ) : null}
                                                {item.allow_pets ? <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">可養寵物</span> : null}
                                            </div>
                                            <h2 className="text-lg font-bold text-on-surface">
                                                {item.property?.title ?? `出租 #${item.id}`}
                                            </h2>
                                            <p className="mt-1 text-sm text-on-surface-variant">
                                                {item.property?.address ?? "地址未提供"}
                                            </p>
                                            {item.property?.main_area ? (
                                                <p className="mt-1 text-xs text-on-surface-variant">{item.property.main_area} 坪</p>
                                            ) : null}
                                        </div>
                                        <div className="flex items-start gap-2 md:flex-col md:items-end">
                                            <div className="text-left md:text-right">
                                                <p className="text-2xl font-extrabold text-on-surface">
                                                    NT$ {item.monthly_rent.toLocaleString()}
                                                    <span className="ml-1 text-base font-normal text-on-surface-variant">/ 月</span>
                                                </p>
                                                <p className="mt-1 text-xs text-on-surface-variant">押金 {item.deposit_months} 個月</p>
                                            </div>
                                            <HeartButton listingType="RENT" listingId={item.id} authenticated={authenticated} />
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </SiteLayout>
    );
}
