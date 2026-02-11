import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { hostsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
    Server,
    Cpu,
    MemoryStick,
    Search,
    Cloud,
    HardDrive,
    Columns,
    ChevronDown
} from 'lucide-react';

const ALL_COLUMNS = [
    { key: 'platform', label: 'Platform', default: true },
    { key: 'hostname', label: 'Hostname', default: true },
    { key: 'hypervisor_ip', label: 'IP Address', default: true },
    { key: 'vm_count', label: 'VMs', default: true },
    { key: 'hypervisor_name', label: 'Hypervisor Version', default: true },
    { key: 'cpu_model', label: 'CPU Model', default: true },
    { key: 'cpu_cores_physical', label: 'Cores', default: true },
    { key: 'ram_gb', label: 'RAM (GB)', default: true },
];

export default function Hypervisors() {
    const [hosts, setHosts] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [platform, setPlatform] = useState('');
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState(() => {
        const saved = localStorage.getItem('hypervisors_columns');
        return saved ? JSON.parse(saved) : ALL_COLUMNS.filter(c => c.default).map(c => c.key);
    });
    const { isAdmin } = useAuth();

    useEffect(() => {
        loadData();
    }, [platform]);

    useEffect(() => {
        localStorage.setItem('hypervisors_columns', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    const loadData = async () => {
        try {
            const [hostsRes, summaryRes] = await Promise.all([
                hostsApi.list({ platform, search }),
                hostsApi.getSummary()
            ]);
            setHosts(hostsRes.data.hosts || []);
            setSummary(summaryRes.data);
        } catch (error) {
            console.error('Failed to load hosts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        loadData();
    };

    const toggleColumn = (key) => {
        setVisibleColumns(prev =>
            prev.includes(key)
                ? prev.filter(k => k !== key)
                : [...prev, key]
        );
    };

    const filteredHosts = hosts.filter(host => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
            host.hostname?.toLowerCase().includes(searchLower) ||
            host.hypervisor_ip?.toLowerCase().includes(searchLower) ||
            host.cpu_model?.toLowerCase().includes(searchLower)
        );
    });

    const isColumnVisible = (key) => visibleColumns.includes(key);

    if (loading) {
        return (
            <div className="loading-overlay" style={{ position: 'relative', minHeight: '400px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="hypervisors-page">

            {/* Summary Stats */}
            {summary && (
                <div className="stats-grid" style={{ marginBottom: '24px' }}>
                    <div className="stat-card">
                        <div className="stat-icon primary">
                            <Server size={24} />
                        </div>
                        <div className="stat-content">
                            <h3>{summary.total_hosts}</h3>
                            <p>Total Hosts</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-content">
                            <h3>{summary.vmware?.count || 0} / {summary.nutanix?.count || 0}</h3>
                            <p>VMware / Nutanix</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon success">
                            <Cpu size={24} />
                        </div>
                        <div className="stat-content">
                            <h3>{summary.totals?.cores?.toLocaleString()} <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)' }}>({summary.vmware?.total_cores} / {summary.nutanix?.total_cores})</span></h3>
                            <p>Total CPU Cores</p>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon warning">
                            <MemoryStick size={24} />
                        </div>
                        <div className="stat-content">
                            <h3>{(summary.totals?.ram_gb / 1024).toFixed(1)} TB <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)' }}>({(summary.vmware?.total_ram_gb / 1024).toFixed(1)} / {(summary.nutanix?.total_ram_gb / 1024).toFixed(1)})</span></h3>
                            <p>Total RAM</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="card" style={{ marginBottom: '24px', position: 'relative', zIndex: 10 }}>
                <form onSubmit={handleSearch} className="filter-bar">
                    <div className="search-wrapper">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search by hostname, IP, or CPU model..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="filter-select"
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value)}
                    >
                        <option value="">All Platforms</option>
                        <option value="vmware">VMware</option>
                        <option value="nutanix">Nutanix</option>
                    </select>

                    {/* Column Picker */}
                    <div className="column-picker">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setShowColumnPicker(!showColumnPicker)}
                        >
                            <Columns size={16} />
                            Columns
                            <ChevronDown size={14} />
                        </button>
                        {showColumnPicker && (
                            <div className="column-picker-dropdown">
                                {ALL_COLUMNS.map(col => (
                                    <label key={col.key} className="column-option">
                                        <input
                                            type="checkbox"
                                            checked={isColumnVisible(col.key)}
                                            onChange={() => toggleColumn(col.key)}
                                        />
                                        <span>{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </form>
            </div>

            {/* Hosts Table */}
            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                {isColumnVisible('platform') && <th>Platform</th>}
                                {isColumnVisible('hostname') && <th>Hostname</th>}
                                {isColumnVisible('hypervisor_ip') && <th>IP Address</th>}
                                {isColumnVisible('vm_count') && <th>VMs</th>}
                                {isColumnVisible('hypervisor_name') && <th>Hypervisor</th>}
                                {isColumnVisible('cpu_model') && <th>CPU Model</th>}
                                {isColumnVisible('cpu_cores_physical') && <th>Cores</th>}
                                {isColumnVisible('ram_gb') && <th>RAM (GB)</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHosts.length === 0 ? (
                                <tr>
                                    <td colSpan={visibleColumns.length} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                                        <HardDrive size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                        <div>No hosts found. Go to Sync Management to fetch data.</div>
                                    </td>
                                </tr>
                            ) : (
                                filteredHosts.map((host) => (
                                    <tr key={host.id}>
                                        {isColumnVisible('platform') && (
                                            <td>
                                                <span className={`badge badge-${host.platform === 'vmware' ? 'info' : 'success'}`}>
                                                    {host.platform}
                                                </span>
                                            </td>
                                        )}
                                        {isColumnVisible('hostname') && (
                                            <td style={{ fontWeight: 500 }}>{host.hostname}</td>
                                        )}
                                        {isColumnVisible('hypervisor_ip') && (
                                            <td>
                                                <code style={{
                                                    background: 'var(--bg-tertiary)',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.875rem'
                                                }}>
                                                    {host.hypervisor_ip}
                                                </code>
                                            </td>
                                        )}
                                        {isColumnVisible('vm_count') && (
                                            <td>
                                                {host.vm_count > 0 ? (
                                                    <Link
                                                        to={`/vms?host_identifier=${encodeURIComponent(host.hypervisor_ip)}`}
                                                        className="badge badge-info"
                                                        style={{ textDecoration: 'none', cursor: 'pointer' }}
                                                    >
                                                        {host.vm_count} VMs
                                                    </Link>
                                                ) : (
                                                    <span className="badge badge-neutral">0</span>
                                                )}
                                            </td>
                                        )}
                                        {isColumnVisible('hypervisor_name') && (
                                            <td style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                {host.hypervisor_name}
                                            </td>
                                        )}
                                        {isColumnVisible('cpu_model') && (
                                            <td style={{ fontSize: '0.875rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {host.cpu_model}
                                            </td>
                                        )}
                                        {isColumnVisible('cpu_cores_physical') && (
                                            <td>
                                                <span className="badge badge-neutral">{host.cpu_cores_physical}</span>
                                            </td>
                                        )}
                                        {isColumnVisible('ram_gb') && (
                                            <td>
                                                <span className="badge badge-warning">{host.ram_gb}</span>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
