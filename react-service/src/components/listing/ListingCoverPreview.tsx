import type { ListingDisplayModel } from "./listingDisplayModel";

export default function ListingCoverPreview({ model }: { model: ListingDisplayModel }) {
    return (
        <article className="mx-auto aspect-[1.414/1] w-full max-w-[960px] overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8 text-on-surface">
            <div className="grid h-full gap-6 md:grid-cols-[1.1fr_0.9fr]">
                <div className="overflow-hidden rounded-2xl bg-surface-container-low">
                    {model.coverImageUrl ? (
                        <img src={model.coverImageUrl} alt={model.title} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">尚未上傳照片</div>
                    )}
                </div>
                <div className="flex flex-col justify-between">
                    <div>
                        <p className="text-sm font-bold text-on-surface-variant">刊登封面預覽 · 預覽稿</p>
                        <h1 className="mt-3 text-3xl font-extrabold">{model.title}</h1>
                        <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                            {model.district} · {model.address}
                        </p>
                        <p className="mt-8 text-sm text-on-surface-variant">{model.priceCaption}</p>
                        <p className="text-3xl font-extrabold text-primary-container">{model.priceLabel}</p>
                    </div>
                    <div className="grid gap-2">
                        {model.heroStats.map((stat) => (
                            <div key={stat.label} className="flex justify-between rounded-xl bg-surface-container-low px-4 py-3 text-sm">
                                <span className="text-on-surface-variant">{stat.label}</span>
                                <span className="font-bold">{stat.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </article>
    );
}
