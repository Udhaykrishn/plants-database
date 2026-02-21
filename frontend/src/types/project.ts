import type { Plant } from "./plant";

export interface ProjectPlant {
    plant_id: string;
    quantity: number;
    notes?: string;
    plant?: Plant;
}

export interface Project {
    id: string;
    name: string;
    client_name?: string;
    location?: string;
    description?: string;
    created_at: string;
    updated_at: string;
    plants: ProjectPlant[];
}

export interface ProjectCreate {
    name: string;
    client_name?: string;
    location?: string;
    description?: string;
}

export interface ProjectPlantCreate {
    plant_id: string;
    quantity: number;
    notes?: string;
}
