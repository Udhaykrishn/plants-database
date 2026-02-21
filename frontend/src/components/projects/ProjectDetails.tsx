import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { plantsApi } from '../../api/plants';
import { ioApi } from '../../api/io';
import type { ProjectPlantCreate } from '../../types/project';
import { useAlert } from '../../contexts/AlertContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import './Projects.css';

export const ProjectDetails = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const { showAlert } = useAlert();
    const { confirm } = useConfirm();

    const [isAdding, setIsAdding] = useState(false);
    const [editingPlantId, setEditingPlantId] = useState<string | null>(null);

    // Form
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
            showAlert('Plant added to project successfully', 'success');
            cancelEdit();
        },
        onError: (error: any) => {
            showAlert("Failed to add plant: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const updatePlantMutation = useMutation({
        mutationFn: (data: ProjectPlantCreate) => projectsApi.updatePlant(id!, editingPlantId!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project', id] });
            showAlert('Plant updated successfully', 'success');
            cancelEdit();
        },
        onError: (error: any) => {
            showAlert("Failed to update plant: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const deletePlantMutation = useMutation({
        mutationFn: (plantId: string) => projectsApi.removePlant(id!, plantId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project', id] });
            showAlert('Plant removed successfully', 'success');
        },
        onError: (error: any) => {
            showAlert("Failed to remove plant: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const handleEditClick = (plantId: string, currentNotes: string) => {
        setEditingPlantId(plantId);
        setSelectedPlantId(plantId);
        setNotes(currentNotes || '');
        setIsAdding(true);
    };

    const cancelEdit = () => {
        setEditingPlantId(null);
        setSelectedPlantId('');
        setNotes('');
        setIsAdding(false);
    };

    const handleDeleteClick = (plantId: string, plantName: string) => {
        confirm({
            title: 'Remove Plant',
            message: `Are you sure you want to remove ${plantName} from this project?`,
            confirmText: 'Remove',
            cancelText: 'Cancel',
            onConfirm: () => {
                deletePlantMutation.mutate(plantId);
            }
        });
    };

    const handleSubmitPlant = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlantId) {
            showAlert("Please select a plant", 'warning');
            return;
        }

        const payload = {
            plant_id: selectedPlantId,
            notes
        };

        if (editingPlantId) {
            updatePlantMutation.mutate(payload);
        } else {
            addPlantMutation.mutate(payload);
        }
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
                    <button className="btn" onClick={() => ioApi.exportProjectPdf(project.id, project.name)} style={{ height: 'fit-content' }}>
                        Download PDF
                    </button>
                </div>
                <p>{project.client_name} • {project.location}</p>
                <p>{project.description}</p>
            </div>

            <div className="project-plants-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Plants List</h3>
                    <button className="btn" onClick={() => isAdding ? cancelEdit() : setIsAdding(true)}>
                        {isAdding ? 'Cancel' : '+ Add Plant to Project'}
                    </button>
                </div>

                {isAdding && (
                    <form className="create-plant-form" onSubmit={handleSubmitPlant} style={{ marginTop: '1rem' }}>
                        <h4>{editingPlantId ? 'Edit Plant' : 'Add Plant'}</h4>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Plant</label>
                                <select
                                    value={selectedPlantId}
                                    onChange={e => setSelectedPlantId(e.target.value)}
                                    required
                                    disabled={!!editingPlantId}
                                >
                                    <option value="">Select Plant...</option>
                                    {allPlants?.map(p => (
                                        <option key={p.id} value={p.id}>{p.common_name} ({p.taxon?.name})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Notes</label>
                            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Location notes, sizes, etc." />
                        </div>
                        <button type="submit" className="btn">{editingPlantId ? 'Save Changes' : 'Add to Project'}</button>
                    </form>
                )}

                <div className="plants-table" style={{ marginTop: '1rem', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
                    <div className="plant-row" style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
                        <div style={{ flex: 2 }}>Plant Name</div>
                        <div style={{ flex: 1 }}>Category</div>
                        <div style={{ flex: 2 }}>Notes</div>
                        <div style={{ width: '120px', textAlign: 'right' }}>Actions</div>
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
                            <div style={{ flex: 2 }}>{pp.notes || '-'}</div>
                            <div style={{ width: '120px', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button className="btn-small" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }} onClick={() => handleEditClick(pp.plant_id, pp.notes || '')}>Edit</button>
                                <button className="btn-small danger" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }} onClick={() => handleDeleteClick(pp.plant_id, pp.plant?.common_name || 'Plant')}>Remove</button>
                            </div>
                        </div>
                    ))}
                    {
                        project.plants.length === 0 && (
                            <div className="plant-row" style={{ justifyContent: 'center', padding: '2rem' }}>
                                No plants added yet.
                            </div>
                        )
                    }
                </div >
            </div >
        </div >
    );
};
