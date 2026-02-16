import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { networkFeaturesApi } from '../services/api';
import { Shield, Search, RefreshCw, X, AlertTriangle, Lock } from 'lucide-react';

export default function DNSRecordList() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        loadRecords();
    }, []);

    const loadRecords = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await networkFeaturesApi.listDNSRecords();
            setRecords(response.data.dns_records);
        } catch (err) {
            console.error('Failed to load DNS records:', err);
            setError('Failed to load DNS record data');
        } finally {
            setLoading(false);
        }
    };

    const filteredRecords = records.filter(rec =>
        rec.vm_name.toLowerCase().includes(search.toLowerCase()) ||
        (rec.internal_dns && rec.internal_dns.toLowerCase().includes(search.toLowerCase())) ||
        (rec.external_dns && rec.external_dns.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div>
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div className="search-wrapper" style={{ flex: 1 }}>
                        <Search className="search-icon" size={18} />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search by VM Name or DNS..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <button
                                className="btn-icon"
                                onClick={() => setSearch('')}
                                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <button className="btn btn-secondary" onClick={loadRecords} disabled={loading} style={{ height: '42px' }}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="alert alert-error" style={{ marginBottom: '24px' }}>
                    <AlertTriangle size={18} /> {error}
                </div>
            )}

            {loading ? (
                <div className="loading-container">
                    <div className="loading-spinner" />
                </div>
            ) : filteredRecords.length === 0 ? (
                <div className="empty-state card">
                    <Shield size={48} />
                    <h3>No DNS Records Found</h3>
                    <p>No active DNS records were found.</p>
                </div>
            ) : (
                <div className="table-container card">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>VM Name</th>
                                <th>Platform</th>
                                <th>Internal DNS</th>
                                <th>External DNS</th>
                                <th>SSL Status</th>
                                <th>Last Updated</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecords.map(rec => (
                                <tr key={rec.id}>
                                    <td style={{ fontWeight: 500 }}>
                                        <Link to={`/vms/${rec.vm_id}`} style={{ color: 'inherit', textDecoration: 'none' }} className="hover-underline">
                                            {rec.vm_name}
                                        </Link>
                                    </td>
                                    <td>
                                        <span className={`badge ${rec.platform === 'nutanix' ? 'badge-success' : 'badge-info'}`}>
                                            {rec.platform}
                                        </span>
                                    </td>
                                    <td style={{ fontFamily: 'monospace' }}>{rec.internal_dns || '-'}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{rec.external_dns || '-'}</td>
                                    <td>
                                        {rec.ssl_enabled ? (
                                            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <Lock size={10} /> SSL Enabled
                                            </span>
                                        ) : (
                                            <span className="badge badge-neutral" style={{ opacity: 0.6 }}>No SSL</span>
                                        )}
                                    </td>
                                    <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                        {rec.updated_at ? new Date(rec.updated_at).toLocaleString() : '-'}
                                    </td>
                                    <td>
                                        <Link to={`/vms/${rec.vm_id}`} className="btn btn-sm btn-secondary">
                                            View VM
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
