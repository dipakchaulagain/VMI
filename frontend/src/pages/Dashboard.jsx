import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { vmsApi, syncApi, changesApi, networksApi, hostsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
    Server,
    Power,
    PowerOff,
    HardDrive,
    Cpu,
    MemoryStick,
    History,
    RefreshCw,
    ArrowRight,
    Cloud,
    AlertCircle,
    Network,
    Monitor
} from 'lucide-react';

export default function Dashboard() {
    const [summary, setSummary] = useState(null);
    const [recentChanges, setRecentChanges] = useState([]);
    const [syncStatus, setSyncStatus] = useState(null);
    const [networkStats, setNetworkStats] = useState(null);
    const [hostStats, setHostStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const { isAdmin } = useAuth();

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            const [summaryRes, changesRes, syncRes, networksRes, hostsRes] = await Promise.all([
                vmsApi.getSummary(),
                changesApi.getSummary(),
                isAdmin ? syncApi.getStatus() : Promise.resolve({ data: null }),
                networksApi.getSummary(),
                hostsApi.getSummary()
            ]);

            setSummary(summaryRes.data);
            setRecentChanges(changesRes.data.recent_changes || []);
            setSyncStatus(syncRes.data);
            setNetworkStats(networksRes.data);
            setHostStats(hostsRes.data);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    // ... handleSync ...

    // ... loading check ...

    return (
        <div className="dashboard">
            {/* Stats Grid */}
            <div className="stats-grid">
                <Link to="/vms" className="stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                    <div className="stat-icon primary">
                        <Server size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{summary?.total_vms || 0}</h3>
                        <p>Total VMs</p>
                    </div>
                </Link>

                <Link to="/hypervisors" className="stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                    <div className="stat-icon info">
                        <HardDrive size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{hostStats?.total_hosts || 0} <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)' }}>({hostStats?.vmware?.count || 0} / {hostStats?.nutanix?.count || 0})</span></h3>
                        <p>Total Hypervisors</p>
                    </div>
                </Link>

                <Link to="/vms?power_state=ON" className="stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                    <div className="stat-icon success">
                        <Power size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{summary?.by_power_state?.ON || 0}</h3>
                        <p>Powered On</p>
                    </div>
                </Link>

                <Link to="/vms?power_state=OFF" className="stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                    <div className="stat-icon error">
                        <PowerOff size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{summary?.by_power_state?.OFF || 0}</h3>
                        <p>Powered Off</p>
                    </div>
                </Link>

                <Link to="/changes" className="stat-card" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                    <div className="stat-icon warning">
                        <History size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>{recentChanges.length}</h3>
                        <p>Recent Changes</p>
                    </div>
                </Link>
            </div>

            {/* Platform & Network Distribution */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                {/* Platform Distribution */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Platform Distribution</h3>
                    </div>
                    {/* ... existing platform content ... */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {Object.entries(summary?.by_platform || {}).map(([platform, count]) => (
                            <Link
                                key={platform}
                                to={`/vms?platform=${platform}`}
                                style={{
                                    display: 'flex',
                                    justify_content: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 12px',
                                    borderRadius: 'var(--border-radius-sm)',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    transition: 'background 0.2s',
                                    cursor: 'pointer'
                                }}
                                className="item-hover"
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Cloud size={20} style={{ color: platform === 'nutanix' ? '#10b981' : '#6366f1' }} />
                                    <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{platform}</span>
                                </div>
                                <span className="badge badge-neutral">{count} VMs</span>
                            </Link>
                        ))}
                    </div>

                    {/* OS Family Distribution */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">OS Family Distribution</h3>
                        </div>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                Loading...
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {(!summary?.by_os_family || Object.keys(summary.by_os_family).length === 0) ? (
                                    <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>
                                        No Data
                                    </div>
                                ) : (
                                    Object.entries(summary.by_os_family).map(([family, count]) => (
                                        <Link
                                            key={family}
                                            to={`/vms?os_family=${family}`}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '8px 12px',
                                                borderRadius: 'var(--border-radius-sm)',
                                                textDecoration: 'none',
                                                color: 'inherit',
                                                transition: 'background 0.2s',
                                                cursor: 'pointer'
                                            }}
                                            className="item-hover"
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <Monitor size={20} style={{ color: family.toLowerCase().includes('windows') ? '#0ea5e9' : (family.toLowerCase().includes('linux') ? '#f59e0b' : 'var(--text-muted)') }} />
                                                <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{family}</span>
                                            </div>
                                            <span className="badge badge-neutral">{count} VMs</span>
                                        </Link>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Network Overview */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Network Statistics</h3>
                        <Link to="/networks" className="btn btn-sm btn-secondary">
                            View All <ArrowRight size={14} />
                        </Link>
                    </div>
                    {networkStats ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--border-radius-sm)', textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{networkStats.total}</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Total Networks</div>
                            </div>
                            <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '12px', borderRadius: 'var(--border-radius-sm)', textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{networkStats.in_use}</div>
                                <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>In Use</div>
                            </div>
                            <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--border-radius-sm)', textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{networkStats.vmware}</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>VMware</div>
                            </div>
                            <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--border-radius-sm)', textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{networkStats.nutanix}</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Nutanix</div>
                            </div>
                            <div style={{ gridColumn: '1 / -1', background: 'var(--error-bg)', color: 'var(--error)', padding: '12px', borderRadius: 'var(--border-radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Not In Use</span>
                                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{networkStats.not_in_use}</span>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                            Loading stats...
                        </div>
                    )}
                </div>

                {/* By Cluster */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">By Cluster</h3>
                    </div>
                    {/* ... existing cluster content ... */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {Object.entries(summary?.by_cluster || {}).slice(0, 5).map(([cluster, count]) => (
                            <Link
                                key={cluster}
                                to={`/vms?cluster=${cluster}`}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 12px',
                                    borderRadius: 'var(--border-radius-sm)',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    transition: 'background 0.2s',
                                    cursor: 'pointer'
                                }}
                                className="item-hover"
                            >
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{cluster}</span>
                                <span className="badge badge-info">{count}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Changes */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Recent Changes</h3>
                    <Link to="/changes" className="btn btn-sm btn-secondary">
                        View All <ArrowRight size={14} />
                    </Link>
                </div>

                {recentChanges.length === 0 ? (
                    <div className="empty-state">
                        <AlertCircle size={48} />
                        <h3>No Recent Changes</h3>
                        <p>VM changes will appear here after syncing</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>VM Name</th>
                                    <th>Change Type</th>
                                    <th>Field</th>
                                    <th>Old Value</th>
                                    <th>New Value</th>
                                    <th>Changed At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentChanges.slice(0, 5).map((change) => (
                                    <tr key={change.id}>
                                        <td>
                                            <Link to={`/vms/${change.vm_id}`} style={{ color: 'var(--accent-primary)' }}>
                                                {change.vm_name}
                                            </Link>
                                        </td>
                                        <td>
                                            <span className={`badge badge-${getChangeTypeBadge(change.change_type)}`}>
                                                {change.change_type}
                                            </span>
                                        </td>
                                        <td>{change.field_name}</td>
                                        <td style={{ color: 'var(--error)' }}>{change.old_value || '-'}</td>
                                        <td style={{ color: 'var(--success)' }}>{change.new_value || '-'}</td>
                                        <td style={{ color: 'var(--text-muted)' }}>
                                            {new Date(change.changed_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function getChangeTypeBadge(type) {
    const badges = {
        'POWER_STATE': 'warning',
        'CPU': 'info',
        'MEMORY': 'info',
        'DISK': 'neutral',
        'NIC': 'neutral',
        'IP': 'success',
        'HOST': 'warning',
        'CLUSTER': 'warning'
    };
    return badges[type] || 'neutral';
}
