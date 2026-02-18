import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taxonomyApi } from '../../api/taxonomy';
import { Rank } from '../../types/taxon';
import type { TaxonTree } from '../../types/taxon';
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
    // Form state
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
            setIsCreating(false);
            setNewName('');
            setDescription('');
        },
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate({
            name: newName,
            rank: newRank,
            description,
            parent_id: selectedNode?.id // Logic to determine parent needs refinement based on rank
        });
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
            } else {
                alert("Cannot create child of Species");
            }
        } else {
            setNewRank(Rank.KINGDOM);
            setIsCreating(true);
        }
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
                        onSelect={setSelectedNode}
                        selectedId={selectedNode?.id}
                    />
                ))}
            </div>

            <div className="taxon-details">
                {isCreating ? (
                    <form onSubmit={handleCreate}>
                        <h3>Add New {newRank}</h3>
                        {selectedNode && <p>Parent: {selectedNode.name} ({selectedNode.rank})</p>}

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
                            <button type="button" className="btn" onClick={() => setIsCreating(false)} style={{ background: '#ccc' }}>Cancel</button>
                        </div>
                    </form>
                ) : selectedNode ? (
                    <div>
                        <h2>{selectedNode.name}</h2>
                        <span className="rank-badge">{selectedNode.rank}</span>
                        <p>{selectedNode.description || "No description."}</p>
                        <p>ID: {selectedNode.id}</p>

                        <div style={{ marginTop: '2rem' }}>
                            <button className="btn" onClick={startCreateChild}>
                                + Add {getNextRank(selectedNode.rank)}
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
