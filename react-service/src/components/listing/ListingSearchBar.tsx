import type { ListingType } from "../../api/listingApi";

export type ListingListMode = Exclude<ListingType, "UNSET"> | "ALL";

export type ListingSearchState = {
    mode: ListingListMode;
    district: string;
    keyword: string;
    priceBand: string;
    layout: string;
    sort: string;
    mapSelected: boolean;
};

type Props = {
    state: ListingSearchState;
    onChange: (next: ListingSearchState) => void;
    onSearch: () => void;
};

const modeOptions: Array<{ value: ListingListMode; label: string }> = [
    { value: "ALL", label: "全部" },
    { value: "SALE", label: "買屋" },
    { value: "RENT", label: "租屋" },
];

export default function ListingSearchBar({ state, onChange, onSearch }: Props) {
    const isRent = state.mode === "RENT";
    const isSale = state.mode === "SALE";

    const update = <K extends keyof ListingSearchState>(key: K, value: ListingSearchState[K]) => {
        onChange({ ...state, [key]: value });
    };

    return (
        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
            <div className="flex flex-wrap items-center gap-3">
                {modeOptions.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => update("mode", option.value)}
                        className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                            state.mode === option.value
                                ? "bg-primary-container text-on-primary-container"
                                : "bg-surface-container-low text-on-surface-variant hover:text-on-surface"
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => update("mapSelected", false)}
                    className={`rounded-full px-4 py-2 text-sm font-bold ${
                        !state.mapSelected ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-low text-on-surface-variant"
                    }`}
                >
                    列表
                </button>
                <button
                    type="button"
                    onClick={() => update("mapSelected", true)}
                    className={`rounded-full px-4 py-2 text-sm font-bold ${
                        state.mapSelected ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-low text-on-surface-variant"
                    }`}
                >
                    地圖
                </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                <input
                    value={state.district}
                    onChange={(event) => update("district", event.target.value)}
                    placeholder="行政區"
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                />
                <input
                    value={state.keyword}
                    onChange={(event) => update("keyword", event.target.value)}
                    placeholder={isRent ? "路街、社區、關鍵字或物件編號" : "街道、捷運站、社區、物件編號或學校"}
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container md:col-span-2"
                />
                <select
                    value={state.priceBand}
                    onChange={(event) => update("priceBand", event.target.value)}
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                >
                    <option value="">{isRent ? "不限租金" : "不限總價"}</option>
                    <option value="low">{isRent ? "2萬以下" : "1000萬以下"}</option>
                    <option value="mid">{isRent ? "2萬-5萬" : "1000萬-3000萬"}</option>
                    <option value="high">{isRent ? "5萬以上" : "3000萬以上"}</option>
                </select>
                <button type="button" onClick={onSearch} className="rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container">
                    {isRent ? "租屋搜尋" : isSale ? "買屋搜尋" : "搜尋"}
                </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
                <select
                    value={state.layout}
                    onChange={(event) => update("layout", event.target.value)}
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-2 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                >
                    <option value="">不限格局</option>
                    <option value="1">1房</option>
                    <option value="2">2房</option>
                    <option value="3">3房以上</option>
                </select>
                <select
                    value={state.sort}
                    onChange={(event) => update("sort", event.target.value)}
                    className="rounded-xl border border-outline-variant/15 bg-surface px-4 py-2 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary-container"
                >
                    <option value="default">預設排序</option>
                    <option value="newest">最新</option>
                    <option value="priceAsc">{isRent ? "租金低到高" : "價格低到高"}</option>
                    <option value="priceDesc">{isRent ? "租金高到低" : "價格高到低"}</option>
                    <option value="areaDesc">坪數大到小</option>
                </select>
            </div>

            {state.mapSelected ? (
                <div className="mt-5 rounded-xl border border-dashed border-outline-variant/30 bg-surface-container-low p-6 text-sm text-on-surface-variant">
                    地圖搜尋將在刊登、需求與仲介流程完成後接入地圖服務；目前先使用列表搜尋。
                </div>
            ) : null}
        </section>
    );
}
