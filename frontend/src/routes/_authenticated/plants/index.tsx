import { createFileRoute } from '@tanstack/react-router';
import { PlantManager } from '@/components/plants/PlantManager';
import { plantsQueryOptions, taxonomyTreeQueryOptions, categoriesQueryOptions } from '@/api/queryOptions';

export const Route = createFileRoute('/_authenticated/plants/')({
    loader: ({ context: { queryClient } }) => {
        queryClient.prefetchQuery(plantsQueryOptions({ skip: 0, limit: 20, sort: 'recent' }));
        queryClient.prefetchQuery(taxonomyTreeQueryOptions());
        queryClient.prefetchQuery(categoriesQueryOptions());
    },
    component: PlantManager,
});
