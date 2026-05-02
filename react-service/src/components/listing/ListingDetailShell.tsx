import type { ReactNode } from "react";
import type { ListingDisplayMode, ListingDisplayModel } from "./listingDisplayModel";
import {
    ListingCompletenessSection,
    ListingFactsSection,
    ListingFeaturesSection,
    ListingHeroSection,
    ListingTrustSection,
} from "./ListingDetailSections";

type Props = {
    model: ListingDisplayModel;
    mode: ListingDisplayMode;
    actions?: ReactNode;
};

export default function ListingDetailShell({ model, mode, actions }: Props) {
    return (
        <div className={mode === "print" ? "listing-print-surface" : "flex flex-col gap-6"}>
            {mode !== "public" ? (
                <div className="rounded-2xl border border-amber-700/20 bg-amber-700/10 p-4 text-sm text-amber-700">
                    這是刊登預覽內容，尚未代表正式公開頁面。產出時間：{model.generatedAtLabel}
                </div>
            ) : null}
            <ListingHeroSection model={model} mode={mode} />
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="flex flex-col gap-6">
                    <ListingFactsSection model={model} />
                    <ListingFeaturesSection model={model} />
                    <ListingTrustSection model={model} />
                    {mode !== "public" ? <ListingCompletenessSection model={model} /> : null}
                </div>
                {mode !== "print" && actions ? <aside className="flex flex-col gap-4">{actions}</aside> : null}
            </div>
        </div>
    );
}
