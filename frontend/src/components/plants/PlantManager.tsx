import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    const navigate = useNavigate();
    const { showAlert } = useAlert();
    const { confirm } = useConfirm();
    const [isCreating, setIsCreating] = useState(false);
    const [editingPlantId, setEditingPlantId] = useState<string | null>(null);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (!target.closest('.actions-menu-container')) {
                setActiveDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Filters & Sort
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<PlantCategory | ''>('');
    const [filterIndoor, setFilterIndoor] = useState(false);
    const [filterOutdoor, setFilterOutdoor] = useState(false);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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
    const [isIndoor, setIsIndoor] = useState(true);
    const [isOutdoor, setIsOutdoor] = useState(true);
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
        setIsIndoor(true);
        setIsOutdoor(true);
        setDescription('');
        setTaxonId('');
    };

    const handleEdit = (plant: Plant) => {
        setEditingPlantId(plant.id);
        setIsCreating(false);
        setActiveDropdown(null);
        setCommonName(plant.common_name);
        setCategory(plant.category);
        setIsIndoor(plant.planting_place === PlantingPlace.INDOOR || plant.planting_place === PlantingPlace.BOTH);
        setIsOutdoor(plant.planting_place === PlantingPlace.OUTDOOR || plant.planting_place === PlantingPlace.BOTH);
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

    const toggleDropdown = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveDropdown(activeDropdown === id ? null : id);
    };

    const handleRowClick = (id: string, e: React.MouseEvent) => {
        // Ignore row clicks if user clicked inside the actions menu
        if ((e.target as Element).closest('.actions-menu-container') || (e.target as Element).closest('.dropdown-menu')) return;
        navigate(`/plants/${id}`);
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
        if (!isIndoor && !isOutdoor) {
            showAlert("Please select at least one Planting Place (Indoor or Outdoor)", 'warning');
            return;
        }

        let plantingPlace: PlantingPlace = PlantingPlace.BOTH;
        if (isIndoor && !isOutdoor) plantingPlace = PlantingPlace.INDOOR;
        if (!isIndoor && isOutdoor) plantingPlace = PlantingPlace.OUTDOOR;

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

    const displayedPlants = useMemo(() => {
        if (!plants) return [];
        return [...plants].filter(plant => {
            const matchesSearch = plant.common_name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === '' || plant.category === filterCategory;

            let matchesPlace = true;
            if (!filterIndoor && !filterOutdoor) {
                matchesPlace = true;
            } else if (filterIndoor && !filterOutdoor) {
                matchesPlace = plant.planting_place === PlantingPlace.INDOOR || plant.planting_place === PlantingPlace.BOTH;
            } else if (!filterIndoor && filterOutdoor) {
                matchesPlace = plant.planting_place === PlantingPlace.OUTDOOR || plant.planting_place === PlantingPlace.BOTH;
            } else if (filterIndoor && filterOutdoor) {
                matchesPlace = plant.planting_place === PlantingPlace.BOTH;
            }

            return matchesSearch && matchesCategory && matchesPlace;
        }).sort((a, b) => {
            const nameA = a.common_name.toLowerCase();
            const nameB = b.common_name.toLowerCase();
            return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
    }, [plants, searchTerm, filterCategory, filterIndoor, filterOutdoor, sortOrder]);

    return (
        <div className="plant-manager">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, borderBottom: 'none', paddingBottom: 0, fontSize: '1.75rem', fontWeight: 500, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>Plant Catalog</h2>
                    <div className="view-toggle">
                        <button className={`btn-toggle ${viewMode === 'card' ? 'active' : ''}`} onClick={() => setViewMode('card')} title="Card View">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                <rect x="3" y="3" width="7" height="7"></rect>
                                <rect x="14" y="3" width="7" height="7"></rect>
                                <rect x="14" y="14" width="7" height="7"></rect>
                                <rect x="3" y="14" width="7" height="7"></rect>
                            </svg>
                            Cards
                        </button>
                        <button className={`btn-toggle ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')} title="Table View">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                <line x1="8" y1="6" x2="21" y2="6"></line>
                                <line x1="8" y1="12" x2="21" y2="12"></line>
                                <line x1="8" y1="18" x2="21" y2="18"></line>
                                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                                <line x1="3" y1="18" x2="3.01" y2="18"></line>
                            </svg>
                            List
                        </button>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <label className="btn" style={{ background: '#f4f4f4', color: '#1a1a1a', border: '1px solid #eaeaea', cursor: 'pointer' }}>
                        Import CSV
                        <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                    </label>
                    <button className="btn" onClick={toggleCreate}>
                        {isCreating ? 'Cancel Create' : '+ Add Plant'}
                    </button>
                </div>
            </div>

            <div className="toolbar" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    placeholder="Search catalog..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', padding: '10px 14px' }}
                />
                <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value as PlantCategory | '')}
                    style={{ padding: '10px 14px' }}
                >
                    <option value="">All Categories</option>
                    {Object.values(PlantCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0 14px', height: '42px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, color: '#444' }}>
                        <input type="checkbox" checked={filterIndoor} onChange={e => setFilterIndoor(e.target.checked)} />
                        Indoor
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, color: '#444' }}>
                        <input type="checkbox" checked={filterOutdoor} onChange={e => setFilterOutdoor(e.target.checked)} />
                        Outdoor
                    </label>
                </div>
                <select
                    value={sortOrder}
                    onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
                    style={{ padding: '10px 14px' }}
                >
                    <option value="asc">A-Z</option>
                    <option value="desc">Z-A</option>
                </select>
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
                            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={isIndoor}
                                        onChange={e => setIsIndoor(e.target.checked)}
                                    />
                                    Indoor
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={isOutdoor}
                                        onChange={e => setIsOutdoor(e.target.checked)}
                                    />
                                    Outdoor
                                </label>
                            </div>
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
                            <button type="button" className="btn" onClick={cancelEdit} style={{ background: '#f4f4f4', color: '#1a1a1a', borderColor: '#eaeaea' }}>
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            )}

            {plantsLoading ? <p>Loading plants...</p> : (
                viewMode === 'card' ? (
                    <div className="plant-list">
                        {displayedPlants.map((plant: Plant) => (
                            <div key={plant.id} className="plant-card" onClick={(e) => handleRowClick(plant.id, e)} style={{ cursor: 'pointer' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h3>{plant.common_name}</h3>
                                    <div className="actions-menu-container">
                                        <button
                                            className="icon-btn"
                                            onClick={(e) => toggleDropdown(plant.id, e)}
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
                ) : (
                    <div className="plants-table-container">
                        <div className="plant-table-header">
                            <div style={{ flex: 2 }}>Common Name</div>
                            <div style={{ flex: 2 }}>Species</div>
                            <div style={{ flex: 1 }}>Category</div>
                            <div style={{ flex: 1 }}>Place</div>
                            <div style={{ width: '40px' }}></div>
                        </div>
                        {displayedPlants.map((plant: Plant) => (
                            <div key={plant.id} className="plant-table-row" onClick={(e) => handleRowClick(plant.id, e)} style={{ cursor: 'pointer' }}>
                                <div style={{ flex: 2, fontWeight: '500', color: '#1a1a1a' }}>{plant.common_name}</div>
                                <div style={{ flex: 2, fontStyle: 'italic', color: '#888', fontFamily: 'serif' }}>{plant.taxon?.name}</div>
                                <div style={{ flex: 1 }}><span className="tag">{plant.category}</span></div>
                                <div style={{ flex: 1 }}><span className="tag">{plant.planting_place}</span></div>
                                <div style={{ width: '40px', textAlign: 'right' }}>
                                    <div className="actions-menu-container">
                                        <button className="icon-btn" onClick={(e) => toggleDropdown(`table-${plant.id}`, e)}>⋮</button>
                                        {activeDropdown === `table-${plant.id}` && (
                                            <div className="dropdown-menu">
                                                <button className="dropdown-item" onClick={() => handleEdit(plant)}>Edit</button>
                                                <button className="dropdown-item danger" onClick={() => handleDelete(plant.id, plant.common_name)}>Delete</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
};
