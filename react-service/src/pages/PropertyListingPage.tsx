import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProperty, type Property } from "../api/propertyApi";
import SiteLayout from "../layouts/SiteLayout";
import RentalListingForm from "../components/listing/RentalListingForm";
import SaleListingForm from "../components/listing/SaleListingForm";

type ActiveTab = "RENT" | "SALE";

export default function PropertyListingPage() {
    const { id } = useParams<{ id: string }>();
    const propertyId = parseInt(id ?? "", 10);
    const [property, setProperty] = useState<Property | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>("RENT");

    useEffect(() => {
        getProperty(propertyId).then(setProperty).catch(console.error);
    }, [propertyId]);

    if (!property) return (
        <SiteLayout>
            <div className="p-12 text-sm text-on-surface-variant">載入中...</div>
        </SiteLayout>
    );

    if (property.setup_status !== "READY") return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 py-12 md:px-12">
                <Link
                    to="/my/properties"
                    className="text-sm text-on-surface-variant hover:text-primary-container"
                >
                    ← 返回我的物件
                </Link>
                <p className="text-sm text-on-surface-variant">
                    此物件尚未完成設定（setup_status: {property.setup_status}），無法上架。請先補齊必填欄位。
                </p>
            </main>
        </SiteLayout>
    );

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 py-12 md:px-12">
                <div className="flex flex-col gap-2">
                    <Link
                        to="/my/properties"
                        className="text-sm text-on-surface-variant hover:text-primary-container"
                    >
                        ← 返回我的物件
                    </Link>
                    <h1 className="text-4xl font-extrabold text-on-surface">上架刊登</h1>
                    <p className="text-sm text-on-surface-variant">{property.address}</p>
                </div>

                <div className="flex border-b border-outline-variant/20">
                    <button
                        type="button"
                        onClick={() => setActiveTab("RENT")}
                        className={`px-6 py-3 text-sm font-semibold transition-colors ${
                            activeTab === "RENT"
                                ? "border-b-2 border-primary-container text-on-surface"
                                : "text-on-surface-variant hover:text-on-surface"
                        }`}
                    >
                        出租
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("SALE")}
                        className={`px-6 py-3 text-sm font-semibold transition-colors ${
                            activeTab === "SALE"
                                ? "border-b-2 border-primary-container text-on-surface"
                                : "text-on-surface-variant hover:text-on-surface"
                        }`}
                    >
                        出售
                    </button>
                </div>

                {activeTab === "RENT" && (
                    <RentalListingForm propertyId={propertyId} property={property} />
                )}
                {activeTab === "SALE" && (
                    <SaleListingForm propertyId={propertyId} property={property} />
                )}
            </main>
        </SiteLayout>
    );
}
