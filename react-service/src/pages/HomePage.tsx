import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getListings, type Listing } from "../api/listingApi";
import SiteLayout from "../layouts/SiteLayout";

const DISTRICTS = [
    { name: "信義區", count: "1,204 件物件" },
    { name: "大安區", count: "982 件物件" },
    { name: "中山區", count: "1,543 件物件" },
    { name: "松山區", count: "756 件物件" },
];

const VALUE_CARDS = [
    {
        iconBg:   "w-16 h-16 bg-primary-container/20 rounded-full flex items-center justify-center mb-6 text-primary",
        icon:     "verified_user",
        title:    "身份可信",
        desc:     "透過嚴格的 KYC 驗證與鏈上身份綁定，杜絕假房東與虛假屋主，保障雙方權益。",
    },
    {
        iconBg:   "w-16 h-16 bg-secondary-container/20 rounded-full flex items-center justify-center mb-6 text-secondary",
        icon:     "visibility",
        title:    "交易透明",
        desc:     "所有產權變更、租賃紀錄與歷史價格皆上鏈保存，告別資訊不對稱的黑箱作業。",
    },
    {
        iconBg:   "w-16 h-16 bg-tertiary-container/20 rounded-full flex items-center justify-center mb-6 text-tertiary",
        icon:     "key",
        title:    "主權在屋主",
        desc:     "直接與潛在買家或租客對接，智能合約自動執行條件，降低高昂的中介抽成。",
    },
];

function formatPrice(price: number, listType: string) {
    if (listType === "RENT") return `${(price / 10000).toFixed(0)} 萬 / 月`;
    return price >= 10000 ? `${(price / 10000).toFixed(0)} 萬` : `${price.toLocaleString()}`;
}

