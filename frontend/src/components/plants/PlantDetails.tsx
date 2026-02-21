import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import React, { useMemo } from 'react';
import { plantsApi } from '../../api/plants';
import { taxonomyApi } from '../../api/taxonomy';
import type { TaxonTree } from '../../types/taxon';

export const PlantDetails = () => {
    const { id } = useParams<{ id: string }>();

    const { data: plant, isLoading: plantLoading, error: plantError } = useQuery({
        queryKey: ['plants', id],
        queryFn: () => plantsApi.getById(id!),
        enabled: !!id,
    });

    const { data: tree } = useQuery({
        queryKey: ['taxonomy', 'tree'],
        queryFn: taxonomyApi.getTree,
    });

    const getTaxonomyPath = (nodes: TaxonTree[], targetId: string, currentPath: TaxonTree[] = []): TaxonTree[] | null => {
        for (const node of nodes) {
            const path = [...currentPath, node];
            if (node.id === targetId) {
                return path;
            }
            if (node.children && node.children.length > 0) {
                const foundPath = getTaxonomyPath(node.children, targetId, path);
                if (foundPath) return foundPath;
            }
        }
        return null;
    };

    const taxonomyPath = useMemo(() => {
        if (!tree || !plant?.taxon?.id) return null;
        return getTaxonomyPath(tree, plant.taxon.id);
    }, [tree, plant]);

    if (plantLoading) return <div>Loading plant details...</div>;
    if (plantError || !plant) return <div>Error loading plant details. Plant may not exist.</div>;

    return (
        <div className="plant-details-container" style={{ padding: '2rem' }}>
            <Link to="/plants" className="btn" style={{ background: '#6c757d', marginBottom: '1rem', display: 'inline-block' }}>
                ← Back to Catalog
            </Link>

            <div className="plant-header" style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{plant.common_name}</h1>
                <p style={{ fontSize: '1.2rem', fontStyle: 'italic', color: '#666' }}>
                    {plant.taxon?.name || 'Unknown Species'}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <span className="tag" style={{ background: '#e9ecef', padding: '0.3rem 0.8rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                        {plant.category}
                    </span>
                    <span className="tag" style={{ background: '#e9ecef', padding: '0.3rem 0.8rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                        {plant.planting_place}
                    </span>
                </div>
            </div>

            <div className="plant-body" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '2rem' }}>

                {taxonomyPath && taxonomyPath.length > 0 && (
                    <div className="plant-section">
                        <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid #eaeaea', paddingBottom: '0.5rem', fontSize: '1.25rem' }}>Taxonomy Lineage</h3>
                        <div style={{ background: '#fafafa', padding: '1.25rem', borderRadius: '8px', border: '1px solid #eaeaea', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {taxonomyPath.map((t, index) => (
                                <React.Fragment key={t.id}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.25rem 0.5rem', background: '#fff', borderRadius: '6px', border: '1px solid #e0e0e0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                        <span style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>{t.rank}</span>
                                        <span style={{ fontWeight: '500', color: '#2b2b2b' }}>{t.name}</span>
                                    </div>
                                    {index < taxonomyPath.length - 1 && (
                                        <span style={{ color: '#ccc', margin: '0 0.25rem', fontSize: '1.2rem' }}>→</span>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                )}

                <div className="plant-section">
                    <h3>Description</h3>
                    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eaeaea', lineHeight: '1.6' }}>
                        {plant.description ? <p>{plant.description}</p> : <p style={{ color: '#888' }}>No description provided.</p>}
                    </div>
                </div>

                {plant.care_data && Object.keys(plant.care_data).length > 0 && (
                    <div className="plant-section">
                        <h3>Care Data</h3>
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eaeaea' }}>
                            <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                                {Object.entries(plant.care_data).map(([key, value]) => (
                                    <li key={key} style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', padding: '0.8rem 0' }}>
                                        <span style={{ fontWeight: '600', width: '150px', textTransform: 'capitalize' }}>
                                            {key.replace(/_/g, ' ')}
                                        </span>
                                        <span style={{ flex: 1 }}>{String(value)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
