import type { Plant } from "./plant";

export interface ProjectPlant {
    plant_id: string;
    notes?: string;
    plant?: Plant;
    quantity?: number;
    unit?: string;
    optimum_height_size?: string;
    rate?: number;
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
    notes?: string;
    quantity?: number;
    unit?: string;
    optimum_height_size?: string;
    rate?: number;
}

export type ProjectResponse = Project;

export interface ProjectListResponse {
    items: ProjectResponse[];
    total: number;
}

/** Slim association returned by POST/PUT/DELETE project-plant mutations (RIA-18). */
export interface ProjectPlantMutationResponse {
    project_id: string;
    plant_id: string;
    notes?: string;
    quantity?: number;
    unit?: string;
    optimum_height_size?: string;
    rate?: number;
}
