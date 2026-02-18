import type { Taxon } from "./taxon";

export const PlantCategory = {
    TREE: "Tree",
    SHRUB: "Shrub",
    PALM: "Palm",
    CREEPER: "Creeper",
    GROUNDCOVER: "Groundcover",
    CLIMBER: "Climber",
    FERN: "Fern",
    GRASS: "Grass",
    SUCCULENT: "Succulent",
    AQUATIC: "Aquatic",
    OTHER: "Other",
} as const;

export type PlantCategory = typeof PlantCategory[keyof typeof PlantCategory];

export const PlantingPlace = {
    INDOOR: "Indoor",
    OUTDOOR: "Outdoor",
    BOTH: "Both",
} as const;

export type PlantingPlace = typeof PlantingPlace[keyof typeof PlantingPlace];

export interface Plant {
    id: string;
    taxon_id: string;
    common_name: string;
    category: PlantCategory;
    planting_place: PlantingPlace;
    description?: string;
    care_data?: Record<string, any>;
    created_at: string;
    taxon?: Taxon;
}

export type PlantResponse = Plant;

export interface PlantCreate {
    taxon_id: string;
    common_name: string;
    category: PlantCategory;
    planting_place: PlantingPlace;
    description?: string;
    care_data?: Record<string, any>;
}

export interface PlantUpdate {
    taxon_id?: string;
    common_name?: string;
    category?: PlantCategory;
    planting_place?: PlantingPlace;
    description?: string;
    care_data?: Record<string, any>;
}
