import type { Listing } from "../types/listing";

export interface ListingSummary {
    total: number;
    completed: number;
    pending: number;
}

export const getListingSummary = (listings: Listing[]): ListingSummary => {
    const total = listings.length;
    const completed = listings.filter((listing) => listing.status === "COMPLETED").length;
    const pending = listings.filter((listing) => listing.status === "OPEN").length;

    return {
        total,
        completed,
        pending,
    };
};

export const getRecentListings = (listings: Listing[], limit = 3): Listing[] => {
    return [...listings].slice(0, limit);
};
