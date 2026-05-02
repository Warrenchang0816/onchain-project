import ListingDetailShell from "./ListingDetailShell";
import type { ListingDisplayModel } from "./listingDisplayModel";

export default function ListingPrintBook({ model }: { model: ListingDisplayModel }) {
    return (
        <article className="mx-auto flex max-w-[960px] flex-col gap-6 bg-surface px-8 py-8 text-on-surface print:max-w-none print:px-0 print:py-0">
            <section className="listing-print-page rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                <p className="text-sm font-bold text-on-surface-variant">完整刊登書 · 預覽稿</p>
                <h1 className="mt-3 text-4xl font-extrabold">{model.title}</h1>
                <p className="mt-3 text-sm text-on-surface-variant">
                    {model.district} · {model.address}
                </p>
                <div className="mt-8 grid gap-6 md:grid-cols-[1fr_280px]">
                    <div className="h-[360px] overflow-hidden rounded-2xl bg-surface-container-low">
                        {model.coverImageUrl ? (
                            <img src={model.coverImageUrl} alt={model.title} className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">尚未上傳照片</div>
                        )}
                    </div>
                    <div>
                        <p className="text-sm text-on-surface-variant">{model.priceCaption}</p>
                        <p className="mt-1 text-3xl font-extrabold text-primary-container">{model.priceLabel}</p>
                        <div className="mt-6 grid gap-3">
                            {model.heroStats.map((stat) => (
                                <div key={stat.label} className="rounded-xl bg-surface-container-low p-4">
                                    <p className="text-xs text-on-surface-variant">{stat.label}</p>
                                    <p className="text-base font-bold">{stat.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <footer className="mt-8 flex justify-between border-t border-surface-container pt-4 text-xs text-on-surface-variant">
                    <span>物件 #{model.id}</span>
                    <span>產出時間 {model.generatedAtLabel}</span>
                </footer>
            </section>
            <ListingDetailShell model={model} mode="print" />
        </article>
    );
}
