import { client } from "./client";
import type { CategoryResponse, CategoryCreate, CategoryUpdate, CategoryListResponse } from "../types/category";

export const categoriesApi = {
    getAll: async (params?: { skip?: number; limit?: number; search?: string }): Promise<CategoryListResponse> => {
        const response = await client.get<CategoryListResponse>("/categories/", { params });
        return response.data;
    },

    create: async (data: CategoryCreate): Promise<CategoryResponse> => {
        const response = await client.post<CategoryResponse>("/categories/", data);
        return response.data;
    },

    update: async (id: string, data: CategoryUpdate): Promise<CategoryResponse> => {
        const response = await client.put<CategoryResponse>(`/categories/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<any> => {
        const response = await client.delete(`/categories/${id}`);
        return response.data;
    }
};
