import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listMyProperties, type Property } from "../api/propertyApi";
import SiteLayout from "../layouts/SiteLayout";

const BUILDING_TYPE_LABEL: Record<string, string> = {
    APARTMENT: "公寓", BUILDING: "大樓", TOWNHOUSE: "透天", STUDIO: "套房",
};

function formatArea(p: Property): string {
    if (!p.main_area) return "坪數未設定";
    return `${p.main_area} 坪`;
}

function formatLayout(p: Property): string {
    const parts: string[] = [];
    if (p.rooms != null) parts.push(`${p.rooms} 房`);
    if (p.living_rooms != null) parts.push(`${p.living_rooms} 廳`);
    if (p.bathrooms != null) parts.push(`${p.bathrooms} 衛`);
    return parts.length > 0 ? parts.join("") : "格局未設定";
}

export default function MyPropertiesPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        listMyProperties()
            .then(setItems)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取物件失敗"))
            .finally(() => setLoading(false));
    }, []);

    const readyCount = items.filter((p) => p.setup_status === "READY").length;

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-12 md:px-12">
                <header className="flex flex-col gap-2">
                    <Link
                        to="/member"
                        className="mb-2 inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface"
                    >
                        ← 身分工作台
                    </Link>
                    <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-extrabold text-on-surface">我的物件</h1>
                        <p className="mt-2 text-sm text-on-surface-variant">管理你的房屋物件，完成後可上架出租或出售。</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate("/my/properties/new")}
                        className="flex items-center gap-2 rounded-xl bg-primary-container px-5 py-3 font-bold text-on-primary-container transition-opacity hover:opacity-90"
                    >
                        <span className="material-symbols-outlined text-sm">add</span>
                        新增物件
                    </button>
                    </div>
                </header>

                <section className="grid gap-4 md:grid-cols-3">
                    {[
                        ["物件總數", items.length],
                        ["完成度 READY", readyCount],
                        ["草稿中", items.length - readyCount],
                    ].map(([label, value]) => (
                        <div key={label as string} className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5">
                            <p className="text-sm text-on-surface-variant">{label}</p>
                            <p className="mt-2 text-3xl font-extrabold text-on-surface">{value}</p>
                        </div>
                    ))}
                </section>

                {loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取物件中...</div>
                ) : error ? (
                    <div className="rounded-xl border border-error/20 bg-error-container p-6 text-sm text-on-error-container">{error}</div>
                ) : items.length === 0 ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <h2 className="text-2xl font-bold text-on-surface">尚無物件</h2>
                        <p className="mt-2 text-sm text-on-surface-variant">點擊右上角「新增物件」開始建立第一個物件。</p>
                    </section>
                ) : (
                    <section className="grid gap-4">
                        {items.map((item) => (
                            <article
                                key={item.id}
                                className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
                                onClick={() => navigate(`/my/properties/${item.id}`)}
                            >
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">#{item.id}</span>
                                            {item.building_type ? (
                                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                                    {BUILDING_TYPE_LABEL[item.building_type] ?? item.building_type}
                                                </span>
                                            ) : null}
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.setup_status === "READY" ? "bg-[#E8F5E9] text-[#2E7D32]" : "bg-surface-container-low text-on-surface-variant"}`}>
                                                {item.setup_status === "READY" ? "✓ READY" : "草稿"}
                                            </span>
                                        </div>
                                        <h2 className="text-xl font-bold text-on-surface">{item.title || "未命名物件"}</h2>
                                        <p className="mt-1 text-sm text-on-surface-variant">{item.address || "地址未設定"}</p>
                                        <p className="mt-1 text-xs text-on-surface-variant">{formatArea(item)} · {formatLayout(item)}</p>
                                    </div>
                                    <div className="text-left md:text-right">
                                        <p className="text-xs text-on-surface-variant">更新於 {new Date(item.updated_at).toLocaleDateString("zh-TW")}</p>
                                        <p className="mt-2 text-xs font-medium text-primary-container">點擊編輯 →</p>
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
