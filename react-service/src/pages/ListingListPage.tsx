import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getListings, getMyListings, type Listing, type ListingType } from "../api/listingApi";
import { getAuthMe } from "../api/authApi";
import SiteLayout from "../layouts/SiteLayout";

// DEV: Placeholder listings — delete this block once real API data is available
const PLACEHOLDER_LISTINGS: Listing[] = [
    {
        id: -1, owner_user_id: 0, title: "光影交織 頂層公寓",
        description: "位於市中心靜巷，擁有大面積採光與通風極佳的開放式格局，感受城市中的寧靜綠洲。",
        address: "台北市信義區", list_type: "RENT", price: 28500,
        area_ping: 35, floor: 12, total_floors: 15, room_count: 2, bathroom_count: 1,
        is_pet_allowed: false, is_parking_included: false, status: "ACTIVE",
        daily_fee_ntd: 0, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z", is_owner: false,
        image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuD8fJgV4Qomu977t2ldtQlm2ftWNStvFeVxR2PUucC_Cb97zt1oLcojMPYMFH2A2z2lS9KjV3rMFlPZazPvQ2Mr-esr89aQftiXa9BkVhxNAuA2cmDBx2mbtpo-cR9tLWgMrZHBOxUExpZes124qKbeqzcnV9uZyFBIbgYAZBNRkzpI7LzyVstoABWpsqFw2QBc89vzGVKa7-3nItAJLxzWy-BQ_pjhzwSH7unF-AQ68GAqWOPfGsUovlrf18nfcrrOlmcZhhRznNhF", // DEV
    },
    {
        id: -2, owner_user_id: 0, title: "靜謐森居 透天別墅",
        description: "隱身於半山腰的質感別墅，私家庭院設計讓自然綠意延伸至室內，享受極致的生活私密性。",
        address: "新北市北投區", list_type: "SALE", price: 42000000,
        area_ping: 85, room_count: 4, bathroom_count: 2,
        is_pet_allowed: true, is_parking_included: true, status: "NEGOTIATING",
        daily_fee_ntd: 0, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z", is_owner: false,
        image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuCrAR1WfTs2VUjiG9jAQlzxogpXeIqURTqVVJtTUzPEZWG9xiqspnDJetpuSgCjxLp99HLHuB_hSC68QVuXXksdOqW2mBwCzj-YmvbNBwGo-_oFSJ72Qmcxyd-loYuBhd9ba7VxUKGYLwa97k_vkxQtFLKVABgGLw-yfF3rYMd58R3cCrxD9jWUo66c9EThYeck-sqEZYHnqX-SQNJ0mdssCSNkZfxg9XGjNiCub9SMe2Sl7RQ1JBtNzXJk-mbDJ-TxRxEPlxMxJ6ix", // DEV
    },
    {
        id: -3, owner_user_id: 0, title: "都會質感 陽光雅寓",
        description: "鄰近捷運站與綠地公園，格局方正且全室精裝修，為追求高效生活的都會人士打造。",
        address: "台北市大安區", list_type: "RENT", price: 22000,
        area_ping: 22, floor: 5, total_floors: 8, room_count: 1, bathroom_count: 1,
        is_pet_allowed: false, is_parking_included: false, status: "ACTIVE",
        daily_fee_ntd: 0, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z", is_owner: false,
        image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBW3nE3z46K4aPNn-vViZpfIryPoBiDEB3hXSBW5rWszKjZ8aUdZXc6L5hSBNL3LWF9867r8-zJHUu3puzK2yO_zRpze2qY81oVBFPUEVl0PrbmOQnYTTLqy3VArKhlsiFf65OTThxIpgK-GxLLaO-LyLcIkuchefIcUPUAi9jmNNJHy0932rz4g40Q61-jCJgbjuyUyofT1T4tfUOSKbcR7-2FzElgR2vXP-JuLbUOgND9fH8Le0KWiFcLu69D4Fj-pE5bY9lnZJk_", // DEV
    },
];

