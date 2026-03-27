import { client } from './client';

export interface DashboardStats {
    total_plants: number;
    total_taxonomy_nodes: number;
    total_categories: number;
    total_projects: number;
}

export const dashboardApi = {
    getStats: async (): Promise<DashboardStats> => {
        const response = await client.get('/dashboard/stats');
        return response.data;
    },
};
