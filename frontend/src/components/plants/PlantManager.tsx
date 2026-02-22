import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plantsApi } from '../../api/plants';
import { taxonomyApi } from '../../api/taxonomy';
import { projectsApi } from '../../api/projects';
import { PlantingPlace } from '../../types/plant';
import type { PlantCreate, Plant } from '../../types/plant';
import './PlantManager.css';

import { ioApi } from '../../api/io';
import { useAlert } from '../../contexts/AlertContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { categoriesApi } from '../../api/categories';
import { aiApi } from '../../api/ai';
import { TaxonomyFormTable } from './TaxonomyFormTable';

export const PlantManager = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const location = useLocation();
    const { showAlert } = useAlert();
    const { confirm } = useConfirm();
    const [isCreating, setIsCreating] = useState(false);
    const [editingPlantId, setEditingPlantId] = useState<string | null>(null);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'card' | 'table'>('table');

    const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>(() => {
        const saved = sessionStorage.getItem('plantSelection');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        sessionStorage.setItem('plantSelection', JSON.stringify(selectedPlantIds));
    }, [selectedPlantIds]);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    const { data: projectsData } = useQuery({
        queryKey: ['projects'],
        queryFn: projectsApi.getAll
    });

    const addPlantsToProjectMutation = useMutation({
        mutationFn: async (args: { projectId: string; plantIds: string[] }) => {
            const promises = args.plantIds.map(plantId =>
                projectsApi.addPlant(args.projectId, { plant_id: plantId, notes: '' })
            );
            return Promise.all(promises);
        },
        onSuccess: () => {
            showAlert(`Successfully added ${selectedPlantIds.length} plant(s) to project.`, 'success');
            setSelectedPlantIds([]);
            setShowProjectModal(false);
            setSelectedProjectId('');
        },
        onError: (error: any) => {
            showAlert("Failed to add plants to project: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

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
    const [filterCategory, setFilterCategory] = useState<string>('');
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
    const [category, setCategory] = useState<string>('');
    const [isIndoor, setIsIndoor] = useState(true);
    const [isOutdoor, setIsOutdoor] = useState(true);
    const [description, setDescription] = useState('');
    const [commonDiseases, setCommonDiseases] = useState('');
    const [scientificName, setScientificName] = useState('');
    const [taxonId, setTaxonId] = useState<string | null>(null);
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [iconUrl, setIconUrl] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    // Care Form State
    const [careWater, setCareWater] = useState('');
    const [careSunlight, setCareSunlight] = useState('');
    const [careSoil, setCareSoil] = useState('');
    const [careMaintenance, setCareMaintenance] = useState('');

    // Queries
    const { data: plants, isLoading: plantsLoading } = useQuery({
        queryKey: ['plants'],
        queryFn: plantsApi.getAll,
    });

    const { data: taxonomyTree } = useQuery({
        queryKey: ['taxonomy', 'tree'],
        queryFn: taxonomyApi.getTree,
    });

    const { data: categoriesOptions } = useQuery({
        queryKey: ['categories'],
        queryFn: categoriesApi.getAll,
    });

    useEffect(() => {
        if (location.state?.editPlant && plants && taxonomyTree) {
            handleEdit(location.state.editPlant);
            // Clear the state so it doesn't re-trigger on refresh
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, plants, taxonomyTree, navigate]);

    const createMutation = useMutation({
        mutationFn: plantsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plants'] });
            showAlert('Plant created successfully', 'success');
            setIsCreating(false);
            resetForm();
            navigate('/plants', { replace: true });
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
            setIsCreating(false);
            resetForm();
            navigate('/plants', { replace: true });
        },
        onError: (error: any) => {
            showAlert("Error updating plant: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const aiMutation = useMutation({
        mutationFn: () => {
            if (!commonName.trim() && !scientificName.trim()) throw new Error("Please enter a common name or scientific name first");
            return aiApi.generatePlantDetails({
                commonName: commonName.trim() || undefined,
                scientificName: scientificName.trim() || undefined
            });
        },
        onSuccess: (data) => {
            if (data.common_name && !commonName.trim()) setCommonName(data.common_name);
            if (data.description) setDescription(data.description);
            if (data.common_diseases) setCommonDiseases(data.common_diseases);
            if (data.category) setCategory(data.category);
            if (data.icon_url) setIconUrl(data.icon_url);
            if (data.image_url) setImageUrl(data.image_url);

            if (data.planting_place === 'Indoor') {
                setIsIndoor(true); setIsOutdoor(false);
            } else if (data.planting_place === 'Outdoor') {
                setIsIndoor(false); setIsOutdoor(true);
            } else if (data.planting_place === 'Indoor & Outdoor') {
                setIsIndoor(true); setIsOutdoor(true);
            }

            // Handle proper separation
            if (data.care_data) {
                setCareWater(data.care_data.water || '');
                setCareSunlight(data.care_data.sunlight || '');
                setCareSoil(data.care_data.soil || '');
                setCareMaintenance(data.care_data.maintenance || '');
            }

            // Automate taxonomy mapping
            if (data.taxonomy) {
                const path: { rank: string, name: string }[] = [];
                if (data.taxonomy.kingdom) path.push({ rank: 'Kingdom', name: data.taxonomy.kingdom });
                if (data.taxonomy.division) path.push({ rank: 'Division', name: data.taxonomy.division });
                if (data.taxonomy.class_name) path.push({ rank: 'Class', name: data.taxonomy.class_name });
                if (data.taxonomy.order) path.push({ rank: 'Order', name: data.taxonomy.order });
                if (data.taxonomy.family) path.push({ rank: 'Family', name: data.taxonomy.family });
                if (data.taxonomy.genus) path.push({ rank: 'Genus', name: data.taxonomy.genus });
                if (data.taxonomy.species) path.push({ rank: 'Species', name: data.taxonomy.species });

                if (path.length > 0) {
                    taxonomyApi.ensurePath(path).then((res) => {
                        setTaxonId(res.id);
                        queryClient.invalidateQueries({ queryKey: ['taxonomy', 'tree'] });
                    }).catch(console.error);
                }

                // Fallback scientific_name using genus+species if available
                if (data.taxonomy.genus && data.taxonomy.species) {
                    setScientificName(`${data.taxonomy.genus} ${data.taxonomy.species}`);
                } else if (data.taxonomy.species) {
                    setScientificName(data.taxonomy.species);
                }
            }

            showAlert("Auto-filled details using AI!", 'success');
        },
        onError: (error: any) => {
            showAlert("AI Autofill failed: " + (error.response?.data?.detail || error.message), 'error');
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
        setCategory('');
        setIsIndoor(true);
        setIsOutdoor(true);
        setDescription('');
        setCommonDiseases('');
        setScientificName('');
        setTaxonId(null);
        setIconFile(null);
        setImageFile(null);
        setIconUrl('');
        setImageUrl('');
        setCareWater('');
        setCareSunlight('');
        setCareSoil('');
        setCareMaintenance('');
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
        setCommonDiseases(plant.common_diseases || '');
        setScientificName(plant.scientific_name || '');
        setTaxonId(plant.taxon_id || null);
        setIconUrl(plant.icon_url || '');
        setImageUrl(plant.image_url || '');
        setIconFile(null);
        setImageFile(null);
        setCareWater(plant.care_data?.water || '');
        setCareSunlight(plant.care_data?.sunlight || '');
        setCareSoil(plant.care_data?.soil || '');
        setCareMaintenance(plant.care_data?.maintenance || '');
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
        // Ignore row clicks if user clicked inside the actions menu or checkbox
        if ((e.target as Element).closest('.actions-menu-container') || (e.target as Element).closest('.dropdown-menu') || (e.target as Element).tagName.toLowerCase() === 'input') return;

        navigate(`/plants/${id}`);
    };

    const openSingleProjectModal = (plantId: string) => {
        setSelectedPlantIds([plantId]);
        setShowProjectModal(true);
        setActiveDropdown(null);
    };

    const cancelEdit = () => {
        setEditingPlantId(null);
        setIsCreating(false);
        resetForm();
        navigate('/plants', { replace: true });
    };

    const toggleCreate = () => {
        if (isCreating || editingPlantId) {
            cancelEdit();
        } else {
            setEditingPlantId(null);
            resetForm();
            setIsCreating(true);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isIndoor && !isOutdoor) {
            showAlert("Please select at least one Planting Place (Indoor or Outdoor)", 'warning');
            return;
        }

        setIsUploading(true);
        let finalIconUrl = iconUrl;
        let finalImageUrl = imageUrl;

        try {
            if (iconFile) {
                const res = await plantsApi.uploadImage(iconFile, 'icon');
                finalIconUrl = res.url;
            }
            if (imageFile) {
                const res = await plantsApi.uploadImage(imageFile, 'image');
                finalImageUrl = res.url;
            }
        } catch (error: any) {
            setIsUploading(false);
            showAlert("Error uploading images: " + (error.response?.data?.detail || error.message), 'error');
            return;
        }

        setIsUploading(false);

        let plantingPlace: PlantingPlace = PlantingPlace.BOTH;
        if (isIndoor && !isOutdoor) plantingPlace = PlantingPlace.INDOOR;
        if (!isIndoor && isOutdoor) plantingPlace = PlantingPlace.OUTDOOR;

        let parsedCareData = undefined;
        if (careWater.trim() || careSunlight.trim() || careSoil.trim() || careMaintenance.trim()) {
            parsedCareData = {
                water: careWater.trim() || undefined,
                sunlight: careSunlight.trim() || undefined,
                soil: careSoil.trim() || undefined,
                maintenance: careMaintenance.trim() || undefined
            };
        }

        const plantData: Partial<PlantCreate> = {
            common_name: commonName,
            scientific_name: scientificName,
            category,
            planting_place: plantingPlace,
            description,
            common_diseases: commonDiseases,
            taxon_id: taxonId || undefined,
            icon_url: finalIconUrl || undefined,
            image_url: finalImageUrl || undefined,
            care_data: parsedCareData
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
                    <h2 style={{ margin: 0, borderBottom: 'none', paddingBottom: 0, fontSize: '1.75rem', fontWeight: 500, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                        {isCreating || editingPlantId ? 'Plant Editor' : 'Plant Catalog'}
                    </h2>

                    {!isCreating && !editingPlantId && (
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
                    )}
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    {!isCreating && !editingPlantId && (
                        <label className="btn" style={{ background: '#f4f4f4', color: '#1a1a1a', border: '1px solid #eaeaea', cursor: 'pointer' }}>
                            Import CSV
                            <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                        </label>
                    )}
                    <button className="btn" onClick={toggleCreate}>
                        {isCreating || editingPlantId ? 'Cancel' : '+ Add Plant'}
                    </button>
                </div>
            </div>

            {!isCreating && !editingPlantId && (
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
                        onChange={e => setFilterCategory(e.target.value)}
                        style={{ padding: '10px 14px' }}
                    >
                        <option value="">All Categories</option>
                        {categoriesOptions?.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
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
            )}

            {(isCreating || editingPlantId) && (
                <form className="create-plant-form" onSubmit={handleSubmit}>
                    <h3>{editingPlantId ? 'Edit Plant' : 'New Plant'}</h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Common Name</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    value={commonName}
                                    onChange={e => setCommonName(e.target.value)}
                                    required
                                    style={{ flex: 1 }}
                                />
                                <button
                                    type="button"
                                    title="Auto-fill details using AI"
                                    className="btn"
                                    onClick={() => aiMutation.mutate()}
                                    disabled={aiMutation.isPending || (!commonName.trim() && !scientificName.trim())}
                                    style={{
                                        background: aiMutation.isPending ? '#e0e0e0' : 'linear-gradient(135deg, #a8ff78 0%, #78ffd6 100%)',
                                        color: '#000',
                                        border: 'none',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    {aiMutation.isPending ? '⏳ loading...' : '✨ AI Auto-Fill'}
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Scientific Name</label>
                            <input
                                value={scientificName}
                                onChange={e => setScientificName(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label>Taxonomy line</label>
                        <TaxonomyFormTable
                            taxonomyTree={taxonomyTree || []}
                            selectedTaxonId={taxonId}
                            onChange={setTaxonId}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Category</label>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                required
                            >
                                <option value="" disabled>Select category...</option>
                                {categoriesOptions?.map(c => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
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

                    <div className="form-group" style={{ marginTop: '1.5rem' }}>
                        <label>Common Diseases & Pests</label>
                        <textarea
                            value={commonDiseases}
                            onChange={e => setCommonDiseases(e.target.value)}
                            placeholder="Known diseases and pest susceptibility..."
                            style={{ minHeight: '80px' }}
                        />
                    </div>

                    <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', color: '#333', fontSize: '1.2rem' }}>Care Information</h4>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Water Needs</label>
                            <textarea
                                value={careWater}
                                onChange={e => setCareWater(e.target.value)}
                                placeholder="Watering schedule & amount..."
                                style={{ minHeight: '60px' }}
                            />
                        </div>
                        <div className="form-group">
                            <label>Sunlight Guidelines</label>
                            <textarea
                                value={careSunlight}
                                onChange={e => setCareSunlight(e.target.value)}
                                placeholder="Prefers direct, indirect, shade..."
                                style={{ minHeight: '60px' }}
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Soil Type</label>
                            <textarea
                                value={careSoil}
                                onChange={e => setCareSoil(e.target.value)}
                                placeholder="Soil drainage, pH, compost..."
                                style={{ minHeight: '60px' }}
                            />
                        </div>
                        <div className="form-group">
                            <label>General Maintenance</label>
                            <textarea
                                value={careMaintenance}
                                onChange={e => setCareMaintenance(e.target.value)}
                                placeholder="Pruning, fertilizer, repotting..."
                                style={{ minHeight: '60px' }}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Icon Image</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={e => setIconFile(e.target.files?.[0] || null)}
                                style={{ padding: '0.5rem', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                            {(iconFile || iconUrl) && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <img
                                        src={iconFile ? URL.createObjectURL(iconFile) : iconUrl}
                                        alt="Icon preview"
                                        style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #eee' }}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label>Main Image</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={e => setImageFile(e.target.files?.[0] || null)}
                                style={{ padding: '0.5rem', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                            {(imageFile || imageUrl) && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <img
                                        src={imageFile ? URL.createObjectURL(imageFile) : imageUrl}
                                        alt="Main image preview"
                                        style={{ maxWidth: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #eee' }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button type="submit" className="btn" disabled={isUploading}>
                            {isUploading ? 'Uploading...' : editingPlantId ? 'Save Changes' : 'Create Plant'}
                        </button>
                        {(isCreating || editingPlantId) && (
                            <button type="button" className="btn" onClick={cancelEdit} style={{ background: '#f4f4f4', color: '#1a1a1a', borderColor: '#eaeaea' }}>
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            )}

            {!isCreating && !editingPlantId && (
                plantsLoading ? <p>Loading plants...</p> : (
                    viewMode === 'card' ? (
                        <div className="plant-list" style={{ position: 'relative' }}>
                            {displayedPlants.map((plant: Plant) => {
                                const isSelected = selectedPlantIds.includes(plant.id);
                                return (
                                    <div
                                        key={plant.id}
                                        className={`plant-card ${isSelected ? 'selected-card' : ''}`}
                                        onClick={(e) => handleRowClick(plant.id, e)}
                                        style={{
                                            cursor: 'pointer',
                                            outline: isSelected ? '2px solid #0056b3' : 'none',
                                            transition: 'outline 0.15s ease-in-out',
                                            userSelect: 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedPlantIds(prev =>
                                                            prev.includes(plant.id) ? prev.filter(p => p !== plant.id) : [...prev, plant.id]
                                                        );
                                                    }}
                                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                    onClick={e => e.stopPropagation()}
                                                />
                                                {plant.icon_url ? (
                                                    <img
                                                        src={plant.icon_url}
                                                        alt=""
                                                        style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }}
                                                    />
                                                ) : (
                                                    <div style={{ width: '32px', height: '32px', background: '#eee', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span style={{ fontSize: '10px', color: '#999' }}>No img</span>
                                                    </div>
                                                )}
                                                <h3 style={{ margin: 0 }}>{plant.common_name}</h3>
                                            </div>
                                            <div className="actions-menu-container">
                                                <button
                                                    className="icon-btn"
                                                    onClick={(e) => toggleDropdown(plant.id, e)}
                                                >
                                                    ⋮
                                                </button>
                                                {activeDropdown === plant.id && (
                                                    <div className="dropdown-menu">
                                                        <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); openSingleProjectModal(plant.id); }}>
                                                            Add to Project
                                                        </button>
                                                        <button className="dropdown-item" onClick={() => handleEdit(plant)}>
                                                            Edit
                                                        </button>
                                                        <button
                                                            className="dropdown-item danger"
                                                            onClick={() => handleDelete(plant.id, plant.common_name)}
                                                            disabled={selectedPlantIds.length > 0}
                                                            style={selectedPlantIds.length > 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="taxonomy-info">
                                            <i>{plant.scientific_name}</i>
                                        </div>
                                        <div className="plant-meta">
                                            <span className="tag">{plant.category}</span>
                                            <span className="tag">{plant.planting_place}</span>
                                        </div>
                                        <p>{plant.description}</p>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="plants-table-container">
                            <div className="plant-table-header">
                                <div style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={displayedPlants.length > 0 && selectedPlantIds.length === displayedPlants.length}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedPlantIds(displayedPlants.map((p: Plant) => p.id));
                                            } else {
                                                setSelectedPlantIds([]);
                                            }
                                        }}
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                </div>
                                <div style={{ width: '48px' }}>Icon</div>
                                <div style={{ flex: 2 }}>Common Name</div>
                                <div style={{ flex: 2 }}>Scientific Name</div>
                                <div style={{ flex: 1 }}>Category</div>
                                <div style={{ flex: 1 }}>Place</div>
                                <div style={{ width: '40px' }}></div>
                            </div>
                            {displayedPlants.map((plant: Plant) => {
                                const isSelected = selectedPlantIds.includes(plant.id);
                                return (
                                    <div
                                        key={plant.id}
                                        className={`plant-table-row ${isSelected ? 'selected-row' : ''}`}
                                        onClick={(e) => handleRowClick(plant.id, e)}
                                        style={{
                                            cursor: 'pointer',
                                            backgroundColor: isSelected ? '#f0f8ff' : '',
                                            userSelect: 'none'
                                        }}
                                    >
                                        <div style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedPlantIds(prev =>
                                                        prev.includes(plant.id) ? prev.filter(p => p !== plant.id) : [...prev, plant.id]
                                                    );
                                                }}
                                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        </div>
                                        <div style={{ width: '48px', display: 'flex', alignItems: 'center' }}>
                                            {plant.icon_url ? (
                                                <img src={plant.icon_url} alt="" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }} />
                                            ) : (
                                                <div style={{ width: '32px', height: '32px', background: '#eee', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <span style={{ fontSize: '10px', color: '#999' }}>-</span>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ flex: 2, fontWeight: '500', color: '#1a1a1a' }}>{plant.common_name}</div>
                                        <div style={{ flex: 2, fontStyle: 'italic', color: '#888', fontFamily: 'serif' }}>{plant.scientific_name}</div>
                                        <div style={{ flex: 1 }}><span className="tag">{plant.category}</span></div>
                                        <div style={{ flex: 1 }}><span className="tag">{plant.planting_place}</span></div>
                                        <div style={{ width: '40px', textAlign: 'right' }}>
                                            <div className="actions-menu-container">
                                                <button className="icon-btn" onClick={(e) => toggleDropdown(`table-${plant.id}`, e)}>⋮</button>
                                                {activeDropdown === `table-${plant.id}` && (
                                                    <div className="dropdown-menu">
                                                        <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); openSingleProjectModal(plant.id); }}>Add to Project</button>
                                                        <button className="dropdown-item" onClick={() => handleEdit(plant)}>Edit</button>
                                                        <button
                                                            className="dropdown-item danger"
                                                            onClick={() => handleDelete(plant.id, plant.common_name)}
                                                            disabled={selectedPlantIds.length > 0}
                                                            style={selectedPlantIds.length > 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                                        >Delete</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )
                )
            )}

            {/* Bulk Selection ToolBar */}
            {!isCreating && !editingPlantId && selectedPlantIds.length > 0 && !showProjectModal && (
                <div style={{
                    position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
                    background: '#222', color: 'white', padding: '1rem 2rem', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', gap: '1.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 100
                }}>
                    <span style={{ fontWeight: '500' }}>{selectedPlantIds.length} plant(s) selected</span>
                    <button className="btn" style={{ background: '#fff', color: '#222', padding: '0.4rem 1rem', fontSize: '0.9rem' }} onClick={() => setShowProjectModal(true)}>
                        Add to Project
                    </button>
                    <button className="btn btn-cancel" style={{ background: 'transparent', color: '#ccc', border: '1px solid #666', padding: '0.4rem 1rem', fontSize: '0.9rem' }} onClick={() => setSelectedPlantIds([])}>
                        Clear
                    </button>
                </div>
            )
            }

            {/* Project Selection Modal */}
            {showProjectModal && (
                <div className="confirm-overlay" style={{ zIndex: 110 }}>
                    <div className="confirm-dialog">
                        <h3>Select Project for {selectedPlantIds.length} Plant(s)</h3>
                        <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                            <select
                                value={selectedProjectId}
                                onChange={e => setSelectedProjectId(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #ccc' }}
                            >
                                <option value="" disabled>-- Choose a Project --</option>
                                {projectsData?.map(proj => (
                                    <option key={proj.id} value={proj.id}>{proj.name} ({proj.client_name})</option>
                                ))}
                            </select>
                        </div>
                        <div className="confirm-actions">
                            <button className="btn btn-cancel" onClick={() => setShowProjectModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn"
                                style={{ background: selectedProjectId ? '#0056b3' : '#ccc', color: '#fff' }}
                                disabled={!selectedProjectId}
                                onClick={() => addPlantsToProjectMutation.mutate({ projectId: selectedProjectId, plantIds: selectedPlantIds })}
                            >
                                Add Plants
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
};
