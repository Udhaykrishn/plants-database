import { client } from "./client";
import type { PlantCreate, PlantResponse } from "../types/plant";

export const plantsApi = {
    getAll: async (): Promise<PlantResponse[]> => {
        const response = await client.get<PlantResponse[]>("/plants/");
        return response.data;
    },

    create: async (data: PlantCreate): Promise<PlantResponse> => {
        const response = await client.post<PlantResponse>("/plants/", data);
        return response.data;
    },

    getById: async (id: string): Promise<PlantResponse> => {
        const response = await client.get<PlantResponse>(`/plants/${id}`);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await client.delete(`/plants/${id}`);
    },

    update: async (id: string, data: Partial<PlantCreate>): Promise<PlantResponse> => {
        const response = await client.put<PlantResponse>(`/plants/${id}`, data);
        return response.data;
    }
};
