import { useState, useMemo, useEffect, memo, useCallback, Fragment } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft, Download, Plus, Pencil, Trash2, Leaf,
    User, MapPin, ExternalLink, Search, ChevronUp, ChevronDown,
    ChevronsUpDown, ChevronLeft, ChevronRight,
    Link2, Copy, Check, RefreshCw, FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportProjectBoqPdf } from './ProjectBoqPdfDocument';

import { projectsApi } from '../../api/projects';
import type { ShareLinkInfo } from '../../api/projects';
import { plantsApi } from '../../api/plants';
import { taxonomyApi } from '../../api/taxonomy';
import type { ProjectPlantCreate } from '../../types/project';
import { useAlert } from '../../contexts/AlertContext';
import { useConfirm } from '../../contexts/ConfirmContext';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

/* ── types ── */
type SortKey = 'common_name' | 'scientific_name' | 'category' | 'planting_place' | 'notes';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

/* ── SortHeader helper ── */
function SortTh({
    label, col, sortKey, sortDir, onSort, className = '',
}: {
    label: string; col: SortKey; sortKey: SortKey; sortDir: SortDir;
    onSort: (col: SortKey) => void; className?: string;
}) {
    const active = sortKey === col;
    return (
        <TableHead
            className={`font-semibold cursor-pointer select-none hover:bg-muted/40 transition-colors ${className}`}
            onClick={() => onSort(col)}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                {active
                    ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    : <ChevronsUpDown className="w-3 h-3 opacity-30" />}
            </span>
        </TableHead>
    );
}


/* ─── Memoized Row ─── */
interface ProjectPlantRowProps {
    pp: any;
    idx: number;
    safePage: number;
    pageSize: number;
    onEdit: (plantId: string, notes: string) => void;
    onDelete: (plantId: string, plantName: string) => void;
}

