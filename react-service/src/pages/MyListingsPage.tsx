import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyListings, type Listing, type PropertyCompletenessStatus } from "@/api/listingApi";
import SiteLayout from "@/layouts/SiteLayout";

const STATUS_LABEL: Record<string, string> = {
    DRAFT: "草稿",
    ACTIVE: "上架中",
    NEGOTIATING: "洽談中",
    LOCKED: "鎖定中",
    SIGNING: "簽約中",
    CLOSED: "已結案",
    EXPIRED: "已過期",
    REMOVED: "已下架",
    SUSPENDED: "已停權",
};

const PROPERTY_COMPLETENESS_LABEL: Record<PropertyCompletenessStatus, string> = {
    BASIC_CREATED: "物件已建立",
    DISCLOSURE_REQUIRED: "待填財產說明",
    WARRANTY_REQUIRED: "待確認重大事項",
    SNAPSHOT_READY: "揭露快照已產生",
    READY_FOR_LISTING: "物件可建立刊登",
};

function formatPrice(listing: Listing) {
    if (listing.price <= 0) return "價格未設定";
    if (listing.list_type === "RENT") return `NT$ ${listing.price.toLocaleString()} / 月`;
    return `NT$ ${listing.price.toLocaleString()}`;
}

function setupLabel(listing: Listing) {
    if (listing.status === "DRAFT" && listing.property?.completeness_status === "READY_FOR_LISTING" && listing.list_type === "UNSET") {
        return "待選擇出租或出售";
    }
    if (listing.status === "DRAFT" && listing.list_type === "RENT" && listing.setup_status !== "READY") {
        return "出租刊登待補資料";
    }
    if (listing.status === "DRAFT" && listing.list_type === "SALE" && listing.setup_status !== "READY") {
        return "出售刊登待補資料";
    }
    return listing.setup_status === "READY" ? "刊登資料完整" : "刊登資料未完整";
}

function propertyLabel(listing: Listing) {
    if (!listing.property_id) return "未綁定物件";
    if (!listing.property) return "物件資料讀取中";
    return PROPERTY_COMPLETENESS_LABEL[listing.property.completeness_status] ?? listing.property.completeness_status;
}

export default function MyListingsPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        getMyListings()
            .then(setItems)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取我的房源失敗"))
            .finally(() => setLoading(false));
    }, []);

    const counts = useMemo(() => ({
        incomplete: items.filter((item) => item.status === "DRAFT" && item.setup_status === "INCOMPLETE").length,
        ready: items.filter((item) => item.status === "DRAFT" && item.setup_status === "READY").length,
        active: items.filter((item) => item.status === "ACTIVE").length,
        propertyReady: items.filter((item) => item.property?.completeness_status === "READY_FOR_LISTING").length,
    }), [items]);

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="flex flex-col gap-4">
                    <h1 className="text-4xl font-extrabold text-on-surface">我的房源</h1>
                    <p className="max-w-3xl text-sm leading-[1.8] text-on-surface-variant">
                        房源草稿會綁定屋主認證後建立的房屋物件。完成財產/現況說明、重大事項保證與揭露快照後，還要選擇出租或賣屋並補完刊登資料，才會進入公開列表。
                    </p>
                </header>

                <section className="grid gap-4 md:grid-cols-4">
                    {[
                        ["未完整草稿", counts.incomplete],
                        ["可公開草稿", counts.ready],
                        ["上架中", counts.active],
                        ["物件可建立刊登", counts.propertyReady],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
                            <p className="text-sm text-on-surface-variant">{label}</p>
                            <p className="mt-2 text-3xl font-extrabold text-on-surface">{value}</p>
                        </div>
                    ))}
                </section>

                {loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取房源中...</div>
                ) : error ? (
                    <div className="rounded-xl border border-error/20 bg-error-container p-6 text-sm text-on-error-container">{error}</div>
                ) : items.length === 0 ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <h2 className="text-2xl font-bold text-on-surface">目前沒有房源草稿</h2>
                        <p className="mt-2 text-sm text-on-surface-variant">屋主身份啟用後，平台會先建立房屋物件與第一筆房源草稿。</p>
                    </section>
                ) : (
                    <section className="grid gap-4">
                        {items.map((item) => (
                            <article
                                key={item.id}
                                className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
                                onClick={() => navigate(`/my/listings/${item.id}`)}
                            >
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">#{item.id}</span>
                                            <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{STATUS_LABEL[item.status] ?? item.status}</span>
                                            <span className="rounded-full bg-primary-container/15 px-3 py-1 text-xs font-semibold text-primary-container">{setupLabel(item)}</span>
                                            <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs font-semibold text-tertiary">{propertyLabel(item)}</span>
                                            {item.draft_origin === "OWNER_ACTIVATION" ? (
                                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">屋主認證草稿</span>
                                            ) : null}
                                        </div>
                                        <h2 className="text-xl font-bold text-on-surface">{item.title || "未命名房源草稿"}</h2>
                                        <p className="mt-1 text-sm text-on-surface-variant">{item.address || "地址未設定"}</p>
                                        {item.property?.disclosure_hash ? (
                                            <p className="mt-2 text-xs text-on-surface-variant">Disclosure hash: {item.property.disclosure_hash.slice(0, 16)}...</p>
                                        ) : null}
                                    </div>
                                    <div className="text-left md:text-right">
                                        <p className="text-lg font-extrabold text-on-surface">{formatPrice(item)}</p>
                                        <p className="mt-1 text-xs text-on-surface-variant">更新於 {new Date(item.updated_at).toLocaleDateString("zh-TW")}</p>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </main>
        </SiteLayout>
    );
}
