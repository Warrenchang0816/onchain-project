import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRequirementDetail, type TenantRequirement } from "@/api/tenantApi";
import TenantRequirementDetailShell from "@/components/tenant/TenantRequirementDetailShell";
import SiteLayout from "@/layouts/SiteLayout";

export default function RequirementDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const requirementId = Number(id);
    const hasValidId = Number.isFinite(requirementId) && requirementId > 0;
    const [item, setItem] = useState<TenantRequirement | null>(null);
    const [loading, setLoading] = useState(hasValidId);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!hasValidId) {
            return;
        }

        setLoading(true);
        setError("");
        getRequirementDetail(requirementId)
            .then(setItem)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "讀取租屋需求失敗"))
            .finally(() => setLoading(false));
    }, [hasValidId, requirementId]);

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-6 py-12 md:px-12">
                <button
                    type="button"
                    onClick={() => navigate("/requirements")}
                    className="self-start bg-transparent text-sm font-bold text-on-surface-variant hover:text-primary-container"
                >
                    返回租屋需求
                </button>

                {!hasValidId ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <h1 className="text-2xl font-bold text-on-surface">需求編號不正確</h1>
                    </section>
                ) : loading ? (
                    <div className="py-20 text-center text-sm text-on-surface-variant">讀取中...</div>
                ) : error || !item ? (
                    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10 text-center">
                        <h1 className="text-2xl font-bold text-on-surface">找不到租屋需求</h1>
                        <p className="mt-2 text-sm text-on-surface-variant">{error || "此需求可能已下架或不存在。"}</p>
                    </section>
                ) : (
                    <TenantRequirementDetailShell requirement={item} />
                )}
            </main>
        </SiteLayout>
    );
}
