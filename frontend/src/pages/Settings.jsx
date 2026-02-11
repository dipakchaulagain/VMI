import { useState, useEffect } from 'react';
import { settingsApi, syncApi, vmsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
    Settings,
    Clock,
    Globe,
    Server,
    Edit,
    Trash2,
    Plus,
    X,
    Database,
    CheckCircle,
    AlertCircle,
    Power,
    RefreshCw,
    Save,
    Download
} from 'lucide-react';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('sync');

    // Sync Settings State
    const [syncSettings, setSyncSettings] = useState({
        sync_enabled: false,
        sync_interval_minutes: 60,
        sync_last_run: null
    });

    // API Management State
    const [apis, setApis] = useState([]);
    const [editingApi, setEditingApi] = useState(null);
    const [showApiModal, setShowApiModal] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [message, setMessage] = useState(null);
    const { isAdmin } = useAuth();

    // Export state
    const [exporting, setExporting] = useState(false);
    const [exportPlatform, setExportPlatform] = useState('');
    const [exportPowerState, setExportPowerState] = useState('');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const [syncRes, apisRes] = await Promise.all([
                settingsApi.getSyncSettings(),
                settingsApi.listApis()
            ]);
            setSyncSettings(syncRes.data);
            setApis(apisRes.data.apis);
        } catch (error) {
            console.error('Failed to load settings:', error);
            setMessage({ type: 'error', text: 'Failed to load settings' });
        } finally {
            setLoading(false);
        }
    };

    const loadApis = async () => {
        try {
            const res = await settingsApi.listApis();
            setApis(res.data.apis);
        } catch (error) {
            console.error('Failed to load APIs:', error);
        }
    };

    const handleSaveSync = async () => {
        if (!isAdmin) return;
        setSaving(true);
        setMessage(null);

        try {
            await settingsApi.updateSyncSettings({
                sync_enabled: syncSettings.sync_enabled,
                sync_interval_minutes: syncSettings.sync_interval_minutes
            });
            setMessage({ type: 'success', text: 'Settings saved successfully!' });
        } catch (error) {
            console.error('Failed to save settings:', error);
            setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    const handleSyncNow = async () => {
        if (!isAdmin) return;
        setSyncing(true);
        setMessage(null);

        try {
            await syncApi.all();
            setMessage({ type: 'success', text: 'Sync completed successfully!' });
            await loadSettings();
        } catch (error) {
            console.error('Sync failed:', error);
            setMessage({ type: 'error', text: 'Sync failed. Check logs for details.' });
        } finally {
            setSyncing(false);
        }
    };

    const handleSaveApi = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const formData = new FormData(e.target);
            const apiData = {
                name: formData.get('name'),
                url: formData.get('url'),
                method: formData.get('method'),
                resource_type: formData.get('resource_type'),
                payload: formData.get('payload') ? JSON.parse(formData.get('payload')) : {},
                response_schema: formData.get('response_schema') ? JSON.parse(formData.get('response_schema')) : {},
                is_active: formData.get('is_active') === 'on'
            };

            if (editingApi) {
                await settingsApi.updateApi(editingApi.id, apiData);
                setMessage({ type: 'success', text: 'API updated successfully' });
            } else {
                await settingsApi.createApi(apiData);
                setMessage({ type: 'success', text: 'API created successfully' });
            }
            setShowApiModal(false);
            setEditingApi(null);
            loadApis();
        } catch (error) {
            console.error('Failed to save API:', error);
            setMessage({ type: 'error', text: 'Failed to save API. Check JSON format.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteApi = async (id) => {
        if (!window.confirm('Are you sure you want to delete this API configuration?')) return;
        try {
            await settingsApi.deleteApi(id);
            setMessage({ type: 'success', text: 'API deleted successfully' });
            loadApis();
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to delete API' });
        }
    };

    const openEditModal = (api) => {
        setEditingApi(api);
        setShowApiModal(true);
    };

    const handleExport = async () => {
        setExporting(true);
        setMessage(null);
        try {
            const params = {};
            if (exportPlatform) params.platform = exportPlatform;
            if (exportPowerState) params.power_state = exportPowerState;

            const response = await vmsApi.exportVMs(params);

            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vm_inventory_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            setMessage({ type: 'success', text: 'Export downloaded successfully!' });
        } catch (error) {
            console.error('Export failed:', error);
            setMessage({ type: 'error', text: 'Export failed. Please try again.' });
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-overlay" style={{ position: 'relative', minHeight: '400px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="settings-page">


            {message && (
                <div className={`alert alert-${message.type}`} style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {message.text}
                </div>
            )}

            {/* Tabs */}
            <div className="tabs" style={{ display: 'flex', gap: '2px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
                <button
                    className={`btn ${activeTab === 'sync' ? 'btn-primary' : 'btn-text'}`}
                    style={{ borderRadius: '4px 4px 0 0', borderBottom: activeTab === 'sync' ? '2px solid var(--primary-color)' : 'none' }}
                    onClick={() => setActiveTab('sync')}
                >
                    <RefreshCw size={16} style={{ marginRight: '8px' }} /> Scheduled Sync
                </button>
                <button
                    className={`btn ${activeTab === 'apis' ? 'btn-primary' : 'btn-text'}`}
                    style={{ borderRadius: '4px 4px 0 0', borderBottom: activeTab === 'apis' ? '2px solid var(--primary-color)' : 'none' }}
                    onClick={() => setActiveTab('apis')}
                >
                    <Globe size={16} style={{ marginRight: '8px' }} /> API Management
                </button>
                <button
                    className={`btn ${activeTab === 'export' ? 'btn-primary' : 'btn-text'}`}
                    style={{ borderRadius: '4px 4px 0 0', borderBottom: activeTab === 'export' ? '2px solid var(--primary-color)' : 'none' }}
                    onClick={() => setActiveTab('export')}
                >
                    <Download size={16} style={{ marginRight: '8px' }} /> Export Data
                </button>
            </div>

            {activeTab === 'sync' && (
                <div className="card" style={{ maxWidth: '600px' }}>
                    <div className="card-header">
                        <h3 className="card-title">
                            <Clock size={20} style={{ marginRight: '8px' }} />
                            Sync Configuration
                        </h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Enable/Disable Toggle */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <label style={{ fontWeight: 500, display: 'block', marginBottom: '4px' }}>
                                    <Power size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                    Enable Scheduled Sync
                                </label>
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                    Automatically sync all platforms at the specified interval
                                </span>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={syncSettings.sync_enabled}
                                    onChange={(e) => setSyncSettings({ ...syncSettings, sync_enabled: e.target.checked })}
                                    disabled={!isAdmin}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        {/* Interval Setting */}
                        <div>
                            <label style={{ fontWeight: 500, display: 'block', marginBottom: '8px' }}>
                                <Clock size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                Sync Interval (minutes)
                            </label>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={syncSettings.sync_interval_minutes}
                                    onChange={(e) => setSyncSettings({ ...syncSettings, sync_interval_minutes: parseInt(e.target.value) || 60 })}
                                    min={5}
                                    max={1440}
                                    disabled={!isAdmin}
                                    style={{ width: '120px' }}
                                />
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                    Min: 5 minutes, Max: 1440 minutes (24 hours)
                                </span>
                            </div>
                        </div>

                        {/* Last Run Info */}
                        {syncSettings.sync_last_run && (
                            <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--border-radius-sm)' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Last Sync: </span>
                                <span style={{ fontWeight: 500 }}>
                                    {new Date(syncSettings.sync_last_run).toLocaleString()}
                                </span>
                            </div>
                        )}

                        {/* Actions */}
                        {isAdmin && (
                            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSaveSync}
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : <><Save size={16} style={{ marginRight: '8px' }} /> Save Settings</>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'apis' && (
                <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="card-title">
                            <Database size={20} style={{ marginRight: '8px' }} />
                            External APIs
                        </h3>
                        {isAdmin && (
                            <button className="btn btn-primary btn-sm" onClick={() => { setEditingApi(null); setShowApiModal(true); }}>
                                <Plus size={16} style={{ marginRight: '4px' }} /> Add API
                            </button>
                        )}
                    </div>

                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Method</th>
                                    <th>URL</th>
                                    <th>Resource Type</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {apis.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                                            No APIs configured. Click "Add API" to configure sync endpoints.
                                        </td>
                                    </tr>
                                ) : (
                                    apis.map(api => (
                                        <tr key={api.id}>
                                            <td style={{ fontWeight: 500 }}>{api.name}</td>
                                            <td><span className="badge badge-secondary">{api.method}</span></td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{api.url}</td>
                                            <td>{api.resource_type}</td>
                                            <td>
                                                {api.is_active ?
                                                    <span className="badge badge-success">Active</span> :
                                                    <span className="badge badge-warning">Inactive</span>
                                                }
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(api)} title="View & Edit">
                                                        <Edit size={14} style={{ marginRight: '4px' }} /> View / Edit
                                                    </button>
                                                    <button className="btn btn-sm btn-icon danger" onClick={() => handleDeleteApi(api.id)} title="Delete">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'export' && (
                <div className="card" style={{ maxWidth: '600px' }}>
                    <div className="card-header">
                        <h3 className="card-title">
                            <Download size={20} style={{ marginRight: '8px' }} />
                            Export VM Inventory
                        </h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            Export all VM inventory data as a CSV file. Optionally filter by platform or power state.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group">
                                <label className="form-label">Platform</label>
                                <select
                                    className="form-input form-select"
                                    value={exportPlatform}
                                    onChange={(e) => setExportPlatform(e.target.value)}
                                >
                                    <option value="">All Platforms</option>
                                    <option value="vmware">VMware</option>
                                    <option value="nutanix">Nutanix</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Power State</label>
                                <select
                                    className="form-input form-select"
                                    value={exportPowerState}
                                    onChange={(e) => setExportPowerState(e.target.value)}
                                >
                                    <option value="">All States</option>
                                    <option value="POWERED_ON">Powered On</option>
                                    <option value="POWERED_OFF">Powered Off</option>
                                    <option value="SUSPENDED">Suspended</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                            <button
                                className="btn btn-primary"
                                onClick={handleExport}
                                disabled={exporting}
                            >
                                {exporting ? 'Exporting...' : <><Download size={16} style={{ marginRight: '8px' }} /> Download CSV</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit API Modal */}
            {showApiModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '800px', width: '100%' }}>
                        <div className="modal-header">
                            <h3>{editingApi ? 'Edit API Configuration' : 'Add New API Configuration'}</h3>
                            <button className="btn btn-icon" onClick={() => setShowApiModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveApi}>
                            <div className="modal-body">
                                <div className="row">
                                    <div className="col-6 form-group">
                                        <label>Name</label>
                                        <input name="name" className="form-input" defaultValue={editingApi?.name} required placeholder="e.g. VMware Host Sync" />
                                    </div>
                                    <div className="col-6 form-group">
                                        <label>Resource Type</label>
                                        <select name="resource_type" className="form-select" defaultValue={editingApi?.resource_type || 'vmware_host'}>
                                            <option value="vmware_host">VMware Host</option>
                                            <option value="nutanix_host">Nutanix Host</option>
                                            <option value="vmware_network">VMware Network</option>
                                            <option value="nutanix_network">Nutanix Network</option>
                                            <option value="vmware_vm">VMware VM</option>
                                            <option value="nutanix_vm">Nutanix VM</option>

                                        </select>
                                    </div>
                                </div>

                                <div className="row">
                                    <div className="col-3 form-group">
                                        <label>Method</label>
                                        <select name="method" className="form-select" defaultValue={editingApi?.method || 'POST'}>
                                            <option value="POST">POST</option>
                                            <option value="GET">GET</option>
                                            <option value="PUT">PUT</option>
                                        </select>
                                    </div>
                                    <div className="col-9 form-group">
                                        <label>URL</label>
                                        <input name="url" className="form-input" defaultValue={editingApi?.url} required placeholder="https://webhook.site/..." />
                                    </div>
                                </div>

                                <div className="row">
                                    <div className="col-6 form-group">
                                        <label>JSON Request Payload <small>(Optional)</small></label>
                                        <textarea
                                            name="payload"
                                            className="form-input"
                                            rows="8"
                                            defaultValue={editingApi?.payload ? JSON.stringify(editingApi.payload, null, 2) : '{\n  "infra": "vw-host"\n}'}
                                            style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div className="col-6 form-group">
                                        <label>Expected Response Format <small>(For reference)</small></label>
                                        <textarea
                                            name="response_schema"
                                            className="form-input"
                                            rows="8"
                                            defaultValue={editingApi?.response_schema ? JSON.stringify(editingApi.response_schema, null, 2) : '[\n  {\n    "field": "value"\n  }\n]'}
                                            style={{ fontFamily: 'monospace', fontSize: '0.85rem', background: 'var(--bg-secondary)' }}
                                            placeholder="Enter the expected JSON response structure here..."
                                        />
                                        <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)' }}>
                                            Define the JSON structure this API is expected to return. Used for validation and documentation.
                                        </small>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="checkbox-label">
                                        <input type="checkbox" name="is_active" defaultChecked={editingApi ? editingApi.is_active : true} />
                                        Active
                                    </label>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowApiModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Configuration'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
