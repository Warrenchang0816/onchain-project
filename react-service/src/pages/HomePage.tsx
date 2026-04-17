import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getListingSummary, getRecentListings } from "../api/dashboardApi";
import { getListings } from "../api/listingApi";
import EmptyState from "../components/common/EmptyState";
import PageLoading from "../components/common/PageLoading";
import SummaryCard from "../components/common/SummaryCard";
import PropertyCard from "../components/task/PropertyCard";
import SiteLayout from "../layouts/SiteLayout";
import type { Listing } from "../types/listing";

const FEATURED_CITIES = [
    { name: "台北市", listings: 16323, median: "3,782 萬" },
    { name: "新北市", listings: 29249, median: "1,898 萬" },
    { name: "桃園市", listings: 25809, median: "1,488 萬" },
    { name: "台中市", listings: 42882, median: "1,680 萬" },
    { name: "台南市", listings: 18602, median: "1,350 萬" },
    { name: "高雄市", listings: 23164, median: "1,338 萬" },
];

const PLATFORM_LAYERS = [
    {
        title: "供給層 Supply",
        description: "將房屋、授權、委託與仲介任務整理成可搜尋的房產供給清單，建立平台上的房源入口。",
    },
    {
        title: "信任層 Trust",
        description: "以會員、KYC、錢包綁定與簽名驗證建立可信身份，讓平台操作與鏈上行為之間有明確對應。",
    },
    {
        title: "市場層 Market",
        description: "把看房、媒合、驗證、授權與鏈上登記串成完整流程，逐步形成可落地的 Web3 房屋平台。",
    },
];

const HomePage = () => {
    const navigate = useNavigate();
    const [listings, setListings] = useState<Listing[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadListings = async () => {
            try {
                const data = await getListings();
                setListings(data);
            } finally {
                setIsLoading(false);
            }
        };

        void loadListings();
    }, []);

    const summary = getListingSummary(listings);
    const recentListings = getRecentListings(listings, 6);

    return (
        <SiteLayout>
            <section className="leju-hero">
                <div className="leju-hero-breadcrumb">首頁 / 買房列表</div>
                <h1>買房，每日更新所有平台房源</h1>
                <p>
                    以房產平台的搜尋節奏結合會員、KYC 與 Web3 驗證流程，先完成可信身份，再進入錢包與鏈上操作。
                </p>

                <div className="leju-search-shell">
                    <div className="leju-search-bar">
                        <button type="button" className="leju-select">選擇縣市</button>
                        <button type="button" className="leju-select">總價不限</button>
                        <button type="button" className="leju-select">類型不限</button>
                        <div className="leju-search-input">請輸入路段、社區名稱</div>
                        <button type="button" className="leju-select">特色不限</button>
                        <button type="button" className="leju-search-button" onClick={() => navigate("/listings")}>
                            找房
                        </button>
                    </div>
                </div>
            </section>

            {isLoading ? (
                <PageLoading message="Loading properties..." />
            ) : (
                <>
                    <section className="summary-section property-summary-section">
                        <SummaryCard title="平台房源" value={summary.total} variant="default" />
                        <SummaryCard title="已完成驗證" value={summary.completed} variant="success" />
                        <SummaryCard title="待媒合案件" value={summary.pending} variant="info" />
                    </section>

                    <section className="page-section leju-section">
                        <div className="page-heading">
                            <h2>平台三層架構</h2>
                            <p>依照目前四份規劃文件的方向，把可信房屋媒合平台整理成供給層、信任層與市場層三個主要區塊。</p>
                        </div>

                        <div className="platform-layer-grid">
                            {PLATFORM_LAYERS.map((layer) => (
                                <article key={layer.title} className="platform-layer-card">
                                    <h3>{layer.title}</h3>
                                    <p>{layer.description}</p>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="page-section leju-section">
                        <div className="page-heading">
                            <h2>查看排除重複的房源</h2>
                        </div>

                        <div className="leju-mode-row">
                            <button type="button" className="leju-mode-tab leju-mode-tab--active">看物件</button>
                            <button type="button" className="leju-mode-tab">地圖</button>
                            <button type="button" className="leju-text-link" onClick={() => navigate("/listings")}>
                                使用社區模式搜尋
                            </button>
                        </div>

                        <div className="leju-city-grid">
                            {FEATURED_CITIES.map((city) => (
                                <button key={city.name} type="button" className="leju-city-card" onClick={() => navigate("/listings")}>
                                    <div className="leju-city-title">
                                        {city.name}買房 <span>{city.listings} 戶</span>
                                    </div>
                                    <div className="leju-city-line" />
                                    <div className="leju-city-price">
                                        價格中位數：<strong>{city.median}</strong>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="page-section leju-section">
                        <div className="page-heading">
                            <h2>平台最新房源</h2>
                            <p>同步目前任務資料，先用房產化卡片呈現第二波 UI/UX 方向。</p>
                        </div>

                        {recentListings.length === 0 ? (
                            <EmptyState title="目前沒有最新房源" description="等下一筆房源上架後，這裡會顯示最新更新內容。" />
                        ) : (
                            <div className="property-card-grid">
                                {recentListings.map((listing) => (
                                    <PropertyCard key={listing.id} task={listing} />
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}
        </SiteLayout>
    );
};

export default HomePage;
