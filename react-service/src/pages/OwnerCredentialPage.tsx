import CredentialRolePage from "@/components/credential/CredentialRolePage";

const OWNER_FIELDS = [
    // Existing fields
    { key: "propertyAddress", label: "房屋地址", placeholder: "請填寫本次申請對應的房屋地址" },
    { key: "ownershipDocNo",  label: "權狀字號", placeholder: "若權狀或稅籍資料有字號請填寫" },
    // Basic info
    { key: "buildingType",    label: "建物類型", placeholder: "大樓 / 公寓 / 透天 / 店面" },
    { key: "floor",           label: "樓層 / 總樓層", placeholder: "例：5F / 24F" },
    { key: "mainArea",        label: "主建物面積（坪）", placeholder: "例：38" },
    { key: "rooms",           label: "格局（房 / 廳 / 衛）", placeholder: "例：3 房 2 廳 2 衛" },
    { key: "buildingAge",     label: "屋齡（年）", placeholder: "例：10" },
    // Building details
    { key: "buildingStructure", label: "建物結構", placeholder: "例：鋼骨鋼筋混凝土" },
    { key: "exteriorMaterial",  label: "外牆建材", placeholder: "例：石材" },
    { key: "buildingUsage",     label: "謄本用途", placeholder: "例：集合住宅" },
    { key: "zoning",            label: "使用分區", placeholder: "例：第一種住宅區" },
];

const OWNER_DECLARATIONS = [
    { key: "no_sea_sand", text: "本物件非海砂屋，無使用海砂混凝土之情形" },
    { key: "no_radiation", text: "本物件非輻射屋，未受輻射污染" },
    { key: "no_haunted", text: "本物件非凶宅，近期無發生非自然死亡事件" },
];

export default function OwnerCredentialPage() {
    return (
        <CredentialRolePage
            credentialType="OWNER"
            title="屋主身分申請"
            description="填寫物件基本資料與建物詳情，並確認聲明。可選擇上傳權狀或所有權證明以提升可信度（非必填）；上傳後可送出智能審核比對物件資料。"
            primaryFields={OWNER_FIELDS}
            declarations={OWNER_DECLARATIONS}
            mainDocRequired={false}
        />
    );
}
