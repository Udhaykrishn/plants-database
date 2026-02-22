import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { plantsApi } from '../../api/plants';
import { taxonomyApi } from '../../api/taxonomy';
import type { TaxonTree } from '../../types/taxon';
import {
    ArrowLeft, Edit3, Bug, ListTree, Info, Sprout,
    Droplets, Sun, Wind, ScanText, MapPin, Tag
} from 'lucide-react';
import './PlantDetails.css';

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
        <div className="pd-container">
            <div className="pd-nav">
                <Link to="/plants" className="pd-back-btn">
                    <ArrowLeft size={18} /> Back to Catalog
                </Link>
                <Link to="/plants" state={{ editPlant: plant }} className="pd-edit-btn">
                    <Edit3 size={18} /> Edit Plant
                </Link>
            </div>

            <div className="pd-header">
                <div className="pd-header-content">
                    <div className="pd-title-wrapper">
                        {plant.icon_url && (
                            <img src={plant.icon_url} alt={`${plant.common_name} icon`} className="pd-icon" />
                        )}
                        <div>
                            <h1 className="pd-title">{plant.common_name}</h1>
                            <p className="pd-scientific">{plant.scientific_name || 'Scientific Name Unknown'}</p>
                        </div>
                    </div>
                    <div className="pd-tags">
                        <span className="pd-tag">
                            <Tag size={14} /> {plant.category}
                        </span>
                        <span className="pd-tag">
                            <MapPin size={14} /> {plant.planting_place}
                        </span>
                    </div>
                </div>
                {plant.image_url && (
                    <img src={plant.image_url} alt={`${plant.common_name} full view`} className="pd-hero-image" />
                )}
            </div>

            <div className="pd-grid">
                <div className="pd-main-col">
                    <div className="pd-section">
                        <h3 className="pd-section-title"><ScanText size={22} /> Description</h3>
                        {plant.description ? (
                            <p className="pd-text">{plant.description}</p>
                        ) : (
                            <p className="pd-text" style={{ color: '#888' }}>No description provided.</p>
                        )}
                    </div>

                    {plant.care_data && Object.keys(plant.care_data).length > 0 && (
                        <div className="pd-section">
                            <h3 className="pd-section-title"><Sprout size={22} /> Care Data</h3>
                            <div className="pd-care-grid">
                                {Object.entries(plant.care_data).map(([key, value]) => {
                                    let Icon = Info;
                                    if (key.toLowerCase().includes('water')) Icon = Droplets;
                                    if (key.toLowerCase().includes('sun')) Icon = Sun;
                                    if (key.toLowerCase().includes('soil')) Icon = ListTree;
                                    if (key.toLowerCase().includes('maintenance')) Icon = Wind;

                                    return (
                                        <div key={key} className="pd-care-item">
                                            <div className="pd-care-label">
                                                <Icon size={16} /> {key.replace(/_/g, ' ')}
                                            </div>
                                            <p className="pd-care-value">{String(value)}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="pd-side-col">
                    {plant.common_diseases && (
                        <div className="pd-section pd-disease-card">
                            <h3 className="pd-section-title"><Bug size={22} /> Common Diseases & Pests</h3>
                            <p className="pd-text">{plant.common_diseases}</p>
                        </div>
                    )}

                    {taxonomyPath && taxonomyPath.length > 0 && (
                        <div className="pd-section">
                            <h3 className="pd-section-title"><ListTree size={22} /> Taxonomy Lineage</h3>
                            <div className="pd-taxonomy">
                                {taxonomyPath.map((t) => (
                                    <div key={t.id} className="pd-tax-node">
                                        <span className="pd-tax-rank">{t.rank}</span>
                                        <span className="pd-tax-name">{t.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
