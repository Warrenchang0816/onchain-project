import { useEffect, useMemo, useState } from "react";
import { getListings } from "../api/listingApi";
import EmptyState from "../components/common/EmptyState";
import FilterTabs from "../components/common/FilterTabs";
import PageLoading from "../components/common/PageLoading";
import PropertyCard from "../components/task/PropertyCard";
import SiteLayout from "../layouts/SiteLayout";
import type { Listing } from "../types/listing";

type ListingFilter = "ALL" | "COMPLETED" | "OPEN";

const LISTING_FILTER_OPTIONS: { label: string; value: ListingFilter }[] = [
    { label: "全部房源", value: "ALL" },
    { label: "已完成", value: "COMPLETED" },
    { label: "進行中", value: "OPEN" },
];

const TaskListPage = () => {
    const [listings, setListings] = useState<Listing[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [filter, setFilter] = useState<ListingFilter>("ALL");

    useEffect(() => {
        const loadListings = async () => {
            try {
                setErrorMessage("");
                setIsLoading(true);
                const data = await getListings();
                setListings(data);
            } catch (error) {
                setErrorMessage(error instanceof Error ? error.message : "載入房源失敗");
            } finally {
                setIsLoading(false);
            }
        };

        void loadListings();
    }, []);

    const filteredListings = useMemo(() => {
        if (filter === "ALL") return listings;
        if (filter === "COMPLETED") return listings.filter((listing) => listing.status === "COMPLETED");
        return listings.filter((listing) => ["OPEN", "IN_PROGRESS", "SUBMITTED", "APPROVED"].includes(listing.status));
    }, [filter, listings]);

    return (
        <SiteLayout>
            <section className="page-section">
                <section className="leju-hero leju-hero--compact">
                    <div className="leju-hero-breadcrumb">首頁 / 買房列表</div>
                    <h1>買房，每日更新所有平台房件</h1>
                    <p>把目前任務資料整理成房產搜尋列表，讓會員流程、KYC 流程與房源探索感更一致。</p>

                    <div className="leju-search-shell">
                        <div className="leju-search-bar">
                            <button type="button" className="leju-select">選擇縣市</button>
                            <button type="button" className="leju-select">總價不限</button>
                            <button type="button" className="leju-select">類型不限</button>
                            <div className="leju-search-input">請輸入路段、社區名稱</div>
                            <button type="button" className="leju-select">特色不限</button>
                            <button type="button" className="leju-search-button">找房</button>
                        </div>
                    </div>
                </section>

                <div className="page-heading page-heading-row">
                    <div>
                        <h1>平台房源列表</h1>
                        <p>結合會員驗證與 Web3 能力，先把瀏覽體驗拉到更像房產平台的搜尋節奏。</p>
                    </div>
                </div>

                {errorMessage ? (
                    <div className="feedback-banner error-banner">
                        <p>{errorMessage}</p>
                    </div>
                ) : null}

                <FilterTabs options={LISTING_FILTER_OPTIONS} value={filter} onChange={setFilter} />

                {isLoading ? (
                    <PageLoading message="Loading properties..." />
                ) : filteredListings.length === 0 ? (
                    <EmptyState title="沒有符合條件的房源" description="可以切換篩選條件，或等待新的房源上架。" />
                ) : (
                    <div className="property-card-grid">
                        {filteredListings.map((listing) => (
                            <PropertyCard key={listing.id} task={listing} />
                        ))}
                    </div>
                )}
            </section>
        </SiteLayout>
    );
};

export default TaskListPage;
