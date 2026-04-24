import SiteLayout from "@/layouts/SiteLayout";

export default function FavoritesPage() {
    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-16 md:px-12">
                <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-10">
                    <h1 className="text-3xl font-extrabold text-on-surface">我的最愛</h1>
                    <p className="mt-3 text-sm leading-[1.8] text-on-surface-variant">
                        收藏房源、租屋需求與仲介專頁會在後續支援軌補上。目前先保留入口，避免主線 Gate 2 前把會員資料表綁死在錯誤的收藏模型。
                    </p>
                </section>
            </main>
        </SiteLayout>
    );
}
