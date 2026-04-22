import CredentialRolePage from "@/components/credential/CredentialRolePage";

const AGENT_FIELDS = [
    { key: "holderName", label: "執業人姓名", placeholder: "請填寫與 KYC 一致的姓名" },
    { key: "licenseNumber", label: "證照字號", placeholder: "例如：ABC123456" },
    { key: "brokerageName", label: "服務品牌或公司", placeholder: "例如：屋柱安心仲介" },
];

export default function AgentCredentialPage() {
    return (
        <CredentialRolePage
            credentialType="AGENT"
            title="仲介身份認證"
            description="提交證照或執業相關文件後，可先走智能審核；若不採用智能結果，也可自行改走人工審核。通過後是否啟用身份 NFT，仍由你最後決定。"
            primaryFields={AGENT_FIELDS}
        />
    );
}
