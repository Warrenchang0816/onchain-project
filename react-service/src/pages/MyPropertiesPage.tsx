import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listMyProperties, removeProperty, type Property, type PropertySetupStatus } from "../api/propertyApi";
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

function statusBadgeCls(status: PropertySetupStatus): string {
    if (status === "READY") return "bg-[#E8F5E9] text-[#2E7D32]";
    if (status === "ARCHIVED") return "bg-surface-container text-on-surface-variant";
    return "bg-surface-container-low text-on-surface-variant";
}

function statusLabel(status: PropertySetupStatus): string {
    if (status === "READY") return "✓ READY";
    if (status === "ARCHIVED") return "歷史";
    return "草稿";
}

type FilterType = "ALL" | "READY" | "DRAFT" | "ARCHIVED";

export default function MyPropertiesPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeFilter, setActiveFilter] = useState<FilterType>("ALL");
    const [removing, setRemoving] = useState<number | null>(null);
    const [removeError, setRemoveError] = useState("");
    const [removeLoading, setRemoveLoading] = useState(false);

    const loadItems = () => {
        setLoading(true);
        listMyProperties()
            .then(setItems)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取物件失敗"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadItems(); }, []);

    const readyCount    = items.filter((p) => p.setup_status === "READY").length;
    const draftCount    = items.filter((p) => p.setup_status === "DRAFT").length;
    const archivedCount = items.filter((p) => p.setup_status === "ARCHIVED").length;

    const filtered =
        activeFilter === "ALL"      ? items :
        activeFilter === "READY"    ? items.filter((p) => p.setup_status === "READY") :
        activeFilter === "DRAFT"    ? items.filter((p) => p.setup_status === "DRAFT") :
        items.filter((p) => p.setup_status === "ARCHIVED");

    const handleRemove = async () => {
        if (removing === null) return;
        setRemoveLoading(true);
        setRemoveError("");
        try {
            await removeProperty(removing);
            setRemoving(null);
            loadItems();
        } catch (e) {
            setRemoveError(e instanceof Error ? e.message : "移除失敗");
        } finally {
            setRemoveLoading(false);
        }
    };

    const filterCards: { label: string; value: number; filter: FilterType }[] = [
        { label: "物件總數",    value: items.length,   filter: "ALL"      },
        { label: "完成度 READY", value: readyCount,    filter: "READY"    },
        { label: "草稿中",      value: draftCount,     filter: "DRAFT"    },
        { label: "歷史",        value: archivedCount,  filter: "ARCHIVED" },
    ];

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

                <section className="grid gap-4 md:grid-cols-4">
                    {filterCards.map(({ label, value, filter }) => (
                        <button
                            key={label}
                            type="button"
                            onClick={() => setActiveFilter(filter)}
                            className={`rounded-2xl border p-5 text-left transition-colors ${
                                activeFilter === filter
                                    ? "border-primary-container bg-primary-container/10"
                                    : "border-outline-variant/15 bg-surface-container-lowest hover:bg-surface-container-low"
                            }`}
                        >
                            <p className="text-sm text-on-surface-variant">{label}</p>
                            <p className="mt-2 text-3xl font-extrabold text-on-surface">{value}</p>
                        </button>
                    ))}
                </section>

                {loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取物件中...</div>
                ) : error ? (
                    <div className="rounded-xl border border-error/20 bg-error-container p-6 text-sm text-on-error-container">{error}</div>
                ) : filtered.length === 0 ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <h2 className="text-2xl font-bold text-on-surface">尚無物件</h2>
                        <p className="mt-2 text-sm text-on-surface-variant">
                            {activeFilter === "ALL" ? "點擊右上角「新增物件」開始建立第一個物件。" : "此篩選條件下無物件。"}
                        </p>
                    </section>
                ) : (
                    <section className="grid gap-4">
                        {filtered.map((item) => (
                            <article
                                key={item.id}
                                className="cursor-pointer rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
                                onClick={() => navigate(`/my/properties/${item.id}`)}
                            >
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    {(() => {
                                        const firstPhoto = item.attachments.find((a) => a.type === "PHOTO");
                                        return firstPhoto ? (
                                            <img
                                                src={firstPhoto.url}
                                                alt="物件照片"
                                                className="h-20 w-28 shrink-0 rounded-xl object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-surface-container-low">
                                                <span className="material-symbols-outlined text-2xl text-on-surface-variant">photo_camera</span>
                                            </div>
                                        );
                                    })()}
                                    <div className="flex-1">
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">#{item.id}</span>
                                            {item.building_type ? (
                                                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                                    {BUILDING_TYPE_LABEL[item.building_type] ?? item.building_type}
                                                </span>
                                            ) : null}
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeCls(item.setup_status)}`}>
                                                {statusLabel(item.setup_status)}
                                            </span>
                                        </div>
                                        <h2 className="text-xl font-bold text-on-surface">{item.title || "未命名物件"}</h2>
                                        <p className="mt-1 text-sm text-on-surface-variant">{item.address || "地址未設定"}</p>
                                        <p className="mt-1 text-xs text-on-surface-variant">{formatArea(item)} · {formatLayout(item)}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 text-right">
                                        <p className="text-xs text-on-surface-variant">更新於 {new Date(item.updated_at).toLocaleDateString("zh-TW")}</p>
                                        {item.setup_status === "ARCHIVED" ? (
                                            <span className="text-xs text-on-surface-variant">已歸檔</span>
                                        ) : (
                                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                                {item.setup_status === "READY" && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/my/properties/${item.id}/listing`); }}
                                                        className="rounded-lg bg-primary-container px-3 py-1.5 text-xs font-bold text-on-primary-container transition-opacity hover:opacity-90"
                                                    >
                                                        上架
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); setRemoving(item.id); setRemoveError(""); }}
                                                    className="rounded-lg border border-error/30 bg-surface-container-lowest px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error-container"
                                                >
                                                    移除物件
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </main>

            {removing !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-8 shadow-xl">
                        <h3 className="text-lg font-bold text-on-surface">確定移除物件？</h3>
                        <p className="mt-2 text-sm leading-[1.8] text-on-surface-variant">
                            此操作無法復原，物件資料將保留於資料庫但不再顯示。
                        </p>
                        {removeError && (
                            <p className="mt-3 rounded-lg bg-error-container p-3 text-sm text-on-error-container">{removeError}</p>
                        )}
                        <div className="mt-6 flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={() => void handleRemove()}
                                disabled={removeLoading}
                                className="w-full rounded-xl bg-error px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                            >
                                {removeLoading ? "處理中..." : "確定移除"}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setRemoving(null); setRemoveError(""); }}
                                disabled={removeLoading}
                                className="w-full rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </SiteLayout>
    );
}
