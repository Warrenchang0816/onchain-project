import type { UpdatePropertyPayload } from "@/api/propertyApi";

export const REQUIRED_FIELD_KEYS = [
    "propertyAddress",
    "buildingType",
    "floor",
    "mainArea",
    "rooms",
    "buildingAge",
    "buildingStructure",
    "exteriorMaterial",
    "buildingUsage",
    "zoning",
] as const;

export const DECLARATION_KEYS = ["no_sea_sand", "no_radiation", "no_haunted"] as const;

export const TOTAL_COMPLETION_ITEMS = REQUIRED_FIELD_KEYS.length + DECLARATION_KEYS.length; // 13

export function computeCompletion(
    fields: Record<string, string>,
    declarations: Record<string, boolean>,
): number {
    const filledFields = REQUIRED_FIELD_KEYS.filter((k) => fields[k]?.trim()).length;
    const checked = DECLARATION_KEYS.filter((k) => declarations[k] === true).length;
    return Math.round(((filledFields + checked) / TOTAL_COMPLETION_ITEMS) * 100);
}

function parseFloor(value: string): Pick<UpdatePropertyPayload, "floor" | "total_floors"> {
    const parts = value
        .split(/[/\\／]/)
        .map((p) => parseInt(p.replace(/[^0-9]/g, ""), 10));
    return {
        floor: isNaN(parts[0]) ? undefined : parts[0],
        total_floors: parts.length > 1 && !isNaN(parts[1]) ? parts[1] : undefined,
    };
}

function parseRooms(
    value: string,
): Pick<UpdatePropertyPayload, "rooms" | "living_rooms" | "bathrooms"> {
    const roomMatch = value.match(/(\d+)\s*房/);
    const livingMatch = value.match(/(\d+)\s*廳/);
    const bathroomMatch = value.match(/(\d+)\s*衛/);
    return {
        rooms: roomMatch ? parseInt(roomMatch[1], 10) : undefined,
        living_rooms: livingMatch ? parseInt(livingMatch[1], 10) : undefined,
        bathrooms: bathroomMatch ? parseInt(bathroomMatch[1], 10) : undefined,
    };
}

const BUILDING_TYPE_MAP: Record<string, string> = {
    大樓: "BUILDING",
    公寓: "APARTMENT",
    透天: "TOWNHOUSE",
    店面: "STUDIO",
};

export function parsePropertyFields(fields: Record<string, string>): UpdatePropertyPayload {
    const result: UpdatePropertyPayload = {};

    const bt = BUILDING_TYPE_MAP[fields.buildingType?.trim() ?? ""];
    if (bt) result.building_type = bt;

    if (fields.floor?.trim()) Object.assign(result, parseFloor(fields.floor));

    const area = parseFloat(fields.mainArea ?? "");
    if (!isNaN(area)) result.main_area = area;

    if (fields.rooms?.trim()) Object.assign(result, parseRooms(fields.rooms));

    const age = parseInt(fields.buildingAge ?? "", 10);
    if (!isNaN(age)) result.building_age = age;

    if (fields.buildingStructure?.trim()) result.building_structure = fields.buildingStructure;
    if (fields.exteriorMaterial?.trim()) result.exterior_material = fields.exteriorMaterial;
    if (fields.buildingUsage?.trim()) result.building_usage = fields.buildingUsage;
    if (fields.zoning?.trim()) result.zoning = fields.zoning;

    return result;
}
