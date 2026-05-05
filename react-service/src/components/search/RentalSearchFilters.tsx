import type { TaiwanDistrictOption } from "../../api/listingApi";
import DistrictMultiSelect from "../location/DistrictMultiSelect";
import { type DistrictSelection } from "../location/districtSelection";

export type RentalSearchFilterValues = {
    districts: DistrictSelection[];
    keyword: string;
    budgetMin: string;
    budgetMax: string;
};

type RentalSearchFiltersProps = {
    districtOptions: TaiwanDistrictOption[];
    values: RentalSearchFilterValues;
    submitLabel: string;
    onChange: (next: RentalSearchFilterValues) => void;
    onSubmit: () => void;
    onReset: () => void;
};

export default function RentalSearchFilters({
    districtOptions,
    values,
    submitLabel,
    onChange,
    onSubmit,
    onReset,
}: RentalSearchFiltersProps) {
    const update = (patch: Partial<RentalSearchFilterValues>) => onChange({ ...values, ...patch });

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
                    onChange={(event) => update({ keyword: event.target.value })}
                    placeholder="街道、捷運站、社區、需求備註"
                />
                <input
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                    inputMode="numeric"
                    value={values.budgetMin}
                    onChange={(event) => update({ budgetMin: event.target.value })}
                    placeholder="最低預算"
                />
                <input
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-container"
                    inputMode="numeric"
                    value={values.budgetMax}
                    onChange={(event) => update({ budgetMax: event.target.value })}
                    placeholder="最高預算"
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
                    className="rounded-xl border border-outline-variant/25 bg-transparent px-5 py-3 text-sm font-bold text-on-surface"
                >
                    清除
                </button>
            </div>
        </section>
    );
}
