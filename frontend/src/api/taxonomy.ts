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
    }
};
