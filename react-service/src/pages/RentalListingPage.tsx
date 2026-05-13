import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProperty, type Property } from "../api/propertyApi";
import SiteLayout from "../layouts/SiteLayout";
import RentalListingForm from "../components/listing/RentalListingForm";

export default function RentalListingPage() {
    const { id } = useParams<{ id: string }>();
    const propertyId = parseInt(id ?? "", 10);
    const [property, setProperty] = useState<Property | null>(null);

    useEffect(() => {
        getProperty(propertyId).then(setProperty).catch(console.error);
    }, [propertyId]);

    if (!property) return (
        <SiteLayout>
            <div className="p-12 text-sm text-on-surface-variant">載入中...</div>
        </SiteLayout>
    );

    return (
        <SiteLayout>
            <main className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 py-12 md:px-12">
                <Link
                    to={`/my/properties/${propertyId}`}
                    className="text-sm text-on-surface-variant hover:text-primary-container"
                >
                    ← 返回物件編輯
                </Link>
                <RentalListingForm propertyId={propertyId} property={property} />
            </main>
        </SiteLayout>
    );
}
