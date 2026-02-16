import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { networkFeaturesApi } from '../services/api';
import { Globe, Search, RefreshCw, X, AlertTriangle } from 'lucide-react';

export default function PublicNetworkList() {
    const [networks, setNetworks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        loadNetworks();
    }, []);

    const loadNetworks = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await networkFeaturesApi.listPublicNetworks();
            setNetworks(response.data.public_networks);
        } catch (err) {
            console.error('Failed to load public networks:', err);
            setError('Failed to load public network data');
        } finally {
            setLoading(false);
        }
    };

    const filteredNetworks = networks.filter(pn =>
        pn.vm_name.toLowerCase().includes(search.toLowerCase()) ||
        (pn.snat_ip && pn.snat_ip.includes(search)) ||
        (pn.dnat_ip && pn.dnat_ip.includes(search))
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
                            placeholder="Search by VM Name, SNAT, or DNAT IP..."
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
                    <button className="btn btn-secondary" onClick={loadNetworks} disabled={loading} style={{ height: '42px' }}>
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
            ) : filteredNetworks.length === 0 ? (
                <div className="empty-state card">
                    <Globe size={48} />
                    <h3>No Public Networks Found</h3>
                    <p>No active public network configurations were found.</p>
                </div>
            ) : (
                <div className="table-container card">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>VM Name</th>
                                <th>Platform</th>
                                <th>SNAT IP</th>
                                <th>DNAT IP</th>
                                <th>Exposed Ports</th>
                                <th>Source Region</th>
                                <th>Last Updated</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredNetworks.map(pn => (
                                <tr key={pn.id}>
                                    <td style={{ fontWeight: 500 }}>
                                        <Link to={`/vms/${pn.vm_id}`} style={{ color: 'inherit', textDecoration: 'none' }} className="hover-underline">
                                            {pn.vm_name}
                                        </Link>
                                    </td>
                                    <td>
                                        <span className={`badge ${pn.platform === 'nutanix' ? 'badge-success' : 'badge-info'}`}>
                                            {pn.platform}
                                        </span>
                                    </td>
                                    <td style={{ fontFamily: 'monospace' }}>{pn.snat_ip || '-'}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{pn.dnat_ip || '-'}</td>
                                    <td>{pn.dnat_exposed_ports || '-'}</td>
                                    <td>{pn.dnat_source_region || '-'}</td>
                                    <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                        {pn.updated_at ? new Date(pn.updated_at).toLocaleString() : '-'}
                                    </td>
                                    <td>
                                        <Link to={`/vms/${pn.vm_id}`} className="btn btn-sm btn-secondary">
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
