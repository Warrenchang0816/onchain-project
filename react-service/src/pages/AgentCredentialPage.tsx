import CredentialRolePage from "@/components/credential/CredentialRolePage";

const AGENT_FIELDS = [
    { key: "licenseNumber", label: "證照字號", placeholder: "例如：ABC123456" },
    { key: "brokerageName", label: "任職仲介公司", placeholder: "例如：去中心化房屋仲介" },
];

export default function AgentCredentialPage() {
    return (
        <CredentialRolePage
            credentialType="AGENT"
            title="仲介身分申請"
            description="仲介身分是 KYC 後的下一階認證。姓名會直接使用 KYC 資料，請填寫證照與公司資訊並上傳佐證文件，通過後可建立公開仲介專頁。"
            primaryFields={AGENT_FIELDS}
        />
    );
}
