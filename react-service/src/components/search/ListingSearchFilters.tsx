import type { TaiwanDistrictOption } from "../../api/listingApi";
import DistrictMultiSelect from "../location/DistrictMultiSelect";
import { type DistrictSelection } from "../location/districtSelection";

export type ListingSearchFilterValues = {
    districts: DistrictSelection[];
    keyword: string;
    priceMin: string;
    priceMax: string;
};

type ListingSearchFiltersProps = {
    districtOptions: TaiwanDistrictOption[];
    values: ListingSearchFilterValues;
    submitLabel?: string;
    keywordPlaceholder?: string;
    pricePlaceholderMin?: string;
    pricePlaceholderMax?: string;
    onChange: (next: ListingSearchFilterValues) => void;
    onSubmit: () => void;
    onReset: () => void;
};

export default function ListingSearchFilters({
    districtOptions,
    values,
    submitLabel = "搜尋",
    keywordPlaceholder = "地址、社區、關鍵字",
    pricePlaceholderMin = "最低價格",
    pricePlaceholderMax = "最高價格",
    onChange,
    onSubmit,
    onReset,
}: ListingSearchFiltersProps) {
    const update = (patch: Partial<ListingSearchFilterValues>) => onChange({ ...values, ...patch });

    return (
        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
            <div className="grid gap-3 lg:grid-cols-[260px_minmax(280px,1fr)_130px_130px_auto_auto] lg:items-center">
                <DistrictMultiSelect
                    options={districtOptions}
                    value={values.districts}
                    onChange={(districts) => update({ districts })}
                />
                <input
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                    value={values.keyword}
                    onChange={(e) => update({ keyword: e.target.value })}
                    placeholder={keywordPlaceholder}
                />
                <input
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                    inputMode="numeric"
                    value={values.priceMin}
                    onChange={(e) => update({ priceMin: e.target.value })}
                    placeholder={pricePlaceholderMin}
                />
                <input
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                    inputMode="numeric"
                    value={values.priceMax}
                    onChange={(e) => update({ priceMax: e.target.value })}
                    placeholder={pricePlaceholderMax}
                />
                <button
                    type="button"
                    onClick={onSubmit}
                    className="rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-colors hover:bg-primary"
                >
                    {submitLabel}
                </button>
                <button
                    type="button"
                    onClick={onReset}
                    className="rounded-xl border border-outline-variant/25 bg-transparent px-5 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-low transition-colors"
                >
                    清除
                </button>
            </div>
        </section>
    );
}
