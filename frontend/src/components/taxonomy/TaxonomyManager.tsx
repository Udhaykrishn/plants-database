import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ChevronRight, ChevronDown, Plus, Pencil, Trash2, Search, ListTree,
} from 'lucide-react';

import { taxonomyApi } from '../../api/taxonomy';
import { Rank } from '../../types/taxon';
import type { TaxonTree } from '../../types/taxon';
import { useAlert } from '../../contexts/AlertContext';
import { useConfirm } from '../../contexts/ConfirmContext';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/* ─── Tree Node ─────────────────────────────────────────── */
interface TreeNodeProps {
    node: TaxonTree;
    onSelect: (node: TaxonTree) => void;
    selectedId?: string;
    searchTerm?: string;
}

const rankColor: Record<string, string> = {
    KINGDOM: 'bg-violet-100 text-violet-700',
    PHYLUM: 'bg-blue-100 text-blue-700',
    CLASS: 'bg-cyan-100 text-cyan-700',
    ORDER: 'bg-teal-100 text-teal-700',
    FAMILY: 'bg-green-100 text-green-700',
    GENUS: 'bg-lime-100 text-lime-700',
    SPECIES: 'bg-yellow-100 text-yellow-700',
};

const TreeNode = ({ node, onSelect, selectedId, searchTerm }: TreeNodeProps) => {
    const [expanded, setExpanded] = useState(false);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = node.id === selectedId;

    const lowerSearch = searchTerm?.toLowerCase() || '';
    const isMatch =
        !!searchTerm &&
        (node.name.toLowerCase().includes(lowerSearch) || node.rank.toLowerCase().includes(lowerSearch));

    useEffect(() => {
        if (searchTerm && searchTerm.length > 0) {
            setExpanded(!isMatch);
        } else {
            setExpanded(false);
        }
    }, [searchTerm, isMatch]);

    return (
        <div>
            <div
                className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer select-none transition-colors group',
                    isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted/60 text-foreground',
                    isMatch && !isSelected && 'bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200',
                )}
                onClick={() => onSelect(node)}
            >
                {/* expand toggle */}
                <span
                    className="flex items-center justify-center w-4 h-4 shrink-0"
                    onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                >
                    {hasChildren ? (
                        expanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        )
                    ) : (
                        <span className="w-3.5" />
                    )}
                </span>

                {/* rank badge */}
                <span
                    className={cn(
                        'shrink-0 text-[0.6rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                        rankColor[node.rank] ?? 'bg-muted text-muted-foreground',
                    )}
                >
                    {node.rank[0]}
                </span>

                {/* name */}
                <span className="text-sm font-medium truncate flex-1">{node.name}</span>
            </div>

            {expanded && hasChildren && (
                <div className="ml-4 pl-3 border-l border-dashed border-border/60 mt-0.5 space-y-0.5">
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            onSelect={onSelect}
                            selectedId={selectedId}
                            searchTerm={searchTerm}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

/* ─── TaxonomyManager ────────────────────────────────────── */
export const TaxonomyManager = () => {
    const queryClient = useQueryClient();
    const { showAlert } = useAlert();
    const { confirm } = useConfirm();

    const [selectedNode, setSelectedNode] = useState<TaxonTree | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false); // mobile detail panel

    const [newName, setNewName] = useState('');
    const [newRank, setNewRank] = useState<Rank>(Rank.KINGDOM);
    const [description, setDescription] = useState('');

    const { data: tree, isLoading, error } = useQuery({
        queryKey: ['taxonomy', 'tree'],
        queryFn: taxonomyApi.getTree,
    });

    const createMutation = useMutation({
        mutationFn: taxonomyApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['taxonomy'] });
            showAlert('Taxon created successfully', 'success');
            setIsCreating(false);
            setNewName('');
            setDescription('');
        },
        onError: (error: any) => {
            showAlert('Failed to create taxon: ' + (error.response?.data?.detail || error.message), 'error');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => taxonomyApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['taxonomy'] });
            showAlert('Taxon updated successfully', 'success');
            setIsEditing(false);
            if (selectedNode) setSelectedNode({ ...selectedNode, name: newName, description });
        },
        onError: (error: any) => {
            showAlert('Failed to update taxon: ' + (error.response?.data?.detail || error.message), 'error');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: taxonomyApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['taxonomy'] });
            showAlert('Taxon deleted successfully', 'success');
            setSelectedNode(null);
            setPanelOpen(false);
        },
        onError: (error: any) => {
            showAlert('Failed to delete taxon: ' + (error.response?.data?.detail || error.message), 'error');
        },
    });

    const getNextRank = (rank: Rank): Rank | null => {
        const ranks = Object.values(Rank);
        const idx = ranks.indexOf(rank);
        return idx >= 0 && idx < ranks.length - 1 ? ranks[idx + 1] : null;
    };

    const startCreateChild = () => {
        if (selectedNode) {
            const next = getNextRank(selectedNode.rank);
            if (!next) { showAlert('Cannot create child of Species', 'warning'); return; }
            setNewRank(next);
        } else {
            setNewRank(Rank.KINGDOM);
        }
        setNewName('');
        setDescription('');
        setIsCreating(true);
        setIsEditing(false);
    };

    const startEdit = () => {
        if (!selectedNode) return;
        setNewName(selectedNode.name);
        setNewRank(selectedNode.rank);
        setDescription(selectedNode.description || '');
        setIsEditing(true);
        setIsCreating(false);
    };

    const handleDelete = () => {
        if (!selectedNode) return;
        if (selectedNode.children?.length) {
            showAlert('Cannot delete a taxon that has children.', 'warning');
            return;
        }
        confirm({
            title: 'Delete Taxon',
            message: 'Are you sure you want to delete this taxon?',
            confirmText: 'Delete',
            onConfirm: () => deleteMutation.mutate(selectedNode.id),
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEditing && selectedNode) {
            updateMutation.mutate({ id: selectedNode.id, data: { name: newName, description } });
        } else {
            createMutation.mutate({
                name: newName,
                rank: newRank,
                description,
                parent_id: selectedNode?.id,
            });
        }
    };

    const handleNodeSelect = (node: TaxonTree) => {
        setSelectedNode(node);
        setIsEditing(false);
        setIsCreating(false);
        setPanelOpen(true);
    };

    const filterTree = (nodes: TaxonTree[], term: string): TaxonTree[] => {
        if (!term) return nodes;
        const lowerTerm = term.toLowerCase();
        return nodes.reduce((acc: TaxonTree[], node) => {
            const matches = node.name.toLowerCase().includes(lowerTerm) || node.rank.toLowerCase().includes(lowerTerm);
            if (matches) {
                acc.push({ ...node });
            } else {
                const filteredChildren = filterTree(node.children, term);
                if (filteredChildren.length > 0) acc.push({ ...node, children: filteredChildren });
            }
            return acc;
        }, []);
    };

    const filteredTree = useMemo(() => {
        if (!tree) return [];
        return filterTree(tree, searchTerm);
    }, [tree, searchTerm]);

    /* ── Panels ── */
    const DetailPanel = () => (
        <div className="flex flex-col h-full">
            {(isCreating || isEditing) ? (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 overflow-y-auto">
                    <div>
                        <h3 className="font-semibold text-foreground">
                            {isEditing ? `Edit ${selectedNode?.rank}` : `Add New ${newRank}`}
                        </h3>
                        {isCreating && selectedNode && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Parent: <strong>{selectedNode.name}</strong> ({selectedNode.rank})
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="tax-name">Name <span className="text-destructive">*</span></Label>
                        <Input
                            id="tax-name"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            required
                            autoFocus
                            placeholder={`Enter ${newRank.toLowerCase()} name`}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Rank</Label>
                        <Input value={newRank} disabled className="bg-muted text-muted-foreground" />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="tax-desc">Description</Label>
                        <Textarea
                            id="tax-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="resize-none"
                            placeholder="Optional notes..."
                        />
                    </div>

                    <div className="flex gap-2 mt-2">
                        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || !newName.trim()}>
                            {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => { setIsCreating(false); setIsEditing(false); }}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            ) : selectedNode ? (
                <div className="flex flex-col gap-4 p-4 overflow-y-auto">
                    <div className="flex items-start gap-3">
                        <div
                            className={cn(
                                'shrink-0 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded mt-0.5',
                                rankColor[selectedNode.rank] ?? 'bg-muted text-muted-foreground',
                            )}
                        >
                            {selectedNode.rank}
                        </div>
                        <h2 className="text-xl font-semibold text-foreground leading-tight">{selectedNode.name}</h2>
                    </div>

                    {selectedNode.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{selectedNode.description}</p>
                    )}

                    {selectedNode.children?.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Children:</span>
                            <Badge variant="secondary">{selectedNode.children.length}</Badge>
                        </div>
                    )}

                    <Separator />

                    <div className="flex flex-col gap-2">
                        {getNextRank(selectedNode.rank) && (
                            <Button size="sm" onClick={startCreateChild} className="w-full">
                                <Plus className="w-3.5 h-3.5 mr-2" />
                                Add {getNextRank(selectedNode.rank)}
                            </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={startEdit} className="w-full">
                            <Pencil className="w-3.5 h-3.5 mr-2" />
                            Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={handleDelete} className="w-full">
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground">
                    <ListTree className="w-10 h-10 mb-3 opacity-25" />
                    <p className="text-sm">Select a taxon to view details, or create a new Kingdom.</p>
                </div>
            )}
        </div>
    );

    return (
        <div>
            {/* Page Header */}
            <div className="flex flex-col gap-1 mb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Taxonomy</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage the hierarchical classification of plants.
                    </p>
                </div>
                <Button
                    onClick={() => { setSelectedNode(null); startCreateChild(); }}
                    className="mt-3 sm:mt-0 w-full sm:w-auto"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Kingdom
                </Button>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[500px]">
                {/* Tree Panel */}
                <div className="lg:col-span-3 rounded-xl border border-border bg-white shadow-sm flex flex-col">
                    {/* Search */}
                    <div className="p-4 border-b border-border">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search taxonomy…"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    {/* Tree */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
                        {isLoading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-2">
                                    <Skeleton className="h-4 w-4 rounded" />
                                    <Skeleton className="h-4 w-16 rounded" />
                                    <Skeleton className="h-4 w-32 rounded" />
                                </div>
                            ))
                        ) : error ? (
                            <p className="text-sm text-destructive px-3 py-2">Error loading taxonomy tree.</p>
                        ) : filteredTree.length === 0 ? (
                            <p className="text-sm text-muted-foreground px-3 py-6 text-center">
                                {searchTerm ? 'No results found.' : 'No taxonomy data yet.'}
                            </p>
                        ) : (
                            filteredTree.map((node) => (
                                <TreeNode
                                    key={node.id}
                                    node={node}
                                    onSelect={handleNodeSelect}
                                    selectedId={selectedNode?.id}
                                    searchTerm={searchTerm}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* Detail Panel — hidden on mobile unless a node is selected */}
                <div
                    className={cn(
                        'lg:col-span-2 rounded-xl border border-border bg-white shadow-sm',
                        !panelOpen && !isCreating && 'hidden lg:flex lg:flex-col',
                        (panelOpen || isCreating) && 'flex flex-col',
                    )}
                >
                    {(panelOpen || isCreating || selectedNode) && !!(selectedNode || isCreating) && (
                        <div className="lg:hidden flex items-center gap-2 px-4 py-3 border-b border-border">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() => { setPanelOpen(false); setSelectedNode(null); setIsCreating(false); setIsEditing(false); }}
                            >
                                ← Back to Tree
                            </Button>
                        </div>
                    )}
                    <DetailPanel />
                </div>
            </div>
        </div>
    );
};
