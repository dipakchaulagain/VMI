import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ownersApi, usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
    UserCircle,
    Plus,
    Edit,
    Trash2,
    X,
    Link,
    Server,
    Search
} from 'lucide-react';

export default function OwnerManagement() {
    const [owners, setOwners] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingOwner, setEditingOwner] = useState(null);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        designation: '',
        department: '',
        user_id: ''
    });
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const { isAdmin } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        loadData();
    }, [debouncedSearch]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const loadData = async () => {
        try {
            const [ownersRes, usersRes] = await Promise.all([
                ownersApi.list({ per_page: 100, search: debouncedSearch }),
                isAdmin ? usersApi.list({ per_page: 100 }) : Promise.resolve({ data: { users: [] } })
            ]);
            setOwners(ownersRes.data.owners);
            setUsers(usersRes.data.users);
        } catch (err) {
            console.error('Failed to load data:', err);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingOwner(null);
        setFormData({
            full_name: '',
            email: '',
            designation: '',
            department: '',
            user_id: ''
        });
        setError('');
        setShowModal(true);
    };

    const openEditModal = (owner) => {
        setEditingOwner(owner);
        setFormData({
            full_name: owner.full_name,
            email: owner.email,
            designation: owner.designation || '',
            department: owner.department || '',
            user_id: owner.user_id || ''
        });
        setError('');
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const data = { ...formData };
            if (!data.user_id) data.user_id = null;

            if (editingOwner) {
                await ownersApi.update(editingOwner.id, data);
            } else {
                await ownersApi.create(data);
            }
            setShowModal(false);
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Operation failed');
        }
    };

    const handleDelete = async (owner) => {
        if (!window.confirm(`Are you sure you want to delete ${owner.full_name}?`)) return;

        try {
            await ownersApi.delete(owner.id);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Delete failed');
        }
    };

    const handleVMCountClick = (ownerId, ownerType) => {
        navigate(`/vms?owner_id=${ownerId}&owner_type=${ownerType}`);
    };

    if (loading) {
        return (
            <div className="loading-overlay" style={{ position: 'relative', minHeight: '300px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                    <p style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {owners.length} owners
                    </p>
                    <div className="search-wrapper" style={{ maxWidth: '400px' }}>
                        <Search className="search-icon" size={18} />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search owners by name, email, or department..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                {isAdmin && (
                    <button className="btn btn-primary" onClick={openCreateModal}>
                        <Plus size={16} /> Add Owner
                    </button>
                )}
            </div>

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Department</th>
                            <th>VMs</th>
                            <th>Linked User</th>
                            {isAdmin && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {owners.map((owner) => (
                            <tr key={owner.id}>
                                <td style={{ fontWeight: 500 }}>{owner.full_name}</td>
                                <td style={{ color: 'var(--text-secondary)' }}>{owner.email}</td>
                                <td>{owner.department || '-'}</td>
                                <td>
                                    {owner.vm_count_total > 0 ? (
                                        <button
                                            className="btn btn-sm"
                                            style={{
                                                background: 'transparent',
                                                padding: '4px 8px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                color: 'var(--accent-primary)',
                                                textDecoration: 'underline',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => handleVMCountClick(owner.id, 'any')}
                                        >
                                            <Server size={14} />
                                            {owner.vm_count_total}
                                        </button>
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>0</span>
                                    )}
                                </td>
                                <td>
                                    {owner.linked_user ? (
                                        <span className="badge badge-info">
                                            <Link size={12} /> {owner.linked_user}
                                        </span>
                                    ) : '-'}
                                </td>
                                {isAdmin && (
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(owner)}>
                                                <Edit size={14} />
                                            </button>
                                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(owner)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editingOwner ? 'Edit Owner' : 'Create Owner'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {error && <div className="alert alert-error">{error}</div>}

                                <div className="form-group">
                                    <label className="form-label">Full Name *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Email *</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Designation</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={formData.designation}
                                            onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Department</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={formData.department}
                                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Link to User (optional)</label>
                                    <select
                                        className="form-input form-select"
                                        value={formData.user_id}
                                        onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                                    >
                                        <option value="">No linked user</option>
                                        {users.map((user) => (
                                            <option key={user.id} value={user.id}>
                                                {user.full_name} ({user.username})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingOwner ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
