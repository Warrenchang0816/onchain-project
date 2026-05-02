import type { ReactNode } from "react";
import type { DisplayStat, ListingDisplayMode, ListingDisplayModel } from "./listingDisplayModel";

function Section(props: { title: string; children: ReactNode; className?: string }) {
    return (
        <section className={`rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 ${props.className ?? ""}`}>
            <h2 className="text-xl font-extrabold text-on-surface">{props.title}</h2>
            <div className="mt-5">{props.children}</div>
        </section>
    );
}

function StatGrid({ stats }: { stats: DisplayStat[] }) {
    return (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat) => (
                <div key={stat.label} className="rounded-xl bg-surface-container-low p-4">
                    <p className="text-xs font-bold text-on-surface-variant">{stat.label}</p>
                    <p className="mt-1 text-base font-extrabold text-on-surface">{stat.value}</p>
                </div>
            ))}
        </div>
    );
}

export function ListingHeroSection({ model, mode }: { model: ListingDisplayModel; mode: ListingDisplayMode }) {
    return (
        <section className="grid gap-6 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 lg:grid-cols-[1fr_360px]">
            <div>
                <div className="relative h-[320px] overflow-hidden rounded-2xl bg-surface-container-low">
                    {model.coverImageUrl ? (
                        <img src={model.coverImageUrl} alt={model.title} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">尚未上傳照片</div>
                    )}
                    {mode !== "public" ? (
                        <span className="absolute left-4 top-4 rounded-full bg-surface-container-lowest px-4 py-2 text-xs font-bold text-on-surface">
                            預覽稿
                        </span>
                    ) : null}
                </div>
            </div>
            <div>
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-on-surface-variant">{model.statusLabel}</span>
                    <span className="rounded-full bg-primary-container/15 px-3 py-1 text-xs font-bold text-primary-container">{model.setupLabel}</span>
                </div>
                <div className="mt-5 text-xs font-bold text-on-surface-variant">物件 #{model.id}</div>
                <h1 className="mt-2 text-3xl font-extrabold text-on-surface">{model.title}</h1>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                    {model.district} · {model.address}
                </p>
                <p className="mt-6 text-sm text-on-surface-variant">{model.priceCaption}</p>
                <p className="text-3xl font-extrabold text-primary-container">{model.priceLabel}</p>
                <div className="mt-6 grid gap-3">
                    {model.heroStats.map((stat) => (
                        <div key={stat.label} className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3">
                            <span className="text-sm text-on-surface-variant">{stat.label}</span>
                            <span className="text-sm font-bold text-on-surface">{stat.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function ListingFactsSection({ model }: { model: ListingDisplayModel }) {
    const stats = model.type === "RENT" ? model.rentFacts : model.saleFacts;
    return (
        <Section title={model.type === "RENT" ? "出租條件" : "基本資料"}>
            {stats.length > 0 ? <StatGrid stats={stats} /> : <p className="text-sm text-on-surface-variant">尚未建立詳細資料。</p>}
        </Section>
    );
}

export function ListingFeaturesSection({ model }: { model: ListingDisplayModel }) {
    return (
        <Section title={model.type === "RENT" ? "設備與特色" : "物件特色"}>
            <div className="flex flex-wrap gap-2">
                {model.featureChips.map((chip) => (
                    <span key={chip.label} className="rounded-full bg-surface-container-low px-3 py-1 text-sm font-bold text-on-surface-variant">
                        {chip.label}
                    </span>
                ))}
            </div>
            {model.description ? <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-on-surface-variant">{model.description}</p> : null}
        </Section>
    );
}

export function ListingTrustSection({ model }: { model: ListingDisplayModel }) {
    return (
        <Section title="可信資料">
            <StatGrid stats={model.trustFacts} />
        </Section>
    );
}

export function ListingCompletenessSection({ model }: { model: ListingDisplayModel }) {
    if (model.missingFields.length === 0) {
        return (
            <Section title="資料完整度">
                <p className="text-sm font-bold text-tertiary">目前沒有偵測到關鍵缺漏欄位。</p>
            </Section>
        );
    }
    return (
        <Section title="資料完整度">
            <p className="text-sm text-on-surface-variant">發布前建議補齊以下欄位：</p>
            <div className="mt-4 flex flex-wrap gap-2">
                {model.missingFields.map((field) => (
                    <span key={field} className="rounded-full bg-amber-700/10 px-3 py-1 text-xs font-bold text-amber-700">
                        {field}
                    </span>
                ))}
            </div>
        </Section>
    );
}
