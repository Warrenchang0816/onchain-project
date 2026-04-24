import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyListings, type Listing } from "@/api/listingApi";
import SiteLayout from "@/layouts/SiteLayout";

const STATUS_LABEL: Record<string, string> = {
    DRAFT: "草稿",
    ACTIVE: "上架中",
    NEGOTIATING: "媒合中",
    LOCKED: "已鎖定",
    SIGNING: "簽約中",
    CLOSED: "已結案",
    EXPIRED: "已到期",
    REMOVED: "已下架",
    SUSPENDED: "已暫停",
};

function formatPrice(listing: Listing) {
    if (listing.price <= 0) return "尚未設定";
    if (listing.list_type === "RENT") return `NT$ ${listing.price.toLocaleString()} / 月`;
    return `NT$ ${listing.price.toLocaleString()}`;
}

function setupLabel(listing: Listing) {
    return listing.setup_status === "READY" ? "資料可上架" : "尚未完善";
}

export default function MyListingsPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        getMyListings()
            .then(setItems)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取我的房源失敗。"))
            .finally(() => setLoading(false));
    }, []);

    const counts = useMemo(() => ({
        incomplete: items.filter((item) => item.status === "DRAFT" && item.setup_status === "INCOMPLETE").length,
        ready: items.filter((item) => item.status === "DRAFT" && item.setup_status === "READY").length,
        active: items.filter((item) => item.status === "ACTIVE").length,
        archived: items.filter((item) => item.status === "REMOVED" || item.status === "CLOSED").length,
    }), [items]);

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-4xl font-extrabold text-on-surface">我的房源</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-[1.8] text-on-surface-variant">
                            屋主認證通過後產生的第一筆房源會留在這裡。草稿不會公開，補齊必要資料後才可以上架。
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate("/listings/new")}
                        className="rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90"
                    >
                        新增房源草稿
                    </button>
                </header>

                <section className="grid gap-4 md:grid-cols-4">
                    {[
                        ["尚未完善", counts.incomplete],
                        ["可上架草稿", counts.ready],
                        ["上架中", counts.active],
                        ["歷史紀錄", counts.archived],
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
                        <h2 className="text-2xl font-bold text-on-surface">目前沒有房源紀錄</h2>
                        <p className="mt-2 text-sm text-on-surface-variant">完成屋主認證或手動建立草稿後，房源會出現在這裡。</p>
                    </section>
                ) : (
                    <section className="grid gap-4">
                        {items.map((item) => (
                            <article
                                key={item.id}
                                className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
                                onClick={() => navigate(`/listings/${item.id}`)}
                            >
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                                {STATUS_LABEL[item.status] ?? item.status}
                                            </span>
                                            <span className="rounded-full bg-primary-container/15 px-3 py-1 text-xs font-semibold text-primary-container">
                                                {setupLabel(item)}
                                            </span>
                                            {item.draft_origin === "OWNER_ACTIVATION" ? (
                                                <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs font-semibold text-tertiary">
                                                    屋主認證草稿
                                                </span>
                                            ) : null}
                                        </div>
                                        <h2 className="text-xl font-bold text-on-surface">{item.title || "未命名房源"}</h2>
                                        <p className="mt-1 text-sm text-on-surface-variant">{item.address || "尚未填寫地址"}</p>
                                    </div>
                                    <div className="text-left md:text-right">
                                        <p className="text-lg font-extrabold text-on-surface">{formatPrice(item)}</p>
                                        <p className="mt-1 text-xs text-on-surface-variant">
                                            更新於 {new Date(item.updated_at).toLocaleDateString("zh-TW")}
                                        </p>
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
