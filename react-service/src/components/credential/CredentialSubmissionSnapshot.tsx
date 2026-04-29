const CHECK_LABELS: Record<string, string> = {
    keyword: "關鍵字符合",
    nameMatch: "姓名比對",
    addressHint: "地址提供",
    licenseNumber: "證照號碼比對",
    credentialType: "身份類型",
};

type Props = {
    fields: Array<{ key: string; label: string }>;
    values: Record<string, string>;
    notes: string;
    mainFileUrl?: string;
    supportFileUrl?: string;
    checks?: Record<string, string>;
};

function SnapshotField(props: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">{props.label}</div>
            <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-[1.8] text-on-surface">
                {props.value || "未填寫"}
            </div>
        </div>
    );
}

function SnapshotImageCard(props: { title: string; imageUrl?: string }) {
    return (
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">{props.title}</div>
            {props.imageUrl ? (
                <div className="mt-3 flex min-h-[300px] items-center justify-center overflow-hidden rounded-2xl border border-outline-variant/15 bg-white p-4">
                    <img src={props.imageUrl} alt={props.title} className="block max-h-[380px] w-full object-contain" />
                </div>
            ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-outline-variant/20 bg-surface px-4 py-12 text-center text-sm text-on-surface-variant">
                    尚未提供文件
                </div>
            )}
        </div>
    );
}

function checkValueDisplay(value: string): { label: string; className: string } {
    if (value === "PASS") return { label: "通過", className: "text-tertiary" };
    if (value === "FAIL") return { label: "未通過", className: "text-error" };
    return { label: value, className: "text-on-surface-variant" };
}

function CheckResultPanel(props: { checks: Record<string, string> }) {
    const entries = Object.entries(props.checks);
    if (entries.length === 0) return null;
    return (
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">審核項目明細</div>
            <div className="mt-3 divide-y divide-outline-variant/10">
                {entries.map(([key, value]) => {
                    const display = checkValueDisplay(value);
                    return (
                        <div key={key} className="flex items-center justify-between py-2">
                            <span className="text-sm text-on-surface">{CHECK_LABELS[key] ?? key}</span>
                            <span className={`text-xs font-bold ${display.className}`}>
                                {display.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function CredentialSubmissionSnapshot(props: Props) {
    return (
        <section className="rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-8">
            <div className="space-y-6">
                <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">送件成品</div>
                    <h2 className="text-2xl font-bold text-on-surface">已送出的身份認證資料</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    {props.fields.map((field) => (
                        <SnapshotField key={field.key} label={field.label} value={props.values[field.key] ?? ""} />
                    ))}
                </div>

                <SnapshotField label="補充說明" value={props.notes} />

                {props.checks && Object.keys(props.checks).length > 0 ? (
                    <CheckResultPanel checks={props.checks} />
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                    <SnapshotImageCard title="主要文件" imageUrl={props.mainFileUrl} />
                    <SnapshotImageCard title="補充文件" imageUrl={props.supportFileUrl} />
                </div>
            </div>
        </section>
    );
}
