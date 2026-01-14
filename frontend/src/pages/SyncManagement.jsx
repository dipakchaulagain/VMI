import { useState, useEffect } from 'react';
import { syncApi, networksApi } from '../services/api';
import {
    RefreshCw,
    Cloud,
    Check,
    X,
    Clock,
    AlertCircle,
    Play,
    Network
} from 'lucide-react';

export default function SyncManagement() {
    const [status, setStatus] = useState(null);
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState({
        nutanix: false,
        vmware: false,
        vmwareNetworks: false,
        nutanixNetworks: false
    });
    const [networkSummary, setNetworkSummary] = useState({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statusRes, runsRes, networkRes] = await Promise.all([
                syncApi.getStatus(),
                syncApi.getRuns({ per_page: 20 }),
                networksApi.getSummary()
            ]);
            setStatus(statusRes.data);
            setRuns(runsRes.data.runs);
            setNetworkSummary(networkRes.data);
        } catch (error) {
            console.error('Failed to load sync data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async (platform) => {
        setSyncing({ ...syncing, [platform]: true });

        try {
            if (platform === 'nutanix') {
                await syncApi.nutanix();
            } else if (platform === 'vmware') {
                await syncApi.vmware();
            } else if (platform === 'vmwareNetworks') {
                await networksApi.syncVmware();
            } else if (platform === 'nutanixNetworks') {
                await networksApi.syncNutanix();
            }
            await loadData();
        } catch (error) {
            console.error('Sync failed:', error);
            alert(`Sync failed: ${error.response?.data?.error || error.message}`);
        } finally {
            setSyncing({ ...syncing, [platform]: false });
        }
    };

    const handleSyncAll = async () => {
        setSyncing({ nutanix: true, vmware: true, networks: false });

        try {
            await syncApi.all();
            await loadData();
        } catch (error) {
            console.error('Sync all failed:', error);
        } finally {
            setSyncing({ nutanix: false, vmware: false, networks: false });
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
            {/* Sync Controls */}
            <div className="stats-grid" style={{ marginBottom: '32px' }}>
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="stat-icon success">
                                <Cloud size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.125rem' }}>Nutanix</h3>
                                {status?.nutanix && (
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        Last sync: {new Date(status.nutanix.started_at).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={() => handleSync('nutanix')}
                            disabled={syncing.nutanix}
                        >
                            {syncing.nutanix ? (
                                <><span className="loading-spinner" /> Syncing...</>
                            ) : (
                                <><Play size={16} /> Sync Now</>
                            )}
                        </button>
                    </div>
                    {status?.nutanix && (
                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <span>Status: <span className={`badge badge-${status.nutanix.status === 'SUCCESS' ? 'success' : status.nutanix.status === 'RUNNING' ? 'warning' : 'error'}`}>{status.nutanix.status}</span></span>
                            <span>VMs: {status.nutanix.vm_count_seen}</span>
                        </div>
                    )}
                </div>

                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="stat-icon primary">
                                <Cloud size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.125rem' }}>VMware</h3>
                                {status?.vmware && (
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        Last sync: {new Date(status.vmware.started_at).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={() => handleSync('vmware')}
                            disabled={syncing.vmware}
                        >
                            {syncing.vmware ? (
                                <><span className="loading-spinner" /> Syncing...</>
                            ) : (
                                <><Play size={16} /> Sync Now</>
                            )}
                        </button>
                    </div>
                    {status?.vmware && (
                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <span>Status: <span className={`badge badge-${status.vmware.status === 'SUCCESS' ? 'success' : status.vmware.status === 'RUNNING' ? 'warning' : 'error'}`}>{status.vmware.status}</span></span>
                            <span>VMs: {status.vmware.vm_count_seen}</span>
                        </div>
                    )}
                </div>

                {/* VMware Networks */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="stat-icon info">
                                <Network size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.125rem' }}>VMware Networks</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Maps network IDs to friendly names
                                </p>
                            </div>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={() => handleSync('vmwareNetworks')}
                            disabled={syncing.vmwareNetworks}
                        >
                            {syncing.vmwareNetworks ? (
                                <><span className="loading-spinner" /> Syncing...</>
                            ) : (
                                <><Play size={16} /> Sync Now</>
                            )}
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <span>Networks: <span className="badge badge-info">{networkSummary?.vmware || 0}</span></span>
                    </div>
                </div>

                {/* Nutanix Networks */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="stat-icon success">
                                <Network size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.125rem' }}>Nutanix Networks</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Subnets with VLAN IDs
                                </p>
                            </div>
                        </div>
                        <button
                            className="btn btn-success"
                            onClick={() => handleSync('nutanixNetworks')}
                            disabled={syncing.nutanixNetworks}
                        >
                            {syncing.nutanixNetworks ? (
                                <><span className="loading-spinner" /> Syncing...</>
                            ) : (
                                <><Play size={16} /> Sync Now</>
                            )}
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <span>Networks: <span className="badge badge-success">{networkSummary?.nutanix || 0}</span></span>
                    </div>
                </div>
            </div>

            {/* Sync All Button */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
                <button
                    className="btn btn-primary"
                    onClick={handleSyncAll}
                    disabled={syncing.nutanix || syncing.vmware}
                    style={{ padding: '14px 32px', fontSize: '1rem' }}
                >
                    {(syncing.nutanix || syncing.vmware) ? (
                        <><span className="loading-spinner" /> Syncing All...</>
                    ) : (
                        <><RefreshCw size={18} /> Sync All Platforms</>
                    )}
                </button>
            </div>

            {/* Sync History */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Sync History</h3>
                </div>

                {runs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px' }}>
                        <Clock size={48} />
                        <h3>No Sync Runs Yet</h3>
                        <p>Click "Sync Now" to start syncing VM data</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Platform</th>
                                    <th>Status</th>
                                    <th>VMs Synced</th>
                                    <th>Started</th>
                                    <th>Finished</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {runs.map((run) => (
                                    <tr key={run.id}>
                                        <td>#{run.id}</td>
                                        <td>
                                            <span className={`badge ${run.platform === 'nutanix' ? 'badge-success' : 'badge-info'}`}>
                                                {run.platform}
                                            </span>
                                        </td>
                                        <td>
                                            {run.status === 'SUCCESS' && (
                                                <span className="badge badge-success"><Check size={12} /> Success</span>
                                            )}
                                            {run.status === 'RUNNING' && (
                                                <span className="badge badge-warning"><Clock size={12} /> Running</span>
                                            )}
                                            {run.status === 'FAILED' && (
                                                <span className="badge badge-error"><X size={12} /> Failed</span>
                                            )}
                                        </td>
                                        <td>{run.vm_count_seen || 0}</td>
                                        <td style={{ color: 'var(--text-muted)' }}>
                                            {new Date(run.started_at).toLocaleString()}
                                        </td>
                                        <td style={{ color: 'var(--text-muted)' }}>
                                            {run.finished_at ? new Date(run.finished_at).toLocaleString() : '-'}
                                        </td>
                                        <td>
                                            {run.details?.changes_detected !== undefined && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    {run.details.changes_detected} changes
                                                </span>
                                            )}
                                            {run.details?.error && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--error)' }} title={run.details.error}>
                                                    Error
                                                </span>
                                            )}
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
