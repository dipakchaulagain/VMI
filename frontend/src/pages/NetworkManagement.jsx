import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { networksApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
    Network,
    Edit,
    X,
    Check,
    Search,
    Cloud,
    Server,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

export default function NetworkManagement() {
    const [networks, setNetworks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [platform, setPlatform] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editVlan, setEditVlan] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [summary, setSummary] = useState({});
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const { isAdmin } = useAuth();
    const navigate = useNavigate();

    const loadNetworks = useCallback(async () => {
        try {
            setLoading(true);
            const [networksRes, summaryRes] = await Promise.all([
                networksApi.list({
                    platform: platform || undefined,
                    search: search || undefined,
                    page,
                    per_page: 50
                }),
                networksApi.getSummary()
            ]);
            setNetworks(networksRes.data.networks);
            setTotalPages(networksRes.data.pages || 1);
            setTotal(networksRes.data.total || 0);
            setSummary(summaryRes.data);
        } catch (error) {
            console.error('Failed to load networks:', error);
        } finally {
            setLoading(false);
        }
    }, [platform, search, page]);

    useEffect(() => {
        loadNetworks();
    }, [loadNetworks]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const startEdit = (network) => {
        setEditingId(network.id);
        setEditVlan(network.vlan_id || '');
        setEditDescription(network.description || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditVlan('');
        setEditDescription('');
    };

    const saveEdit = async (id) => {
        try {
            await networksApi.update(id, {
                vlan_id: editVlan || null,
                description: editDescription || null
            });
            await loadNetworks();
            cancelEdit();
        } catch (error) {
            alert(`Save failed: ${error.response?.data?.error || error.message}`);
        }
    };

    if (loading && networks.length === 0) {
        return (
            <div className="loading-overlay" style={{ position: 'relative', minHeight: '300px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div>
            {/* Summary Cards */}
            <div className="stats-grid" style={{ marginBottom: '24px' }}>
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-icon primary">
                            <Network size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Networks</p>
                            <h3 style={{ fontSize: '1.5rem' }}>{summary.total || 0}</h3>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-icon info">
                            <Cloud size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>VMware</p>
                            <h3 style={{ fontSize: '1.5rem' }}>{summary.vmware || 0}</h3>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-icon success">
                            <Cloud size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nutanix</p>
                            <h3 style={{ fontSize: '1.5rem' }}>{summary.nutanix || 0}</h3>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="stat-icon warning">
                            <Check size={24} />
                        </div>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>With VLAN</p>
                            <h3 style={{ fontSize: '1.5rem' }}>{summary.with_vlan || 0}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--border-radius-sm)',
                        padding: '8px 12px',
                        flex: '1',
                        minWidth: '200px'
                    }}>
                        <Search size={18} style={{ color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search by name or network ID..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                outline: 'none',
                                width: '100%',
                                color: 'var(--text-primary)',
                                fontSize: '0.875rem'
                            }}
                        />
                        {searchInput && (
                            <button
                                onClick={() => setSearchInput('')}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                                <X size={16} style={{ color: 'var(--text-muted)' }} />
                            </button>
                        )}
                    </div>
                    <select
                        className="form-input form-select"
                        value={platform}
                        onChange={(e) => { setPlatform(e.target.value); setPage(1); }}
                        style={{ width: 'auto', minWidth: '150px' }}
                    >
                        <option value="">All Platforms</option>
                        <option value="vmware">VMware</option>
                        <option value="nutanix">Nutanix</option>
                    </select>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Showing {networks.length} of {total} networks
                    </span>
                </div>
            </div>

            {/* Networks Table */}
            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Platform</th>
                                <th>VMs</th>
                                <th>VLAN ID</th>
                                <th>Network ID</th>
                                <th>Description</th>
                                {isAdmin && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {networks.map((network) => (
                                <tr key={network.id}>
                                    <td style={{ fontWeight: 500 }}>{network.name}</td>
                                    <td>
                                        <span className={`badge ${network.platform === 'vmware' ? 'badge-info' : 'badge-success'}`}>
                                            {network.platform}
                                        </span>
                                    </td>
                                    <td>
                                        {network.vm_count > 0 ? (
                                            <button
                                                onClick={() => navigate(`/vms?network=${encodeURIComponent(network.platform === 'vmware' ? network.network_id : network.name)}`)}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    color: 'var(--accent-primary)',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline',
                                                    fontSize: 'inherit',
                                                    fontFamily: 'inherit'
                                                }}
                                            >
                                                <Server size={14} />
                                                {network.vm_count}
                                            </button>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <Server size={14} /> 0
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {editingId === network.id ? (
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={editVlan}
                                                onChange={(e) => setEditVlan(e.target.value)}
                                                placeholder="0-4095"
                                                min="0"
                                                max="4095"
                                                style={{ width: '80px', padding: '4px 8px' }}
                                            />
                                        ) : (
                                            network.vlan_id ? (
                                                <span className="badge badge-warning">{network.vlan_id}</span>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                                            )
                                        )}
                                    </td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {network.network_id}
                                    </td>
                                    <td>
                                        {editingId === network.id ? (
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                                placeholder="Description"
                                                style={{ width: '150px', padding: '4px 8px' }}
                                            />
                                        ) : (
                                            <span style={{ color: 'var(--text-secondary)' }}>{network.description || '-'}</span>
                                        )}
                                    </td>
                                    {isAdmin && (
                                        <td>
                                            {editingId === network.id ? (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button className="btn btn-sm btn-primary" onClick={() => saveEdit(network.id)}>
                                                        <Check size={14} />
                                                    </button>
                                                    <button className="btn btn-sm btn-secondary" onClick={cancelEdit}>
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button className="btn btn-sm btn-secondary" onClick={() => startEdit(network)}>
                                                    <Edit size={14} />
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '16px',
                        borderTop: '1px solid var(--border-color)'
                    }}>
                        <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            <ChevronLeft size={16} /> Previous
                        </button>
                        <span style={{ color: 'var(--text-secondary)' }}>
                            Page {page} of {totalPages}
                        </span>
                        <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>

            {networks.length === 0 && !loading && (
                <div className="empty-state card" style={{ marginTop: '24px' }}>
                    <Network size={64} />
                    <h3>No Networks Found</h3>
                    <p>Sync VMware or Nutanix networks to populate this table</p>
                </div>
            )}
        </div>
    );
}
