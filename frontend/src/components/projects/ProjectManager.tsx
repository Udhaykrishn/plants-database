import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { projectsApi } from '../../api/projects';
import type { ProjectCreate, Project } from '../../types/project';
import { useAlert } from '../../contexts/AlertContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import './Projects.css';

export const ProjectManager = () => {
    const queryClient = useQueryClient();
    const { showAlert } = useAlert();
    const { confirm } = useConfirm();

    const [isCreating, setIsCreating] = useState(false);
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    // Form
    const [name, setName] = useState('');
    const [clientName, setClientName] = useState('');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');

    const { data: projects, isLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: projectsApi.getAll,
    });

    const createMutation = useMutation({
        mutationFn: projectsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            showAlert('Project created successfully', 'success');
            setIsCreating(false);
            resetForm();
        },
        onError: (error: any) => {
            showAlert("Error creating project: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: Partial<ProjectCreate> }) => projectsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            showAlert('Project updated successfully', 'success');
            setEditingProjectId(null);
            setIsCreating(false);
            resetForm();
        },
        onError: (error: any) => {
            showAlert("Error updating project: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: projectsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            showAlert('Project deleted successfully', 'success');
        },
        onError: (error: any) => {
            showAlert("Error deleting project: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const resetForm = () => {
        setName('');
        setClientName('');
        setLocation('');
        setDescription('');
    };

    const handleEdit = (project: Project, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingProjectId(project.id);
        setIsCreating(true); // Open form
        setActiveDropdown(null);
        setName(project.name);
        setClientName(project.client_name || '');
        setLocation(project.location || '');
        setDescription(project.description || '');
    };

    const handleDelete = (id: string, projectName: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveDropdown(null);
        confirm({
            title: 'Delete Project',
            message: `Are you sure you want to delete ${projectName}? This will permanently remove all associated plant records within this project.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: () => {
                deleteMutation.mutate(id);
            }
        });
    };

    const toggleCreate = () => {
        if (isCreating) {
            setIsCreating(false);
            setEditingProjectId(null);
            resetForm();
        } else {
            setIsCreating(true);
            setEditingProjectId(null);
            resetForm();
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const projectData: Partial<ProjectCreate> = {
            name,
            client_name: clientName,
            location,
            description
        };
        if (editingProjectId) {
            updateMutation.mutate({ id: editingProjectId, data: projectData });
        } else {
            createMutation.mutate(projectData as ProjectCreate);
        }
    };

    const toggleDropdown = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveDropdown(activeDropdown === id ? null : id);
    };

    if (isLoading) return <div>Loading projects...</div>;

    return (
        <div className="project-manager">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ margin: 0, borderBottom: 'none', paddingBottom: 0, fontSize: '1.75rem', fontWeight: 500, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>Projects</h2>
                <button className="btn" onClick={toggleCreate}>
                    {isCreating ? 'Cancel' : '+ New Project'}
                </button>
            </div>

            {isCreating && (
                <form className="create-plant-form" onSubmit={handleSubmit}>
                    <h3 style={{ margin: 0, paddingBottom: '1.5rem', fontWeight: 500, fontSize: '1.25rem', color: '#1a1a1a' }}>
                        {editingProjectId ? 'Edit Project' : 'Create Project'}
                    </h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Project Name</label>
                            <input value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>Client</label>
                            <input value={clientName} onChange={e => setClientName(e.target.value)} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Location</label>
                        <input value={location} onChange={e => setLocation(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} />
                    </div>
                    <button type="submit" className="btn">
                        {editingProjectId ? 'Save Changes' : 'Create Project'}
                    </button>
                </form>
            )}

            <div className="project-list" onClick={() => setActiveDropdown(null)}>
                {projects?.map(project => (
                    <div key={project.id} style={{ position: 'relative' }}>
                        <Link to={`/projects/${project.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                            <div className="project-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h3 style={{ margin: 0, color: '#1a1a1a', fontWeight: 500, fontSize: '1.25rem' }}>{project.name}</h3>

                                    <div className="actions-menu-container">
                                        <button className="icon-btn" onClick={(e) => toggleDropdown(project.id, e)} title="Actions">
                                            ⋮
                                        </button>
                                        {activeDropdown === project.id && (
                                            <div className="dropdown-menu">
                                                <button className="dropdown-item" onClick={(e) => handleEdit(project, e)}>
                                                    Edit
                                                </button>
                                                <button className="dropdown-item danger" onClick={(e) => handleDelete(project.id, project.name, e)}>
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.95rem', color: '#666', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div><strong>Client:</strong> {project.client_name || '—'}</div>
                                    <div><strong>Location:</strong> {project.location || '—'}</div>
                                </div>
                                {project.description && (
                                    <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#444' }}>{project.description}</p>
                                )}
                                <div style={{ marginTop: '1.5rem', display: 'flex' }}>
                                    <span className="badge" style={{ background: '#f4f4f4', padding: '0.25rem 0.5rem', borderRadius: '2px', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.02em', color: '#1a1a1a' }}>
                                        {project.plants?.length || 0} Plants
                                    </span>
                                </div>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
};
