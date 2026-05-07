import type { TenantRequirement } from "../../api/tenantApi";
import { buildTenantRequirementDisplayModel } from "./tenantRequirementDisplayModel";

type TenantRequirementCardProps = {
    requirement: TenantRequirement;
    onOpen?: (requirement: TenantRequirement) => void;
};

const matchToneClass = {
    good: "bg-primary-container/15 text-primary-container",
    partial: "bg-tertiary/10 text-tertiary",
    low: "bg-error-container text-on-error-container",
    none: "bg-surface-container-low text-on-surface-variant",
};

export default function TenantRequirementCard({ requirement, onOpen }: TenantRequirementCardProps) {
    const model = buildTenantRequirementDisplayModel(requirement);

    return (
        <article
            className="flex h-full cursor-pointer flex-col rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 transition-transform hover:-translate-y-0.5"
            onClick={() => onOpen?.(requirement)}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs font-bold text-tertiary">{model.statusLabel}</span>
                    <h2 className="mt-4 line-clamp-2 text-xl font-extrabold text-on-surface">{model.title}</h2>
                    <p className="mt-2 text-sm text-on-surface-variant">{model.districtSummary}</p>
                </div>
                {requirement.hasAdvancedData ? (
                    <span className="shrink-0 rounded-full bg-primary-container/15 px-3 py-1 text-xs font-bold text-primary-container">已補資料</span>
                ) : null}
            </div>

            <p className="mt-5 text-lg font-extrabold text-on-surface">{model.budgetLabel}</p>
            <div className="mt-3 grid gap-2 text-sm text-on-surface-variant sm:grid-cols-2">
                <span>{model.areaLabel}</span>
                <span>{model.roomLabel} / {model.bathroomLabel}</span>
                <span>{model.moveInLabel}</span>
                <span>{model.leaseLabel}</span>
            </div>

            <p className="mt-4 line-clamp-2 text-sm leading-[1.75] text-on-surface-variant">{model.notes.mustHave}</p>

            <div className="mt-4 flex flex-wrap gap-2">
                {model.conditionChips.map((chip) => (
                    <span key={chip} className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-on-surface-variant">
                        {chip}
                    </span>
                ))}
            </div>

            <div className="mt-auto pt-5">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${matchToneClass[model.matchTone]}`}>{model.matchLabel}</span>
            </div>
        </article>
    );
}
