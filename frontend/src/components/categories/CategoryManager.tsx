import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../../api/categories';
import { useAlert } from '../../contexts/AlertContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import type { Category } from '../../types/category';

export const CategoryManager = () => {
    const { showAlert } = useAlert();
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();

    const [isCreating, setIsCreating] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const { data: categories, isLoading } = useQuery({
        queryKey: ['categories'],
        queryFn: categoriesApi.getAll,
    });

    const createMutation = useMutation({
        mutationFn: categoriesApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            showAlert('Category created successfully', 'success');
            resetForm();
        },
        onError: (error: any) => {
            showAlert("Error creating category: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => categoriesApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            showAlert('Category updated successfully', 'success');
            resetForm();
        },
        onError: (error: any) => {
            showAlert("Error updating category: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: categoriesApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            showAlert('Category deleted successfully', 'success');
        },
        onError: (error: any) => {
            showAlert("Error deleting category: " + (error.response?.data?.detail || error.message), 'error');
        }
    });

    const resetForm = () => {
        setIsCreating(false);
        setEditingCategory(null);
        setName('');
        setDescription('');
    };

    const handleEdit = (cat: Category) => {
        setEditingCategory(cat);
        setName(cat.name);
        setDescription(cat.description || '');
    };

    const handleDelete = (id: string) => {
        confirm({
            title: 'Delete Category',
            message: 'Are you sure you want to delete this category? Any plant currently using this category must be updated first.',
            onConfirm: () => deleteMutation.mutate(id)
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingCategory) {
            updateMutation.mutate({ id: editingCategory.id, data: { name, description } });
        } else {
            createMutation.mutate({ name, description });
        }
    };

    if (isLoading) return <div style={{ padding: '2rem' }}>Loading categories...</div>;

    const showModal = isCreating || editingCategory !== null;

    return (
        <div className="plant-manager" style={{ padding: '2rem' }}>
            <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Plant Categories</h1>
                <button className="btn" style={{ background: '#1a1a1a', color: '#fff' }} onClick={() => setIsCreating(true)}>
                    + Add Category
                </button>
            </div>

            <div className="table-responsive">
                <table className="plant-table" style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                    <thead>
                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Name</th>
                            <th style={{ padding: '1rem', textAlign: 'left' }}>Description</th>
                            <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories?.map((cat) => (
                            <tr key={cat.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                                <td style={{ padding: '1rem', fontWeight: 600 }}>{cat.name}</td>
                                <td style={{ padding: '1rem', color: '#666' }}>{cat.description || '-'}</td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <button
                                        onClick={() => handleEdit(cat)}
                                        className="btn"
                                        style={{ marginRight: '0.5rem', background: '#e9ecef' }}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(cat.id)}
                                        className="btn btn-danger"
                                        style={{ background: '#dc3545', color: '#fff' }}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {categories?.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#666', background: '#fff' }}>
                        No categories found.
                    </div>
                )}
            </div>

            {showModal && (
                <div className="confirm-overlay" style={{ zIndex: 1100 }}>
                    <div className="confirm-dialog" style={{ maxWidth: '400px', width: '90%' }}>
                        <h2>{editingCategory ? 'Edit Category' : 'New Category'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }}
                                    autoFocus
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Description (Optional)</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px', minHeight: '80px', resize: 'vertical' }}
                                />
                            </div>
                            <div className="confirm-actions">
                                <button type="button" className="btn btn-cancel" onClick={resetForm}>
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn"
                                    style={{ background: '#0056b3', color: '#fff' }}
                                    disabled={createMutation.isPending || updateMutation.isPending || !name.trim()}
                                >
                                    {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save Category'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
