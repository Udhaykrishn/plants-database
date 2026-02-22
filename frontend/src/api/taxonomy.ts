import { client } from "./client";
import type { TaxonTree, TaxonCreate, TaxonResponse } from "../types/taxon";

export const taxonomyApi = {
    getTree: async (): Promise<TaxonTree[]> => {
        const response = await client.get<TaxonTree[]>("/taxonomy/tree");
        return response.data;
    },

    create: async (data: TaxonCreate): Promise<TaxonResponse> => {
        const response = await client.post<TaxonResponse>("/taxonomy/", data);
        return response.data;
    },

    getById: async (id: string): Promise<TaxonResponse> => {
        const response = await client.get<TaxonResponse>(`/taxonomy/${id}`);
        return response.data;
    },

    update: async (id: string, data: Partial<TaxonCreate>): Promise<TaxonResponse> => {
        const response = await client.put<TaxonResponse>(`/taxonomy/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<any> => {
        const response = await client.delete(`/taxonomy/${id}`);
        return response.data;
    },

    ensurePath: async (path: { rank: string; name: string }[]): Promise<TaxonResponse> => {
        const response = await client.post<TaxonResponse>("/taxonomy/ensure-path", { path });
        return response.data;
    }
};
