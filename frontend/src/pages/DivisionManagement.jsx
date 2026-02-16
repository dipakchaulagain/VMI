import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { divisionsApi } from '../services/api';
import { Layers, Plus, Trash2, Edit2, Save, X, Search, AlertTriangle } from 'lucide-react';

export default function DivisionManagement() {
    const navigate = useNavigate();
    const [divisions, setDivisions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ name: '', department: '' });
    const [editData, setEditData] = useState({ name: '', department: '' });
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadDivisions();
    }, []);

    const loadDivisions = async () => {
        setLoading(true);
        try {
            const response = await divisionsApi.list();
            setDivisions(response.data.divisions);
        } catch (err) {
            console.error('Failed to load divisions:', err);
            setError('Failed to load divisions');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await divisionsApi.create(formData);
            setFormData({ name: '', department: '' });
            setIsAdding(false);
            loadDivisions();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to create division');
        }
    };

    const handleUpdate = async (id) => {
        try {
            await divisionsApi.update(id, editData);
            setEditingId(null);
            loadDivisions();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update division');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this division?')) return;
        try {
            await divisionsApi.delete(id);
            loadDivisions();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete division');
        }
    };

    const startEditing = (division) => {
        setEditingId(division.id);
        setEditData({ name: division.name, department: division.department });
    };

    const filteredDivisions = divisions.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.department.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div className="search-wrapper" style={{ flex: 1, maxWidth: '500px' }}>
                        <Search className="search-icon" size={18} />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search divisions or departments..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
                        <Plus size={18} /> Add Division
                    </button>
                </div>
            </div>

            {isAdding && (
                <div className="modal-overlay" onClick={() => setIsAdding(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                <Plus size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Add New Division
                            </h3>
                            <button className="modal-close" onClick={() => setIsAdding(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="modal-body">
                                {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

                                <div className="form-group">
                                    <label className="form-label">Division Name *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Core Banking"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Department *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        required
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        placeholder="e.g. IT"
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setIsAdding(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Create Division
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {error && (
                <div className="alert alert-error" style={{ marginBottom: '24px' }}>
                    <AlertTriangle size={18} /> {error}
                </div>
            )}

            <div className="table-container card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Division Name</th>
                            <th>Department</th>
                            <th>VMs</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px' }}>Loading...</td></tr>
                        ) : filteredDivisions.length === 0 ? (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No divisions found</td></tr>
                        ) : filteredDivisions.map(division => (
                            <tr key={division.id}>
                                {editingId === division.id ? (
                                    <>
                                        <td>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={editData.name}
                                                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={editData.department}
                                                onChange={(e) => setEditData({ ...editData, department: e.target.value })}
                                            />
                                        </td>
                                        <td>-</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button className="btn btn-sm btn-primary" onClick={() => handleUpdate(division.id)}>
                                                    <Save size={14} />
                                                </button>
                                                <button className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td style={{ fontWeight: 500 }}>{division.name}</td>
                                        <td>{division.department}</td>
                                        <td>
                                            <a
                                                href={`/vms?division_id=${division.id}`}
                                                className="badge badge-info"
                                                style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    window.location.href = `/vms?division_id=${division.id}`;
                                                }}
                                            >
                                                {division.vm_count || 0} VMs
                                            </a>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button className="btn btn-icon" onClick={() => startEditing(division)} title="Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="btn btn-icon btn-icon-danger" onClick={() => handleDelete(division.id)} title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