const PLACEHOLDER_CARDS = [
    { title: "光影織境・信義景觀宅", price: "4,280 萬", addr: "信義區・松智路", rooms: 3, baths: 2, ping: 45, badge: "bg-tertiary-container/90 text-on-tertiary-container", label: "驗證上鏈", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuA3lWAdXDiqx56oRlRygVeb81z4Gob3hOFoPjbSKYF9F3cjYF8Qftak5zHG00mRn5u1MXaiZnBQ-mzTfHHeCFWVfI-86XIPMlYfs_C2hxTOTwP1QyeoahAWOjilvbKxj7oBaETQzrJAWYLHFQFJVrTGRB2EIo8PGE-0_O5vgQvR3ggmaqU2bHG2CEteN40G3KNCdev9l3mauWGcdsw2kgtbpDcEnEnvxHN0ab83d6tSB3tKq3Jqd55-wf4CcB7vAxyD8epwW9GPQAj0" },
    { title: "綠意盎然・大安森林寓", price: "3,150 萬", addr: "大安區・新生南路", rooms: 2, baths: 1, ping: 28, badge: "bg-surface-container-high/90 text-on-surface", label: "洽談中",   img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAmQ7WQvimokWYnKxgHLtnRRFKc4OgyJZqQbnl61hXKqncuZKk9cWmzF0xJl-3HjJn_MDqOK4gVZqcmn0FevHlajLB3o24XcPf6249vUDSBFTneXVvXynUvdFps57ELgfXADiUA590T7807AoMTqt7wkMfTuv9cb7rViPvxy25Nag4JaTIf5DjEQ0qmho12xWbfsMVdRlJ1g9bFTsjWVyWSQ-tzgCUXxQHFRbSmoS00FHLe7-067bEdAgLM245j2UNKGuynFgyX9UvP" },
    { title: "文青雅居・中山挑高樓", price: "5 萬 / 月", addr: "中山區・中山北路",  rooms: 1, baths: 1, ping: 18, badge: "bg-tertiary-container/90 text-on-tertiary-container", label: "驗證上鏈", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuB9ki_USArM-KSD2K_H1wGd7AeRB_ZjH46M_XBU9AGMw-r1TkRnkjsSDmhjbRvuc7tuKc1cNhWW4ylGdQELLpzs8CigcHLZbYculInOOG0NzgyFrEVmDa1zL3Xl4eJTtFdrB1O-3W-z90LcQhpEstrxtVJkgmkKn3c03YIvENk1zAp40kEFaET5E83Sm4h2zDLGRTwAyonfO52vg7B1kgwiOvWtavZHq7QvxwNeAdIiQ2jkUjfMxrZjQJqVawpROTJX9S142-wd87-c" },
];

const HomePage = () => {
    const navigate = useNavigate();
    const [listings, setListings] = useState<Listing[]>([]);
    const [searchType, setSearchType] = useState<"BUY" | "RENT">("BUY");
    const [searchText, setSearchText] = useState("");

    useEffect(() => {
        const load = async () => {
            const data = await getListings().catch(() => [] as Listing[]);
            setListings(data);
        };
        void load();
    }, []);

    const recentListings = listings.filter((l) => l.status === "ACTIVE").slice(0, 3);

    const handleSearch = () => {
        navigate(searchText ? `/listings?district=${encodeURIComponent(searchText)}` : "/listings");
    };

    return (
        <SiteLayout>
            {/* Hero Section */}
            <section className="relative pt-24 pb-32 px-6 md:px-12 bg-gradient-to-b from-background to-surface-container-low overflow-hidden">
                <div className="max-w-[1440px] mx-auto grid md:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8 z-10">
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-on-surface leading-tight font-headline">
                            買房・租屋，<br />可信任的媒合市場
                        </h1>
                        <p className="text-lg text-on-surface-variant max-w-lg leading-[1.75]">
                            運用區塊鏈技術，為台灣打造真實、透明、去中心化的不動產交易新標竿。
                        </p>

                        {/* Search Card (Glassmorphism) */}
                        <div className="bg-surface-container-lowest/80 backdrop-blur-2xl p-6 rounded-xl border border-outline-variant/15 shadow-[0_8px_32px_rgba(28,25,23,0.06)]">
                            <div className="flex gap-4 mb-6">
                                <button
                                    type="button"
                                    onClick={() => setSearchType("BUY")}
                                    className={`px-6 py-2 rounded-full font-bold text-sm transition-colors ${
                                        searchType === "BUY"
                                            ? "bg-primary-container text-on-primary-container"
                                            : "bg-surface-container-low text-on-surface font-medium hover:bg-surface-container"
                                    }`}
                                >
                                    買房
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSearchType("RENT")}
                                    className={`px-6 py-2 rounded-full text-sm transition-colors ${
                                        searchType === "RENT"
                                            ? "bg-primary-container text-on-primary-container font-bold"
                                            : "bg-surface-container-low text-on-surface font-medium hover:bg-surface-container"
                                    }`}
                                >
                                    租屋
                                </button>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-grow bg-surface-container-low rounded-lg px-4 py-3 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-outline">search</span>
                                    <input
                                        className="bg-transparent border-none focus:ring-0 w-full text-on-surface placeholder-on-surface-variant outline-none"
                                        placeholder="搜尋區域、捷運站、社區..."
                                        type="text"
                                        value={searchText}
                                        onChange={(e) => setSearchText(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSearch}
                                    className="bg-primary-container text-on-primary-container px-8 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity"
                                >
                                    搜尋
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-0">
                        <div className="aspect-[4/3] rounded-xl overflow-hidden shadow-[0_16px_48px_rgba(28,25,23,0.08)] bg-surface-variant">
                            <img
                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdKRXNvwbCAm5KzsPO2yQdkGazvc0BbuCa4TuXHvhY95ACl4h35P-uK7XhljMKWiV1U9fjGiD43cfix_8NkU15ZQKl1jp6oK3-YMe68qigAqT0z50X8131Ohq5mhOcPmu_JydYPGOqAB5MRbHwPPp0a1KTqUgFYLbGniXU3BMpNw7BkucQaeEDzTyVrqAAS6ddfMiA6_TEqfKgQmXUvVQbA8CBYdrq6JjXLtN2KYbpBj1bQ5mRM1GD16mPhFyf63bS9WBlMQAS6nuQ"
                                alt="Beautiful modern home exterior"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {/* Floating Badge */}
                        <div className="absolute -bottom-6 -left-6 bg-surface-container-lowest/90 backdrop-blur-md p-4 rounded-xl border border-outline-variant/15 shadow-[0_8px_24px_rgba(28,25,23,0.05)] flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-tertiary-container animate-pulse" />
                            <span className="text-sm font-bold text-on-surface">智能合約擔保交易</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Platform Value */}
            <section className="py-24 px-6 md:px-12 bg-surface-container-low">
                <div className="max-w-[1440px] mx-auto">
                    <h2 className="text-3xl font-extrabold text-on-surface mb-16 text-center font-headline">重新定義信任</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {VALUE_CARDS.map((v) => (
                            <div key={v.title} className="bg-surface-container-lowest p-10 rounded-xl flex flex-col items-center text-center">
                                <div className={v.iconBg}>
                                    <span
                                        className="material-symbols-outlined text-3xl"
                                        style={{ fontVariationSettings: "'FILL' 1" }}
                                    >
                                        {v.icon}
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold text-on-surface mb-4">{v.title}</h3>
                                <p className="text-on-surface-variant leading-[1.75]">{v.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* District Links */}
            <section className="py-24 px-6 md:px-12 bg-background">
                <div className="max-w-[1440px] mx-auto">
                    <h2 className="text-3xl font-extrabold text-on-surface mb-12 font-headline">探索熱門區域</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {DISTRICTS.map((d) => (
                            <a
                                key={d.name}
                                href="#"
                                onClick={(e) => { e.preventDefault(); navigate("/listings"); }}
                                className="group bg-surface-container-low p-6 rounded-r-xl border-l-4 border-primary-container hover:bg-surface-container transition-colors flex justify-between items-center"
                            >
                                <div>
                                    <div className="text-lg font-bold text-on-surface group-hover:text-primary transition-colors">{d.name}</div>
                                    <div className="text-sm text-on-surface-variant mt-1">{d.count}</div>
                                </div>
                                <span className="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors">
                                    arrow_forward
                                </span>
                            </a>
                        ))}
                    </div>
                </div>
            </section>

            {/* Recent Listings */}
            <section className="py-24 px-6 md:px-12 bg-surface-container-lowest">
                <div className="max-w-[1440px] mx-auto">
                    <div className="flex justify-between items-end mb-12">
                        <h2 className="text-3xl font-extrabold text-on-surface font-headline">最新上架</h2>
                        <a
                            href="#"
                            onClick={(e) => { e.preventDefault(); navigate("/listings"); }}
                            className="text-tertiary font-medium hover:text-on-surface transition-colors flex items-center gap-1 border-b border-tertiary pb-0.5"
                        >
                            查看全部 <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </a>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {recentListings.length > 0 ? recentListings.map((listing, idx) => (
                            <div
                                key={listing.id}
                                className="group cursor-pointer"
                                onClick={() => navigate(`/listings/${listing.id}`)}
                            >
                                <div className="aspect-[4/3] rounded-xl overflow-hidden mb-6 relative bg-surface-variant">
                                    <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    <div className={`absolute top-4 left-4 text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm ${idx === 1 ? "bg-surface-container-high/90 text-on-surface" : "bg-tertiary-container/90 text-on-tertiary-container"}`}>
                                        {idx === 1 ? "洽談中" : "驗證上鏈"}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-xl font-bold text-on-surface">{listing.title}</h3>
                                        <div className="text-xl font-bold text-primary-container">{formatPrice(listing.price, listing.list_type)}</div>
                                    </div>
                                    <p className="text-on-surface-variant text-sm">
                                        {listing.district ? `${listing.district}・` : ""}{listing.address}
                                    </p>
                                    <div className="flex gap-4 text-sm text-on-surface-variant">
                                        {listing.room_count && (
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[18px]">bed</span>
                                                {listing.room_count} 房
                                            </span>
                                        )}
                                        {listing.bathroom_count && (
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[18px]">shower</span>
                                                {listing.bathroom_count} 衛
                                            </span>
                                        )}
                                        {listing.area_ping && (
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[18px]">square_foot</span>
                                                {listing.area_ping} 坪
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            PLACEHOLDER_CARDS.map((p) => (
                                <div key={p.title} className="group cursor-pointer" onClick={() => navigate("/listings")}>
                                    <div className="aspect-[4/3] rounded-xl overflow-hidden mb-6 relative bg-surface-variant">
                                        <img src={p.img} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <div className={`absolute top-4 left-4 text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm ${p.badge}`}>
                                            {p.label}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-xl font-bold text-on-surface">{p.title}</h3>
                                            <div className="text-xl font-bold text-primary-container">{p.price}</div>
                                        </div>
                                        <p className="text-on-surface-variant text-sm">{p.addr}</p>
                                        <div className="flex gap-4 text-sm text-on-surface-variant">
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[18px]">bed</span>
                                                {p.rooms} 房
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[18px]">shower</span>
                                                {p.baths} 衛
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[18px]">square_foot</span>
                                                {p.ping} 坪
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-6 md:px-12 bg-background">
                <div className="max-w-[1000px] mx-auto bg-gradient-to-br from-primary-container/20 to-surface-container-low rounded-[2rem] p-12 md:p-20 text-center flex flex-col items-center">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-on-surface mb-6 font-headline">
                        準備好體驗全新交易模式？
                    </h2>
                    <p className="text-lg text-on-surface-variant mb-10 max-w-2xl leading-[1.75]">
                        完成 Web3 身份驗證，解鎖發布物件、智能合約簽署與專屬客服等進階功能。
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate("/kyc")}
                        className="bg-primary-container text-on-primary-container px-10 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity shadow-[0_4px_16px_rgba(232,184,0,0.3)] flex items-center gap-2"
                    >
                        立即 KYC 驗證 <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                </div>
            </section>
        </SiteLayout>
    );
};

export default HomePage;