// DEV: Placeholder "My Listings" feature card — delete once real user listings are available
const PLACEHOLDER_MY_LISTING: Listing = {
    id: -10, owner_user_id: 0, title: "信義區 景觀高層",
    description: "草稿狀態。請完成詳細資訊填寫與照片上傳，以發佈您的房源至區塊鏈網絡。",
    address: "台北市信義區", list_type: "SALE", price: 0,
    is_pet_allowed: false, is_parking_included: false, status: "DRAFT",
    daily_fee_ntd: 0, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z", is_owner: true,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDycVdihkJWni7edgnTzxdtXPAqCJ4ghkXxf88BXY9Ep9mKutpsn2QzfCbWXwQ7U9wYFsic3iTc-2yYlvUA6uRyeRfVyaEpR5PCR157q7dd6puu42HJbELte3AzAP6I5rSihX5EtiXENcAe9NGncg57xVxSCHHfhXAs8MR33RrF6I0gp_4VSGoihZZaxenCxu5so6RR5brHAdzHky9gl5b8QL1YCITPoos7rt9I_EmTqdR8YZ8rHvztFqex-8j6usd1U3OvrA2iWW7y", // DEV
};

type TypeFilter = "ALL" | ListingType;

const STATUS_LABEL: Record<string, string> = {
    DRAFT:       "DRAFT",
    ACTIVE:      "ACTIVE",
    NEGOTIATING: "NEGOTIATING",
    LOCKED:      "LOCKED",
    SIGNING:     "SIGNING",
    CLOSED:      "CLOSED",
    EXPIRED:     "EXPIRED",
    REMOVED:     "REMOVED",
    SUSPENDED:   "SUSPENDED",
};

function statusBadgeCls(status: string): string {
    if (status === "ACTIVE")
        return "absolute top-4 left-4 px-3 py-1 bg-tertiary/10 backdrop-blur-md rounded-full border border-tertiary/20";
    if (status === "NEGOTIATING")
        return "absolute top-4 left-4 px-3 py-1 bg-amber-700/10 backdrop-blur-md rounded-full border border-amber-700/20";
    return "absolute top-4 left-4 px-3 py-1 bg-stone-500/10 backdrop-blur-md rounded-full border border-stone-500/20";
}

function statusTextCls(status: string): string {
    if (status === "ACTIVE")      return "text-tertiary text-xs font-bold tracking-wider";
    if (status === "NEGOTIATING") return "text-amber-700 text-xs font-bold tracking-wider";
    return "text-stone-700 text-xs font-bold tracking-wider";
}

function myListingBadgeCls(status: string): string {
    if (status === "DRAFT")       return "inline-block px-3 py-1 bg-stone-500/10 rounded-full border border-stone-500/20 mb-4 self-start";
    if (status === "ACTIVE")      return "inline-block px-3 py-1 bg-tertiary/10 rounded-full border border-tertiary/20 mb-4 self-start";
    if (status === "NEGOTIATING") return "inline-block px-3 py-1 bg-amber-700/10 rounded-full border border-amber-700/20 mb-4 self-start";
    return "inline-block px-3 py-1 bg-stone-500/10 rounded-full border border-stone-500/20 mb-4 self-start";
}

function myListingBadgeTextCls(status: string): string {
    if (status === "DRAFT")       return "text-stone-700 text-xs font-bold tracking-wider";
    if (status === "ACTIVE")      return "text-tertiary text-xs font-bold tracking-wider";
    if (status === "NEGOTIATING") return "text-amber-700 text-xs font-bold tracking-wider";
    return "text-stone-700 text-xs font-bold tracking-wider";
}

function formatPrice(price: number, listType: string) {
    if (listType === "RENT") return `$${price.toLocaleString()}/月`;
    return `$${price.toLocaleString()}`;
}

const ListingCard = ({ listing, onClick }: { listing: Listing; onClick: () => void }) => (
    <article
        onClick={onClick}
        className="flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden transition-transform duration-300 hover:-translate-y-1 cursor-pointer"
    >
        {/* Image Area */}
        <div className="relative h-64 w-full bg-surface-variant overflow-hidden">
            {listing.image_url && (
                <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover" />
            )}
            {/* Status Badge */}
            <div className={statusBadgeCls(listing.status)}>
                <span className={statusTextCls(listing.status)}>{STATUS_LABEL[listing.status] ?? listing.status}</span>
            </div>
            {/* Favorite button */}
            <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-surface-container-lowest/80 backdrop-blur-md text-on-surface hover:text-error transition-colors"
            >
                <span className="material-symbols-outlined text-sm">favorite</span>
            </button>
        </div>
        {/* Content Area */}
        <div className="p-6 flex flex-col flex-grow">
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold text-on-surface leading-tight">{listing.title}</h3>
                <div className="text-2xl font-bold text-[#E8B800] shrink-0 ml-4">
                    {formatPrice(listing.price, listing.list_type)}
                    {listing.list_type === "RENT" && (
                        <span className="text-sm font-normal text-on-surface-variant"></span>
                    )}
                </div>
            </div>
            <p className="text-sm text-on-surface-variant mb-6 line-clamp-2 leading-[1.75]">
                {listing.description ?? listing.address}
            </p>
            {/* Meta Pills */}
            <div className="flex flex-wrap gap-2 mt-auto">
                {listing.area_ping && (
                    <span className="px-3 py-1 bg-surface-container-low text-on-surface-variant text-xs rounded-full">
                        {listing.area_ping} 坪
                    </span>
                )}
                {listing.room_count && (
                    <span className="px-3 py-1 bg-surface-container-low text-on-surface-variant text-xs rounded-full">
                        {listing.room_count} 房{listing.bathroom_count ? ` ${listing.bathroom_count} 衛` : ""}
                    </span>
                )}
                {listing.floor && listing.total_floors && (
                    <span className="px-3 py-1 bg-surface-container-low text-on-surface-variant text-xs rounded-full">
                        {listing.floor}F / {listing.total_floors}F
                    </span>
                )}
            </div>
        </div>
    </article>
);

