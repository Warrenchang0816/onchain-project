import { computeCompletion } from "./ownerFieldParsers";

const inputCls =
    "w-full rounded-xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-primary-container";
const selectCls = inputCls;
const labelCls = "text-xs font-semibold text-on-surface-variant";

const DECLARATIONS = [
    { key: "no_sea_sand", text: "本物件非海砂屋，無使用海砂混凝土之情形" },
    { key: "no_radiation", text: "本物件非輻射屋，未受輻射污染" },
    { key: "no_haunted", text: "本物件非凶宅，近期無發生非自然死亡事件" },
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
    const f = (key: string) => props.fields[key] ?? "";
    const set = props.onFieldChange;

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8 md:p-10">
                <div className="space-y-3">
                    <div className="inline-flex rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                        OWNER CREDENTIAL
                    </div>
                    <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">屋主身分申請</h1>
                    <p className="max-w-3xl text-sm leading-[1.85] text-on-surface-variant">
                        填寫物件基本資料與建物詳情，並確認聲明。可選擇上傳權狀或所有權證明以提升可信度（非必填）；上傳後可送出智能審核比對物件資料。
                    </p>
                </div>
            </section>

            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-on-surface">申請完成度</span>
                    <span className="text-sm font-bold text-primary-container">{pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                    <div className="h-full rounded-full bg-primary-container transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">填寫所有必填欄位並勾選三項聲明後可提交申請</p>
            </section>

            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                <h2 className="mb-6 text-lg font-bold text-on-surface">物件地址</h2>
                <div className="grid gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                        <label className={labelCls}>房屋地址 *</label>
                        <input
                            type="text"
                            value={f("propertyAddress")}
                            onChange={(e) => set("propertyAddress", e.target.value)}
                            className={inputCls}
                            placeholder="請填寫本次申請對應的房屋地址"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                        <label className={labelCls}>權狀字號（選填）</label>
                        <input
                            type="text"
                            value={f("ownershipDocNo")}
                            onChange={(e) => set("ownershipDocNo", e.target.value)}
                            className={inputCls}
                            placeholder="若權狀或稅籍資料有字號請填寫"
                        />
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                <h2 className="mb-6 text-lg font-bold text-on-surface">建物規格</h2>
                <div className="grid gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>建物類型 *</label>
                        <select value={f("buildingType")} onChange={(e) => set("buildingType", e.target.value)} className={selectCls}>
                            <option value="">請選擇</option>
                            <option value="APARTMENT">公寓</option>
                            <option value="BUILDING">大樓</option>
                            <option value="TOWNHOUSE">透天</option>
                            <option value="STUDIO">套房</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>主建物坪數 *</label>
                        <input type="number" value={f("mainArea")} onChange={(e) => set("mainArea", e.target.value)} className={inputCls} placeholder="例：38" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>樓層 *</label>
                        <input type="number" value={f("floor")} onChange={(e) => set("floor", e.target.value)} className={inputCls} placeholder="例：5" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>總樓層</label>
                        <input type="number" value={f("total_floors")} onChange={(e) => set("total_floors", e.target.value)} className={inputCls} placeholder="例：24" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>房間數 *</label>
                        <input type="number" value={f("rooms")} onChange={(e) => set("rooms", e.target.value)} className={inputCls} placeholder="例：3" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>客廳數</label>
                        <input type="number" value={f("living_rooms")} onChange={(e) => set("living_rooms", e.target.value)} className={inputCls} placeholder="例：2" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>衛浴數</label>
                        <input type="number" value={f("bathrooms")} onChange={(e) => set("bathrooms", e.target.value)} className={inputCls} placeholder="例：2" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>屋齡（年）*</label>
                        <input type="number" value={f("buildingAge")} onChange={(e) => set("buildingAge", e.target.value)} className={inputCls} placeholder="例：10" />
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                <h2 className="mb-6 text-lg font-bold text-on-surface">建物詳情</h2>
                <div className="grid gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>建物結構 *</label>
                        <input
                            type="text"
                            value={f("buildingStructure")}
                            onChange={(e) => set("buildingStructure", e.target.value)}
                            className={inputCls}
                            placeholder="例：鋼骨鋼筋混凝土"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>外牆建材 *</label>
                        <input
                            type="text"
                            value={f("exteriorMaterial")}
                            onChange={(e) => set("exteriorMaterial", e.target.value)}
                            className={inputCls}
                            placeholder="例：石材"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>謄本用途 *</label>
                        <input
                            type="text"
                            value={f("buildingUsage")}
                            onChange={(e) => set("buildingUsage", e.target.value)}
                            className={inputCls}
                            placeholder="例：集合住宅"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>使用分區 *</label>
                        <input
                            type="text"
                            value={f("zoning")}
                            onChange={(e) => set("zoning", e.target.value)}
                            className={inputCls}
                            placeholder="例：第一種住宅區"
                        />
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6">
                <p className="mb-1 text-sm font-bold text-on-surface">物件聲明（必填）</p>
                <p className="mb-4 text-xs text-on-surface-variant">以下三項均需勾選方可提交申請</p>
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

            {props.error ? (
                <div className="rounded-2xl border border-error/20 bg-error-container px-5 py-4 text-sm text-on-error-container">{props.error}</div>
            ) : null}

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
