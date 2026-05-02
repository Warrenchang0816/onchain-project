import type { Listing, ListingType } from "../../api/listingApi";

export type ListingDisplayMode = "public" | "ownerPreview" | "print";

export type DisplayStat = {
    label: string;
    value: string;
};

export type DisplayChip = {
    label: string;
    tone: "neutral" | "primary" | "success" | "warning" | "danger";
};

export type ListingDisplayModel = {
    id: number;
    type: ListingType;
    title: string;
    address: string;
    district: string;
    description: string;
    statusLabel: string;
    setupLabel: string;
    priceLabel: string;
    priceCaption: string;
    coverImageUrl?: string;
    generatedAtLabel: string;
    updatedAtLabel: string;
    heroStats: DisplayStat[];
    listStats: DisplayStat[];
    saleFacts: DisplayStat[];
    rentFacts: DisplayStat[];
    featureChips: DisplayChip[];
    trustFacts: DisplayStat[];
    missingFields: string[];
    canShowVisitorActions: boolean;
};

const STATUS_LABEL: Record<string, string> = {
    DRAFT: "草稿",
    ACTIVE: "刊登中",
    NEGOTIATING: "洽談中",
    LOCKED: "已鎖定",
    SIGNING: "簽約中",
    CLOSED: "已成交",
    EXPIRED: "已到期",
    REMOVED: "已下架",
    SUSPENDED: "已暫停",
};

