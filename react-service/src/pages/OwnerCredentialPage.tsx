import CredentialRolePage from "@/components/credential/CredentialRolePage";

const OWNER_FIELDS = [
    { key: "propertyAddress", label: "房屋地址", placeholder: "請填寫本次申請對應的房屋地址" },
    { key: "ownershipDocNo", label: "權狀字號", placeholder: "若權狀或稅籍資料有字號請填寫" },
];

export default function OwnerCredentialPage() {
    return (
        <CredentialRolePage
            credentialType="OWNER"
            title="屋主身分申請"
            description="屋主身分是 KYC 後的下一階認證。姓名會直接使用 KYC 資料，請上傳產權或稅籍佐證；智能審核通過並啟用後，平台會建立第一筆待補齊房源草稿。"
            primaryFields={OWNER_FIELDS}
        />
    );
}
