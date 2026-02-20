import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plantsApi } from '../../api/plants';
import { taxonomyApi } from '../../api/taxonomy';
import { PlantCategory, PlantingPlace } from '../../types/plant';
import type { PlantCreate, Plant } from '../../types/plant';
import { Rank } from '../../types/taxon';
import './PlantManager.css';

import { ioApi } from '../../api/io';
import { useAlert } from '../../contexts/AlertContext';
import { useConfirm } from '../../contexts/ConfirmContext';

export const PlantManager = () => {
    const queryClient = useQueryClient();
    const { showAlert } = useAlert();
    const { confirm } = useConfirm();
    const [isCreating, setIsCreating] = useState(false);
    const [editingPlantId, setEditingPlantId] = useState<string | null>(null);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    // Import Handler
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const result = await ioApi.importCsv(e.target.files[0]);
                showAlert(`Import Complete! Success: ${result.success}, Failed: ${result.failed}`, 'success');
                queryClient.invalidateQueries({ queryKey: ['plants'] });
                queryClient.invalidateQueries({ queryKey: ['taxonomy'] });
            } catch (error: any) {
                showAlert("Import failed: " + error.message, 'error');
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

    const { data: taxonomyTree } = useQuery({
        queryKey: ['taxonomy', 'tree'],
        queryFn: taxonomyApi.getTree,
    });

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
            showAlert('Plant created successfully', 'success');
            setIsCreating(false);
            resetForm();
        },
        onError: (error: any) => {
            showAlert("Error creating plant: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: Partial<PlantCreate> }) => plantsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plants'] });
            showAlert('Plant updated successfully', 'success');
            setEditingPlantId(null);
            resetForm();
        },
        onError: (error: any) => {
            showAlert("Error updating plant: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: plantsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plants'] });
            showAlert('Plant deleted successfully', 'success');
        },
        onError: (error: any) => {
            showAlert("Error deleting plant: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const resetForm = () => {
        setCommonName('');
        setCategory(PlantCategory.OTHER);
        setPlantingPlace(PlantingPlace.BOTH);
        setDescription('');
        setTaxonId('');
    };

    const handleEdit = (plant: Plant) => {
        setEditingPlantId(plant.id);
        setIsCreating(false);
        setActiveDropdown(null);
        setCommonName(plant.common_name);
        setCategory(plant.category);
        setPlantingPlace(plant.planting_place);
        setDescription(plant.description || '');
        setTaxonId(plant.taxon_id);
    };

    const handleDelete = (id: string, name: string) => {
        confirm({
            title: 'Delete Plant',
            message: `Are you sure you want to delete ${name}? This action cannot be undone.`,
            confirmText: 'Delete',
            onConfirm: () => {
                deleteMutation.mutate(id);
            }
        });
        setActiveDropdown(null);
    };

    const toggleDropdown = (id: string) => {
        setActiveDropdown(activeDropdown === id ? null : id);
    };

    const cancelEdit = () => {
        setEditingPlantId(null);
        resetForm();
    };

    const toggleCreate = () => {
        if (isCreating) {
            setIsCreating(false);
            resetForm();
        } else {
            setEditingPlantId(null);
            resetForm();
            setIsCreating(true);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!taxonId) {
            showAlert("Please select a Species", 'warning');
            return;
        }

        const plantData: Partial<PlantCreate> = {
            common_name: commonName,
            category,
            planting_place: plantingPlace,
            description,
            taxon_id: taxonId,
        };

        if (editingPlantId) {
            updateMutation.mutate({ id: editingPlantId, data: plantData });
        } else {
            createMutation.mutate(plantData as PlantCreate);
        }
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
                    <button className="btn" onClick={toggleCreate}>
                        {isCreating ? 'Cancel Create' : '+ Add Plant'}
                    </button>
                </div>
            </div>

            {(isCreating || editingPlantId) && (
                <form className="create-plant-form" onSubmit={handleSubmit}>
                    <h3>{editingPlantId ? 'Edit Plant' : 'New Plant'}</h3>
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

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button type="submit" className="btn">
                            {editingPlantId ? 'Save Changes' : 'Create Plant'}
                        </button>
                        {editingPlantId && (
                            <button type="button" className="btn" onClick={cancelEdit} style={{ background: '#6c757d' }}>
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            )}

            {plantsLoading ? <p>Loading plants...</p> : (
                <div className="plant-list">
                    {plants?.map(plant => (
                        <div key={plant.id} className="plant-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <h3>{plant.common_name}</h3>
                                <div className="actions-menu-container">
                                    <button
                                        className="icon-btn"
                                        onClick={() => toggleDropdown(plant.id)}
                                    >
                                        ⋮
                                    </button>
                                    {activeDropdown === plant.id && (
                                        <div className="dropdown-menu">
                                            <button className="dropdown-item" onClick={() => handleEdit(plant)}>
                                                Edit
                                            </button>
                                            <button className="dropdown-item danger" onClick={() => handleDelete(plant.id, plant.common_name)}>
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
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
