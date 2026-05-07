import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSaleListings, type SaleListing } from "../api/saleListingApi";
import SiteLayout from "../layouts/SiteLayout";

function formatLayout(sl: SaleListing): string {
    const p = sl.property;
    if (!p) return "";
    const parts = [];
    if (p.rooms != null) parts.push(`${p.rooms}房`);
    if (p.living_rooms != null) parts.push(`${p.living_rooms}廳`);
    if (p.bathrooms != null) parts.push(`${p.bathrooms}衛`);
    return parts.join("");
}

export default function SaleListPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<SaleListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        getSaleListings()
            .then(setItems)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取售屋列表失敗"))
            .finally(() => setLoading(false));
    }, []);

    return (
        <SiteLayout>
            <section className="w-full bg-gradient-to-r from-surface to-surface-container-low py-12 md:py-16">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">出售物件</h1>
                    <p className="max-w-2xl text-base leading-[1.75] text-on-surface-variant md:text-lg">
                        瀏覽平台上已公開的出售房源，依行政區、總價快速找到合適物件。
                    </p>
                </div>
            </section>

            <section className="w-full bg-surface py-12">
                <div className="mx-auto max-w-[1440px] px-6 md:px-12">
                    {loading ? (
                        <div className="flex items-center justify-center py-32">
                            <span className="animate-pulse text-sm text-on-surface-variant">讀取售屋中...</span>
                        </div>
                    ) : error ? (
                        <div className="rounded-xl border border-error/20 bg-error-container p-8 text-sm text-on-error-container">{error}</div>
                    ) : items.length === 0 ? (
                        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                            <h2 className="text-2xl font-bold text-on-surface">目前沒有公開的出售物件</h2>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5">
                            {items.map((item) => (
                                <article
                                    key={item.id}
                                    className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
                                    onClick={() => navigate(`/sale/${item.id}`)}
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="flex-1">
                                            <div className="mb-2 flex flex-wrap gap-2">
                                                {item.property?.building_type ? (
                                                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{item.property.building_type}</span>
                                                ) : null}
                                                {formatLayout(item) ? (
                                                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">{formatLayout(item)}</span>
                                                ) : null}
                                            </div>
                                            <h2 className="text-lg font-bold text-on-surface">
                                                {item.property?.title ?? `出售 #${item.id}`}
                                            </h2>
                                            <p className="mt-1 text-sm text-on-surface-variant">{item.property?.address ?? "地址未提供"}</p>
                                            {item.property?.main_area ? (
                                                <p className="mt-1 text-xs text-on-surface-variant">{item.property.main_area} 坪</p>
                                            ) : null}
                                        </div>
                                        <div className="text-left md:text-right">
                                            <p className="text-2xl font-extrabold text-on-surface">
                                                NT$ {item.total_price.toLocaleString()}
                                            </p>
                                            {item.unit_price_per_ping != null ? (
                                                <p className="mt-1 text-xs text-on-surface-variant">單坪 NT$ {item.unit_price_per_ping.toLocaleString()}</p>
                                            ) : null}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </SiteLayout>
    );
}
