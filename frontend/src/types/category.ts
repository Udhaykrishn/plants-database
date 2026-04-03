export interface Category {
    id: string;
    name: string;
    description?: string;
    plant_count?: number;
}

export type CategoryResponse = Category;

export interface CategoryCreate {
    name: string;
    description?: string;
}

export interface CategoryUpdate {
    name?: string;
    description?: string;
}

export interface CategoryListResponse {
    items: CategoryResponse[];
    total: number;
}
