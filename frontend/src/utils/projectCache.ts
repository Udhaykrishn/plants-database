import type { Plant } from '../types/plant';
import type {
    Project,
    ProjectListResponse,
    ProjectPlant,
    ProjectPlantMutationResponse,
} from '../types/project';

/** Merge a slim association mutation response into a cached full Project (RIA-19). */
export function mergeAssociationIntoProject(
    project: Project,
    slim: ProjectPlantMutationResponse,
    plantHint?: Plant | null,
): Project {
    const plants = [...project.plants];
    const idx = plants.findIndex((p) => p.plant_id === slim.plant_id);
    const existing = idx >= 0 ? plants[idx] : undefined;

    const next: ProjectPlant = {
        plant_id: slim.plant_id,
        notes: slim.notes,
        quantity: slim.quantity,
        unit: slim.unit,
        optimum_height_size: slim.optimum_height_size,
        rate: slim.rate,
        plant: existing?.plant ?? plantHint ?? undefined,
    };

    if (idx >= 0) {
        plants[idx] = next;
    } else {
        plants.push(next);
    }

    return {
        ...project,
        plants,
        updated_at: new Date().toISOString(),
    };
}

/** Remove a plant association from a cached full Project using slim delete response. */
export function removeAssociationFromProject(
    project: Project,
    plantId: string,
): Project {
    return {
        ...project,
        plants: project.plants.filter((p) => p.plant_id !== plantId),
        updated_at: new Date().toISOString(),
    };
}

/** Bump plant_count on matching project rows in projects list caches (RIA-21). */
export function bumpListPlantCount(
    list: ProjectListResponse,
    projectId: string,
    delta: number,
): ProjectListResponse {
    if (delta === 0) return list;
    return {
        ...list,
        items: list.items.map((p) => {
            if (p.id !== projectId) return p;
            const base =
                typeof p.plant_count === 'number'
                    ? p.plant_count
                    : Array.isArray(p.plants)
                      ? p.plants.length
                      : 0;
            return {
                ...p,
                plant_count: Math.max(0, base + delta),
                updated_at: new Date().toISOString(),
            };
        }),
    };
}
