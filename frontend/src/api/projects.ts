import { client } from "./client";
import type { Project, ProjectCreate, ProjectPlantCreate } from "../types/project";

export const projectsApi = {
    getAll: async (): Promise<Project[]> => {
        const response = await client.get<Project[]>("/projects");
        return response.data;
    },

    getById: async (id: string): Promise<Project> => {
        const response = await client.get<Project>(`/projects/${id}`);
        return response.data;
    },

    create: async (data: ProjectCreate): Promise<Project> => {
        const response = await client.post<Project>("/projects", data);
        return response.data;
    },

    addPlant: async (projectId: string, data: ProjectPlantCreate): Promise<Project> => {
        const response = await client.post<Project>(`/projects/${projectId}/plants`, data);
        return response.data;
    }
};
