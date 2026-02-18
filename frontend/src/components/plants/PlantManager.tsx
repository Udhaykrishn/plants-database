import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plantsApi } from '../../api/plants';
import { taxonomyApi } from '../../api/taxonomy';
import { PlantCategory, PlantingPlace } from '../../types/plant';
import type { PlantCreate } from '../../types/plant';
import { Rank } from '../../types/taxon';
import './PlantManager.css';

import { ioApi } from '../../api/io';

export const PlantManager = () => {
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);

    // Import Handler
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const result = await ioApi.importCsv(e.target.files[0]);
                alert(`Import Complete!\nSuccess: ${result.success}\nFailed: ${result.failed}`);
                queryClient.invalidateQueries({ queryKey: ['plants'] });
                queryClient.invalidateQueries({ queryKey: ['taxonomy'] });
            } catch (error: any) {
                alert("Import failed: " + error.message);
            }
        }
    };


    // Form State
    const [commonName, setCommonName] = useState('');
    const [category, setCategory] = useState<PlantCategory>(PlantCategory.OTHER);
    const [plantingPlace, setPlantingPlace] = useState<PlantingPlace>(PlantingPlace.BOTH);
    const [description, setDescription] = useState('');
    const [taxonId, setTaxonId] = useState('');

    // Queries
    const { data: plants, isLoading: plantsLoading } = useQuery({
        queryKey: ['plants'],
        queryFn: plantsApi.getAll,
    });

    // NOTE: In a real app we would use a proper AsyncSelect to search for Species.
    // Here we are fetching the whole tree and flattening or just fetching taxons.
    // For simplicity of this Phase 1, we will just use an input for ID or simple dropdown if possible.
    // Actually, let's fetch tree and flatten finding species for the dropdown.
    const { data: taxonomyTree } = useQuery({
        queryKey: ['taxonomy', 'tree'],
        queryFn: taxonomyApi.getTree,
    });

    // Helper to extract species from tree
    const getSpecies = (nodes: any[]): any[] => {
        let species: any[] = [];
        nodes.forEach(node => {
            if (node.rank === Rank.SPECIES) {
                species.push(node);
            }
            if (node.children) {
                species = [...species, ...getSpecies(node.children)];
            }
        });
        return species;
    };

    const speciesList = taxonomyTree ? getSpecies(taxonomyTree) : [];

    const createMutation = useMutation({
        mutationFn: plantsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plants'] });
            setIsCreating(false);
            resetForm();
        },
        onError: (error: any) => {
            alert("Error creating plant: " + (error.response?.data?.detail || error.message));
        }
    });

    const resetForm = () => {
        setCommonName('');
        setCategory(PlantCategory.OTHER);
        setDescription('');
        setTaxonId('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!taxonId) {
            alert("Please select a Species");
            return;
        }

        const newPlant: PlantCreate = {
            common_name: commonName,
            category,
            planting_place: plantingPlace,
            description,
            taxon_id: taxonId,
        };
        createMutation.mutate(newPlant);
    };

    return (
        <div className="plant-manager">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Plant Catalog</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <label className="btn" style={{ background: '#28a745', cursor: 'pointer' }}>
                        Import CSV
                        <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                    </label>
                    <button className="btn" onClick={() => setIsCreating(!isCreating)}>
                        {isCreating ? 'Cancel' : '+ Add Plant'}
                    </button>
                </div>
            </div>

            {isCreating && (
                <form className="create-plant-form" onSubmit={handleSubmit}>
                    <h3>New Plant</h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Common Name</label>
                            <input
                                value={commonName}
                                onChange={e => setCommonName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Scientific Species (Taxon)</label>
                            <select
                                value={taxonId}
                                onChange={e => setTaxonId(e.target.value)}
                                required
                            >
                                <option value="">Select Species...</option>
                                {speciesList.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Category</label>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value as PlantCategory)}
                            >
                                {Object.values(PlantCategory).map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Planting Place</label>
                            <select
                                value={plantingPlace}
                                onChange={e => setPlantingPlace(e.target.value as PlantingPlace)}
                            >
                                {Object.values(PlantingPlace).map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <button type="submit" className="btn">Create Plant</button>
                </form>
            )}

            {plantsLoading ? <p>Loading plants...</p> : (
                <div className="plant-list">
                    {plants?.map(plant => (
                        <div key={plant.id} className="plant-card">
                            <h3>{plant.common_name}</h3>
                            <div className="taxonomy-info">
                                <i>{plant.taxon?.name}</i>
                            </div>
                            <div className="plant-meta">
                                <span className="tag">{plant.category}</span>
                                <span className="tag">{plant.planting_place}</span>
                            </div>
                            <p>{plant.description}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
