import { useEffect, useState } from "react";
import { getListings, getMyListings, type Listing, type ListingType } from "../api/listingApi";
import { getAuthMe } from "../api/authApi";
import ListingCard from "../components/listing/ListingCard";
import EmptyState from "../components/common/EmptyState";
import PageLoading from "../components/common/PageLoading";
import SiteLayout from "../layouts/SiteLayout";

type TypeFilter = "ALL" | ListingType;

const TYPE_TABS: { label: string; value: TypeFilter }[] = [
    { label: "全部房源", value: "ALL" },
    { label: "租屋", value: "RENT" },
    { label: "售屋", value: "SALE" },
];

const ListingListPage = () => {
    const [listings, setListings] = useState<Listing[]>([]);
    const [myListings, setMyListings] = useState<Listing[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
    const [district, setDistrict] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                setIsLoading(true);
                setErrorMessage("");
                const params = typeFilter !== "ALL" ? { type: typeFilter as ListingType } : undefined;
                const data = await getListings(params);
                setListings(data);

                const auth = await getAuthMe().catch(() => ({ authenticated: false }));
                setIsAuthenticated(auth.authenticated);
                if (auth.authenticated) {
                    const mine = await getMyListings().catch(() => []);
                    setMyListings(mine);
                }
            } catch (err) {
                setErrorMessage(err instanceof Error ? err.message : "載入房源失敗");
            } finally {
                setIsLoading(false);
            }
        };
        void load();
    }, [typeFilter]);

    const displayed = district
        ? listings.filter((l) => l.district?.includes(district) || l.address.includes(district))
        : listings;

    return (
        <SiteLayout>
            <section className="page-section">
                <section className="leju-hero leju-hero--compact">
                    <div className="leju-hero-breadcrumb">首頁 / 房源列表</div>
                    <h1>買房・租屋，每日更新所有平台房件</h1>
                    <p>結合 KYC 驗證與 Web3 能力，安全透明的不動產媒合平台。</p>

                    <div className="leju-search-shell">
                        <div className="leju-search-bar">
                            <input
                                type="text"
                                className="leju-search-input"
                                placeholder="請輸入路段、行政區名稱"
                                value={district}
                                onChange={(e) => setDistrict(e.target.value)}
                            />
                        </div>
                    </div>
                </section>

                <div className="page-heading page-heading-row">
                    <div>
                        <h1>平台房源列表</h1>
                        <p>所有上架中的租售物件，均由 KYC 驗證會員刊登。</p>
                    </div>
                </div>

                {errorMessage && (
                    <div className="feedback-banner error-banner">
                        <p>{errorMessage}</p>
                    </div>
                )}

                <div className="leju-mode-row">
                    {TYPE_TABS.map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            className={`leju-mode-tab${typeFilter === tab.value ? " leju-mode-tab--active" : ""}`}
                            onClick={() => setTypeFilter(tab.value)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <PageLoading message="載入房源中..." />
                ) : displayed.length === 0 ? (
                    <EmptyState title="目前沒有符合條件的房源" description="可以切換篩選條件，或等待新的房源上架。" />
                ) : (
                    <div className="property-card-grid">
                        {displayed.map((listing) => (
                            <ListingCard key={listing.id} listing={listing} />
                        ))}
                    </div>
                )}

                {isAuthenticated && myListings.length > 0 && (
                    <div className="page-section-block">
                        <div className="page-heading">
                            <h2>我的房源</h2>
                        </div>
                        <div className="property-card-grid">
                            {myListings.map((listing) => (
                                <ListingCard key={listing.id} listing={listing} />
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </SiteLayout>
    );
};

export default ListingListPage;
