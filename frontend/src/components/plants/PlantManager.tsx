import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plantsApi } from '../../api/plants';
import { taxonomyApi } from '../../api/taxonomy';
import { projectsApi } from '../../api/projects';
import { PlantingPlace } from '../../types/plant';
import type { PlantCreate, Plant } from '../../types/plant';
import { ioApi } from '../../api/io';
import { useAlert } from '../../contexts/AlertContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { categoriesApi } from '../../api/categories';
import { aiApi } from '../../api/ai';
import { TaxonomyFormTable } from './TaxonomyFormTable';

// Shadcn components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

// Lucide icons
import {
    LayoutGrid,
    LayoutList,
    Plus,
    X,
    Upload,
    Sparkles,
    Loader2,
    MoreVertical,
    Leaf,
    FolderOpen,
    Pencil,
    Trash2,
} from 'lucide-react';

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

    // Queries
    const { data: projectsData } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.getAll });
    const { data: plants, isLoading: plantsLoading } = useQuery({ queryKey: ['plants'], queryFn: plantsApi.getAll });
    const { data: taxonomyTree } = useQuery({ queryKey: ['taxonomy', 'tree'], queryFn: taxonomyApi.getTree });
    const { data: categoriesOptions } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.getAll });

    // Mutations
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
            if (!target.closest('.actions-menu-container')) setActiveDropdown(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filters & Sort
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('__all__');
    const [filterIndoor, setFilterIndoor] = useState(false);
    const [filterOutdoor, setFilterOutdoor] = useState(false);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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
    const [careWater, setCareWater] = useState('');
    const [careSunlight, setCareSunlight] = useState('');
    const [careSoil, setCareSoil] = useState('');
    const [careMaintenance, setCareMaintenance] = useState('');

    useEffect(() => {
        if (location.state?.editPlant && plants && taxonomyTree) {
            handleEdit(location.state.editPlant);
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
            if (data.planting_place === 'Indoor') { setIsIndoor(true); setIsOutdoor(false); }
            else if (data.planting_place === 'Outdoor') { setIsIndoor(false); setIsOutdoor(true); }
            else if (data.planting_place === 'Indoor & Outdoor') { setIsIndoor(true); setIsOutdoor(true); }
            if (data.care_data) {
                setCareWater(data.care_data.water || '');
                setCareSunlight(data.care_data.sunlight || '');
                setCareSoil(data.care_data.soil || '');
                setCareMaintenance(data.care_data.maintenance || '');
            }
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
                if (data.taxonomy.genus && data.taxonomy.species) setScientificName(`${data.taxonomy.genus} ${data.taxonomy.species}`);
                else if (data.taxonomy.species) setScientificName(data.taxonomy.species);
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
        setCommonName(''); setCategory(''); setIsIndoor(true); setIsOutdoor(true);
        setDescription(''); setCommonDiseases(''); setScientificName(''); setTaxonId(null);
        setIconFile(null); setImageFile(null); setIconUrl(''); setImageUrl('');
        setCareWater(''); setCareSunlight(''); setCareSoil(''); setCareMaintenance('');
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
        setIconFile(null); setImageFile(null);
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
            onConfirm: () => deleteMutation.mutate(id),
        });
        setActiveDropdown(null);
    };

    const toggleDropdown = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveDropdown(activeDropdown === id ? null : id);
    };

    const handleRowClick = (id: string, e: React.MouseEvent) => {
        if ((e.target as Element).closest('.actions-menu-container') ||
            (e.target as Element).closest('.dropdown-menu') ||
            (e.target as Element).tagName.toLowerCase() === 'input') return;
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
        if (isCreating || editingPlantId) { cancelEdit(); }
        else { setEditingPlantId(null); resetForm(); setIsCreating(true); }
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
            // Upload local file selections first
            if (iconFile) { const res = await plantsApi.uploadImage(iconFile, 'icon'); finalIconUrl = res.url; }
            if (imageFile) { const res = await plantsApi.uploadImage(imageFile, 'image'); finalImageUrl = res.url; }

            // Upload AI-fetched URLs (non-Cloudinary) to Cloudinary
            const isCloudinaryUrl = (url: string) => url.includes('res.cloudinary.com');

            if (!iconFile && finalIconUrl && !isCloudinaryUrl(finalIconUrl)) {
                try {
                    const res = await plantsApi.uploadImageFromUrl(finalIconUrl, 'icon');
                    finalIconUrl = res.url;
                } catch {
                    showAlert("Could not upload icon image to Cloudinary — the AI-suggested image may not exist. It will be skipped.", 'warning');
                    finalIconUrl = '';
                }
            }
            if (!imageFile && finalImageUrl && !isCloudinaryUrl(finalImageUrl)) {
                try {
                    const res = await plantsApi.uploadImageFromUrl(finalImageUrl, 'image');
                    finalImageUrl = res.url;
                } catch {
                    showAlert("Could not upload main image to Cloudinary — the AI-suggested image may not exist. It will be skipped.", 'warning');
                    finalImageUrl = '';
                }
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
                maintenance: careMaintenance.trim() || undefined,
            };
        }
        const plantData: Partial<PlantCreate> = {
            common_name: commonName, scientific_name: scientificName, category,
            planting_place: plantingPlace, description, common_diseases: commonDiseases,
            taxon_id: taxonId || undefined, icon_url: finalIconUrl || undefined,
            image_url: finalImageUrl || undefined, care_data: parsedCareData,
        };
        if (editingPlantId) { updateMutation.mutate({ id: editingPlantId, data: plantData }); }
        else { createMutation.mutate(plantData as PlantCreate); }
    };

    const displayedPlants = useMemo(() => {
        if (!plants) return [];
        return [...plants].filter(plant => {
            const matchesSearch = plant.common_name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === '__all__' || plant.category === filterCategory;
            let matchesPlace = true;
            if (filterIndoor && !filterOutdoor) matchesPlace = plant.planting_place === PlantingPlace.INDOOR || plant.planting_place === PlantingPlace.BOTH;
            else if (!filterIndoor && filterOutdoor) matchesPlace = plant.planting_place === PlantingPlace.OUTDOOR || plant.planting_place === PlantingPlace.BOTH;
            else if (filterIndoor && filterOutdoor) matchesPlace = plant.planting_place === PlantingPlace.BOTH;
            return matchesSearch && matchesCategory && matchesPlace;
        }).sort((a, b) => {
            return sortOrder === 'asc' ? a.common_name.toLowerCase().localeCompare(b.common_name.toLowerCase()) : b.common_name.toLowerCase().localeCompare(a.common_name.toLowerCase());
        });
    }, [plants, searchTerm, filterCategory, filterIndoor, filterOutdoor, sortOrder]);

    // ─── Reusable label ───────────────────────────────────────────────────────
    const FieldLabel = ({ children }: { children: React.ReactNode }) => (
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</span>
    );

    return (
        <TooltipProvider>
            <div>
                {/* ── Page Header ───────────────────────────────────────────── */}
                <div className="mb-6">
                    {/* Row 1: Title */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                            {isCreating || editingPlantId ? 'Plant Editor' : 'Plant Catalog'}
                        </h2>
                    </div>

                    {/* Row 2: Controls (view toggle + actions) */}
                    {!isCreating && !editingPlantId && (
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            {/* View toggle */}
                            <div className="flex bg-muted rounded-lg p-1 gap-0.5">
                                <Button
                                    variant={viewMode === 'card' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('card')}
                                    className="h-7 px-2.5 text-xs gap-1.5"
                                >
                                    <LayoutGrid size={13} /> Cards
                                </Button>
                                <Button
                                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('table')}
                                    className="h-7 px-2.5 text-xs gap-1.5"
                                >
                                    <LayoutList size={13} /> List
                                </Button>
                            </div>

                            {/* spacer pushes import + add to the right */}
                            <div className="flex-1" />

                            {/* Import CSV */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <label className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-background text-sm font-medium text-foreground cursor-pointer hover:bg-muted transition-colors shrink-0">
                                        <Upload size={14} />
                                        <span className="hidden sm:inline">Import CSV</span>
                                        <span className="sm:hidden">Import</span>
                                        <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                                    </label>
                                </TooltipTrigger>
                                <TooltipContent>Import plants from CSV file</TooltipContent>
                            </Tooltip>

                            {/* Add Plant */}
                            <Button
                                onClick={toggleCreate}
                                variant="default"
                                size="sm"
                                className="gap-1.5 shrink-0"
                            >
                                <Plus size={14} /> Add Plant
                            </Button>
                        </div>
                    )}

                    {/* Cancel button when editing */}
                    {(isCreating || editingPlantId) && (
                        <div className="flex mt-3">
                            <Button
                                onClick={toggleCreate}
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                            >
                                <X size={14} /> Cancel
                            </Button>
                        </div>
                    )}
                </div>

                {/* ── Filters ───────────────────────────────────────────────── */}
                {!isCreating && !editingPlantId && (
                    <div className="flex flex-col gap-2 mb-5 sm:flex-row sm:flex-wrap">
                        {/* Search — always full width on mobile */}
                        <Input
                            placeholder="Search catalog..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full sm:flex-1 sm:min-w-[180px] h-9 bg-background"
                        />

                        {/* Second row on mobile: category + checkboxes + sort */}
                        <div className="flex flex-wrap gap-2">
                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                <SelectTrigger className="w-[160px] h-9 bg-background">
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">All Categories</SelectItem>
                                    {categoriesOptions?.map(c => (
                                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <div className="flex items-center gap-3 h-9 px-3 rounded-md border border-input bg-background">
                                <label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground cursor-pointer select-none">
                                    <input type="checkbox" checked={filterIndoor} onChange={e => setFilterIndoor(e.target.checked)} className="accent-primary" /> Indoor
                                </label>
                                <label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground cursor-pointer select-none">
                                    <input type="checkbox" checked={filterOutdoor} onChange={e => setFilterOutdoor(e.target.checked)} className="accent-primary" /> Outdoor
                                </label>
                            </div>

                            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'asc' | 'desc')}>
                                <SelectTrigger className="w-[90px] h-9 bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="asc">A → Z</SelectItem>
                                    <SelectItem value="desc">Z → A</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {/* ── Create / Edit Form ────────────────────────────────────── */}
                {(isCreating || editingPlantId) && (
                    <Card className="mb-6 shadow-sm">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg">
                                {editingPlantId ? 'Edit Plant' : 'New Plant'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* Row 1: Common + Scientific */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <FieldLabel>Common Name</FieldLabel>
                                        <div className="flex gap-2">
                                            <Input
                                                value={commonName}
                                                onChange={e => setCommonName(e.target.value)}
                                                required
                                                placeholder="e.g. Snake Plant"
                                                className="flex-1"
                                            />
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        onClick={() => aiMutation.mutate()}
                                                        disabled={aiMutation.isPending || (!commonName.trim() && !scientificName.trim())}
                                                        className={`gap-1.5 shrink-0 font-semibold ${aiMutation.isPending ? '' : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0'}`}
                                                        variant={aiMutation.isPending ? 'secondary' : 'default'}
                                                        size="sm"
                                                    >
                                                        {aiMutation.isPending
                                                            ? <><Loader2 size={13} className="animate-spin" /> Loading…</>
                                                            : <><Sparkles size={13} /> AI Fill</>
                                                        }
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Auto-fill plant details using Gemini AI</TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <FieldLabel>Scientific Name</FieldLabel>
                                        <Input
                                            value={scientificName}
                                            onChange={e => setScientificName(e.target.value)}
                                            placeholder="e.g. Sansevieria trifasciata"
                                            className="italic"
                                        />
                                    </div>
                                </div>

                                {/* Taxonomy */}
                                <div className="flex flex-col gap-1.5">
                                    <FieldLabel>Taxonomy Line</FieldLabel>
                                    <TaxonomyFormTable
                                        taxonomyTree={taxonomyTree || []}
                                        selectedTaxonId={taxonId}
                                        onChange={setTaxonId}
                                    />
                                </div>

                                {/* Category + Place */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <FieldLabel>Category</FieldLabel>
                                        <Select value={category} onValueChange={setCategory} required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select category…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categoriesOptions?.map(c => (
                                                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <FieldLabel>Planting Place</FieldLabel>
                                        <div className="flex gap-5 mt-1.5">
                                            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                                <input type="checkbox" checked={isIndoor} onChange={e => setIsIndoor(e.target.checked)} className="accent-primary" /> Indoor
                                            </label>
                                            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                                <input type="checkbox" checked={isOutdoor} onChange={e => setIsOutdoor(e.target.checked)} className="accent-primary" /> Outdoor
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="flex flex-col gap-1.5">
                                    <FieldLabel>Description</FieldLabel>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Brief description of this plant…"
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[80px]"
                                    />
                                </div>

                                {/* Common Diseases */}
                                <div className="flex flex-col gap-1.5">
                                    <FieldLabel>Common Diseases & Pests</FieldLabel>
                                    <textarea
                                        value={commonDiseases}
                                        onChange={e => setCommonDiseases(e.target.value)}
                                        placeholder="Known diseases and pest susceptibility…"
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[60px]"
                                    />
                                </div>

                                <Separator />

                                {/* Care Info */}
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Care Information</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {[
                                        { label: 'Water Needs', value: careWater, set: setCareWater, placeholder: 'Watering schedule & amount…' },
                                        { label: 'Sunlight Guidelines', value: careSunlight, set: setCareSunlight, placeholder: 'Prefers direct, indirect, shade…' },
                                        { label: 'Soil Type', value: careSoil, set: setCareSoil, placeholder: 'Soil drainage, pH, compost…' },
                                        { label: 'General Maintenance', value: careMaintenance, set: setCareMaintenance, placeholder: 'Pruning, fertilizer, repotting…' },
                                    ].map(({ label, value, set, placeholder }) => (
                                        <div key={label} className="flex flex-col gap-1.5">
                                            <FieldLabel>{label}</FieldLabel>
                                            <textarea
                                                value={value}
                                                onChange={e => set(e.target.value)}
                                                placeholder={placeholder}
                                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[60px]"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <Separator />

                                {/* Images */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <FieldLabel>Icon Image</FieldLabel>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => setIconFile(e.target.files?.[0] || null)}
                                            className="rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:bg-muted file:text-xs file:font-medium"
                                        />
                                        {(iconFile || iconUrl) && (
                                            <img
                                                src={iconFile ? URL.createObjectURL(iconFile) : iconUrl}
                                                alt="Icon preview"
                                                className="w-16 h-16 object-cover rounded-lg border border-border mt-1"
                                            />
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <FieldLabel>Main Image</FieldLabel>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => setImageFile(e.target.files?.[0] || null)}
                                            className="rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:bg-muted file:text-xs file:font-medium"
                                        />
                                        {(imageFile || imageUrl) && (
                                            <img
                                                src={imageFile ? URL.createObjectURL(imageFile) : imageUrl}
                                                alt="Main image preview"
                                                className="w-full h-28 object-cover rounded-lg border border-border mt-1"
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-1">
                                    <Button type="submit" disabled={isUploading} className="gap-1.5">
                                        {isUploading
                                            ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                                            : editingPlantId ? 'Save Changes' : 'Create Plant'
                                        }
                                    </Button>
                                    <Button type="button" variant="outline" onClick={cancelEdit} className="gap-1.5">
                                        <X size={14} /> Cancel
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* ── Plant List ────────────────────────────────────────────── */}
                {!isCreating && !editingPlantId && (
                    plantsLoading ? (
                        /* Loading skeletons */
                        viewMode === 'card' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <Card key={i} className="p-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <Skeleton className="w-9 h-9 rounded-lg" />
                                            <Skeleton className="h-4 flex-1" />
                                        </div>
                                        <Skeleton className="h-3 w-2/3 mb-2" />
                                        <div className="flex gap-1.5">
                                            <Skeleton className="h-4 w-16 rounded-full" />
                                            <Skeleton className="h-4 w-16 rounded-full" />
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="p-0">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0">
                                            <Skeleton className="w-8 h-8 rounded-md" />
                                            <Skeleton className="h-4 flex-1" />
                                            <Skeleton className="h-4 w-32 hidden sm:block" />
                                            <Skeleton className="h-4 w-20 hidden md:block" />
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )
                    ) : viewMode === 'card' ? (
                        /* Card grid */
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {displayedPlants.map((plant: Plant) => {
                                const isSelected = selectedPlantIds.includes(plant.id);
                                return (
                                    <Card
                                        key={plant.id}
                                        onClick={(e) => handleRowClick(plant.id, e)}
                                        className={`cursor-pointer select-none transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => { e.stopPropagation(); setSelectedPlantIds(prev => prev.includes(plant.id) ? prev.filter(p => p !== plant.id) : [...prev, plant.id]); }}
                                                        onClick={e => e.stopPropagation()}
                                                        className="w-4 h-4 cursor-pointer accent-primary shrink-0"
                                                    />
                                                    {plant.icon_url
                                                        ? <img src={plant.icon_url} alt="" className="w-9 h-9 object-cover rounded-lg shrink-0" />
                                                        : <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center shrink-0"><Leaf size={14} className="text-muted-foreground" /></div>
                                                    }
                                                    <h3 className="font-medium text-foreground text-sm leading-tight">{plant.common_name}</h3>
                                                </div>
                                                {/* Actions dropdown */}
                                                <div className="actions-menu-container relative" onClick={e => e.stopPropagation()}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground"
                                                        onClick={(e) => toggleDropdown(plant.id, e)}
                                                    >
                                                        <MoreVertical size={14} />
                                                    </Button>
                                                    {activeDropdown === plant.id && (
                                                        <div className="dropdown-menu absolute right-0 top-full mt-1 bg-background border border-border rounded-lg shadow-lg z-10 w-40 overflow-hidden">
                                                            <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2" onClick={(e) => { e.stopPropagation(); openSingleProjectModal(plant.id); }}>
                                                                <FolderOpen size={13} /> Add to Project
                                                            </button>
                                                            <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2" onClick={() => handleEdit(plant)}>
                                                                <Pencil size={13} /> Edit
                                                            </button>
                                                            <button className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2 disabled:opacity-40" onClick={() => handleDelete(plant.id, plant.common_name)} disabled={selectedPlantIds.length > 0}>
                                                                <Trash2 size={13} /> Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-xs italic text-muted-foreground mb-2">{plant.scientific_name}</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide font-bold">{plant.category}</Badge>
                                                <Badge variant="outline" className="text-[10px] uppercase tracking-wide font-bold">{plant.planting_place}</Badge>
                                            </div>
                                            {plant.description && (
                                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2">{plant.description}</p>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        /* Table / list view */
                        <Card className="overflow-hidden">
                            {/* Header row */}
                            <div className="flex items-center px-4 py-3 bg-muted/50 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                <div className="w-9 flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        checked={displayedPlants.length > 0 && selectedPlantIds.length === displayedPlants.length}
                                        onChange={(e) => { e.target.checked ? setSelectedPlantIds(displayedPlants.map((p: Plant) => p.id)) : setSelectedPlantIds([]); }}
                                        className="w-4 h-4 cursor-pointer accent-primary"
                                    />
                                </div>
                                <div className="w-11">Icon</div>
                                <div className="flex-[2]">Common Name</div>
                                <div className="flex-[2] hidden sm:block">Scientific Name</div>
                                <div className="flex-1 hidden md:block">Category</div>
                                <div className="flex-1 hidden md:block">Place</div>
                                <div className="w-10" />
                            </div>
                            {/* Data rows */}
                            {displayedPlants.map((plant: Plant) => {
                                const isSelected = selectedPlantIds.includes(plant.id);
                                return (
                                    <div
                                        key={plant.id}
                                        onClick={(e) => handleRowClick(plant.id, e)}
                                        className={`flex items-center px-4 py-3 border-b border-border last:border-b-0 cursor-pointer select-none transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/40'}`}
                                    >
                                        <div className="w-9 flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => { e.stopPropagation(); setSelectedPlantIds(prev => prev.includes(plant.id) ? prev.filter(p => p !== plant.id) : [...prev, plant.id]); }}
                                                onClick={e => e.stopPropagation()}
                                                className="w-4 h-4 cursor-pointer accent-primary"
                                            />
                                        </div>
                                        <div className="w-11">
                                            {plant.icon_url
                                                ? <img src={plant.icon_url} alt="" className="w-8 h-8 object-cover rounded-md" />
                                                : <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center"><Leaf size={12} className="text-muted-foreground" /></div>
                                            }
                                        </div>
                                        <div className="flex-[2] font-medium text-foreground text-sm">{plant.common_name}</div>
                                        <div className="flex-[2] italic text-muted-foreground text-sm hidden sm:block">{plant.scientific_name}</div>
                                        <div className="flex-1 hidden md:block">
                                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide font-bold">{plant.category}</Badge>
                                        </div>
                                        <div className="flex-1 hidden md:block">
                                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide font-bold">{plant.planting_place}</Badge>
                                        </div>
                                        <div className="w-10 flex justify-end actions-menu-container" onClick={e => e.stopPropagation()}>
                                            <div className="relative">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-muted-foreground"
                                                    onClick={(e) => toggleDropdown(`table-${plant.id}`, e)}
                                                >
                                                    <MoreVertical size={14} />
                                                </Button>
                                                {activeDropdown === `table-${plant.id}` && (
                                                    <div className="dropdown-menu absolute right-0 top-full mt-1 bg-background border border-border rounded-lg shadow-lg z-10 w-40 overflow-hidden">
                                                        <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2" onClick={(e) => { e.stopPropagation(); openSingleProjectModal(plant.id); }}>
                                                            <FolderOpen size={13} /> Add to Project
                                                        </button>
                                                        <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2" onClick={() => handleEdit(plant)}>
                                                            <Pencil size={13} /> Edit
                                                        </button>
                                                        <button className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2 disabled:opacity-40" onClick={() => handleDelete(plant.id, plant.common_name)} disabled={selectedPlantIds.length > 0}>
                                                            <Trash2 size={13} /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </Card>
                    )
                )}

                {/* ── Bulk selection floating toolbar ───────────────────────── */}
                {!isCreating && !editingPlantId && selectedPlantIds.length > 0 && !showProjectModal && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50">
                        <span className="text-sm font-medium">{selectedPlantIds.length} plant(s) selected</span>
                        <Separator orientation="vertical" className="h-4 bg-background/30" />
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setShowProjectModal(true)}
                            className="gap-1.5 text-foreground"
                        >
                            <FolderOpen size={13} /> Add to Project
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedPlantIds([])}
                            className="gap-1.5 text-background/80 hover:text-background hover:bg-white/10"
                        >
                            <X size={13} /> Clear
                        </Button>
                    </div>
                )}

                {/* ── Add to Project Dialog ─────────────────────────────────── */}
                <Dialog open={showProjectModal} onOpenChange={setShowProjectModal}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add {selectedPlantIds.length} Plant(s) to Project</DialogTitle>
                        </DialogHeader>
                        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                            <SelectTrigger>
                                <SelectValue placeholder="— Choose a Project —" />
                            </SelectTrigger>
                            <SelectContent>
                                {projectsData?.map(proj => (
                                    <SelectItem key={proj.id} value={proj.id}>{proj.name} ({proj.client_name})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <DialogFooter className="mt-2">
                            <Button variant="outline" onClick={() => setShowProjectModal(false)}>Cancel</Button>
                            <Button
                                disabled={!selectedProjectId || addPlantsToProjectMutation.isPending}
                                onClick={() => addPlantsToProjectMutation.mutate({ projectId: selectedProjectId, plantIds: selectedPlantIds })}
                                className="gap-1.5"
                            >
                                {addPlantsToProjectMutation.isPending ? <><Loader2 size={13} className="animate-spin" /> Adding…</> : 'Add Plants'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
};
