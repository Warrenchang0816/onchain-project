import { Link } from "react-router-dom";
import type { Listing } from "../../api/listingApi";

const STATUS_LABEL: Record<string, string> = {
    DRAFT:        "草稿",
    ACTIVE:       "上架中",
    NEGOTIATING:  "洽談中",
    LOCKED:       "已鎖定",
    SIGNING:      "簽約中",
    CLOSED:       "已結案",
    EXPIRED:      "已到期",
    REMOVED:      "已下架",
    SUSPENDED:    "已停權",
};

const STATUS_CLASS: Record<string, string> = {
    DRAFT:        "badge--gray",
    ACTIVE:       "badge--green",
    NEGOTIATING:  "badge--yellow",
    LOCKED:       "badge--orange",
    SIGNING:      "badge--blue",
    CLOSED:       "badge--gray",
    EXPIRED:      "badge--gray",
    REMOVED:      "badge--red",
    SUSPENDED:    "badge--red",
};

interface Props {
    listing: Listing;
}

const ListingCard = ({ listing }: Props) => {
    const priceLabel = listing.list_type === "RENT"
        ? `NT$ ${listing.price.toLocaleString()} / 月`
        : `NT$ ${listing.price.toLocaleString()}`;

    const meta: string[] = [];
    if (listing.area_ping) meta.push(`${listing.area_ping} 坪`);
    if (listing.room_count) meta.push(`${listing.room_count} 房`);
    if (listing.floor) meta.push(`${listing.floor} 樓`);
    if (listing.is_pet_allowed) meta.push("可養寵");
    if (listing.is_parking_included) meta.push("含車位");

    return (
        <article className="property-card">
            <div className="property-card-cover">
                <span className={`property-card-badge status-badge ${STATUS_CLASS[listing.status] ?? "badge--gray"}`}>
                    {STATUS_LABEL[listing.status] ?? listing.status}
                </span>
                <span className="property-card-chip">
                    {listing.list_type === "RENT" ? "租屋" : "售屋"}
                </span>
            </div>

            <div className="property-card-body">
                <div className="property-card-price">{priceLabel}</div>
                <h3>
                    <Link className="property-card-link" to={`/listings/${listing.id}`}>
                        {listing.title}
                    </Link>
                </h3>
                {listing.district && <p className="property-card-district">{listing.district}</p>}
                <p className="property-card-address">{listing.address}</p>

                {meta.length > 0 && (
                    <div className="property-card-meta">
                        {meta.map((m) => <span key={m}>{m}</span>)}
                    </div>
                )}

                {listing.negotiating_appointment && (
                    <div className="property-card-negotiating">
                        洽談中：第 {listing.negotiating_appointment.queue_position} 組
                    </div>
                )}
            </div>
        </article>
    );
};

export default ListingCard;
