import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getTaiwanDistricts, type TaiwanDistrictOption } from "@/api/listingApi";
import { getRequirementList, type TenantRequirement, type TenantRequirementStatus } from "@/api/tenantApi";
import ListingSearchFilters, { type ListingSearchFilterValues } from "@/components/search/ListingSearchFilters";
import TenantRequirementCard from "@/components/tenant/TenantRequirementCard";
import { districtOptionToSelection, encodeDistrictToken, type DistrictSelection } from "@/components/location/districtSelection";
import SiteLayout from "@/layouts/SiteLayout";

const statusOptions: { value: TenantRequirementStatus; label: string }[] = [
    { value: "OPEN", label: "開放中" },
    { value: "PAUSED", label: "暫停" },
    { value: "CLOSED", label: "已結案" },
];

function readSelectedDistricts(options: TaiwanDistrictOption[], tokens: string[]): DistrictSelection[] {
    const optionMap = new Map(options.map((option) => [encodeDistrictToken(option), option]));
    return tokens
        .map((token) => optionMap.get(token))
        .filter((option): option is TaiwanDistrictOption => Boolean(option))
        .map(districtOptionToSelection);
}

function budgetMatches(item: TenantRequirement, minValue: string, maxValue: string): boolean {
    const min = Number(minValue);
    const max = Number(maxValue);
    if (minValue && Number.isFinite(min) && item.budgetMax < min) return false;
    if (maxValue && Number.isFinite(max) && item.budgetMin > max) return false;
    return true;
}

export default function RequirementsPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [districtOptions, setDistrictOptions] = useState<TaiwanDistrictOption[]>([]);
    const [items, setItems] = useState<TenantRequirement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const selectedDistricts = useMemo(
        () => readSelectedDistricts(districtOptions, searchParams.getAll("district")),
        [districtOptions, searchParams],
    );
    const status = (searchParams.get("status") ?? "OPEN") as TenantRequirementStatus;
    const keyword = searchParams.get("keyword") ?? "";
    const priceMin = searchParams.get("priceMin") ?? "";
    const priceMax = searchParams.get("priceMax") ?? "";

    const [filters, setFilters] = useState<ListingSearchFilterValues>({
        districts: [],
        keyword: "",
        priceMin: "",
        priceMax: "",
    });

    useEffect(() => {
        setFilters({ districts: selectedDistricts, keyword, priceMin, priceMax });
    }, [selectedDistricts, keyword, priceMin, priceMax]);

    useEffect(() => {
        const loadDistricts = async () => {
            try {
                setDistrictOptions(await getTaiwanDistricts());
            } catch {
                setDistrictOptions([]);
            }
        };
        void loadDistricts();
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setError("");
                const results = await getRequirementList({
                    districts: selectedDistricts.map(encodeDistrictToken),
                    status,
                    keyword: keyword.trim() || undefined,
                });
                setItems(results.filter((item) => budgetMatches(item, priceMin, priceMax)));
            } catch (err) {
                setError(err instanceof Error ? err.message : "讀取租屋需求失敗");
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [priceMax, priceMin, keyword, selectedDistricts, status]);

    const applyFilters = () => {
        const next = new URLSearchParams();
        filters.districts.forEach((district) => next.append("district", encodeDistrictToken(district)));
        if (filters.keyword.trim()) next.set("keyword", filters.keyword.trim());
        if (filters.priceMin.trim()) next.set("priceMin", filters.priceMin.trim());
        if (filters.priceMax.trim()) next.set("priceMax", filters.priceMax.trim());
        next.set("status", status);
        setSearchParams(next);
    };

    const resetFilters = () => setSearchParams(new URLSearchParams({ status: "OPEN" }));

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="space-y-3">
                    <h1 className="text-4xl font-extrabold text-on-surface">租屋需求</h1>
                    <p className="max-w-3xl text-sm leading-[1.8] text-on-surface-variant">
                        瀏覽租客公開的租屋條件，依行政區、預算與關鍵字找到適合媒合的需求。
                    </p>
                </header>

                <div className="grid gap-3">
                    <ListingSearchFilters
                        districtOptions={districtOptions}
                        values={filters}
                        submitLabel="搜尋需求"
                        keywordPlaceholder="街道、捷運站、社區、需求備註"
                        pricePlaceholderMin="最低預算"
                        pricePlaceholderMax="最高預算"
                        onChange={setFilters}
                        onSubmit={applyFilters}
                        onReset={resetFilters}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="text-sm font-bold text-on-surface" htmlFor="requirement-status">狀態</label>
                        <select
                            id="requirement-status"
                            className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                            value={status}
                            onChange={(event) => {
                                const next = new URLSearchParams(searchParams);
                                next.set("status", event.target.value);
                                setSearchParams(next);
                            }}
                        >
                            {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取中...</div>
                ) : error ? (
                    <div className="rounded-xl border border-error/20 bg-error-container p-6 text-sm text-on-error-container">{error}</div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <h2 className="text-2xl font-extrabold text-on-surface">目前沒有符合條件的需求</h2>
                        <p className="mt-2 text-sm text-on-surface-variant">請調整搜尋條件，或稍後再回來查看。</p>
                    </div>
                ) : (
                    <section className="grid gap-4 md:grid-cols-2">
                        {items.map((item) => (
                            <TenantRequirementCard
                                key={item.id}
                                requirement={item}
                                onOpen={() => navigate(`/requirements/${item.id}`)}
                            />
                        ))}
                    </section>
                )}
            </main>
        </SiteLayout>
    );
}
