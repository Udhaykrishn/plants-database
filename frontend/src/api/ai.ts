import { client } from "./client";

export interface TaxonomyDetails {
    kingdom?: string;
    division?: string;
    class_name?: string;
    order?: string;
    family?: string;
    genus?: string;
    species?: string;
}

export interface PlantAIDetailsResponse {
    common_name?: string;
    category?: string;
    planting_place?: "Indoor" | "Outdoor" | "Indoor & Outdoor";
    description?: string;
    common_diseases?: string;
    care_data?: Record<string, string>;
    taxonomy?: TaxonomyDetails;
    icon_url?: string;
    image_url?: string;
}

export interface PlantImageResponse {
    icon_url?: string;
    image_url?: string;
    page: number;
}

export const aiApi = {
    generatePlantDetails: async ({ commonName, scientificName }: { commonName?: string, scientificName?: string }): Promise<PlantAIDetailsResponse> => {
        const response = await client.post<PlantAIDetailsResponse>("/ai/generate-plant-details", {
            common_name: commonName,
            scientific_name: scientificName
        });
        return response.data;
    },
    fetchPlantImages: async ({ plantName, page }: { plantName: string, page?: number }): Promise<PlantImageResponse> => {
        const response = await client.get<PlantImageResponse>("/ai/fetch-plant-images", {
            params: { plant_name: plantName, page: page || 1 }
        });
        return response.data;
    }
};
