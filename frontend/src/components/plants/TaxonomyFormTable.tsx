import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taxonomyApi } from '../../api/taxonomy';
import { Rank } from '../../types/taxon';
import type { TaxonTree } from '../../types/taxon';
import { SearchableSelect } from '../common/SearchableSelect';
import { useAlert } from '../../contexts/AlertContext';

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

    const flatNodes = useMemo(() => {
        const nodes: Record<string, FlatNode> = {};
        const traverse = (node: TaxonTree) => {
            nodes[node.id] = { id: node.id, name: node.name, rank: node.rank, parent_id: node.parent_id, created_at: node.created_at };
            if (node.children) {
                node.children.forEach(traverse);
            }
        };
        taxonomyTree.forEach(traverse);
        return nodes;
    }, [taxonomyTree]);

    useEffect(() => {
        if (pendingSelection && flatNodes[pendingSelection.id]) {
            handleSelectionChange(pendingSelection.rank, pendingSelection.id);
            setPendingSelection(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingSelection, flatNodes]);

    useEffect(() => {
        if (selectedTaxonId && flatNodes[selectedTaxonId]) {
            let currentId: string | undefined = selectedTaxonId;
            const newSelections: Record<Rank, string | null> = {
                [Rank.KINGDOM]: null,
                [Rank.DIVISION]: null,
                [Rank.CLASS]: null,
                [Rank.ORDER]: null,
                [Rank.FAMILY]: null,
                [Rank.GENUS]: null,
                [Rank.SPECIES]: null,
            };

            while (currentId && flatNodes[currentId]) {
                const node: FlatNode = flatNodes[currentId];
                newSelections[node.rank] = node.id;
                currentId = node.parent_id;
            }

            // check if state changed before setting to avoid loop
            const hasChanged = RANKS.some(r => newSelections[r] !== selections[r]);
            if (hasChanged) {
                setSelections(newSelections);
            }
        } else if (!selectedTaxonId) {
            setSelections({
                [Rank.KINGDOM]: null,
                [Rank.DIVISION]: null,
                [Rank.CLASS]: null,
                [Rank.ORDER]: null,
                [Rank.FAMILY]: null,
                [Rank.GENUS]: null,
                [Rank.SPECIES]: null,
            });
        }
        // intentionally omitting selections to prevent feedback loop
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTaxonId, flatNodes]);

    const getOptionsForRank = (rank: Rank) => {
        const rankNodes = Object.values(flatNodes).filter(n => n.rank === rank);

        let closestAncestorRankIndex = RANKS.indexOf(rank) - 1;
        let requiredParentId: string | null = null;

        while (closestAncestorRankIndex >= 0) {
            const ancRank = RANKS[closestAncestorRankIndex];
            if (selections[ancRank]) {
                requiredParentId = selections[ancRank];
                break;
            }
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

        // Auto-fill ancestors
        while (currentId && flatNodes[currentId]) {
            const n: FlatNode = flatNodes[currentId];
            newSel[n.rank] = n.id;
            currentId = n.parent_id;
        }

        // Clear descendants
        for (let i = rankIndex + 1; i < RANKS.length; i++) {
            newSel[RANKS[i]] = null;
        }

        setSelections(newSel);

        // Always push the deepest selected node ID upstream
        // In our case, `val` is the new deepest because we just cleared its descendants
        onChange(val);
    };

    const handleSortChange = (rank: Rank, val: 'alpha' | 'recent') => {
        setSortOptions({ ...sortOptions, [rank]: val });
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

            // Set pending selection to automatically select once tree refreshes
            setPendingSelection({ rank: data.rank, id: data.id });
            setShowAddModal(null);
        },
        onError: (error: any) => {
            showAlert("Error creating taxon: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const submitNewTaxon = (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!showAddModal || !newName.trim()) return;

        createMutation.mutate({
            name: newName,
            rank: showAddModal.rank,
            parent_id: showAddModal.parentId || undefined,
            description: newDescription
        });
    };

    return (
        <div style={{ background: '#fafafa', padding: '1rem', borderRadius: '8px', border: '1px solid #eaeaea' }}>
            {RANKS.map((rank) => {
                const options = getOptionsForRank(rank);
                return (
                    <div key={rank} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <div style={{ width: '80px', fontSize: '0.85rem', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>
                            {rank}
                        </div>
                        <div style={{ flex: 1 }}>
                            <SearchableSelect
                                options={options.map(o => ({ value: o.id, label: o.name, createdAt: o.created_at }))}
                                value={selections[rank] || ''}
                                onChange={(val) => handleSelectionChange(rank, val)}
                                placeholder={`Select ${rank}...`}
                                sortOption={sortOptions[rank]}
                                onSortChange={(val) => handleSortChange(rank, val)}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => handleAddClick(rank)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: '#fff', border: '1px solid #ddd', borderRadius: '4px',
                                width: '42px', height: '42px', cursor: 'pointer', flexShrink: 0,
                                color: '#1a1a1a', transition: 'background 0.2s'
                            }}
                            title={`Add new ${rank}`}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f4f4f4'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                );
            })}

            {showAddModal && (
                <div className="confirm-overlay" style={{ zIndex: 1100 }}>
                    <div className="confirm-dialog" style={{ maxWidth: '500px' }}>
                        <h3>Add New {showAddModal.rank}</h3>
                        <div className="modal-form-content">
                            <div className="form-group" style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#666' }}>
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    required
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            submitNewTaxon(e);
                                        }
                                    }}
                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }}
                                    autoFocus
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#666' }}>
                                    Description (Optional)
                                </label>
                                <textarea
                                    value={newDescription}
                                    onChange={e => setNewDescription(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px', minHeight: '80px', resize: 'vertical' }}
                                />
                            </div>
                            <div className="confirm-actions">
                                <button type="button" className="btn btn-cancel" onClick={() => setShowAddModal(null)}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={submitNewTaxon}
                                    className="btn"
                                    style={{ background: '#0056b3', color: '#fff' }}
                                    disabled={!newName.trim() || createMutation.isPending}
                                >
                                    {createMutation.isPending ? 'Saving...' : 'Add Member'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
