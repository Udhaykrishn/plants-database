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
}

export const aiApi = {
    generatePlantDetails: async ({ commonName, scientificName }: { commonName?: string, scientificName?: string }): Promise<PlantAIDetailsResponse> => {
        const response = await client.post<PlantAIDetailsResponse>("/ai/generate-plant-details", {
            common_name: commonName,
            scientific_name: scientificName
        });
        return response.data;
    }
};
