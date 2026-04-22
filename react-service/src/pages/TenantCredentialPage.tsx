import CredentialRolePage from "@/components/credential/CredentialRolePage";

const TENANT_FIELDS = [
    { key: "holderName", label: "申請人姓名", placeholder: "請填寫與 KYC 一致的姓名" },
    { key: "employerOrSchool", label: "任職公司或就讀學校", placeholder: "例如：屋柱科技股份有限公司" },
    { key: "incomeHint", label: "收入或支付能力說明", placeholder: "例如：每月固定薪資 60,000 元" },
];

export default function TenantCredentialPage() {
    return (
        <CredentialRolePage
            credentialType="TENANT"
            title="租客身份認證"
            description="提交可說明租住能力的文件後，可先走智能審核；若不採用智能結果，也可自行改走人工審核。通過後是否啟用身份 NFT，仍由你最後決定。"
            primaryFields={TENANT_FIELDS}
        />
    );
}