function formatDateTime(value?: string): string {
    if (!value) return "未提供";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "未提供";
    return new Intl.DateTimeFormat("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function formatNumber(value?: number): string {
    if (value === undefined || value === null || Number.isNaN(value)) return "未提供";
    return value.toLocaleString("zh-TW");
}

function formatPing(value?: number): string {
    if (value === undefined || value <= 0) return "未提供";
    return `${formatNumber(value)}坪`;
}

function formatCurrency(value?: number): string {
    if (value === undefined || value <= 0) return "未提供";
    return `NT$ ${value.toLocaleString("zh-TW")}`;
}

function formatLayout(listing: Listing): string {
    const rooms = listing.room_count;
    const baths = listing.bathroom_count;
    if (rooms === undefined && baths === undefined) return "未提供";
    if (rooms !== undefined && baths !== undefined) return `${rooms}房 / ${baths}衛`;
    if (rooms !== undefined) return `${rooms}房`;
    return `${baths}衛`;
}

function formatFloor(listing: Listing): string {
    if (listing.floor === undefined && listing.total_floors === undefined) return "未提供";
    if (listing.floor !== undefined && listing.total_floors !== undefined) return `${listing.floor}樓 / ${listing.total_floors}樓`;
    if (listing.floor !== undefined) return `${listing.floor}樓`;
    return `共 ${listing.total_floors}樓`;
}

function missingCommonFields(listing: Listing): string[] {
    const missing: string[] = [];
    if (!listing.title.trim()) missing.push("標題");
    if (!listing.address.trim()) missing.push("地址");
    if (listing.price <= 0) missing.push(listing.list_type === "RENT" ? "月租金" : "價格");
    if (!listing.image_url) missing.push("封面照片");
    if (listing.area_ping === undefined || listing.area_ping <= 0) missing.push("坪數");
    if (listing.room_count === undefined) missing.push("房數");
    if (listing.bathroom_count === undefined) missing.push("衛浴數");
    return missing;
}

function missingSaleFields(listing: Listing): string[] {
    if (listing.list_type !== "SALE") return [];
    const missing: string[] = [];
    if (!listing.sale_details) return ["賣屋詳細資料"];
    if (listing.sale_details.sale_total_price <= 0) missing.push("總價");
    if (listing.sale_details.main_building_ping === undefined) missing.push("主建物坪數");
    return missing;
}

function missingRentFields(listing: Listing): string[] {
    if (listing.list_type !== "RENT") return [];
    const missing: string[] = [];
    if (!listing.rent_details) return ["出租詳細資料"];
    if (listing.rent_details.monthly_rent <= 0) missing.push("月租金");
    if (listing.rent_details.deposit_months <= 0) missing.push("押金");
    if (listing.rent_details.minimum_lease_months <= 0) missing.push("最短租期");
    return missing;
}

function buildFeatureChips(listing: Listing): DisplayChip[] {
    const chips: DisplayChip[] = [];
    if (listing.is_pet_allowed) chips.push({ label: "可寵物", tone: "success" });
    if (listing.is_parking_included) chips.push({ label: "含車位", tone: "primary" });
    if (listing.rent_details?.can_cook) chips.push({ label: "可開伙", tone: "success" });
    if (listing.rent_details?.can_register_household) chips.push({ label: "可設籍", tone: "success" });
    if (listing.sale_details?.parking_space_type) chips.push({ label: listing.sale_details.parking_space_type, tone: "primary" });
    if (chips.length === 0) chips.push({ label: "尚未標註特色", tone: "neutral" });
    return chips;
}

export function buildListingDisplayModel(listing: Listing, now: Date = new Date()): ListingDisplayModel {
    const isRent = listing.list_type === "RENT";
    const isSale = listing.list_type === "SALE";
    const rentPrice = listing.rent_details?.monthly_rent || listing.price;
    const salePrice = listing.sale_details?.sale_total_price || listing.price;
    const priceLabel = isRent ? `${formatCurrency(rentPrice)} / 月` : isSale ? formatCurrency(salePrice) : formatCurrency(listing.price);
    const priceCaption = isRent ? "月租金" : isSale ? "總價" : "價格";

    const heroStats: DisplayStat[] = [
        { label: "坪數", value: formatPing(listing.area_ping) },
        { label: "格局", value: formatLayout(listing) },
        { label: "樓層", value: formatFloor(listing) },
    ];

    const saleFacts: DisplayStat[] = listing.sale_details
        ? [
              { label: "總價", value: formatCurrency(listing.sale_details.sale_total_price) },
              { label: "單價", value: formatCurrency(listing.sale_details.sale_unit_price_per_ping) },
              { label: "主建物", value: formatPing(listing.sale_details.main_building_ping) },
              { label: "附屬建物", value: formatPing(listing.sale_details.auxiliary_building_ping) },
              { label: "陽台", value: formatPing(listing.sale_details.balcony_ping) },
              { label: "土地", value: formatPing(listing.sale_details.land_ping) },
              { label: "車位", value: listing.sale_details.parking_space_type || "未提供" },
              { label: "車位價格", value: formatCurrency(listing.sale_details.parking_space_price) },
          ]
        : [];

    const rentFacts: DisplayStat[] = listing.rent_details
        ? [
              { label: "月租金", value: `${formatCurrency(listing.rent_details.monthly_rent)} / 月` },
              { label: "押金", value: `${listing.rent_details.deposit_months}個月` },
              { label: "管理費", value: `${formatCurrency(listing.rent_details.management_fee_monthly)} / 月` },
              { label: "最短租期", value: `${listing.rent_details.minimum_lease_months}個月` },
              { label: "可設籍", value: listing.rent_details.can_register_household ? "可以" : "不可以" },
              { label: "可開伙", value: listing.rent_details.can_cook ? "可以" : "不可以" },
              { label: "可寵物", value: listing.is_pet_allowed ? "可以" : "不可以" },
              { label: "車位", value: listing.is_parking_included ? "含車位" : "未標示" },
          ]
        : [];

    const trustFacts: DisplayStat[] = [
        { label: "物件驗證", value: listing.property?.verification_status || "未提供" },
        { label: "完整度", value: listing.property?.completeness_status || listing.setup_status },
        { label: "產權雜湊", value: listing.property?.deed_hash || "未提供" },
        { label: "揭露雜湊", value: listing.property?.disclosure_hash || "未提供" },
    ];

    return {
        id: listing.id,
        type: listing.list_type,
        title: listing.title || "未命名物件",
        address: listing.address || "未提供地址",
        district: listing.district || "未提供行政區",
        description: listing.description || "",
        statusLabel: STATUS_LABEL[listing.status] ?? listing.status,
        setupLabel: listing.setup_status === "READY" ? "資料完整" : "資料未完整",
        priceLabel,
        priceCaption,
        coverImageUrl: listing.image_url,
        generatedAtLabel: formatDateTime(now.toISOString()),
        updatedAtLabel: formatDateTime(listing.updated_at),
        heroStats,
        listStats: [
            { label: "行政區", value: listing.district || "未提供" },
            { label: "坪數", value: formatPing(listing.area_ping) },
            { label: "格局", value: formatLayout(listing) },
            { label: "樓層", value: formatFloor(listing) },
        ],
        saleFacts,
        rentFacts,
        featureChips: buildFeatureChips(listing),
        trustFacts,
        missingFields: [...missingCommonFields(listing), ...missingSaleFields(listing), ...missingRentFields(listing)],
        canShowVisitorActions: listing.status === "ACTIVE",
    };
}
