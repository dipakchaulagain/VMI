import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { changesApi } from '../services/api';
import {
    History,
    Filter,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

export default function ChangeHistory() {
    const [changes, setChanges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [changeType, setChangeType] = useState('');
    const [platform, setPlatform] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        loadChanges();
    }, [page, changeType, platform]);

    const loadChanges = async () => {
        setLoading(true);
        try {
            const response = await changesApi.list({
                page,
                per_page: 30,
                change_type: changeType || undefined,
                platform: platform || undefined
            });
            setChanges(response.data.changes);
            setTotalPages(response.data.pages);
            setTotal(response.data.total);
        } catch (error) {
            console.error('Failed to load changes:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            {/* Filter Bar */}
            <div className="filter-bar">
                <select
                    className="form-input form-select filter-select"
                    value={changeType}
                    onChange={(e) => { setChangeType(e.target.value); setPage(1); }}
                >
                    <option value="">All Change Types</option>
                    <option value="POWER_STATE">Power State</option>
                    <option value="CPU">CPU</option>
                    <option value="MEMORY">Memory</option>
                    <option value="DISK">Disk</option>
                    <option value="NIC">Network</option>
                    <option value="IP">IP Address</option>
                    <option value="HOST">Host</option>
                    <option value="CLUSTER">Cluster</option>
                </select>

                <select
                    className="form-input form-select filter-select"
                    value={platform}
                    onChange={(e) => { setPlatform(e.target.value); setPage(1); }}
                >
                    <option value="">All Platforms</option>
                    <option value="nutanix">Nutanix</option>
                    <option value="vmware">VMware</option>
                </select>
            </div>

            {/* Results Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ color: 'var(--text-secondary)' }}>
                    {total} changes recorded
                </p>
            </div>

            {/* Changes Table */}
            {loading ? (
                <div className="loading-overlay" style={{ position: 'relative', minHeight: '300px' }}>
                    <div className="loading-spinner" />
                </div>
            ) : changes.length === 0 ? (
                <div className="empty-state card">
                    <History size={64} />
                    <h3>No Changes Found</h3>
                    <p>Changes will be recorded when VMs are modified during sync</p>
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
                            {changes.map((change) => (
                                <tr key={change.id}>
                                    <td>
                                        <Link
                                            to={`/vms/${change.vm_id}`}
                                            style={{ color: 'var(--accent-primary)', fontWeight: 500 }}
                                        >
                                            {change.vm_name}
                                        </Link>
                                    </td>
                                    <td>
                                        <span className={`badge badge-${getChangeTypeBadge(change.change_type)}`}>
                                            {change.change_type}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{change.field_name}</td>
                                    <td style={{ color: 'var(--error)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {change.old_value || '-'}
                                    </td>
                                    <td style={{ color: 'var(--success)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {change.new_value || '-'}
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {new Date(change.changed_at).toLocaleString()}
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