const ListingListPage = () => {
    const navigate = useNavigate();
    const [listings, setListings] = useState<Listing[]>([]);
    const [myListings, setMyListings] = useState<Listing[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

    useEffect(() => {
        const load = async () => {
            try {
                setIsLoading(true);
                const params = typeFilter !== "ALL" ? { type: typeFilter as ListingType } : undefined;
                const data = await getListings(params);
                setListings(data);
                const auth = await getAuthMe().catch(() => ({ authenticated: false }));
                setIsAuthenticated(auth.authenticated);
                if (auth.authenticated) {
                    const mine = await getMyListings().catch(() => []);
                    setMyListings(mine);
                }
            } finally {
                setIsLoading(false);
            }
        };
        void load();
    }, [typeFilter]);

    // Use real data when available; fall back to placeholders for dev UI review
    const displayListings = listings.length > 0 ? listings : PLACEHOLDER_LISTINGS; // DEV: remove fallback when API returns real data
    const featureListing  = myListings[0] ?? PLACEHOLDER_MY_LISTING;               // DEV: remove fallback when user has real listings

    const myActiveCount      = myListings.length > 0 ? myListings.filter((l) => l.status === "ACTIVE").length      : 2; // DEV
    const myNegotiatingCount = myListings.length > 0 ? myListings.filter((l) => l.status === "NEGOTIATING").length : 1; // DEV
    const myDraftCount       = myListings.length > 0 ? myListings.filter((l) => l.status === "DRAFT").length       : 1; // DEV

    const tabCls = (active: boolean) =>
        active
            ? "text-lg font-bold text-[#E8B800] border-b-2 border-[#E8B800] pb-1 transition-colors bg-transparent"
            : "text-lg font-medium text-on-surface-variant hover:text-on-surface pb-1 transition-colors bg-transparent";

    return (
        <SiteLayout>
            {/* Compact Hero Strip */}
            <section className="w-full py-12 md:py-16 bg-gradient-to-r from-surface to-surface-container-low relative overflow-hidden">
                <div className="max-w-[1440px] mx-auto px-6 md:px-12 relative z-10">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-on-surface mb-4 tracking-tight leading-tight">
                        發現理想空間
                    </h1>
                    <p className="text-on-surface-variant text-base md:text-lg max-w-2xl leading-[1.75]">
                        探索城市中每一處被陽光眷顧的角落。我們為您精選兼具生活品質與建築美學的絕佳居所。
                    </p>
                </div>
                {/* Abstract Background Shape */}
                <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-primary-fixed-dim/20 blur-[80px] -z-0 rounded-full translate-x-1/2" />
            </section>

            {/* Filter Tabs & Actions */}
            <section className="w-full bg-surface-container-lowest sticky top-[64px] z-40">
                <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    {/* Tabs */}
                    <div className="flex items-center gap-6">
                        <button type="button" onClick={() => setTypeFilter("ALL")}  className={tabCls(typeFilter === "ALL")}>全部房源</button>
                        <button type="button" onClick={() => setTypeFilter("RENT")} className={tabCls(typeFilter === "RENT")}>租屋</button>
                        <button type="button" onClick={() => setTypeFilter("SALE")} className={tabCls(typeFilter === "SALE")}>售屋</button>
                    </div>
                    {/* Sort/Filter Actions */}
                    <div className="flex items-center gap-3">
                        <button type="button" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-variant transition-colors">
                            <span className="material-symbols-outlined text-sm">tune</span>
                            <span className="text-sm font-medium">進階篩選</span>
                        </button>
                        <button type="button" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-variant transition-colors">
                            <span className="material-symbols-outlined text-sm">sort</span>
                            <span className="text-sm font-medium">最新上架</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Property Grid */}
            <section className="w-full bg-surface py-12">
                <div className="max-w-[1440px] mx-auto px-6 md:px-12">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-32">
                            <span className="text-sm text-on-surface-variant animate-pulse">載入房源中…</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
                            {displayListings.map((listing) => (
                                <ListingCard
                                    key={listing.id}
                                    listing={listing}
                                    onClick={() => navigate(`/listings/${listing.id}`)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* My Listings Section — DEV: always visible for design review; gate behind isAuthenticated in production */}
            <section className="w-full bg-surface-container-low py-16">
                <div className="max-w-[1440px] mx-auto px-6 md:px-12">
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-extrabold text-on-surface mb-2">我的房源</h2>
                            <p className="text-on-surface-variant text-sm md:text-base">管理您正在出租或出售的物業空間。</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/listings/new")}
                            className="hidden md:flex items-center gap-2 px-6 py-3 bg-primary-container text-on-surface font-bold rounded-lg hover:bg-inverse-primary transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">add</span>
                            <span>新增房源</span>
                        </button>
                    </div>

                    {/* Bento Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Large Feature Block */}
                        <div
                            className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center border border-outline-variant/15 cursor-pointer"
                            onClick={() => navigate(`/listings/${featureListing.id}`)}
                        >
                            <div className="w-full md:w-1/2 h-48 md:h-full min-h-[200px] bg-surface-variant rounded-lg overflow-hidden">
                                {featureListing.image_url && (
                                    <img src={featureListing.image_url} alt={featureListing.title} className="w-full h-full object-cover" />
                                )}
                            </div>
                            <div className="w-full md:w-1/2 flex flex-col justify-center">
                                <div className={myListingBadgeCls(featureListing.status)}>
                                    <span className={myListingBadgeTextCls(featureListing.status)}>
                                        {STATUS_LABEL[featureListing.status] ?? featureListing.status}
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-on-surface mb-2">{featureListing.title}</h3>
                                <p className="text-on-surface-variant text-sm mb-6 leading-[1.75]">
                                    {featureListing.description ?? featureListing.address}
                                </p>
                                <div className="flex gap-4 mt-auto">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); navigate(`/listings/${featureListing.id}`); }}
                                        className="px-6 py-2 bg-primary-container text-on-surface font-bold rounded-lg hover:bg-inverse-primary transition-colors text-sm"
                                    >
                                        繼續編輯
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => e.stopPropagation()}
                                        className="px-6 py-2 bg-transparent text-on-surface font-medium rounded-lg border border-outline-variant/50 hover:bg-surface-container transition-colors text-sm"
                                    >
                                        預覽
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Small Stats Block */}
                        <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-6 md:p-8 flex flex-col justify-between border border-outline-variant/15">
                            <div>
                                <h4 className="text-lg font-bold text-on-surface mb-1">資產總覽</h4>
                                <p className="text-sm text-on-surface-variant mb-6">您目前在平台上的資產狀態</p>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center pb-4 border-b border-surface-variant/50">
                                        <span className="text-on-surface-variant">上架中</span>
                                        <span className="font-bold text-on-surface">{myActiveCount}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-4 border-b border-surface-variant/50">
                                        <span className="text-on-surface-variant">洽談中</span>
                                        <span className="font-bold text-on-surface">{myNegotiatingCount}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-on-surface-variant">草稿</span>
                                        <span className="font-bold text-on-surface">{myDraftCount}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="w-full mt-8 py-3 text-tertiary font-bold bg-transparent hover:text-on-tertiary-container underline decoration-tertiary transition-colors text-sm text-center"
                            >
                                查看智能合約紀錄
                            </button>
                        </div>
                    </div>

                    {/* Mobile Add Button */}
                    <button
                        type="button"
                        onClick={() => navigate("/listings/new")}
                        className="md:hidden w-full mt-6 flex justify-center items-center gap-2 px-6 py-3 bg-primary-container text-on-surface font-bold rounded-lg hover:bg-inverse-primary transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">add</span>
                        <span>新增房源</span>
                    </button>
                </div>
            </section>
        </SiteLayout>
    );
};

export default ListingListPage;
