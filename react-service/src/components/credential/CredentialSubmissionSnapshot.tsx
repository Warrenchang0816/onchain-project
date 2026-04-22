type Props = {
    fields: Array<{ key: string; label: string }>;
    values: Record<string, string>;
    notes: string;
    mainFileUrl?: string;
    supportFileUrl?: string;
};

export default function CredentialSubmissionSnapshot(props: Props) {
    return (
        <section className="credential-snapshot">
            <div className="credential-snapshot__fields">
                {props.fields.map((field) => (
                    <div key={field.key} className="credential-snapshot__field">
                        <div className="credential-snapshot__field-label">{field.label}</div>
                        <div className="credential-snapshot__field-value">{props.values[field.key] || "未填寫"}</div>
                    </div>
                ))}
            </div>
            <div className="credential-snapshot__field">
                <div className="credential-snapshot__field-label">補充說明</div>
                <div className="credential-snapshot__field-value">{props.notes || "未填寫"}</div>
            </div>
            {props.mainFileUrl ? (
                <img src={props.mainFileUrl} alt="主文件預覽" className="credential-snapshot__image" />
            ) : null}
            {props.supportFileUrl ? (
                <img src={props.supportFileUrl} alt="補充文件預覽" className="credential-snapshot__image" />
            ) : null}
        </section>
    );
}
