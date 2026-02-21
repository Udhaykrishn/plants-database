import { client } from "./client";
import type { Project, ProjectCreate, ProjectPlantCreate } from "../types/project";

export const projectsApi = {
    getAll: async (): Promise<Project[]> => {
        const response = await client.get<Project[]>("/projects/");
        return response.data;
    },

    getById: async (id: string): Promise<Project> => {
        const response = await client.get<Project>(`/projects/${id}`);
        return response.data;
    },

    create: async (data: ProjectCreate): Promise<Project> => {
        const response = await client.post<Project>("/projects/", data);
        return response.data;
    },

    addPlant: async (projectId: string, data: ProjectPlantCreate): Promise<Project> => {
        const response = await client.post<Project>(`/projects/${projectId}/plants`, data);
        return response.data;
    },

    updatePlant: async (projectId: string, plantId: string, data: ProjectPlantCreate): Promise<Project> => {
        const response = await client.put<Project>(`/projects/${projectId}/plants/${plantId}`, data);
        return response.data;
    },

    removePlant: async (projectId: string, plantId: string): Promise<Project> => {
        const response = await client.delete<Project>(`/projects/${projectId}/plants/${plantId}`);
        return response.data;
    },

    update: async (id: string, data: Partial<ProjectCreate>): Promise<Project> => {
        const response = await client.put<Project>(`/projects/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await client.delete(`/projects/${id}`);
    }
};
