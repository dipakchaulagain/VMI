import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { vmsApi } from '../services/api';
import {
    Server,
    Search,
    Filter,
    Power,
    PowerOff,
    ChevronLeft,
    ChevronRight,
    Eye,
    X,
    Layout
} from 'lucide-react';

export default function VMInventory() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [vms, setVms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [platform, setPlatform] = useState('');
    const [powerState, setPowerState] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Get filter params from URL
    const ownerIdParam = searchParams.get('owner_id');
    const networkParam = searchParams.get('network');
    const filterActive = ownerIdParam || networkParam;

    useEffect(() => {
        loadVMs();
    }, [page, platform, powerState, ownerIdParam, networkParam]);

    const loadVMs = async () => {
        setLoading(true);
        try {
            const response = await vmsApi.list({
                page,
                per_page: 20,
                search: search || undefined,
                platform: platform || undefined,
                power_state: powerState || undefined,
                owner_id: ownerIdParam || undefined,
                network: networkParam || undefined
            });
            setVms(response.data.vms);
            setTotalPages(response.data.pages);
            setTotal(response.data.total);
        } catch (error) {
            console.error('Failed to load VMs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        loadVMs();
    };

    const clearFilters = () => {
        setSearchParams({});
    };

    const [showColumnDropdown, setShowColumnDropdown] = useState(false);
    const [columns, setColumns] = useState({
        vm_name: { label: 'VM Name', visible: true, mandatory: true },
        ip_address: { label: 'IP Address', visible: true },
        tags: { label: 'Tags', visible: true },
        platform: { label: 'Platform', visible: true },
        power_state: { label: 'Power', visible: true },
        cluster_name: { label: 'Cluster', visible: true },
        total_vcpus: { label: 'vCPUs', visible: false },
        memory_gb: { label: 'Memory', visible: true },
        total_disk_gb: { label: 'Storage', visible: true },
        environment: { label: 'Environment', visible: true },
    });

    const toggleColumn = (key) => {
        setColumns(prev => ({
            ...prev,
            [key]: { ...prev[key], visible: !prev[key].visible }
        }));
    };

    return (
        <div>
            {/* Active Filter Indicator */}
            {filterActive && (
                <div className="alert alert-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                        Filtering VMs by: {ownerIdParam && <strong>Owner ID {ownerIdParam}</strong>}
                        {networkParam && <strong>Network: {networkParam}</strong>}
                    </span>
                    <button className="btn btn-sm btn-secondary" onClick={clearFilters}>
                        <X size={14} /> Clear Filter
                    </button>
                </div>
            )}

            {/* Filter Bar */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
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
                                placeholder="Search by VM name, IP, or UUID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    outline: 'none',
                                    width: '100%',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem'
                                }}
                            />
                        </div>

                        <select
                            className="form-input form-select"
                            value={platform}
                            onChange={(e) => { setPlatform(e.target.value); setPage(1); }}
                            style={{ width: 'auto', minWidth: '140px' }}
                        >
                            <option value="">All Platforms</option>
                            <option value="nutanix">Nutanix</option>
                            <option value="vmware">VMware</option>
                        </select>

                        <select
                            className="form-input form-select"
                            value={powerState}
                            onChange={(e) => { setPowerState(e.target.value); setPage(1); }}
                            style={{ width: 'auto', minWidth: '150px' }}
                        >
                            <option value="">All Power States</option>
                            <option value="ON">Powered On</option>
                            <option value="OFF">Powered Off</option>
                            <option value="SUSPENDED">Suspended</option>
                        </select>

                        <button type="submit" className="btn btn-primary">
                            <Filter size={16} /> Filter
                        </button>

                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginLeft: 'auto' }}>
                            {total} VMs
                        </span>
                    </form>

                    {/* Column Selector */}
                    <div style={{ position: 'relative' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                            style={{ gap: '8px' }}
                        >
                            <Layout size={18} /> Columns
                        </button>

                        {showColumnDropdown && (
                            <div className="card" style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '8px',
                                width: '250px',
                                zIndex: 10,
                                padding: '12px',
                                boxShadow: 'var(--shadow-lg)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.875rem' }}>Show Columns</h4>
                                    <button className="btn btn-sm btn-icon" onClick={() => setShowColumnDropdown(false)}><X size={14} /></button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                                    {Object.entries(columns).map(([key, config]) => !config.mandatory && (
                                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={config.visible}
                                                onChange={() => toggleColumn(key)}
                                            />
                                            {config.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading VMs...
                </div>
            ) : vms.length === 0 ? (
                <div className="empty-state card">
                    <Server size={64} />
                    <h3>No VMs Found</h3>
                    <p>Try adjusting your search or filters</p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>VM Name</th> {/* Always shown */}
                                {columns.ip_address.visible && <th>IP Address</th>}
                                {columns.tags.visible && <th>Tags</th>}
                                {columns.platform.visible && <th>Platform</th>}
                                {columns.power_state.visible && <th>Power</th>}
                                {columns.cluster_name.visible && <th>Cluster</th>}
                                {columns.total_vcpus.visible && <th>vCPUs</th>}
                                {columns.memory_gb.visible && <th>Memory</th>}
                                {columns.total_disk_gb.visible && <th>Storage</th>}
                                {columns.environment.visible && <th>Environment</th>}
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vms.map((vm) => (
                                <tr key={vm.id}>
                                    {/* VM Name (Mandatory) */}
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Server size={18} style={{ color: 'var(--accent-primary)' }} />
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{vm.vm_name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {vm.hostname || vm.vm_uuid.substring(0, 8)}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* IP Address */}
                                    {columns.ip_address.visible && (
                                        <td>
                                            {vm.ip_address ? (
                                                <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{vm.ip_address}</span>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                                            )}
                                        </td>
                                    )}

                                    {/* Tags */}
                                    {columns.tags.visible && (
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {vm.tags && vm.tags.length > 0 ? vm.tags.map((tag, idx) => (
                                                    <span key={idx} className="badge badge-neutral" style={{ fontSize: '0.75rem', padding: '2px 6px' }}>
                                                        {tag.tag_value}
                                                    </span>
                                                )) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                                            </div>
                                        </td>
                                    )}

                                    {/* Platform */}
                                    {columns.platform.visible && (
                                        <td>
                                            <span className={`badge ${vm.platform === 'nutanix' ? 'badge-success' : 'badge-info'}`}>
                                                {vm.platform}
                                            </span>
                                        </td>
                                    )}

                                    {/* Power */}
                                    {columns.power_state.visible && (
                                        <td>
                                            {vm.power_state === 'ON' ? (
                                                <span className="badge badge-success">
                                                    <Power size={12} /> ON
                                                </span>
                                            ) : (
                                                <span className="badge badge-error">
                                                    <PowerOff size={12} /> OFF
                                                </span>
                                            )}
                                        </td>
                                    )}

                                    {/* Cluster */}
                                    {columns.cluster_name.visible && (
                                        <td style={{ color: 'var(--text-secondary)' }}>{vm.cluster_name || '-'}</td>
                                    )}

                                    {/* vCPUs */}
                                    {columns.total_vcpus.visible && (
                                        <td>{vm.total_vcpus || '-'}</td>
                                    )}

                                    {/* Memory */}
                                    {columns.memory_gb.visible && (
                                        <td>{vm.memory_gb ? `${vm.memory_gb} GB` : '-'}</td>
                                    )}

                                    {/* Storage */}
                                    {columns.total_disk_gb.visible && (
                                        <td>{vm.total_disk_gb ? `${vm.total_disk_gb} GB` : '-'}</td>
                                    )}

                                    {/* Environment */}
                                    {columns.environment.visible && (
                                        <td>
                                            {vm.environment ? (
                                                <span className={`badge badge-${getEnvBadge(vm.environment)}`}>
                                                    {vm.environment}
                                                </span>
                                            ) : '-'}
                                        </td>
                                    )}

                                    <td>
                                        <Link to={`/vms/${vm.id}`} className="btn btn-sm btn-secondary">
                                            <Eye size={14} /> View
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button
                        className="pagination-btn"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                    >
                        <ChevronLeft size={16} /> Prev
                    </button>
                    <span className="pagination-info">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        className="pagination-btn"
                        disabled={page === totalPages}
                        onClick={() => setPage(page + 1)}
                    >
                        Next <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}

function getEnvBadge(env) {
    const badges = {
        'prod': 'error',
        'production': 'error',
        'dev': 'info',
        'development': 'info',
        'test': 'warning',
        'testing': 'warning',
        'staging': 'warning',
        'dr': 'neutral'
    };
    return badges[env?.toLowerCase()] || 'neutral';
}