const ProjectPlantRowMemo = memo(({ pp, idx, safePage, pageSize, onEdit, onDelete }: ProjectPlantRowProps) => {
    return (
        <TableRow key={pp.plant_id} className="hover:bg-muted/20 transition-colors">
            {/* # */}
            <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                {(safePage - 1) * pageSize + idx + 1}
            </TableCell>

            {/* Plant */}
            <TableCell>
                <div className="flex items-center gap-3">
                    {/* Icon/Image */}
                    <div className="shrink-0">
                        {pp.plant?.icon_url ? (
                            <img
                                src={pp.plant.icon_url}
                                alt=""
                                className="w-10 h-10 object-cover rounded-lg border border-border/50"
                            />
                        ) : (
                            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center border border-border/50 shadow-sm">
                                <Leaf size={16} className="text-muted-foreground/50" />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <Link
                            to="/plants/$id"
                            params={{ id: pp.plant_id }}
                            className="group/plant inline-flex items-start gap-1 font-medium text-foreground hover:text-primary transition-colors leading-tight"
                        >
                            <span className="truncate">{pp.plant?.common_name}</span>
                            <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-0 group-hover/plant:opacity-50 transition-opacity" />
                        </Link>

                        {/* Mobile details: Scientific + Category */}
                        <div className="flex flex-col gap-1 mt-1 sm:hidden">
                            <p className="text-xs text-muted-foreground italic truncate">
                                {pp.plant?.scientific_name || pp.plant?.taxon?.name || 'Unknown species'}
                            </p>
                            {pp.plant?.category && (
                                <div>
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">
                                        {pp.plant.category}
                                    </Badge>
                                </div>
                            )}
                        </div>

                        {/* Desktop scientific fallback */}
                        <p className="hidden sm:block text-xs text-muted-foreground italic truncate md:hidden">
                            {pp.plant?.scientific_name || pp.plant?.taxon?.name}
                        </p>
                    </div>
                </div>

                {/* notes on mobile */}
                {pp.notes && (
                    <p className="text-xs text-muted-foreground mt-2 md:hidden pl-[52px]">
                        {pp.notes}
                    </p>
                )}
            </TableCell>

            {/* Scientific */}
            <TableCell className="hidden sm:table-cell text-xs text-muted-foreground italic">
                {pp.plant?.scientific_name || pp.plant?.taxon?.name || <span className="opacity-30">—</span>}
            </TableCell>

            {/* Category */}
            <TableCell className="hidden md:table-cell">
                {pp.plant?.category
                    ? <Badge variant="outline" className="text-xs">{pp.plant.category}</Badge>
                    : <span className="text-muted-foreground/40 text-sm">—</span>}
            </TableCell>

            {/* Place */}
            <TableCell className="hidden lg:table-cell">
                {pp.plant?.planting_place
                    ? <Badge variant="secondary" className="text-xs">{pp.plant.planting_place}</Badge>
                    : <span className="text-muted-foreground/40 text-sm">—</span>}
            </TableCell>

            {/* Notes */}
            <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[180px] truncate">
                {pp.notes || <span className="opacity-30">—</span>}
            </TableCell>

            {/* Actions */}
            <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                    <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => onEdit(pp.plant_id, pp.notes || '')}
                        title="Edit notes"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(pp.plant_id, pp.plant?.common_name || 'Plant')}
                        title="Remove plant"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
});

const ProjectBoqRow = ({
    pp,
    idx,
    onDelete,
    onUpdate,
    isSelected,
    onSelectChange
}: {
    pp: any;
    idx: number;
    onDelete: (plantId: string, plantName: string) => void;
    onUpdate: (plantId: string, data: any) => Promise<void>;
    isSelected: boolean;
    onSelectChange: (plantId: string, selected: boolean) => void;
}) => {
    const [localQty, setLocalQty] = useState(pp.quantity !== undefined && pp.quantity !== null ? String(pp.quantity) : '');
    const [localUnit, setLocalUnit] = useState(pp.unit ?? '');
    const [localSize, setLocalSize] = useState(pp.optimum_height_size ?? '');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setLocalQty(pp.quantity !== undefined && pp.quantity !== null ? String(pp.quantity) : '');
        setLocalUnit(pp.unit ?? '');
        setLocalSize(pp.optimum_height_size ?? '');
    }, [pp.quantity, pp.unit, pp.optimum_height_size]);

    const handleBlur = async (field: 'quantity' | 'unit' | 'optimum_height_size', value: string) => {
        const trimmed = value.trim();
        let hasChanged = false;
        if (field === 'quantity') {
            const parsed = trimmed ? parseFloat(trimmed) : null;
            const original = pp.quantity !== undefined && pp.quantity !== null ? pp.quantity : null;
            hasChanged = parsed !== original;
        } else if (field === 'unit') {
            const original = pp.unit ?? '';
            hasChanged = trimmed !== original;
        } else if (field === 'optimum_height_size') {
            const original = pp.optimum_height_size ?? '';
            hasChanged = trimmed !== original;
        }

        if (!hasChanged) return;

        setSaving(true);
        try {
            const parsedQty = field === 'quantity' ? (trimmed ? parseFloat(trimmed) : null) : (localQty.trim() ? parseFloat(localQty) : null);
            const currentUnit = field === 'unit' ? trimmed : localUnit;
            const currentSize = field === 'optimum_height_size' ? trimmed : localSize;
            
            await onUpdate(pp.plant_id, {
                plant_id: pp.plant_id,
                notes: pp.notes,
                quantity: parsedQty === null ? undefined : parsedQty,
                unit: currentUnit || undefined,
                optimum_height_size: currentSize || undefined
            });
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <TableRow className={`hover:bg-muted/10 transition-colors ${saving ? 'opacity-70 bg-muted/5' : ''}`}>
            {/* # */}
            <TableCell className="text-center font-medium text-xs tabular-nums text-muted-foreground w-12">
                {idx + 1}
            </TableCell>
            
            {/* Checkbox */}
            <TableCell className="w-10 text-center">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelectChange(pp.plant_id, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                />
            </TableCell>

            {/* Image */}
            <TableCell className="w-16">
                <div className="flex justify-center">
                    {pp.plant?.icon_url ? (
                        <img
                            src={pp.plant.icon_url}
                            alt=""
                            className="w-10 h-10 object-cover rounded-lg border border-border/50 shadow-sm"
                        />
                    ) : (
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center border border-border/50">
                            <Leaf size={16} className="text-muted-foreground/40" />
                        </div>
                    )}
                </div>
            </TableCell>

            {/* Common Name */}
            <TableCell className="font-semibold text-foreground max-w-[150px] truncate">
                {pp.plant?.common_name || '—'}
            </TableCell>

            {/* Scientific Name */}
            <TableCell className="italic text-muted-foreground text-xs max-w-[180px] truncate">
                {pp.plant?.scientific_name || pp.plant?.taxon?.name || '—'}
            </TableCell>

            {/* Unit */}
            <TableCell className="w-24">
                <input
                    type="text"
                    value={localUnit}
                    onChange={(e) => setLocalUnit(e.target.value)}
                    onBlur={() => handleBlur('unit', localUnit)}
                    placeholder="—"
                    className="w-full text-sm font-medium bg-transparent hover:bg-muted/20 focus:bg-white focus:border-border border border-transparent rounded px-2 py-1 transition-all h-8 text-muted-foreground focus:text-foreground focus:outline-none"
                />
            </TableCell>

            {/* Quantity */}
            <TableCell className="w-24">
                <input
                    type="number"
                    step="any"
                    min="0"
                    value={localQty}
                    onChange={(e) => setLocalQty(e.target.value)}
                    onBlur={() => handleBlur('quantity', localQty)}
                    placeholder="—"
                    className="w-full text-sm font-semibold bg-transparent hover:bg-muted/20 focus:bg-white focus:border-border border border-transparent rounded px-2 py-1 transition-all h-8 text-foreground focus:outline-none tabular-nums"
                />
            </TableCell>

            {/* Height/Size */}
            <TableCell className="w-36">
                <input
                    type="text"
                    value={localSize}
                    onChange={(e) => setLocalSize(e.target.value)}
                    onBlur={() => handleBlur('optimum_height_size', localSize)}
                    placeholder="—"
                    className="w-full text-sm font-medium bg-transparent hover:bg-muted/20 focus:bg-white focus:border-border border border-transparent rounded px-2 py-1 transition-all h-8 text-foreground focus:outline-none"
                />
            </TableCell>

            {/* Actions */}
            <TableCell className="text-right w-16">
                <div className="flex items-center justify-end gap-1">
                    <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(pp.plant_id, pp.plant?.common_name || 'Plant')}
                        title="Remove plant"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
};

export const ProjectDetails = () => {
    const { id } = useParams({ strict: false }) as { id: string };
    const queryClient = useQueryClient();
    const { showAlert } = useAlert();
    const { confirm } = useConfirm();

    /* ── Dialog state ── */
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPlantId, setEditingPlantId] = useState<string | null>(null);
    const [selectedPlantId, setSelectedPlantId] = useState('');
    const [notes, setNotes] = useState('');
    const [quantity, setQuantity] = useState('');
    const [unit, setUnit] = useState('');
    const [optimumHeightSize, setOptimumHeightSize] = useState('');

    /* ── Table state ── */
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('__all__');
    const [sortKey, setSortKey] = useState<SortKey>('common_name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [pdfLoading, setPdfLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'standard' | 'boq'>('standard');
    const [pdfBoqLoading, setPdfBoqLoading] = useState(false);
    const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>([]);
    const [bulkUpdating, setBulkUpdating] = useState(false);
    const [bulkUnit, setBulkUnit] = useState('');
    const [bulkQty, setBulkQty] = useState('');
    const [bulkSize, setBulkSize] = useState('');

    useEffect(() => {
        setSelectedPlantIds([]);
    }, [viewMode]);

    /* ── Share link state ── */
    const [shareLink, setShareLink] = useState<ShareLinkInfo | null>(null);
    const [shareLinkLoaded, setShareLinkLoaded] = useState(false);
    const [copied, setCopied] = useState(false);

    const generateShareMutation = useMutation({
        mutationFn: () => projectsApi.generateShareLink(id!),
        onSuccess: (data) => setShareLink(data),
    });

    /* ── Fetch existing share link on mount ── */
    useEffect(() => {
        if (!id) return;
        projectsApi.getShareLink(id).then((link) => {
            setShareLink(link);
            setShareLinkLoaded(true);
        }).catch(() => setShareLinkLoaded(true));
    }, [id]);

    const fullShareUrl = shareLink
        ? `${window.location.origin}${shareLink.url}`
        : null;

    const handleCopyLink = async () => {
        if (!fullShareUrl) return;
        await navigator.clipboard.writeText(fullShareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    /* ── Queries ── */
    const { data: project, isLoading } = useQuery({
        queryKey: ['project', id],
        queryFn: () => projectsApi.getById(id!),
        enabled: !!id,
    });

    const { data: allPlantsData } = useQuery({
        queryKey: ['plants', 'all-picker'],
        queryFn: () => plantsApi.getAll({ limit: 1000 }), // Load more for picker
    });
    const allPlants = allPlantsData?.items || [];

    const { data: taxTree } = useQuery({
        queryKey: ['taxonomy', 'tree'],
        queryFn: () => taxonomyApi.getTree(),
    });

    const handleDownloadPdf = async () => {
        if (!project) return;
        setPdfLoading(true);
        try {
            const { prepareProjectImageCache } = await import('../../utils/pdf-images');
            const imgCache = await prepareProjectImageCache(project);
            
            const { exportProjectPdfNew } = await import('./ProjectPdfDocument');
            await exportProjectPdfNew(project, taxTree, imgCache, project.name);
        } catch (e) {
            console.error(e);
            showAlert('PDF export failed', 'error');
        } finally {
            setPdfLoading(false);
        }
    };

    const handleExportBoqPdf = async () => {
        if (!project) return;
        setPdfBoqLoading(true);
        try {
            const { prepareProjectImageCache } = await import('../../utils/pdf-images');
            const imgCache = await prepareProjectImageCache(project);
            await exportProjectBoqPdf(project, imgCache, project.name);
        } catch (e) {
            console.error(e);
            showAlert('BOQ PDF export failed', 'error');
        } finally {
            setPdfBoqLoading(false);
        }
    };

    const handleExportBoqExcel = () => {
        if (!project) return;
        try {
            const rows = project.plants.map((pp, idx) => ({
                "S. No.": idx + 1,
                "Common Name": pp.plant?.common_name || '—',
                "Scientific Name": pp.plant?.scientific_name || pp.plant?.taxon?.name || '—',
                "Optimum Height / Size": pp.optimum_height_size || '—',
                "Quantity": pp.quantity !== undefined && pp.quantity !== null ? pp.quantity : '—',
                "Unit": pp.unit || '—',
                "Notes": pp.notes || '—'
            }));

            const worksheet = XLSX.utils.json_to_sheet([]);
            
            // Add header info (Landschaft BOQ)
            XLSX.utils.sheet_add_aoa(worksheet, [
                ["LANDSCHAFT - BILL OF QUANTITIES"],
                [],
                [`Project Name:`, project.name],
                [`Client:`, project.client_name || '—'],
                [`Location:`, project.location || '—'],
                [`Date:`, new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })],
                [],
            ], { origin: "A1" });

            // Add table headers and data
            XLSX.utils.sheet_add_json(worksheet, rows, { origin: "A8", skipHeader: false });

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "BOQ");

            // Set column widths
            const maxLens = [10, 25, 25, 25, 12, 10, 30];
            worksheet["!cols"] = maxLens.map(w => ({ wch: w }));

            XLSX.writeFile(workbook, `${project.name}_BOQ.xlsx`);
            showAlert('Excel exported successfully', 'success');
        } catch (e) {
            console.error(e);
            showAlert('Excel export failed', 'error');
        }
    };

    /* ── Mutations ── */
    const addPlantMutation = useMutation({
        mutationFn: (data: ProjectPlantCreate) => projectsApi.addPlant(id!, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['project', id] }); showAlert('Plant added to project', 'success'); closeDialog(); },
        onError: (e: any) => { showAlert('Failed to add plant: ' + (e.response?.data?.detail || e.message), 'error'); },
    });

    const updatePlantMutation = useMutation({
        mutationFn: (data: ProjectPlantCreate) => projectsApi.updatePlant(id!, editingPlantId!, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['project', id] }); showAlert('Plant updated', 'success'); closeDialog(); },
        onError: (e: any) => { showAlert('Failed to update plant: ' + (e.response?.data?.detail || e.message), 'error'); },
    });

    const deletePlantMutation = useMutation({
        mutationFn: (plantId: string) => projectsApi.removePlant(id!, plantId),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['project', id] }); showAlert('Plant removed', 'success'); },
        onError: (e: any) => { showAlert('Failed to remove: ' + (e.response?.data?.detail || e.message), 'error'); },
    });

    const updateBoqFieldsMutation = useMutation({
        mutationFn: (data: { plantId: string } & Partial<ProjectPlantCreate>) => {
            const { plantId, ...payload } = data;
            return projectsApi.updatePlant(id!, plantId, payload as ProjectPlantCreate);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project', id] });
        },
        onError: (e: any) => {
            showAlert('Failed to update: ' + (e.response?.data?.detail || e.message), 'error');
        }
    });

    const handleUpdateBoqFields = useCallback(async (plantId: string, data: any) => {
        try {
            await updateBoqFieldsMutation.mutateAsync({ plantId, ...data });
        } catch (e) {
            // Error already shown in mutation onError
        }
    }, [updateBoqFieldsMutation]);

    const handleBulkEdit = async (data: { quantity?: number; unit?: string; optimum_height_size?: string }) => {
        if (selectedPlantIds.length === 0) return;
        setBulkUpdating(true);
        try {
            const promises = selectedPlantIds.map(plantId => {
                const pp = project?.plants.find(item => item.plant_id === plantId);
                const payload: ProjectPlantCreate = {
                    plant_id: plantId,
                    notes: pp?.notes,
                    quantity: data.quantity !== undefined ? data.quantity : pp?.quantity,
                    unit: data.unit !== undefined ? data.unit : pp?.unit,
                    optimum_height_size: data.optimum_height_size !== undefined ? data.optimum_height_size : pp?.optimum_height_size,
                };
                return projectsApi.updatePlant(id!, plantId, payload);
            });
            await Promise.all(promises);
            queryClient.invalidateQueries({ queryKey: ['project', id] });
            showAlert('Bulk update completed successfully', 'success');
            setSelectedPlantIds([]);
        } catch (e: any) {
            showAlert('Bulk update failed: ' + (e.message || 'error'), 'error');
        } finally {
            setBulkUpdating(false);
        }
    };

    const handleSelectChange = useCallback((plantId: string, selected: boolean) => {
        setSelectedPlantIds(prev => {
            if (selected) {
                return prev.includes(plantId) ? prev : [...prev, plantId];
            } else {
                return prev.filter(id => id !== plantId);
            }
        });
    }, []);

    const handleSelectAllChange = useCallback((selected: boolean, visiblePlants: any[]) => {
        if (selected) {
            const allIds = visiblePlants.map(pp => pp.plant_id);
            setSelectedPlantIds(allIds);
        } else {
            setSelectedPlantIds([]);
        }
    }, []);

    /* ── Dialog helpers ── */
    const openAdd = useCallback(() => {
        setEditingPlantId(null);
        setSelectedPlantId('');
        setNotes('');
        setQuantity('');
        setUnit('');
        setOptimumHeightSize('');
        setIsDialogOpen(true);
    }, []);
    const openEdit = useCallback((plantId: string) => {
        if (!project) return;
        const pp = project.plants.find(p => p.plant_id === plantId);
        if (!pp) return;
        setEditingPlantId(plantId);
        setSelectedPlantId(plantId);
        setNotes(pp.notes ?? '');
        setQuantity(pp.quantity !== undefined && pp.quantity !== null ? String(pp.quantity) : '');
        setUnit(pp.unit ?? '');
        setOptimumHeightSize(pp.optimum_height_size ?? '');
        setIsDialogOpen(true);
    }, [project]);
    const closeDialog = useCallback(() => {
        setIsDialogOpen(false);
        setEditingPlantId(null);
        setSelectedPlantId('');
        setNotes('');
        setQuantity('');
        setUnit('');
        setOptimumHeightSize('');
    }, []);

    const handleDeletePlant = useCallback((plantId: string, plantName: string) => {
        confirm({ title: 'Remove Plant', message: `Remove "${plantName}" from this project?`, confirmText: 'Remove', cancelText: 'Cancel', onConfirm: () => deletePlantMutation.mutate(plantId) });
    }, [confirm, deletePlantMutation]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlantId) { showAlert('Please select a plant', 'warning'); return; }
        const parsedQty = quantity.trim() ? parseFloat(quantity) : undefined;
        const payload = {
            plant_id: selectedPlantId,
            notes: notes.trim() || undefined,
            quantity: parsedQty,
            unit: unit.trim() || undefined,
            optimum_height_size: optimumHeightSize.trim() || undefined
        };
        editingPlantId ? updatePlantMutation.mutate(payload) : addPlantMutation.mutate(payload);
    };

    const isSaving = addPlantMutation.isPending || updatePlantMutation.isPending;

    /* ── Sort handler ── */
    const handleSort = useCallback((col: SortKey) => {
        setSortKey(prevKey => {
            if (prevKey === col) {
                setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                return prevKey;
            }
            setSortDir('asc');
            return col;
        });
        setPage(1);
    }, []);

    /* ── Derived data ── */
    const uniqueCategories = useMemo(() => {
        if (!project) return [];
        const cats = new Set(project.plants.map(pp => pp.plant?.category).filter(Boolean) as string[]);
        return Array.from(cats).sort();
    }, [project]);

    const filteredSorted = useMemo(() => {
        if (!project) return [];
        const q = search.toLowerCase();

        return [...project.plants]
            .filter(pp => {
                const matchSearch = !q
                    || pp.plant?.common_name?.toLowerCase().includes(q)
                    || pp.plant?.scientific_name?.toLowerCase().includes(q)
                    || (pp.notes || '').toLowerCase().includes(q);
                const matchCat = categoryFilter === '__all__' || pp.plant?.category === categoryFilter;
                return matchSearch && matchCat;
            })
            .sort((a, b) => {
                let av = '', bv = '';
                if (sortKey === 'common_name') { av = a.plant?.common_name || ''; bv = b.plant?.common_name || ''; }
                else if (sortKey === 'scientific_name') { av = a.plant?.scientific_name || ''; bv = b.plant?.scientific_name || ''; }
                else if (sortKey === 'category') { av = a.plant?.category || ''; bv = b.plant?.category || ''; }
                else if (sortKey === 'planting_place') { av = a.plant?.planting_place || ''; bv = b.plant?.planting_place || ''; }
                else if (sortKey === 'notes') { av = a.notes || ''; bv = b.notes || ''; }
                return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
            });
    }, [project, search, categoryFilter, sortKey, sortDir]);

    const boqGroups = useMemo(() => {
        const groups = new Map<string, typeof filteredSorted>();
        for (const pp of filteredSorted) {
            const cat = pp.plant?.category || 'Uncategorized';
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat)!.push(pp);
        }
        return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filteredSorted]);

    const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const pageSlice = filteredSorted.slice((safePage - 1) * pageSize, safePage * pageSize);

    /* ── Loading states ── */
    if (isLoading) return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
        </div>
    );
    if (!project) return (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-sm">Project not found.</p>
            <Button asChild variant="link" className="mt-2"><Link to="/projects">← Back to Projects</Link></Button>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto">
            {/* Back nav */}
            <div className="mb-6">
                <Button asChild variant="outline" size="sm">
                    <Link to="/projects"><ArrowLeft className="w-4 h-4 mr-2" />Back to Projects</Link>
                </Button>
            </div>

            {/* Project header card */}
            <div className="rounded-xl border border-border bg-white shadow-sm p-5 sm:p-6 mb-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground leading-tight">{project.name}</h1>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
                            {project.client_name && (
                                <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><User className="w-3.5 h-3.5" /> {project.client_name}</span>
                            )}
                            {project.location && (
                                <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="w-3.5 h-3.5" /> {project.location}</span>
                            )}
                        </div>
                        {project.description && (
                            <p className="text-sm text-muted-foreground leading-relaxed mt-3">{project.description}</p>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* ── Share link group ── */}
                        {shareLinkLoaded && (
                            <div className="flex items-center gap-1.5">
                                {shareLink ? (
                                    <>
                                        <button
                                            onClick={handleCopyLink}
                                            title={fullShareUrl || ''}
                                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-white text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                                        >
                                            <Link2 className="w-3.5 h-3.5 text-primary" />
                                            <span className="hidden sm:inline max-w-[140px] truncate text-xs text-muted-foreground">
                                                {fullShareUrl}
                                            </span>
                                            {copied
                                                ? <Check className="w-3.5 h-3.5 text-green-600" />
                                                : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                                        </button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                            onClick={() => generateShareMutation.mutate()}
                                            disabled={generateShareMutation.isPending}
                                            title="Regenerate link (new 2-day expiry)"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${generateShareMutation.isPending ? 'animate-spin' : ''}`} />
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => generateShareMutation.mutate()}
                                        disabled={generateShareMutation.isPending}
                                        className="h-9 gap-1.5"
                                    >
                                        <Link2 className="w-3.5 h-3.5" />
                                        {generateShareMutation.isPending ? 'Generating…' : 'Public Link'}
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* ── Download PDF button ── */}
                        <Button
                            variant="outline" size="sm"
                            className="h-9"
                            onClick={handleDownloadPdf}
                            disabled={pdfLoading}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            {pdfLoading ? 'Generating PDF…' : 'Download PDF'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Plants section */}
            <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">

                {/* Section header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Leaf className="w-4 h-4 text-primary" />
                        <h2 className="font-semibold text-foreground">Plants List</h2>
                        <Badge variant="secondary" className="tabular-nums">{project.plants.length}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/20">
                            <button
                                type="button"
                                onClick={() => setViewMode('standard')}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'standard' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                Standard List
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('boq')}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'boq' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                BOQ View
                            </button>
                        </div>
                        <Button size="sm" onClick={openAdd}>
                            <Plus className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">Add Plant</span>
                            <span className="sm:hidden">Add</span>
                        </Button>
                    </div>
                </div>

                {project.plants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <Leaf className="w-8 h-8 mb-3 opacity-20" />
                        <p className="text-sm">No plants added yet.</p>
                        <Button variant="link" size="sm" className="mt-1" onClick={openAdd}>Add the first plant</Button>
                    </div>
                ) : viewMode === 'boq' ? (
                    <>
                        {/* BOQ Header Document Section */}
                        <div className="p-5 border-b border-border bg-gradient-to-r from-background to-[#fdfcfb]">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[10px] tracking-wider uppercase font-semibold text-primary border-primary/20 bg-primary/5">
                                            Landscape BOQ
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
                                        <div>
                                            <span className="font-semibold text-foreground mr-1.5">Client Name:</span>
                                            {project.client_name || <span className="opacity-40 italic">Not Specified</span>}
                                        </div>
                                        <div>
                                            <span className="font-semibold text-foreground mr-1.5">Date:</span>
                                            {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </div>
                                        <div className="sm:col-span-2">
                                            <span className="font-semibold text-foreground mr-1.5">Location:</span>
                                            {project.location || <span className="opacity-40 italic">Not Specified</span>}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-2 shrink-0 md:border-l md:border-border md:pl-6">
                                    {/* Landschaft Logo */}
                                    <div className="flex flex-col items-center gap-1.5">
                                        <svg viewBox="0 0 400 400" className="w-14 h-14" xmlns="http://www.w3.org/2000/svg">
                                            <g transform="translate(-85,0)">
                                                <path fill="#2d5a27" d="M125 70 Q125 40 155 40 H245 Q275 40 275 70 V190 H125 Z" />
                                                <path fill="#8aa87f" d="M125 210 H275 V360 H155 Q125 360 125 330 V210 Z" />
                                                <path fill="#e4ddd1" d="M295 210 H415 Q445 210 445 240 V330 Q445 360 415 360 H295 V210 Z" />
                                            </g>
                                        </svg>
                                        <span className="text-[10px] font-bold tracking-[0.25em] text-[#2d5a27] leading-none">LANDSCHAFT</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border/50">
                                <Button variant="outline" size="sm" className="h-8.5 font-medium border-green-600/30 hover:border-green-600/50 hover:bg-green-50/50 text-green-700 transition-colors" onClick={handleExportBoqExcel}>
                                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Export Excel
                                </Button>
                                <Button variant="outline" size="sm" className="h-8.5 font-medium border-red-600/30 hover:border-red-600/50 hover:bg-red-50/50 text-red-700 transition-colors" onClick={handleExportBoqPdf} disabled={pdfBoqLoading}>
                                    {pdfBoqLoading ? 'Generating PDF…' : <><Download className="w-3.5 h-3.5 mr-1.5" /> Export PDF</>}
                                </Button>
                            </div>
                        </div>

                        {/* Bulk Edit Toolbar */}
                        {selectedPlantIds.length > 0 && (
                            <div className="mx-5 my-3 p-4 bg-primary/5 border border-primary/20 rounded-xl flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-semibold text-primary">Bulk Edit Selected</h4>
                                    <p className="text-xs text-muted-foreground">
                                        Modifying <span className="font-semibold text-foreground">{selectedPlantIds.length}</span> plants. Leave fields blank to keep their current values.
                                    </p>
                                </div>
                                <div className="grid grid-cols-3 gap-3 flex-1 max-w-xl">
                                    <div className="space-y-1">
                                        <Label htmlFor="bulk-unit" className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Unit</Label>
                                        <Input
                                            id="bulk-unit"
                                            placeholder="e.g. Nos."
                                            className="h-8 text-xs bg-white"
                                            value={bulkUnit}
                                            onChange={(e) => setBulkUnit(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="bulk-qty" className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Quantity</Label>
                                        <Input
                                            id="bulk-qty"
                                            type="number"
                                            step="any"
                                            placeholder="e.g. 25"
                                            className="h-8 text-xs bg-white"
                                            value={bulkQty}
                                            onChange={(e) => setBulkQty(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="bulk-size" className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Height / Size</Label>
                                        <Input
                                            id="bulk-size"
                                            placeholder="e.g. 2m"
                                            className="h-8 text-xs bg-white"
                                            value={bulkSize}
                                            onChange={(e) => setBulkSize(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() => setSelectedPlantIds([])}
                                        disabled={bulkUpdating}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="h-8 text-xs bg-primary text-white hover:bg-primary/95"
                                        onClick={async () => {
                                            const qtyVal = bulkQty.trim() ? parseFloat(bulkQty) : undefined;
                                            const unitVal = bulkUnit.trim() ? bulkUnit : undefined;
                                            const sizeVal = bulkSize.trim() ? bulkSize : undefined;
                                            if (qtyVal === undefined && unitVal === undefined && sizeVal === undefined) {
                                                showAlert('Please enter at least one value to update', 'warning');
                                                return;
                                            }
                                            await handleBulkEdit({
                                                quantity: qtyVal,
                                                unit: unitVal,
                                                optimum_height_size: sizeVal
                                            });
                                            setBulkQty('');
                                            setBulkUnit('');
                                            setBulkSize('');
                                        }}
                                        disabled={bulkUpdating}
                                    >
                                        {bulkUpdating ? 'Applying…' : 'Apply'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* BOQ Table View */}
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30">
                                        <TableHead className="w-12 font-semibold text-center">#</TableHead>
                                        <TableHead className="w-10 text-center">
                                            <input
                                                type="checkbox"
                                                checked={filteredSorted.length > 0 && selectedPlantIds.length === filteredSorted.length}
                                                onChange={(e) => handleSelectAllChange(e.target.checked, filteredSorted)}
                                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                                            />
                                        </TableHead>
                                        <TableHead className="w-16 text-center font-semibold">Image</TableHead>
                                        <TableHead className="font-semibold">Common Name</TableHead>
                                        <TableHead className="font-semibold">Scientific Name</TableHead>
                                        <TableHead className="font-semibold">Unit</TableHead>
                                        <TableHead className="font-semibold">Quantity</TableHead>
                                        <TableHead className="font-semibold">Height / Size</TableHead>
                                        <TableHead className="text-right font-semibold w-16">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredSorted.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                                                No plants found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        boqGroups.map(([category, pps]) => (
                                            <Fragment key={category}>
                                                {/* Group Header Row */}
                                                <TableRow className="bg-muted/5 hover:bg-muted/5 border-b border-border/80">
                                                    <TableCell colSpan={9} className="py-2 px-5 font-bold text-primary text-xs uppercase tracking-wider bg-muted/10 border-l-[3px] border-primary/70">
                                                        {category} ({pps.length})
                                                    </TableCell>
                                                </TableRow>
                                                {pps.map((pp, idx) => (
                                                    <ProjectBoqRow
                                                        key={pp.plant_id}
                                                        pp={pp}
                                                        idx={idx}
                                                        onDelete={handleDeletePlant}
                                                        onUpdate={handleUpdateBoqFields}
                                                        isSelected={selectedPlantIds.includes(pp.plant_id)}
                                                        onSelectChange={handleSelectChange}
                                                    />
                                                ))}
                                            </Fragment>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                ) : (
                    <>
                        {/* ── Toolbar ── */}
                        <div className="flex flex-row flex-wrap items-center gap-2 px-5 py-3 border-b border-border bg-muted/20">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[180px]">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                    placeholder="Search plants, notes…"
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                                    className="pl-8 h-8 text-sm bg-background w-full"
                                />
                            </div>

                            {/* Filters Group */}
                            <div className="flex items-center gap-2">
                                {/* Category filter */}
                                <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setPage(1); }}>
                                    <SelectTrigger className="w-[125px] sm:w-[150px] h-8 text-sm bg-background">
                                        <SelectValue placeholder="All categories" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__all__">All categories</SelectItem>
                                        {uniqueCategories.map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Page size */}
                                <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
                                    <SelectTrigger className="w-[75px] sm:w-[90px] h-8 text-sm bg-background">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAGE_SIZE_OPTIONS.map(n => (
                                            <SelectItem key={n} value={String(n)}>{n} / pg</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* ── Table ── */}
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30">
                                        <TableHead className="w-8 font-semibold text-center">#</TableHead>
                                        <SortTh label="Plant" col="common_name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="pl-0" />
                                        <SortTh label="Scientific" col="scientific_name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
                                        <SortTh label="Category" col="category" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                                        <SortTh label="Place" col="planting_place" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
                                        <SortTh label="Notes" col="notes" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                                        <TableHead className="text-right font-semibold w-20">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pageSlice.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                                                No plants match your search.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        pageSlice.map((pp, idx) => (
                                            <ProjectPlantRowMemo
                                                key={pp.plant_id}
                                                pp={pp}
                                                idx={idx}
                                                safePage={safePage}
                                                pageSize={pageSize}
                                                onEdit={openEdit}
                                                onDelete={handleDeletePlant}
                                            />
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* ── Pagination ── */}
                        <div className="flex flex-col gap-2 px-5 py-3 border-t border-border bg-muted/10 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-muted-foreground order-2 sm:order-1">
                                {filteredSorted.length === 0
                                    ? 'No results'
                                    : `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filteredSorted.length)} of ${filteredSorted.length} plants`}
                            </p>
                            <div className="flex items-center gap-1.5 order-1 sm:order-2">
                                <Button
                                    variant="outline" size="icon"
                                    className="h-7 w-7"
                                    disabled={safePage <= 1}
                                    onClick={() => setPage(1)}
                                    title="First page"
                                >
                                    <ChevronLeft className="w-3 h-3" />
                                </Button>
                                <Button
                                    variant="outline" size="sm"
                                    className="h-7 px-2 text-xs"
                                    disabled={safePage <= 1}
                                    onClick={() => setPage(p => p - 1)}
                                >
                                    <ChevronLeft className="w-3 h-3 mr-1" /> Prev
                                </Button>
                                <span className="text-xs text-muted-foreground px-1 tabular-nums">
                                    {safePage} / {totalPages}
                                </span>
                                <Button
                                    variant="outline" size="sm"
                                    className="h-7 px-2 text-xs"
                                    disabled={safePage >= totalPages}
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    Next <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                                <Button
                                    variant="outline" size="icon"
                                    className="h-7 w-7"
                                    disabled={safePage >= totalPages}
                                    onClick={() => setPage(totalPages)}
                                    title="Last page"
                                >
                                    <ChevronRight className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ── Add / Edit Plant Dialog ── */}
            <Dialog open={isDialogOpen} onOpenChange={(o) => !o && closeDialog()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingPlantId ? 'Edit Plant Entry' : 'Add Plant to Project'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="pp-plant">Plant <span className="text-destructive">*</span></Label>
                            <Select value={selectedPlantId} onValueChange={setSelectedPlantId} disabled={!!editingPlantId} required>
                                <SelectTrigger id="pp-plant">
                                    <SelectValue placeholder="Select a plant…" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {allPlants.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.common_name}{p.taxon?.name ? ` (${p.taxon.name})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="pp-quantity">Quantity</Label>
                                <Input
                                    id="pp-quantity"
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    placeholder="e.g. 15"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="pp-unit">Unit</Label>
                                <Input
                                    id="pp-unit"
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    placeholder="e.g. Nos."
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="pp-height-size">Optimum Height / Size</Label>
                            <Input
                                id="pp-height-size"
                                value={optimumHeightSize}
                                onChange={(e) => setOptimumHeightSize(e.target.value)}
                                placeholder="e.g. 1.5 - 2.0 m"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="pp-notes">Notes</Label>
                            <Input
                                id="pp-notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Special instructions, placement..."
                            />
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button type="button" variant="outline" onClick={closeDialog} disabled={isSaving}>Cancel</Button>
                            <Button type="submit" disabled={isSaving || !selectedPlantId}>
                                {isSaving ? 'Saving…' : editingPlantId ? 'Save Changes' : 'Add to Project'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

        </div>
    );
};
