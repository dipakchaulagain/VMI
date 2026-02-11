import { useState, useEffect } from 'react';
import { auditApi } from '../services/api';
import { Activity, Filter, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function ActivityLog() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Filters
    const [filterAction, setFilterAction] = useState('');
    const [filterResource, setFilterResource] = useState('');
    const [searchUser, setSearchUser] = useState('');

    // Filter options
    const [actionTypes, setActionTypes] = useState([]);
    const [resourceTypes, setResourceTypes] = useState([]);

    useEffect(() => {
        loadFilterOptions();
    }, []);

    useEffect(() => {
        loadLogs();
    }, [page, filterAction, filterResource]); // Search user triggers on submit or debounce, for now simple submit

    const loadFilterOptions = async () => {
        try {
            const response = await auditApi.getTypes();
            setActionTypes(response.data.actions || []);
            setResourceTypes(response.data.resource_types || []);
        } catch (error) {
            console.error('Failed to load filter options:', error);
        }
    };

    const loadLogs = async () => {
        setLoading(true);
        try {
            const response = await auditApi.list({
                page,
                per_page: 50,
                action: filterAction || undefined,
                resource_type: filterResource || undefined,
                username: searchUser || undefined
            });
            setLogs(response.data.logs);
            setTotal(response.data.total);
            setTotalPages(response.data.pages);
        } catch (error) {
            console.error('Failed to load logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        loadLogs();
    };

    const clearFilters = () => {
        setFilterAction('');
        setFilterResource('');
        setSearchUser('');
        setPage(1);
        setTimeout(loadLogs, 0); // Trigger reload after state update
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Kathmandu'
        });
    };

    const renderDetails = (log) => {
        if (!log.details) return '-';

        // Custom rendering based on action/resource
        if (log.action === 'UPDATE' && log.details.changes) {
            return `Changed: ${log.details.changes.join(', ')}`;
        }

        if (log.action === 'LOGIN' && log.details.ip) {
            return `IP: ${log.details.ip}`;
        }

        // Truncate long JSON for display
        const str = JSON.stringify(log.details);
        return str.length > 50 ? str.substring(0, 50) + '...' : str;
    };

    return (
        <div className="container" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Activity /> Web Activity Log
                </h1>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                        className="form-input form-select"
                        value={filterAction}
                        onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
                        style={{ width: 'auto', minWidth: '150px' }}
                    >
                        <option value="">All Actions</option>
                        {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>

                    <select
                        className="form-input form-select"
                        value={filterResource}
                        onChange={(e) => { setFilterResource(e.target.value); setPage(1); }}
                        style={{ width: 'auto', minWidth: '150px' }}
                    >
                        <option value="">All Resource Types</option>
                        {resourceTypes.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>

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
                            placeholder="Search by Username..."
                            value={searchUser}
                            onChange={(e) => setSearchUser(e.target.value)}
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

                    <button type="submit" className="btn btn-primary">
                        <Filter size={16} /> Filter
                    </button>

                    <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                        <X size={16} /> Clear
                    </button>
                </form>
            </div>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading logs...
                </div>
            ) : logs.length === 0 ? (
                <div className="empty-state card">
                    <Activity size={48} />
                    <h3>No Activity Logs Found</h3>
                    <p>No actions have been recorded matching your criteria.</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>User</th>
                                    <th>Action</th>
                                    <th>Resource</th>
                                    <th>Resource ID</th>
                                    <th>Details</th>
                                    <th>IP Address</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log.id}>
                                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {formatDate(log.created_at)}
                                        </td>
                                        <td style={{ fontWeight: 500 }}>
                                            {log.username || 'System'}
                                        </td>
                                        <td>
                                            <span className={`badge ${getActionBadge(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td>{log.resource_type}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                            {log.resource_id || '-'}
                                        </td>
                                        <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={JSON.stringify(log.details, null, 2)}>
                                            {renderDetails(log)}
                                        </td>
                                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {log.ip_address || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination" style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
                            <button
                                className="pagination-btn"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                <ChevronLeft size={16} /> Prev
                            </button>
                            <span className="pagination-info">
                                Page {page} of {totalPages} (Total {total})
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
            )}
        </div>
    );
}

function getActionBadge(action) {
    if (!action) return 'badge-neutral';
    const a = action.toUpperCase();
    if (a.includes('DELETE')) return 'badge-error';
    if (a.includes('CREATE')) return 'badge-success';
    if (a.includes('UPDATE')) return 'badge-info';
    if (a.includes('LOGIN')) return 'badge-neutral';
    if (a.includes('LOGOUT')) return 'badge-neutral';
    return 'badge-neutral';
}
