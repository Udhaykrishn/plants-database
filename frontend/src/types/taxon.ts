export enum Rank {
    KINGDOM = "Kingdom",
    DIVISION = "Division",
    CLASS = "Class",
    ORDER = "Order",
    FAMILY = "Family",
    GENUS = "Genus",
    SPECIES = "Species",
}

export interface Taxon {
    id: string;
    name: string;
    rank: Rank;
    description?: string;
    parent_id?: string;
    parent?: Taxon;
    children?: Taxon[];
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
