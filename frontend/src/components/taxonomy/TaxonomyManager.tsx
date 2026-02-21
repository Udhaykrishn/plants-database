import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taxonomyApi } from '../../api/taxonomy';
import { Rank } from '../../types/taxon';
import type { TaxonTree } from '../../types/taxon';
import { useAlert } from '../../contexts/AlertContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import './Taxonomy.css';

interface GreetingProps {
    node: TaxonTree;
    onSelect: (node: TaxonTree) => void;
    selectedId?: string;
}

const TreeNode = ({ node, onSelect, selectedId }: GreetingProps) => {
    const [expanded, setExpanded] = useState(false);
    const hasChildren = node.children && node.children.length > 0;

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setExpanded(!expanded);
    };

    return (
        <div className={`tree-node ${node.id === selectedId ? 'selected' : ''}`}>
            <div className="node-content" onClick={() => onSelect(node)}>
                {hasChildren && (
                    <span onClick={handleToggle} style={{ cursor: 'pointer', marginRight: '5px' }}>
                        {expanded ? '▼' : '▶'}
                    </span>
                )}
                <span className="rank-badge">{node.rank[0]}</span>
                <span>{node.name}</span>
            </div>
            {expanded && hasChildren && (
                <div className="children">
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            onSelect={onSelect}
                            selectedId={selectedId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const TaxonomyManager = () => {
    const queryClient = useQueryClient();
    const [selectedNode, setSelectedNode] = useState<TaxonTree | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    // Form state
    const [newName, setNewName] = useState('');
    const [newRank, setNewRank] = useState<Rank>(Rank.KINGDOM);
    const [description, setDescription] = useState('');

    const { showAlert } = useAlert();
    const { confirm } = useConfirm();

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
            showAlert("Failed to create taxon: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => taxonomyApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['taxonomy'] });
            showAlert('Taxon updated successfully', 'success');
            setIsEditing(false);

            // Update local selection description
            if (selectedNode) {
                setSelectedNode({ ...selectedNode, name: newName, description });
            }
        },
        onError: (error: any) => {
            showAlert("Failed to update taxon: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: taxonomyApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['taxonomy'] });
            showAlert('Taxon deleted successfully', 'success');
            setSelectedNode(null);
        },
        onError: (error: any) => {
            showAlert("Failed to delete taxon: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEditing && selectedNode) {
            updateMutation.mutate({
                id: selectedNode.id,
                data: {
                    name: newName,
                    description,
                }
            });
        } else {
            createMutation.mutate({
                name: newName,
                rank: newRank,
                description,
                parent_id: selectedNode?.id // Logic to determine parent needs refinement based on rank
            });
        }
    };

    const handleDelete = async () => {
        if (!selectedNode) return;
        if (selectedNode.children && selectedNode.children.length > 0) {
            showAlert("Cannot delete taxon that has children.", 'warning');
            return;
        }

        confirm({
            title: 'Confirm Delete',
            message: 'Are you sure you want to delete this taxon?',
            confirmText: 'Delete',
            onConfirm: () => {
                deleteMutation.mutate(selectedNode.id);
            }
        });
    };

    const startEdit = () => {
        if (selectedNode) {
            setNewName(selectedNode.name);
            setNewRank(selectedNode.rank);
            setDescription(selectedNode.description || '');
            setIsEditing(true);
            setIsCreating(false);
        }
    };

    const getNextRank = (currentRank: Rank): Rank | null => {
        const ranks = Object.values(Rank);
        const idx = ranks.indexOf(currentRank);
        if (idx >= 0 && idx < ranks.length - 1) {
            return ranks[idx + 1];
        }
        return null;
    };

    const startCreateChild = () => {
        if (selectedNode) {
            const next = getNextRank(selectedNode.rank);
            if (next) {
                setNewRank(next);
                setIsCreating(true);
                setIsEditing(false);
                setNewName('');
                setDescription('');
            } else {
                showAlert("Cannot create child of Species", 'warning');
            }
        } else {
            setNewRank(Rank.KINGDOM);
            setIsCreating(true);
            setIsEditing(false);
            setNewName('');
            setDescription('');
        }
    };

    const handleNodeSelect = (node: TaxonTree) => {
        setSelectedNode(node);
        setIsEditing(false);
        setIsCreating(false);
    };

    if (isLoading) return <div>Loading taxonomy...</div>;
    if (error) return <div>Error loading taxonomy</div>;

    return (
        <div className="taxonomy-container">
            <div className="taxonomy-tree">
                <h3>Taxonomy Tree</h3>
                <button className="btn" onClick={() => { setSelectedNode(null); startCreateChild(); }}>+ Add Kingdom</button>
                {tree?.map((node) => (
                    <TreeNode
                        key={node.id}
                        node={node}
                        onSelect={handleNodeSelect}
                        selectedId={selectedNode?.id}
                    />
                ))}
            </div>

            <div className="taxon-details">
                {(isCreating || isEditing) ? (
                    <form onSubmit={handleSubmit}>
                        <h3>{isEditing ? `Edit ${selectedNode?.rank}` : `Add New ${newRank}`}</h3>
                        {(isCreating && selectedNode) && <p>Parent: {selectedNode.name} ({selectedNode.rank})</p>}

                        <div className="form-group">
                            <label>Name</label>
                            <input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Rank</label>
                            <select value={newRank} disabled>
                                <option value={newRank}>{newRank}</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button type="submit" className="btn">Save</button>
                            <button type="button" className="btn" onClick={() => { setIsCreating(false); setIsEditing(false); }} style={{ background: '#ccc' }}>Cancel</button>
                        </div>
                    </form>
                ) : selectedNode ? (
                    <div>
                        <h2>{selectedNode.name}</h2>
                        <span className="rank-badge">{selectedNode.rank}</span>
                        <p>{selectedNode.description || "No description."}</p>
                        <p>ID: {selectedNode.id}</p>

                        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                            <button className="btn" onClick={startCreateChild}>
                                + Add {getNextRank(selectedNode.rank)}
                            </button>
                            <button className="btn" onClick={startEdit} style={{ background: '#6c757d', borderColor: '#6c757d' }}>
                                Edit
                            </button>
                            <button className="btn" onClick={handleDelete} style={{ background: '#dc3545', borderColor: '#dc3545' }}>
                                Delete
                            </button>
                        </div>
                    </div>
                ) : (
                    <p>Select a node to view details or add a child.</p>
                )}
            </div>
        </div>
    );
};
