import type { TenantRequirement } from "../../api/tenantApi";
import { buildTenantRequirementDisplayModel } from "./tenantRequirementDisplayModel";

type TenantRequirementDetailShellProps = {
    requirement: TenantRequirement;
};

const matchToneClass = {
    good: "bg-primary-container/15 text-primary-container",
    partial: "bg-tertiary/10 text-tertiary",
    low: "bg-error-container text-on-error-container",
    none: "bg-surface-container-low text-on-surface-variant",
};

export default function TenantRequirementDetailShell({ requirement }: TenantRequirementDetailShellProps) {
    const model = buildTenantRequirementDisplayModel(requirement);

    return (
        <div className="flex flex-col gap-6">
            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-tertiary/10 px-3 py-1 text-xs font-bold text-tertiary">{model.statusLabel}</span>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${matchToneClass[model.matchTone]}`}>{model.matchLabel}</span>
                        </div>
                        <h1 className="mt-5 text-4xl font-extrabold text-on-surface">{model.title}</h1>
                        <p className="mt-3 text-sm text-on-surface-variant">{model.districtSummary}</p>
                        <p className="mt-4 text-2xl font-extrabold text-on-surface">{model.budgetLabel}</p>
                    </div>
                    {requirement.hasAdvancedData ? (
                        <span className="rounded-full bg-primary-container/15 px-4 py-2 text-xs font-bold text-primary-container">已補租客資料</span>
                    ) : null}
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
                {[
                    ["坪數", model.areaLabel],
                    ["房 / 衛", `${model.roomLabel} / ${model.bathroomLabel}`],
                    ["入住時間", model.moveInLabel],
                    ["租期", model.leaseLabel],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-surface-container-lowest p-5">
                        <p className="text-sm text-on-surface-variant">{label}</p>
                        <p className="mt-2 text-lg font-bold text-on-surface">{value}</p>
                    </div>
                ))}
            </section>

            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                <h2 className="text-xl font-bold text-on-surface">需求條件</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                    {model.conditionChips.length > 0 ? (
                        model.conditionChips.map((chip) => (
                            <span key={chip} className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-on-surface-variant">
                                {chip}
                            </span>
                        ))
                    ) : (
                        <span className="text-sm text-on-surface-variant">未指定特殊條件</span>
                    )}
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <NoteBlock title="格局偏好" text={model.notes.layout} />
                    <NoteBlock title="生活習慣" text={model.notes.lifestyle} />
                    <NoteBlock title="必要條件" text={model.notes.mustHave} />
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
                <ReasonList title="符合原因" items={model.matchReasons} emptyText="尚未產生符合原因" />
                <ReasonList title="待確認項目" items={model.matchGaps} emptyText="目前沒有待補落差" />
            </section>

            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                <h2 className="text-xl font-bold text-on-surface">租客補充資料</h2>
                {requirement.hasAdvancedData ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <InfoBlock label="職業型態" value={requirement.occupationType || "未填寫"} />
                        <InfoBlock label="收入區間" value={requirement.incomeRange || "未填寫"} />
                        <InfoBlock label="入住時程" value={requirement.moveInTimeline || "未填寫"} />
                    </div>
                ) : (
                    <p className="mt-3 text-sm leading-[1.8] text-on-surface-variant">租客尚未補齊進階資料，媒合時會先以需求草稿條件判斷。</p>
                )}
            </section>
        </div>
    );
}

function NoteBlock({ title, text }: { title: string; text: string }) {
    return (
        <div className="rounded-xl bg-surface-container-low p-4">
            <p className="text-xs font-bold text-on-surface-variant">{title}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-[1.75] text-on-surface">{text}</p>
        </div>
    );
}

function ReasonList({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
    return (
        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
            <h2 className="text-xl font-bold text-on-surface">{title}</h2>
            {items.length > 0 ? (
                <ul className="mt-4 space-y-2 text-sm text-on-surface-variant">
                    {items.map((item) => (
                        <li key={item} className="rounded-lg bg-surface-container-low px-3 py-2">{item}</li>
                    ))}
                </ul>
            ) : (
                <p className="mt-3 text-sm text-on-surface-variant">{emptyText}</p>
            )}
        </section>
    );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-on-surface-variant">{label}</p>
            <p className="mt-1 font-bold text-on-surface">{value}</p>
        </div>
    );
}
