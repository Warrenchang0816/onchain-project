import { computeCompletion } from "./ownerFieldParsers";

const ALL_FIELDS = [
    { key: "propertyAddress",    label: "房屋地址",          placeholder: "請填寫本次申請對應的房屋地址", required: true },
    { key: "ownershipDocNo",     label: "權狀字號",          placeholder: "若權狀或稅籍資料有字號請填寫", required: false },
    { key: "buildingType",       label: "建物類型",          placeholder: "大樓 / 公寓 / 透天 / 店面",   required: true },
    { key: "floor",              label: "樓層 / 總樓層",     placeholder: "例：5F / 24F",               required: true },
    { key: "mainArea",           label: "主建物面積（坪）",  placeholder: "例：38",                     required: true },
    { key: "rooms",              label: "格局（房 / 廳 / 衛）", placeholder: "例：3 房 2 廳 2 衛",     required: true },
    { key: "buildingAge",        label: "屋齡（年）",        placeholder: "例：10",                     required: true },
    { key: "buildingStructure",  label: "建物結構",          placeholder: "例：鋼骨鋼筋混凝土",         required: true },
    { key: "exteriorMaterial",   label: "外牆建材",          placeholder: "例：石材",                   required: true },
    { key: "buildingUsage",      label: "謄本用途",          placeholder: "例：集合住宅",               required: true },
    { key: "zoning",             label: "使用分區",          placeholder: "例：第一種住宅區",           required: true },
];

const DECLARATIONS = [
    { key: "no_sea_sand", text: "本物件非海砂屋，無使用海砂混凝土之情形" },
    { key: "no_radiation", text: "本物件非輻射屋，未受輻射污染" },
    { key: "no_haunted",   text: "本物件非凶宅，近期無發生非自然死亡事件" },
];

type Props = {
    fields: Record<string, string>;
    declarations: Record<string, boolean>;
    onFieldChange: (key: string, value: string) => void;
    onDeclarationChange: (key: string, checked: boolean) => void;
    onComplete: () => void;
    onCancel: () => void;
    submitting: boolean;
    error: string;
};

export default function OwnerStep1Form(props: Props) {
    const pct = computeCompletion(props.fields, props.declarations);
    const canComplete = pct === 100 && !props.submitting;

    return (
        <div className="space-y-6">
            {/* Header */}
            <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8 md:p-10">
                <div className="space-y-3">
                    <div className="inline-flex rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                        OWNER CREDENTIAL
                    </div>
                    <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
                        屋主身分申請
                    </h1>
                    <p className="max-w-3xl text-sm leading-[1.85] text-on-surface-variant">
                        填寫物件基本資料與建物詳情，並確認聲明。可選擇上傳權狀或所有權證明以提升可信度（非必填）；上傳後可送出智能審核比對物件資料。
                    </p>
                </div>
            </section>

            {/* Completion Progress */}
            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-on-surface">申請完成度</span>
                    <span className="text-sm font-bold text-primary-container">{pct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
                    <div
                        className="h-full rounded-full bg-primary-container transition-all duration-300"
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">
                    填寫所有必填欄位並勾選三項聲明後可提交申請
                </p>
            </section>

            {/* Fields */}
            <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
                <div className="grid gap-4 md:grid-cols-2">
                    {ALL_FIELDS.map((field) => (
                        <label key={field.key} className="space-y-2">
                            <span className="text-sm font-semibold text-on-surface">
                                {field.label}
                                {!field.required && (
                                    <span className="ml-1 text-xs font-normal text-on-surface-variant">（選填）</span>
                                )}
                            </span>
                            <input
                                value={props.fields[field.key] ?? ""}
                                onChange={(e) => props.onFieldChange(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className="w-full rounded-xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-primary-container"
                            />
                        </label>
                    ))}
                </div>
            </section>

            {/* Declarations */}
            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                <p className="text-sm font-bold text-on-surface mb-1">物件聲明（必填）</p>
                <p className="text-xs text-on-surface-variant mb-4">以下三項均需勾選方可提交申請</p>
                <div className="space-y-3">
                    {DECLARATIONS.map((d) => (
                        <label key={d.key} className="flex cursor-pointer items-start gap-3">
                            <input
                                type="checkbox"
                                checked={props.declarations[d.key] ?? false}
                                onChange={(e) => props.onDeclarationChange(d.key, e.target.checked)}
                                className="mt-0.5 h-4 w-4 accent-primary-container"
                            />
                            <span className="text-sm text-on-surface">{d.text}</span>
                        </label>
                    ))}
                </div>
            </section>

            {/* Error */}
            {props.error ? (
                <div className="rounded-2xl border border-error/20 bg-error-container px-5 py-4 text-sm text-on-error-container">
                    {props.error}
                </div>
            ) : null}

            {/* Action Buttons */}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={props.onCancel}
                    disabled={props.submitting}
                    className="flex-1 rounded-xl border border-outline-variant/20 bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                >
                    取消
                </button>
                <button
                    type="button"
                    onClick={props.onComplete}
                    disabled={!canComplete}
                    className="flex-[2] rounded-xl bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {props.submitting ? "建立中..." : `完成（${pct}%）`}
                </button>
            </div>
        </div>
    );
}
