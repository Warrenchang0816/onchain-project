import CredentialRolePage from "@/components/credential/CredentialRolePage";

const OWNER_FIELDS = [
    { key: "holderName", label: "持有人姓名", placeholder: "請填寫與 KYC 一致的姓名" },
    { key: "propertyAddress", label: "房屋地址", placeholder: "請填寫本次申請對應的房屋地址" },
    { key: "ownershipDocNo", label: "權狀字號", placeholder: "可填寫文件上的權狀字號" },
];

export default function OwnerCredentialPage() {
    return (
        <CredentialRolePage
            credentialType="OWNER"
            title="屋主身份認證"
            description="提交權狀與相關文件後，可先走智能審核；若不採用智能結果，也可自行改走人工審核。通過後是否啟用身份 NFT，仍由你最後決定。"
            primaryFields={OWNER_FIELDS}
        />
    );
}
