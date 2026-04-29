import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getListings, type Listing, type ListingType } from "../api/listingApi";
import SiteLayout from "../layouts/SiteLayout";

const DISTRICT_SUGGESTIONS = [
    { name: "信義區", description: "商辦、捷運與高樓住宅密集，適合快速掌握都會型房源。" },
    { name: "大安區", description: "生活機能成熟，常見家庭住宅與穩定租賃需求。" },
    { name: "中山區", description: "小宅、套房與混合用途物件多，適合彈性租住。" },
    { name: "內湖區", description: "科技園區通勤導向，適合工作生活圈條件篩選。" },
];

const VALUE_CARDS = [
    {
        icon: "verified_user",
        title: "先確認人，再談媒合",
        description: "目前主線已支援 KYC、角色啟用、房源草稿、上架與看房預約，平台會清楚揭露狀態，不替交易結果背書。",
    },
    {
        icon: "home_work",
        title: "屋主從草稿開始",
        description: "屋主認證通過後可管理自己的物件系統，草稿不公開，補齊資料後再上架。",
    },
    {
        icon: "timeline",
        title: "鏈上能力分階段接上",
        description: "Property、Agency、Case、Stake 等證明會在後續 Gate 逐步上鏈，現階段先把媒合主流程打穩。",
    },
];

function formatPrice(listing: Listing): string {
    if (listing.price <= 0) return "價格未設定";
    if (listing.list_type === "RENT") return `NT$ ${listing.price.toLocaleString()} / 月`;
    return `NT$ ${listing.price.toLocaleString()}`;
}

function formatMeta(listing: Listing): string[] {
    const items: string[] = [];
    if (listing.room_count !== undefined) items.push(`${listing.room_count} 房`);
    if (listing.bathroom_count !== undefined) items.push(`${listing.bathroom_count} 衛`);
    if (listing.area_ping !== undefined) items.push(`${listing.area_ping} 坪`);
    return items;
}

