import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { taxonomyApi } from '../../api/taxonomy';
import { Rank } from '../../types/taxon';
import type { TaxonTree } from '../../types/taxon';
import { SearchableSelect } from '../common/SearchableSelect';
import { useAlert } from '../../contexts/AlertContext';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

const RANKS = [
    Rank.KINGDOM,
    Rank.DIVISION,
    Rank.CLASS,
    Rank.ORDER,
    Rank.FAMILY,
    Rank.GENUS,
    Rank.SPECIES,
];

interface FlatNode {
    id: string;
    name: string;
    rank: Rank;
    parent_id?: string;
    created_at?: string;
}

interface TaxonomyFormTableProps {
    taxonomyTree: TaxonTree[];
    selectedTaxonId: string | null;
    onChange: (taxonId: string) => void;
}

export const TaxonomyFormTable: React.FC<TaxonomyFormTableProps> = ({ taxonomyTree, selectedTaxonId, onChange }) => {
    const { showAlert } = useAlert();
    const queryClient = useQueryClient();

    const [selections, setSelections] = useState<Record<Rank, string | null>>({
        [Rank.KINGDOM]: null,
        [Rank.DIVISION]: null,
        [Rank.CLASS]: null,
        [Rank.ORDER]: null,
        [Rank.FAMILY]: null,
        [Rank.GENUS]: null,
        [Rank.SPECIES]: null,
    });

    const [sortOptions, setSortOptions] = useState<Record<Rank, 'alpha' | 'recent'>>({
        [Rank.KINGDOM]: 'recent',
        [Rank.DIVISION]: 'recent',
        [Rank.CLASS]: 'recent',
        [Rank.ORDER]: 'recent',
        [Rank.FAMILY]: 'recent',
        [Rank.GENUS]: 'recent',
        [Rank.SPECIES]: 'recent',
    });

    const [showAddModal, setShowAddModal] = useState<{ rank: Rank; parentId: string | null } | null>(null);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [pendingSelection, setPendingSelection] = useState<{ rank: Rank; id: string } | null>(null);

    /* ── flatten tree ── */
    const flatNodes = useMemo(() => {
        const nodes: Record<string, FlatNode> = {};
        const traverse = (node: TaxonTree) => {
            nodes[node.id] = { id: node.id, name: node.name, rank: node.rank, parent_id: node.parent_id, created_at: node.created_at };
            if (node.children) node.children.forEach(traverse);
        };
        taxonomyTree.forEach(traverse);
        return nodes;
    }, [taxonomyTree]);

    /* ── auto-select pending after tree refreshes ── */
    useEffect(() => {
        if (pendingSelection && flatNodes[pendingSelection.id]) {
            handleSelectionChange(pendingSelection.rank, pendingSelection.id);
            setPendingSelection(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingSelection, flatNodes]);

    /* ── sync selections when editing a plant ── */
    useEffect(() => {
        if (selectedTaxonId && flatNodes[selectedTaxonId]) {
            let currentId: string | undefined = selectedTaxonId;
            const newSelections: Record<Rank, string | null> = {
                [Rank.KINGDOM]: null, [Rank.DIVISION]: null, [Rank.CLASS]: null,
                [Rank.ORDER]: null, [Rank.FAMILY]: null, [Rank.GENUS]: null, [Rank.SPECIES]: null,
            };
            while (currentId && flatNodes[currentId]) {
                const node: FlatNode = flatNodes[currentId];
                newSelections[node.rank] = node.id;
                currentId = node.parent_id;
            }
            if (RANKS.some(r => newSelections[r] !== selections[r])) setSelections(newSelections);
        } else if (!selectedTaxonId) {
            setSelections({
                [Rank.KINGDOM]: null, [Rank.DIVISION]: null, [Rank.CLASS]: null,
                [Rank.ORDER]: null, [Rank.FAMILY]: null, [Rank.GENUS]: null, [Rank.SPECIES]: null,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTaxonId, flatNodes]);

    const getOptionsForRank = (rank: Rank) => {
        const rankNodes = Object.values(flatNodes).filter(n => n.rank === rank);
        let closestAncestorRankIndex = RANKS.indexOf(rank) - 1;
        let requiredParentId: string | null = null;
        while (closestAncestorRankIndex >= 0) {
            const ancRank = RANKS[closestAncestorRankIndex];
            if (selections[ancRank]) { requiredParentId = selections[ancRank]; break; }
            closestAncestorRankIndex--;
        }
        if (!requiredParentId) return rankNodes;
        return rankNodes.filter(n => {
            let curr = n.parent_id;
            while (curr) {
                if (curr === requiredParentId) return true;
                curr = flatNodes[curr]?.parent_id;
            }
            return false;
        });
    };

    const handleSelectionChange = (rank: Rank, val: string) => {
        const node = flatNodes[val];
        if (!node) return;
        const rankIndex = RANKS.indexOf(rank);
        let currentId: string | undefined = val;
        const newSel = { ...selections };
        while (currentId && flatNodes[currentId]) {
            const n: FlatNode = flatNodes[currentId];
            newSel[n.rank] = n.id;
            currentId = n.parent_id;
        }
        for (let i = rankIndex + 1; i < RANKS.length; i++) newSel[RANKS[i]] = null;
        setSelections(newSel);
        onChange(val);
    };

    const handleAddClick = (rank: Rank) => {
        const rankIndex = RANKS.indexOf(rank);
        let parentId = null;
        if (rankIndex > 0) {
            const parentRank = RANKS[rankIndex - 1];
            parentId = selections[parentRank];
            if (!parentId) {
                showAlert(`Please select a ${parentRank} first before adding a ${rank}`, 'warning');
                return;
            }
        }
        setNewName('');
        setNewDescription('');
        setShowAddModal({ rank, parentId });
    };

    const createMutation = useMutation({
        mutationFn: taxonomyApi.create,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['taxonomy', 'tree'] });
            showAlert(`${data.rank} created successfully`, 'success');
            setPendingSelection({ rank: data.rank, id: data.id });
            setShowAddModal(null);
        },
        onError: (error: any) => {
            showAlert('Error creating taxon: ' + (error.response?.data?.detail || error.message), 'error');
        },
    });

    const submitNewTaxon = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!showAddModal || !newName.trim()) return;
        createMutation.mutate({
            name: newName,
            rank: showAddModal.rank,
            parent_id: showAddModal.parentId || undefined,
            description: newDescription,
        });
    };

    return (
        <>
            {/* ── Taxonomy rows ── */}
            <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border">
                {RANKS.map((rank) => {
                    const options = getOptionsForRank(rank);
                    const isSelected = !!selections[rank];
                    return (
                        <div
                            key={rank}
                            className="flex items-center gap-2 px-3 py-2"
                        >
                            {/* Rank label */}
                            <span className={`w-20 shrink-0 text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                                {rank}
                            </span>

                            {/* Select */}
                            <div className="flex-1 min-w-0">
                                <SearchableSelect
                                    options={options.map(o => ({ value: o.id, label: o.name, createdAt: o.created_at }))}
                                    value={selections[rank] || ''}
                                    onChange={(val) => handleSelectionChange(rank, val)}
                                    placeholder={`Select ${rank}…`}
                                    sortOption={sortOptions[rank]}
                                    onSortChange={(val) => setSortOptions({ ...sortOptions, [rank]: val })}
                                />
                            </div>

                            {/* Add button */}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                onClick={() => handleAddClick(rank)}
                                title={`Add new ${rank}`}
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    );
                })}
            </div>

            {/* ── Add taxon dialog ── */}
            <Dialog open={!!showAddModal} onOpenChange={(o) => !o && setShowAddModal(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Add New {showAddModal?.rank}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitNewTaxon} className="space-y-4 pt-1">
                        <div className="space-y-1.5">
                            <Label htmlFor="taxon-name">Name <span className="text-destructive">*</span></Label>
                            <Input
                                id="taxon-name"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                required
                                autoFocus
                                placeholder={`e.g. ${showAddModal?.rank === Rank.SPECIES ? 'robur' : 'Plantae'}`}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="taxon-desc">Description <span className="text-xs text-muted-foreground">(optional)</span></Label>
                            <Input
                                id="taxon-desc"
                                value={newDescription}
                                onChange={e => setNewDescription(e.target.value)}
                                placeholder="Brief notes…"
                            />
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button type="button" variant="outline" onClick={() => setShowAddModal(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!newName.trim() || createMutation.isPending}>
                                {createMutation.isPending ? 'Saving…' : 'Add'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
};
