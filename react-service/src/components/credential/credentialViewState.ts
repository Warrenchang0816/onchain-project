export type CredentialDisplayState =
    | "NOT_STARTED"
    | "SMART_REVIEWING"
    | "MANUAL_REVIEWING"
    | "STOPPED"
    | "PASSED_READY"
    | "FAILED"
    | "ACTIVATED"
    | "REVOKED";

export type CredentialDetailLike =
    | {
          displayStatus: CredentialDisplayState;
      }
    | null
    | undefined;

export function shouldRenderSnapshot(detail: CredentialDetailLike, forceEditMode: boolean): boolean {
    return !forceEditMode && Boolean(detail && detail.displayStatus !== "NOT_STARTED");
}

export function shouldRenderForm(detail: CredentialDetailLike, forceEditMode: boolean): boolean {
    return forceEditMode || !detail || detail.displayStatus === "NOT_STARTED";
}

export function getSnapshotActionCopy(status: CredentialDisplayState): { title: string; description: string } {
    switch (status) {
        case "FAILED":
            return {
                title: "可以重新送審",
                description: "你可以先檢視這份送件成品，再決定重新跑智能審核、改送人工審核，或重新開一份新的申請。",
            };
        case "MANUAL_REVIEWING":
            return {
                title: "人工審核中",
                description: "目前申請已送入人工審核。你可以查看送件成品，若暫時不想等待，也可以停止審核。",
            };
        case "STOPPED":
            return {
                title: "審核已停止",
                description: "這份申請已停止審核。若要重新申請，可以從下方重新審核重新開始。",
            };
        case "PASSED_READY":
            return {
                title: "審核已通過",
                description: "請先檢視送件成品；若確認資料無誤，就可以啟用身份並鑄造 NFT 憑證。",
            };
        case "ACTIVATED":
            return {
                title: "身份已啟用",
                description: "這份送件成品已完成啟用，你仍可以在這裡回看當時送出的資料與文件。",
            };
        case "SMART_REVIEWING":
            return {
                title: "智能審核中",
                description: "系統正在處理這份送件資料。智能審核完成後，頁面會更新成最新結果。",
            };
        case "REVOKED":
            return {
                title: "身份已撤銷",
                description: "這份身份目前已撤銷。若要重新申請，請依下方操作重新送件。",
            };
        case "NOT_STARTED":
        default:
            return {
                title: "送件成品",
                description: "這裡會顯示你送出的身份認證資料與文件。",
            };
    }
}