export default function HomePage() {
    const navigate = useNavigate();
    const [listings, setListings] = useState<Listing[]>([]);
    const [searchType, setSearchType] = useState<Exclude<ListingType, "UNSET">>("SALE");
    const [searchText, setSearchText] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setLoadError("");
                setListings(await getListings());
            } catch (err) {
                setLoadError(err instanceof Error ? err.message : "讀取房源失敗。");
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    const recentListings = listings.filter((listing) => listing.status === "ACTIVE").slice(0, 3);

    const handleSearch = () => {
        const params = new URLSearchParams();
        params.set("type", searchType);
        if (searchText.trim()) params.set("district", searchText.trim());
        navigate(`/listings?${params.toString()}`);
    };

    return (
        <SiteLayout>
            <section className="bg-gradient-to-b from-background to-surface-container-low px-6 pb-24 pt-20 md:px-12">
                <div className="mx-auto grid max-w-[1440px] gap-14 md:grid-cols-2 md:items-center">
                    <div className="flex flex-col gap-8">
                        <span className="w-fit rounded-full border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-xs font-semibold text-on-surface-variant">
                            Gate 1 主線媒合平台
                        </span>
                        <div className="space-y-5">
                            <h1 className="text-4xl font-extrabold leading-tight text-on-surface md:text-6xl">
                                房源、需求、仲介身份都看得清楚。
                            </h1>
                            <p className="max-w-xl text-lg leading-[1.8] text-on-surface-variant">
                                從 KYC、角色啟用、屋主草稿到租屋需求，平台協助揭露可驗證資訊；實際合作仍由屋主、租客與仲介自行確認。
                            </p>
                        </div>

                        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest/90 p-6 shadow-[0_16px_48px_rgba(28,25,23,0.08)]">
                            <div className="mb-5 flex gap-3">
                                <button type="button" onClick={() => setSearchType("SALE")} className={`rounded-full px-5 py-2 text-sm font-bold ${searchType === "SALE" ? "bg-primary-container text-on-primary-container" : "bg-surface-container-low text-on-surface"}`}>
                                    出售
                                </button>
                                <button type="button" onClick={() => setSearchType("RENT")} className={`rounded-full px-5 py-2 text-sm font-bold ${searchType === "RENT" ? "bg-primary-container text-on-primary-container" : "bg-surface-container-low text-on-surface"}`}>
                                    出租
                                </button>
                            </div>
                            <div className="flex flex-col gap-4 sm:flex-row">
                                <div className="flex flex-1 items-center gap-3 rounded-xl bg-surface-container-low px-4 py-3">
                                    <span className="material-symbols-outlined text-outline">search</span>
                                    <input
                                        type="text"
                                        value={searchText}
                                        onChange={(event) => setSearchText(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") handleSearch();
                                        }}
                                        placeholder="輸入行政區或關鍵字"
                                        className="w-full bg-transparent text-on-surface outline-none placeholder:text-on-surface-variant"
                                    />
                                </div>
                                <button type="button" onClick={handleSearch} className="rounded-xl bg-primary-container px-8 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90">
                                    搜尋房源
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button type="button" onClick={() => navigate("/listings")} className="rounded-xl bg-primary-container px-6 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90">
                                瀏覽房源列表
                            </button>
                            <button type="button" onClick={() => navigate("/member")} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-6 py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low">
                                前往身份中心
                            </button>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-[0_24px_80px_rgba(28,25,23,0.08)]">
                        <div className="grid gap-0 border-b border-outline-variant/10 bg-surface-container-low p-6 md:grid-cols-[1.1fr_0.9fr]">
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-on-surface-variant">目前已上線</p>
                                <h2 className="text-2xl font-bold text-on-surface">草稿到預約</h2>
                                <p className="text-sm leading-[1.8] text-on-surface-variant">屋主可以整理房源，租客可預約看房，仲介可建立公開專頁。</p>
                            </div>
                            <div className="mt-6 rounded-2xl bg-primary-container/15 p-5 md:mt-0">
                                <p className="text-xs font-semibold text-on-surface-variant">後續 Gate</p>
                                <h2 className="mt-2 text-lg font-bold text-on-surface">Property、Agency、Case、Stake</h2>
                                <p className="mt-2 text-sm leading-[1.7] text-on-surface-variant">鏈上資產與案件證明會在基礎流程穩定後逐步接入。</p>
                            </div>
                        </div>
                        <div className="grid gap-4 p-6 md:grid-cols-2">
                            {VALUE_CARDS.map((card) => (
                                <div key={card.title} className="rounded-2xl bg-surface-container-low p-5 md:last:col-span-2">
                                    <span className="material-symbols-outlined mb-4 text-3xl text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        {card.icon}
                                    </span>
                                    <h2 className="mb-2 text-lg font-bold text-on-surface">{card.title}</h2>
                                    <p className="text-sm leading-[1.75] text-on-surface-variant">{card.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-surface-container-low px-6 py-20 md:px-12">
                <div className="mx-auto max-w-[1440px]">
                    <div className="mb-10">
                        <h2 className="text-3xl font-extrabold text-on-surface">從區域開始找</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-[1.8] text-on-surface-variant">快速入口會帶入公開房源列表的即時查詢條件。</p>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                        {DISTRICT_SUGGESTIONS.map((district) => (
                            <button key={district.name} type="button" onClick={() => navigate(`/listings?district=${encodeURIComponent(district.name)}`)} className="group rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 text-left transition-colors hover:bg-surface-container">
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-on-surface">{district.name}</h3>
                                    <span className="material-symbols-outlined text-on-surface-variant transition-transform group-hover:translate-x-1">arrow_forward</span>
                                </div>
                                <p className="text-sm leading-[1.75] text-on-surface-variant">{district.description}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-surface-container-lowest px-6 py-20 md:px-12">
                <div className="mx-auto max-w-[1440px]">
                    <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <h2 className="text-3xl font-extrabold text-on-surface">近期上架房源</h2>
                            <p className="mt-3 max-w-2xl text-sm leading-[1.8] text-on-surface-variant">這裡只呈現後端狀態為上架中的真實房源。</p>
                        </div>
                        <button type="button" onClick={() => navigate("/listings")} className="w-fit rounded-xl border border-outline-variant/20 px-5 py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low">
                            開啟房源列表
                        </button>
                    </div>

                    {loading ? (
                        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-10 text-sm text-on-surface-variant">讀取近期房源中...</div>
                    ) : loadError ? (
                        <div className="rounded-2xl border border-error/20 bg-error-container p-10 text-sm text-on-error-container">{loadError}</div>
                    ) : recentListings.length === 0 ? (
                        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-10">
                            <h3 className="text-2xl font-bold text-on-surface">目前沒有上架房源</h3>
                            <p className="mt-3 max-w-2xl text-sm leading-[1.8] text-on-surface-variant">等屋主完成草稿並公開上架後，房源會出現在這裡。</p>
                        </div>
                    ) : (
                        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                            {recentListings.map((listing) => (
                                <article key={listing.id} onClick={() => navigate(`/listings/${listing.id}`)} className="cursor-pointer overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface transition-transform duration-300 hover:-translate-y-1">
                                    <div className="relative h-64 bg-surface-variant">
                                        {listing.image_url ? (
                                            <img src={listing.image_url} alt={listing.title} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center">
                                                <span className="material-symbols-outlined text-7xl text-on-surface-variant/20" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
                                            </div>
                                        )}
                                        <div className="absolute left-4 top-4 rounded-full border border-outline-variant/10 bg-surface-container-lowest/90 px-3 py-1 text-xs font-bold text-on-surface">
                                            {listing.list_type === "RENT" ? "出租" : "出售"}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-4 p-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <h3 className="text-xl font-bold text-on-surface">{listing.title}</h3>
                                            <div className="text-lg font-bold text-primary-container">{formatPrice(listing)}</div>
                                        </div>
                                        <p className="text-sm leading-[1.75] text-on-surface-variant">
                                            {listing.district ? `${listing.district}，` : ""}
                                            {listing.address}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {formatMeta(listing).map((item) => (
                                                <span key={item} className="rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">{item}</span>
                                            ))}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <section className="bg-background px-6 py-20 md:px-12">
                <div className="mx-auto flex max-w-[1080px] flex-col items-center rounded-2xl bg-gradient-to-br from-primary-container/20 to-surface-container-low p-12 text-center md:p-16">
                    <h2 className="text-3xl font-extrabold text-on-surface md:text-4xl">準備進入身份中心了嗎？</h2>
                    <p className="mt-5 max-w-2xl text-base leading-[1.8] text-on-surface-variant">
                        完成 KYC 後即可申請屋主、租客或仲介身份，依照角色管理房源、租屋需求與公開專頁。
                    </p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <button type="button" onClick={() => navigate("/kyc")} className="rounded-xl bg-primary-container px-6 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90">
                            開始 KYC
                        </button>
                        <button type="button" onClick={() => navigate("/member")} className="rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-6 py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low">
                            開啟身份中心
                        </button>
                    </div>
                </div>
            </section>
        </SiteLayout>
    );
}
