import type { ListingDisplayModel } from "./listingDisplayModel";

type Props = {
    listing: ListingDisplayModel;
    onClick: () => void;
};

function chipClass(tone: string): string {
    if (tone === "success") return "bg-tertiary/10 text-tertiary";
    if (tone === "primary") return "bg-primary-container/15 text-primary-container";
    if (tone === "warning") return "bg-amber-700/10 text-amber-700";
    if (tone === "danger") return "bg-error-container text-on-error-container";
    return "bg-surface-container-low text-on-surface-variant";
}

export default function ListingResultCard({ listing, onClick }: Props) {
    return (
        <article
            onClick={onClick}
            className="grid cursor-pointer gap-5 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 transition-transform duration-300 hover:-translate-y-0.5 md:grid-cols-[220px_1fr_auto]"
        >
            <div className="relative h-48 overflow-hidden rounded-xl bg-surface-container-low md:h-40">
                {listing.coverImageUrl ? (
                    <img src={listing.coverImageUrl} alt={listing.title} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-on-surface-variant">尚未上傳照片</div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-surface-container-lowest px-3 py-1 text-xs font-bold text-on-surface">
                    {listing.statusLabel}
                </span>
            </div>
            <div className="min-w-0">
                <div className="text-xs font-bold text-on-surface-variant">
                    {listing.type === "RENT" ? "出租物件" : listing.type === "SALE" ? "賣屋物件" : "未設定類型"}
                </div>
                <h2 className="mt-1 text-xl font-extrabold text-on-surface">{listing.title}</h2>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                    {listing.district} · {listing.address}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {listing.listStats.slice(1).map((stat) => (
                        <span key={stat.label} className="rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant">
                            {stat.label} {stat.value}
                        </span>
                    ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    {listing.featureChips.slice(0, 4).map((chip) => (
                        <span key={chip.label} className={`rounded-full px-3 py-1 text-xs font-bold ${chipClass(chip.tone)}`}>
                            {chip.label}
                        </span>
                    ))}
                </div>
            </div>
            <div className="flex flex-col items-start justify-between gap-4 md:items-end">
                <div>
                    <div className="text-xs text-on-surface-variant">{listing.priceCaption}</div>
                    <div className="mt-1 text-2xl font-extrabold text-primary-container">{listing.priceLabel}</div>
                </div>
                <div className="text-xs text-on-surface-variant">更新 {listing.updatedAtLabel}</div>
            </div>
        </article>
    );
}
