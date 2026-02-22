import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft, Download, Plus, Pencil, Trash2, Leaf,
    User, MapPin,
} from 'lucide-react';

import { projectsApi } from '../../api/projects';
import { plantsApi } from '../../api/plants';
import { ioApi } from '../../api/io';
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

export const ProjectDetails = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const { showAlert } = useAlert();
    const { confirm } = useConfirm();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPlantId, setEditingPlantId] = useState<string | null>(null);
    const [selectedPlantId, setSelectedPlantId] = useState('');
    const [notes, setNotes] = useState('');

    const { data: project, isLoading } = useQuery({
        queryKey: ['project', id],
        queryFn: () => projectsApi.getById(id!),
        enabled: !!id,
    });

    const { data: allPlants } = useQuery({
        queryKey: ['plants'],
        queryFn: plantsApi.getAll,
    });

    const addPlantMutation = useMutation({
        mutationFn: (data: ProjectPlantCreate) => projectsApi.addPlant(id!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project', id] });
            showAlert('Plant added to project', 'success');
            closeDialog();
        },
        onError: (error: any) => {
            showAlert('Failed to add plant: ' + (error.response?.data?.detail || error.message), 'error');
        },
    });

    const updatePlantMutation = useMutation({
        mutationFn: (data: ProjectPlantCreate) => projectsApi.updatePlant(id!, editingPlantId!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project', id] });
            showAlert('Plant updated', 'success');
            closeDialog();
        },
        onError: (error: any) => {
            showAlert('Failed to update plant: ' + (error.response?.data?.detail || error.message), 'error');
        },
    });

    const deletePlantMutation = useMutation({
        mutationFn: (plantId: string) => projectsApi.removePlant(id!, plantId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project', id] });
            showAlert('Plant removed', 'success');
        },
        onError: (error: any) => {
            showAlert('Failed to remove plant: ' + (error.response?.data?.detail || error.message), 'error');
        },
    });

    const openAdd = () => {
        setEditingPlantId(null);
        setSelectedPlantId('');
        setNotes('');
        setIsDialogOpen(true);
    };

    const openEdit = (plantId: string, currentNotes: string) => {
        setEditingPlantId(plantId);
        setSelectedPlantId(plantId);
        setNotes(currentNotes);
        setIsDialogOpen(true);
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setEditingPlantId(null);
        setSelectedPlantId('');
        setNotes('');
    };

    const handleDeletePlant = (plantId: string, plantName: string) => {
        confirm({
            title: 'Remove Plant',
            message: `Remove "${plantName}" from this project?`,
            confirmText: 'Remove',
            cancelText: 'Cancel',
            onConfirm: () => deletePlantMutation.mutate(plantId),
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlantId) { showAlert('Please select a plant', 'warning'); return; }
        const payload = { plant_id: selectedPlantId, notes };
        if (editingPlantId) {
            updatePlantMutation.mutate(payload);
        } else {
            addPlantMutation.mutate(payload);
        }
    };

    const isSaving = addPlantMutation.isPending || updatePlantMutation.isPending;

    /* ── Loading ── */
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
            <Button asChild variant="link" className="mt-2">
                <Link to="/projects">← Back to Projects</Link>
            </Button>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto">
            {/* Back nav */}
            <div className="mb-6">
                <Button asChild variant="outline" size="sm">
                    <Link to="/projects">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Projects
                    </Link>
                </Button>
            </div>

            {/* Project header card */}
            <div className="rounded-xl border border-border bg-white shadow-sm p-5 sm:p-6 mb-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground leading-tight">
                            {project.name}
                        </h1>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
                            {project.client_name && (
                                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <User className="w-3.5 h-3.5" /> {project.client_name}
                                </span>
                            )}
                            {project.location && (
                                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <MapPin className="w-3.5 h-3.5" /> {project.location}
                                </span>
                            )}
                        </div>
                        {project.description && (
                            <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                                {project.description}
                            </p>
                        )}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 w-full sm:w-auto"
                        onClick={() => ioApi.exportProjectPdf(project.id, project.name)}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                    </Button>
                </div>
            </div>

            {/* Plants section */}
            <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Leaf className="w-4 h-4 text-primary" />
                        <h2 className="font-semibold text-foreground">Plants List</h2>
                        <Badge variant="secondary" className="tabular-nums">
                            {project.plants.length}
                        </Badge>
                    </div>
                    <Button size="sm" onClick={openAdd}>
                        <Plus className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Add Plant</span>
                        <span className="sm:hidden">Add</span>
                    </Button>
                </div>

                {/* Table */}
                {project.plants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <Leaf className="w-8 h-8 mb-3 opacity-20" />
                        <p className="text-sm">No plants added yet.</p>
                        <Button variant="link" size="sm" className="mt-1" onClick={openAdd}>
                            Add the first plant
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="font-semibold">Plant</TableHead>
                                    <TableHead className="font-semibold hidden sm:table-cell">Category</TableHead>
                                    <TableHead className="font-semibold hidden md:table-cell">Notes</TableHead>
                                    <TableHead className="text-right font-semibold w-24">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {project.plants.map((pp) => (
                                    <TableRow key={pp.plant_id} className="hover:bg-muted/20 transition-colors">
                                        <TableCell>
                                            <p className="font-medium text-foreground leading-tight">
                                                {pp.plant?.common_name}
                                            </p>
                                            <p className="text-xs text-muted-foreground italic mt-0.5">
                                                {pp.plant?.taxon?.name}
                                            </p>
                                            {pp.notes && (
                                                <p className="text-xs text-muted-foreground mt-1 md:hidden">
                                                    {pp.notes}
                                                </p>
                                            )}
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            {pp.plant?.category ? (
                                                <Badge variant="outline" className="text-xs">
                                                    {pp.plant.category}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground/50 text-sm">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                            {pp.notes || <span className="opacity-40">—</span>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    onClick={() => openEdit(pp.plant_id, pp.notes || '')}
                                                    title="Edit notes"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleDeletePlant(pp.plant_id, pp.plant?.common_name || 'Plant')}
                                                    title="Remove plant"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {/* Add / Edit Plant Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={(o) => !o && closeDialog()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingPlantId ? 'Edit Plant Entry' : 'Add Plant to Project'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="pp-plant">Plant <span className="text-destructive">*</span></Label>
                            <Select
                                value={selectedPlantId}
                                onValueChange={setSelectedPlantId}
                                disabled={!!editingPlantId}
                                required
                            >
                                <SelectTrigger id="pp-plant">
                                    <SelectValue placeholder="Select a plant…" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {allPlants?.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.common_name}
                                            {p.taxon?.name ? ` (${p.taxon.name})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="pp-notes">Notes</Label>
                            <Input
                                id="pp-notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Location notes, sizes, quantities…"
                            />
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button type="button" variant="outline" onClick={closeDialog} disabled={isSaving}>
                                Cancel
                            </Button>
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
