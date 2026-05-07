import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createProperty } from "../api/propertyApi";
import SiteLayout from "../layouts/SiteLayout";

const inputCls =
    "block w-full px-4 py-3 bg-surface-container-low text-on-surface rounded-lg border-0 " +
    "focus:ring-2 focus:ring-primary-container transition-colors text-sm outline-none placeholder:text-outline";

export default function PropertyCreatePage() {
    const navigate = useNavigate();
    const [title, setTitle] = useState("");
    const [address, setAddress] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const canSubmit = title.trim() !== "" && address.trim() !== "" && !submitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError("");
        try {
            const { id } = await createProperty({ title: title.trim(), address: address.trim() });
            navigate(`/my/properties/${id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "建立物件失敗");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 py-12 md:px-12">
                <div className="flex flex-col gap-2">
                    <Link to="/my/properties" className="text-sm text-on-surface-variant transition-colors hover:text-primary-container">
                        ← 返回我的物件
                    </Link>
                    <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">新增物件</h1>
                    <p className="text-sm text-on-surface-variant">先填入名稱和地址建立草稿，其他詳細資料可以之後補齊。</p>
                </div>

                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">物件名稱 *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="例：台北市信義區兩房公寓"
                                className={inputCls}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-on-surface-variant">地址 *</label>
                            <input
                                type="text"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="例：台北市信義區松仁路100號5樓"
                                className={inputCls}
                            />
                        </div>

                        {error ? (
                            <p className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p>
                        ) : null}

                        <button
                            type="button"
                            disabled={!canSubmit}
                            onClick={() => void handleSubmit()}
                            className="w-full rounded-xl bg-primary-container px-6 py-3 font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:opacity-40"
                        >
                            {submitting ? "建立中..." : "建立草稿"}
                        </button>
                    </div>
                </section>
            </main>
        </SiteLayout>
    );
}
