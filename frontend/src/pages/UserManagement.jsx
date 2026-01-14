import { useState, useEffect } from 'react';
import { usersApi } from '../services/api';
import {
    Users,
    Plus,
    Edit,
    Trash2,
    X,
    Search,
    Shield,
    Eye
} from 'lucide-react';

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        designation: '',
        department: '',
        username: '',
        password: '',
        role: 'viewer',
        is_active: true,
        must_reset_password: true
    });
    const [error, setError] = useState('');

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const response = await usersApi.list({ per_page: 100 });
            setUsers(response.data.users);
        } catch (err) {
            console.error('Failed to load users:', err);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingUser(null);
        setFormData({
            full_name: '',
            email: '',
            designation: '',
            department: '',
            username: '',
            password: '',
            role: 'viewer',
            is_active: true,
            must_reset_password: true
        });
        setError('');
        setShowModal(true);
    };

    const openEditModal = (user) => {
        setEditingUser(user);
        setFormData({
            full_name: user.full_name,
            email: user.email,
            designation: user.designation || '',
            department: user.department || '',
            username: user.username,
            password: '',
            role: user.role,
            is_active: user.is_active,
            must_reset_password: false
        });
        setError('');
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            if (editingUser) {
                const data = { ...formData };
                if (!data.password) delete data.password;
                await usersApi.update(editingUser.id, data);
            } else {
                await usersApi.create(formData);
            }
            setShowModal(false);
            loadUsers();
        } catch (err) {
            setError(err.response?.data?.error || 'Operation failed');
        }
    };

    const handleDelete = async (user) => {
        if (!window.confirm(`Are you sure you want to delete ${user.full_name}?`)) return;

        try {
            await usersApi.delete(user.id);
            loadUsers();
        } catch (err) {
            alert(err.response?.data?.error || 'Delete failed');
        }
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <p style={{ color: 'var(--text-secondary)' }}>
                    {users.length} users
                </p>
                <button className="btn btn-primary" onClick={openCreateModal}>
                    <Plus size={16} /> Add User
                </button>
            </div>

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Department</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{user.full_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {user.designation || '-'}
                                        </div>
                                    </div>
                                </td>
                                <td>{user.username}</td>
                                <td style={{ color: 'var(--text-secondary)' }}>{user.email}</td>
                                <td>{user.department || '-'}</td>
                                <td>
                                    <span className={`badge ${user.role === 'admin' ? 'badge-warning' : 'badge-info'}`}>
                                        {user.role === 'admin' && <Shield size={12} />}
                                        {user.role === 'admin' && <Eye size={12} />}
                                        {user.role}
                                    </span>
                                </td>
                                <td>
                                    <span className={`badge ${user.is_active ? 'badge-success' : 'badge-error'}`}>
                                        {user.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(user)}>
                                            <Edit size={14} />
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(user)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
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
                            <h3 className="modal-title">{editingUser ? 'Edit User' : 'Create User'}</h3>
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
                                    <label className="form-label">Username *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        required
                                        disabled={!!editingUser}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required={!editingUser}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Role *</label>
                                        <select
                                            className="form-input form-select"
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        >
                                            <option value="viewer">Viewer</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Status</label>
                                        <select
                                            className="form-input form-select"
                                            value={formData.is_active ? 'active' : 'inactive'}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>

                                {!editingUser && (
                                    <div className="form-group">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.must_reset_password}
                                                onChange={(e) => setFormData({ ...formData, must_reset_password: e.target.checked })}
                                            />
                                            <span style={{ color: 'var(--text-secondary)' }}>Require password reset on first login</span>
                                        </label>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingUser ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
