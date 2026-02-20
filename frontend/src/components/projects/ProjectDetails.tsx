import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { plantsApi } from '../../api/plants';
import { ioApi } from '../../api/io';
import type { ProjectPlantCreate } from '../../types/project';
import { useAlert } from '../../contexts/AlertContext';
import './Projects.css';

export const ProjectDetails = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);

    // Add Plant Form
    const [selectedPlantId, setSelectedPlantId] = useState('');
    const [quantity, setQuantity] = useState(1);
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

    const { showAlert } = useAlert();

    const addPlantMutation = useMutation({
        mutationFn: (data: ProjectPlantCreate) => projectsApi.addPlant(id!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project', id] });
            showAlert('Plant added to project successfully', 'success');
            setIsAdding(false);
            setQuantity(1);
            setNotes('');
            setSelectedPlantId('');
        },
        onError: (error: any) => {
            showAlert("Failed to add plant: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const handleAddPlant = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlantId) {
            showAlert("Please select a plant", 'warning');
            return;
        }
        addPlantMutation.mutate({
            plant_id: selectedPlantId,
            quantity,
            notes
        });
    };

    if (isLoading) return <div>Loading project...</div>;
    if (!project) return <div>Project not found</div>;

    return (
        <div className="project-details-container" style={{ padding: '2rem' }}>
            <Link to="/projects" className="btn" style={{ background: '#6c757d', marginBottom: '1rem', display: 'inline-block' }}>
                ← Back to Projects
            </Link>

            <div className="project-header" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h1>{project.name}</h1>
                    <button className="btn" onClick={() => ioApi.exportProjectPdf(project.id)} style={{ height: 'fit-content' }}>
                        Download PDF
                    </button>
                </div>
                <p>{project.client_name} • {project.location}</p>
                <p>{project.description}</p>
            </div>

            <div className="project-plants-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Plants List</h3>
                    <button className="btn" onClick={() => setIsAdding(!isAdding)}>
                        {isAdding ? 'Cancel' : '+ Add Plant to Project'}
                    </button>
                </div>

                {isAdding && (
                    <form className="create-plant-form" onSubmit={handleAddPlant} style={{ marginTop: '1rem' }}>
                        <h4>Add Plant</h4>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Plant</label>
                                <select
                                    value={selectedPlantId}
                                    onChange={e => setSelectedPlantId(e.target.value)}
                                    required
                                >
                                    <option value="">Select Plant...</option>
                                    {allPlants?.map(p => (
                                        <option key={p.id} value={p.id}>{p.common_name} ({p.taxon?.name})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Quantity</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={e => setQuantity(parseInt(e.target.value))}
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Notes</label>
                            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Location notes, sizes, etc." />
                        </div>
                        <button type="submit" className="btn">Add to Project</button>
                    </form>
                )}

                <div className="plants-table" style={{ marginTop: '1rem', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
                    <div className="plant-row" style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
                        <div style={{ flex: 2 }}>Plant Name</div>
                        <div style={{ flex: 1 }}>Category</div>
                        <div style={{ flex: 1 }}>Quantity</div>
                        <div style={{ flex: 2 }}>Notes</div>
                    </div>
                    {project.plants.map((pp) => (
                        <div key={pp.plant_id} className="plant-row">
                            <div style={{ flex: 2 }}>
                                <strong>{pp.plant?.common_name}</strong><br />
                                <small>{pp.plant?.taxon?.name}</small>
                            </div>
                            <div style={{ flex: 1 }}>
                                <span className="tag">{pp.plant?.category}</span>
                            </div>
                            <div style={{ flex: 1 }}>{pp.quantity}</div>
                            <div style={{ flex: 2 }}>{pp.notes || '-'}</div>
                        </div>
                    ))}
                    {project.plants.length === 0 && (
                        <div className="plant-row" style={{ justifyContent: 'center', padding: '2rem' }}>
                            No plants added yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
