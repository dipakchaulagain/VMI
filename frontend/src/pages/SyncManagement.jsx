import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { syncApi, networksApi, hostsApi } from '../services/api';
import {
    RefreshCw,
    Cloud,
    Check,
    X,
    Clock,
    AlertCircle,
    Play,
    Network,
    Server
} from 'lucide-react';

export default function SyncManagement() {
    const [status, setStatus] = useState(null);
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState({
        nutanix: false,
        vmware: false,
        vmwareNetworks: false,
        nutanixNetworks: false,
        hosts: false
    });
    const [networkSummary, setNetworkSummary] = useState({});
    const [hostSummary, setHostSummary] = useState({});
    const [headerActions, setHeaderActions] = useState(null);

    useEffect(() => {
        setHeaderActions(document.getElementById('header-actions'));
    }, []);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statusRes, runsRes, networkRes, hostRes] = await Promise.all([
                syncApi.getStatus(),
                syncApi.getRuns({ per_page: 20 }),
                networksApi.getSummary(),
                hostsApi.getSummary()
            ]);
            setStatus(statusRes.data);
            setRuns(runsRes.data.runs);
            setNetworkSummary(networkRes.data);
            setHostSummary(hostRes.data);
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
            } else if (platform === 'hosts') {
                await hostsApi.sync();
            } else if (platform === 'vmwareHosts') {
                await hostsApi.sync('vmware');
            } else if (platform === 'nutanixHosts') {
                await hostsApi.sync('nutanix');
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

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('en-US', {
            timeZone: 'Asia/Kathmandu',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true
        });
    };

    return (
        <div>
            {headerActions && createPortal(
                <button
                    className="btn btn-primary"
                    onClick={handleSyncAll}
                    disabled={syncing.nutanix || syncing.vmware}
                >
                    {(syncing.nutanix || syncing.vmware) ? (
                        <><span className="loading-spinner" /> Syncing All...</>
                    ) : (
                        <><RefreshCw size={18} /> Sync All</>
                    )}
                </button>,
                headerActions
            )}

            {/* Sync Controls */}
            <div className="stats-grid" style={{ marginBottom: '32px' }}>
                {/* Virtual Machines */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', minHeight: '48px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                            <div className="stat-icon primary" style={{ flexShrink: 0 }}>
                                <Cloud size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.125rem', lineHeight: '1.3' }}>Virtual Machines</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Sync VM inventory from hypervisors
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignSelf: 'center' }}>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleSync('vmware')}
                                disabled={syncing.vmware}
                                title="Sync VMware VMs"
                            >
                                {syncing.vmware ? (
                                    <><span className="loading-spinner" /> VMware</>
                                ) : (
                                    <><Play size={14} /> VMware</>
                                )}
                            </button>
                            <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleSync('nutanix')}
                                disabled={syncing.nutanix}
                                title="Sync Nutanix VMs"
                            >
                                {syncing.nutanix ? (
                                    <><span className="loading-spinner" /> Nutanix</>
                                ) : (
                                    <><Play size={14} /> Nutanix</>
                                )}
                            </button>

                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '24px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <span>VMware:</span>
                            {status?.vmware && (
                                <>
                                    <span>{status.vmware.vm_count_seen} VMs</span>
                                </>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <span>Nutanix:</span>
                            {status?.nutanix && (
                                <>
                                    <span>{status.nutanix.vm_count_seen} VMs</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Networks */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', minHeight: '48px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                            <div className="stat-icon info" style={{ flexShrink: 0 }}>
                                <Network size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.125rem', lineHeight: '1.3' }}>Networks</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Hypervisor network mappings
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignSelf: 'center' }}>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleSync('vmwareNetworks')}
                                disabled={syncing.vmwareNetworks}
                                title="Sync VMware Networks"
                            >
                                {syncing.vmwareNetworks ? (
                                    <><span className="loading-spinner" /> VMware</>
                                ) : (
                                    <><Play size={14} /> VMware</>
                                )}
                            </button>
                            <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleSync('nutanixNetworks')}
                                disabled={syncing.nutanixNetworks}
                                title="Sync Nutanix Networks"
                            >
                                {syncing.nutanixNetworks ? (
                                    <><span className="loading-spinner" /> Nutanix</>
                                ) : (
                                    <><Play size={14} /> Nutanix</>
                                )}
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <span>VMware: <span className="badge badge-info">{networkSummary?.vmware || 0}</span></span>
                        <span>Nutanix: <span className="badge badge-success">{networkSummary?.nutanix || 0}</span></span>
                    </div>
                </div>

                {/* Hosts (Hypervisors) */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', minHeight: '48px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                            <div className="stat-icon warning" style={{ flexShrink: 0 }}>
                                <Server size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.125rem', lineHeight: '1.3' }}>Hypervisors</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    ESXi and Nutanix hosts
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignSelf: 'center' }}>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleSync('vmwareHosts')}
                                disabled={syncing.vmwareHosts}
                                title="Sync VMware Hosts"
                            >
                                {syncing.vmwareHosts ? (
                                    <><span className="loading-spinner" /> VMware</>
                                ) : (
                                    <><Play size={14} /> VMware</>
                                )}
                            </button>
                            <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleSync('nutanixHosts')}
                                disabled={syncing.nutanixHosts}
                                title="Sync Nutanix Hosts"
                            >
                                {syncing.nutanixHosts ? (
                                    <><span className="loading-spinner" /> Nutanix</>
                                ) : (
                                    <><Play size={14} /> Nutanix</>
                                )}
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <span>VMware: <span className="badge badge-info">{hostSummary?.vmware?.count || 0}</span></span>
                        <span>Nutanix: <span className="badge badge-success">{hostSummary?.nutanix?.count || 0}</span></span>
                    </div>
                </div>
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
                                            {formatDate(run.started_at)}
                                        </td>
                                        <td style={{ color: 'var(--text-muted)' }}>
                                            {formatDate(run.finished_at)}
                                        </td>
                                        <td>
                                            {run.details?.changes_detected !== undefined && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    {run.details.changes_detected} changes
                                                </div>
                                            )}
                                            {run.details?.updated !== undefined && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    {run.details.updated} updated
                                                </div>
                                            )}
                                            {run.details?.mappings_received !== undefined && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title={`VMs matched: ${run.details.vm_matched}, Hosts matched: ${run.details.host_matched}`}>
                                                    {run.details.mappings_received} rx, {run.details.vm_matched}/{run.details.host_matched} match
                                                </div>
                                            )}
                                            {run.details?.first_mapping_keys && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} title={`Keys: ${run.details.first_mapping_keys.join(', ')}`}>
                                                    Keys: {run.details.first_mapping_keys.join(', ').substring(0, 20)}...
                                                </div>
                                            )}
                                            {run.details?.error && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--error)' }} title={run.details.error}>
                                                    Error
                                                </div>
                                            )}
                                            {run.details?.errors && run.details.errors.length > 0 && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--error)' }} title={run.details.errors.join('\n')}>
                                                    {run.details.errors.length} Errors
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div >
    );
}
