import type { Taxon } from "./taxon";



export const PlantingPlace = {
    INDOOR: "Indoor",
    OUTDOOR: "Outdoor",
    BOTH: "Indoor & Outdoor",
} as const;

export type PlantingPlace = typeof PlantingPlace[keyof typeof PlantingPlace];

export interface Plant {
    id: string;
    taxon_id?: string;
    scientific_name?: string;
    common_name: string;
    category: string;
    planting_place: PlantingPlace;
    description?: string;
    care_data?: Record<string, any>;
    icon_url?: string;
    image_url?: string;
    created_at: string;
    taxon?: Taxon;
}

export type PlantResponse = Plant;

export interface PlantCreate {
    taxon_id?: string;
    scientific_name?: string;
    common_name: string;
    category: string;
    planting_place: PlantingPlace;
    description?: string;
    care_data?: Record<string, any>;
    icon_url?: string;
    image_url?: string;
}

export interface PlantUpdate {
    taxon_id?: string;
    common_name?: string;
    category?: string;
    planting_place?: PlantingPlace;
    description?: string;
    care_data?: Record<string, any>;
    icon_url?: string;
    image_url?: string;
}
