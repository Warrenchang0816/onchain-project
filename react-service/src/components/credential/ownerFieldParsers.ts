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

export function parsePropertyFields(fields: Record<string, string>): UpdatePropertyPayload {
    const result: UpdatePropertyPayload = {};

    if (fields.buildingType) result.building_type = fields.buildingType;

    const floor = parseInt(fields.floor ?? "", 10);
    if (!isNaN(floor)) result.floor = floor;

    const totalFloors = parseInt(fields.total_floors ?? "", 10);
    if (!isNaN(totalFloors)) result.total_floors = totalFloors;

    const area = parseFloat(fields.mainArea ?? "");
    if (!isNaN(area)) result.main_area = area;

    const rooms = parseInt(fields.rooms ?? "", 10);
    if (!isNaN(rooms)) result.rooms = rooms;

    const livingRooms = parseInt(fields.living_rooms ?? "", 10);
    if (!isNaN(livingRooms)) result.living_rooms = livingRooms;

    const bathrooms = parseInt(fields.bathrooms ?? "", 10);
    if (!isNaN(bathrooms)) result.bathrooms = bathrooms;

    const age = parseInt(fields.buildingAge ?? "", 10);
    if (!isNaN(age)) result.building_age = age;

    if (fields.buildingStructure?.trim()) result.building_structure = fields.buildingStructure;
    if (fields.exteriorMaterial?.trim()) result.exterior_material = fields.exteriorMaterial;
    if (fields.buildingUsage?.trim()) result.building_usage = fields.buildingUsage;
    if (fields.zoning?.trim()) result.zoning = fields.zoning;

    return result;
}
