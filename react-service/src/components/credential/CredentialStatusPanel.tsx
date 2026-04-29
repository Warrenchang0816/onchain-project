import type { CredentialCenterItem, CredentialDisplayStatus } from "@/api/credentialApi";
import { CREDENTIAL_STATUS_LABEL } from "./credentialStatusLabels";

const STATUS_HELP_TEXT: Record<CredentialDisplayStatus, string> = {
    NOT_STARTED: "可先走智能審核，若不採用結果也可改送人工審核。",
    SMART_REVIEWING: "資料已送出，系統正在整理智能判定結果。",
    MANUAL_REVIEWING: "案件已改送人工審核，請等待平台回覆結果。",
    STOPPED: "你已停止這次人工審核，如需繼續請重新發起一筆新申請。",
    PASSED_READY: "結果已通過，是否啟用 NFT 憑證由你自行決定。",
    FAILED: "本次申請未通過，你可以重新送智能審核或改走人工審核。",
    ACTIVATED: "此身份 NFT 憑證已啟用，可回身份中心查看狀態。",
    REVOKED: "此身份憑證已被撤銷，如需恢復請重新提出申請。",
};

function badgeClass(status: CredentialDisplayStatus): string {
    if (status === "ACTIVATED") return "border-tertiary/20 bg-tertiary/10 text-tertiary";
    if (status === "PASSED_READY") return "border-secondary/20 bg-secondary/10 text-secondary";
    if (status === "FAILED" || status === "REVOKED") return "border-error/20 bg-error/10 text-error";
    if (status === "MANUAL_REVIEWING") return "border-amber-700/20 bg-amber-700/10 text-amber-700";
    if (status === "STOPPED") return "border-outline-variant/20 bg-surface-container text-on-surface-variant";
    return "border-outline-variant/20 bg-surface-container text-on-surface-variant";
}

function shortenTxHash(txHash?: string): string | null {
    if (!txHash) return null;
    if (txHash.length < 14) return txHash;
    return `${txHash.slice(0, 8)}...${txHash.slice(-6)}`;
}

export default function CredentialStatusPanel(props: { item?: CredentialCenterItem }) {
    const status = props.item?.displayStatus ?? "NOT_STARTED";
    const summary = props.item?.summary?.trim();
    const txHash = props.item?.activationTxHash?.trim();

    return (
        <section className="space-y-4 rounded-[28px] border border-outline-variant/15 bg-surface-container-lowest p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">目前狀態</div>
                    <h2 className="text-2xl font-bold text-on-surface">{CREDENTIAL_STATUS_LABEL[status]}</h2>
                </div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${badgeClass(status)}`}>
                    {CREDENTIAL_STATUS_LABEL[status]}
                </span>
            </div>

            <p className="text-sm leading-[1.8] text-on-surface-variant">{summary || STATUS_HELP_TEXT[status]}</p>

            {txHash ? (
                <div className="rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                    啟用交易：
                    <span className="ml-2 font-semibold text-on-surface">{shortenTxHash(txHash)}</span>
                </div>
            ) : null}
        </section>
    );
}
