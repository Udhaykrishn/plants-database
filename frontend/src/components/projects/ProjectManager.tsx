import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { projectsApi } from '../../api/projects';
import type { ProjectCreate } from '../../types/project';
import './Projects.css';

export const ProjectManager = () => {
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);

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
            setIsCreating(false);
            resetForm();
        },
    });

    const resetForm = () => {
        setName('');
        setClientName('');
        setLocation('');
        setDescription('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newProject: ProjectCreate = {
            name,
            client_name: clientName,
            location,
            description
        };
        createMutation.mutate(newProject);
    };

    if (isLoading) return <div>Loading projects...</div>;

    return (
        <div className="project-manager">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Projects</h2>
                <button className="btn" onClick={() => setIsCreating(!isCreating)}>
                    {isCreating ? 'Cancel' : '+ New Project'}
                </button>
            </div>

            {isCreating && (
                <form className="create-plant-form" onSubmit={handleSubmit}>
                    <h3>Create Project</h3>
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
                    <button type="submit" className="btn">Save Project</button>
                </form>
            )}

            <div className="project-list">
                {projects?.map(project => (
                    <Link to={`/projects/${project.id}`} key={project.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div className="project-card">
                            <h3>{project.name}</h3>
                            <p><strong>Client:</strong> {project.client_name || 'N/A'}</p>
                            <p><strong>Location:</strong> {project.location || 'N/A'}</p>
                            <p>{project.description}</p>
                            <div style={{ marginTop: '1rem' }}>
                                <span className="badge">{project.plants.length} Plants</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};
