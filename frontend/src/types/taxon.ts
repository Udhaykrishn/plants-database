export const Rank = {
    KINGDOM: "Kingdom",
    DIVISION: "Division",
    CLASS: "Class",
    ORDER: "Order",
    FAMILY: "Family",
    GENUS: "Genus",
    SPECIES: "Species",
} as const;

export type Rank = typeof Rank[keyof typeof Rank];

export interface Taxon {
    id: string;
    name: string;
    rank: Rank;
    description?: string;
    parent_id?: string;
    parent?: Taxon;
    children?: Taxon[];
    created_at?: string;
    updated_at?: string;
}

export type TaxonResponse = Taxon;

export interface TaxonTree extends Taxon {
    children: TaxonTree[];
}

export interface TaxonCreate {
    name: string;
    rank: Rank;
    description?: string;
    parent_id?: string;
}

export interface TaxonUpdate {
    name?: string;
    rank?: Rank;
    description?: string;
    parent_id?: string;
}
