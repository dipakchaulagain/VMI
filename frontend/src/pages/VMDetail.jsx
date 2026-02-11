import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { vmsApi, changesApi, ownersApi, hostsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
    Server,
    Power,
    PowerOff,
    Cpu,
    MemoryStick,
    HardDrive,
    Network,
    Clock,
    User,
    History,
    Tag,
    Plus,
    X,
    Edit2,
    Save,
    ArrowLeft,
    Trash2,
    Monitor
} from 'lucide-react';

export default function VMDetail() {
    const { id } = useParams();
    // ... (state vars same)
    const [vm, setVm] = useState(null);
    const [changes, setChanges] = useState([]);
    const [owners, setOwners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [ownershipEditing, setOwnershipEditing] = useState(false);
    const [guestInfoEditing, setGuestInfoEditing] = useState(false);
    const [manualData, setManualData] = useState({});
    const [newTagValue, setNewTagValue] = useState('');
    const [addingTag, setAddingTag] = useState(false);
    const [addingIp, setAddingIp] = useState(false);
    const [newIp, setNewIp] = useState('');
    const [hostMap, setHostMap] = useState({});
    const { isAdmin } = useAuth();

    useEffect(() => {
        loadVM();
    }, [id]);

    const loadVM = async () => {
        try {
            const [vmRes, changesRes, ownersRes, hostsRes] = await Promise.all([
                vmsApi.get(id),
                changesApi.getVmChanges(id, { per_page: 20 }),
                ownersApi.list({ per_page: 100 }),
                hostsApi.list()
            ]);

            setVm(vmRes.data.vm);
            setChanges(changesRes.data.changes);
            setOwners(ownersRes.data.owners);

            if (hostsRes.data && hostsRes.data.hosts) {
                const map = {};
                hostsRes.data.hosts.forEach(h => {
                    if (h.hypervisor_ip) map[h.hypervisor_ip] = h.hostname;
                });
                setHostMap(map);
            }

            setManualData({
                business_owner_id: vmRes.data.vm.business_owner_id || '',
                technical_owner_id: vmRes.data.vm.technical_owner_id || '',
                project_name: vmRes.data.vm.project_name || '',
                environment: vmRes.data.vm.environment || '',
                project_name: vmRes.data.vm.project_name || '',
                environment: vmRes.data.vm.environment || '',
                notes: vmRes.data.vm.notes || '',
                manual_hostname: vmRes.data.vm.hostname || '',
                manual_os_type: vmRes.data.vm.os_type || '',
                manual_os_family: vmRes.data.vm.os_family || ''
            });
        } catch (error) {
            console.error('Failed to load VM:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveManual = async () => {
        try {
            await vmsApi.updateManual(id, manualData);
            await loadVM();
            setEditMode(false);
        } catch (error) {
            console.error('Failed to save:', error);
        }
    };

    const handleAddTag = async () => {
        if (!newTagValue.trim()) {
            alert('Tag value is required');
            return;
        }
        try {
            await vmsApi.addTag(id, newTagValue.trim());
            setNewTagValue('');
            setAddingTag(false);
            await loadVM();
        } catch (error) {
            alert(`Failed to add tag: ${error.response?.data?.error || error.message}`);
        }
    };

    const handleRemoveTag = async (tagId) => {
        if (!window.confirm(`Remove this tag?`)) return;
        try {
            await vmsApi.removeTag(id, tagId);
            await loadVM();
        } catch (error) {
            alert(`Failed to remove tag: ${error.response?.data?.error || error.message}`);
        }
    };

    // Helper to get matching manual IP for a NIC
    const getManualIp = (nic) => {
        if (!vm?.manual_ips) return null;
        // Try to find manual IP with label matching NIC network name/label
        const label = nic.network_display_name || nic.network_name || nic.label;
        const manualIp = vm.manual_ips.find(ip => ip.label === label);
        return manualIp ? manualIp.ip_address : null;
    };

    // Helper to get effective IP (Manual > Fact)
    const getEffectiveIp = (nic) => {
        const manual = getManualIp(nic);
        if (manual) return manual;

        // Return first non-169 IP, or first IP, or null
        if (!nic.ip_addresses || nic.ip_addresses.length === 0) return null;

        const validIp = nic.ip_addresses.find(ip => !ip.ip_address.startsWith('169.254'));
        return validIp ? validIp.ip_address : nic.ip_addresses[0].ip_address;
    };

    const handleSaveIp = async (nic) => {
        if (!newIp.trim()) {
            alert('IP address is required');
            return;
        }

        // We use the network label to associate the manual IP with this NIC
        const label = nic.network_display_name || nic.network_name || nic.label;

        try {
            await vmsApi.addManualIp(id, {
                ip_address: newIp.trim(),
                label: label,
                is_primary: true // Assume manual override is primary
            });
            setNewIp('');
            setAddingIp(false);
            await loadVM();
        } catch (error) {
            alert(`Failed to save IP: ${error.response?.data?.error || error.message}`);
        }
    };

    const handleOwnershipSave = async () => {
        try {
            await vmsApi.updateManual(id, {
                business_owner_id: manualData.business_owner_id,
                technical_owner_id: manualData.technical_owner_id,
                project_name: manualData.project_name,
                environment: manualData.environment
            });
            await loadVM();
            setOwnershipEditing(false);
        } catch (error) {
            console.error('Failed to save ownership:', error);
            alert('Failed to save ownership details');
        }
    };

    const handleGuestInfoSave = async () => {
        try {
            await vmsApi.updateManual(id, {
                manual_hostname: manualData.manual_hostname,
                override_hostname: true,
                manual_os_type: manualData.manual_os_type,
                override_os_type: true,
                manual_os_family: manualData.manual_os_family,
                override_os_family: true
            });
            await loadVM();
            setGuestInfoEditing(false);
        } catch (error) {
            console.error('Failed to save guest info:', error);
            alert('Failed to save guest info details');
        }
    };

    if (loading) {
        return (
            <div className="loading-overlay" style={{ position: 'relative', minHeight: '400px' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    if (!vm) {
        return (
            <div className="empty-state card">
                <Server size={64} />
                <h3>VM Not Found</h3>
                <Link to="/vms" className="btn btn-primary">
                    <ArrowLeft size={16} /> Back to Inventory
                </Link>
            </div>
        );
    }

    return (
        <div>
            {/* Back Button */}
            <Link to="/vms" className="btn btn-secondary" style={{ marginBottom: '20px' }}>
                <ArrowLeft size={16} /> Back to Inventory
            </Link>

            {/* Header */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: 'var(--border-radius)',
                            background: 'var(--accent-gradient)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Server size={32} color="white" />
                        </div>
                        <div>
                            <h2 style={{ marginBottom: '4px' }}>{vm.vm_name}</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                {vm.inventory_key}
                            </p>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <span className={`badge ${vm.platform === 'nutanix' ? 'badge-success' : 'badge-info'}`}>
                                    {vm.platform}
                                </span>
                                {vm.power_state === 'ON' ? (
                                    <span className="badge badge-success"><Power size={12} /> ON</span>
                                ) : (
                                    <span className="badge badge-error"><PowerOff size={12} /> OFF</span>
                                )}
                                {vm.environment && (
                                    <span className="badge badge-warning">{vm.environment}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Edit Manual Data button removed - using inline editing for ownership */}
                </div>
            </div>

            {/* Info Grid */}
            {/* Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                {/* Guest Info */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 className="card-title" style={{ margin: 0 }}>
                            <Monitor size={18} style={{ marginRight: '8px' }} /> Guest Info
                        </h3>
                        {isAdmin && !guestInfoEditing && (
                            <button className="btn btn-sm btn-secondary" onClick={() => setGuestInfoEditing(true)}>Edit</button>
                        )}
                        {guestInfoEditing && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-sm btn-primary" onClick={handleGuestInfoSave}>Save</button>
                                <button className="btn btn-sm btn-secondary" onClick={() => {
                                    setGuestInfoEditing(false);
                                    setManualData(prev => ({
                                        ...prev,
                                        manual_hostname: vm.hostname || '',
                                        manual_os_type: vm.os_type || '',
                                        manual_os_family: vm.os_family || ''
                                    }));
                                }}>Cancel</button>
                            </div>
                        )}
                    </div>

                    {guestInfoEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Hostname</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={manualData.manual_hostname}
                                    onChange={(e) => setManualData({ ...manualData, manual_hostname: e.target.value })}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">OS Type</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={manualData.manual_os_type}
                                    onChange={(e) => setManualData({ ...manualData, manual_os_type: e.target.value })}
                                    placeholder="e.g. Windows Server 2022"
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">OS Family</label>
                                <select
                                    className="form-input form-select"
                                    value={manualData.manual_os_family}
                                    onChange={(e) => setManualData({ ...manualData, manual_os_family: e.target.value })}
                                >
                                    <option value="">Select Family</option>
                                    <option value="Windows">Windows</option>
                                    <option value="Linux">Linux</option>
                                    <option value="Other">Other</option>
                                    <option value="N/A">N/A</option>
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Hostname</span>
                                <span>{vm.hostname || '-'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>OS Type</span>
                                <span>{vm.os_type || '-'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>OS Family</span>
                                <span>{vm.os_family || '-'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Primary IP</span>
                                <span style={{ fontFamily: 'monospace' }}>{vm.ip_address || '-'}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Resources */}
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: '16px' }}>
                        <Cpu size={18} style={{ marginRight: '8px' }} /> Resources
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>vCPUs</span>
                            <span>{vm.total_vcpus || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Memory</span>
                            <span>{vm.memory_gb ? `${vm.memory_gb} GB` : '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Disks</span>
                            <span>{vm.total_disks || 0} ({vm.total_disk_gb || 0} GB)</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>NICs</span>
                            <span>{vm.total_nics || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Placement */}
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: '16px' }}>
                        <Server size={18} style={{ marginRight: '8px' }} /> Placement
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Cluster</span>
                            <span>{vm.cluster_name || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Host</span>
                            <span>{hostMap[vm.host_identifier] || vm.host_identifier || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Hypervisor</span>
                            <span>{vm.hypervisor_type || '-'}</span>
                        </div>
                    </div>
                </div>

                {/* Ownership - Editable */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 className="card-title" style={{ margin: 0 }}>
                            <User size={18} style={{ marginRight: '8px' }} /> Ownership
                        </h3>
                        {isAdmin && !ownershipEditing && (
                            <button className="btn btn-sm btn-secondary" onClick={() => setOwnershipEditing(true)}>Edit</button>
                        )}
                        {ownershipEditing && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-sm btn-primary" onClick={handleOwnershipSave}>Save</button>
                                <button className="btn btn-sm btn-secondary" onClick={() => {
                                    setOwnershipEditing(false);
                                    // Reset manual data from VM
                                    setManualData({
                                        ...manualData,
                                        business_owner_id: vm.business_owner_id || '',
                                        technical_owner_id: vm.technical_owner_id || '',
                                        project_name: vm.project_name || '',
                                        environment: vm.environment || ''
                                    });
                                }}>Cancel</button>
                            </div>
                        )}
                    </div>
                    {ownershipEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Business Owner</label>
                                <select
                                    className="form-input form-select"
                                    value={manualData.business_owner_id}
                                    onChange={(e) => setManualData({ ...manualData, business_owner_id: e.target.value || null })}
                                >
                                    <option value="">Select owner...</option>
                                    {owners.map((o) => (
                                        <option key={o.id} value={o.id}>{o.full_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Technical Owner</label>
                                <select
                                    className="form-input form-select"
                                    value={manualData.technical_owner_id}
                                    onChange={(e) => setManualData({ ...manualData, technical_owner_id: e.target.value || null })}
                                >
                                    <option value="">Select owner...</option>
                                    {owners.map((o) => (
                                        <option key={o.id} value={o.id}>{o.full_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Environment</label>
                                <select
                                    className="form-input form-select"
                                    value={manualData.environment}
                                    onChange={(e) => setManualData({ ...manualData, environment: e.target.value })}
                                >
                                    <option value="">Select...</option>
                                    <option value="prod">Production</option>
                                    <option value="dev">Development</option>
                                    <option value="test">Testing</option>
                                    <option value="staging">Staging</option>
                                    <option value="dr">DR</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Project</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={manualData.project_name}
                                    onChange={(e) => setManualData({ ...manualData, project_name: e.target.value })}
                                    placeholder="Project name"
                                />
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Business Owner</span>
                                <span>{vm.business_owner || '-'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Technical Owner</span>
                                <span>{vm.technical_owner || '-'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Project</span>
                                <span>{vm.project_name || '-'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Environment</span>
                                <span>{vm.environment || '-'}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tags Section */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 className="card-title" style={{ margin: 0 }}>
                            <Tag size={18} style={{ marginRight: '8px' }} /> Tags
                        </h3>
                    </div>

                    {/* Tag Controls */}
                    <div style={{
                        marginBottom: '12px',
                        padding: '12px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--border-radius-sm)',
                        border: '1px solid var(--border-color)'
                    }}>
                        {addingTag ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    className="form-input form-input-sm"
                                    style={{ flex: 1 }}
                                    placeholder="Tag name..."
                                    value={newTagValue}
                                    onChange={(e) => setNewTagValue(e.target.value)}
                                    autoFocus
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                                />
                                <button className="btn btn-sm btn-primary" onClick={handleAddTag}>Add</button>
                                <button className="btn btn-sm btn-secondary" onClick={() => { setAddingTag(false); setNewTagValue(''); }}>
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            isAdmin && (
                                <button
                                    className="btn btn-sm btn-secondary"
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                    onClick={() => setAddingTag(true)}
                                >
                                    <Plus size={14} /> Add Tag
                                </button>
                            )
                        )}
                    </div>

                    {/* Tags Display */}
                    {vm.tags?.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {vm.tags.map((tag) => (
                                <div key={tag.id} className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}>
                                    <span>{tag.tag_value}</span>
                                    {isAdmin && (
                                        <button
                                            className="btn btn-sm"
                                            onClick={() => handleRemoveTag(tag.id)}
                                            style={{
                                                padding: '2px',
                                                background: 'transparent',
                                                color: 'var(--error)',
                                                marginLeft: '2px',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>No tags assigned</p>
                    )}
                </div>
            </div >

            {/* Network Interfaces Section */}
            < div className="card" style={{ marginBottom: '24px' }
            }>
                <h3 className="card-title" style={{ marginBottom: '16px' }}>
                    <Network size={18} style={{ marginRight: '8px' }} /> Network Interfaces
                </h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '24px'
                }}>
                    {vm.nics?.length > 0 ? vm.nics.map((nic, idx) => (
                        <div key={idx} style={{
                            padding: '16px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--border-radius-sm)',
                            border: '1px solid var(--border-color)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ fontWeight: 600, fontSize: '1rem' }}>{nic.network_display_name || nic.network_name || nic.label || `NIC ${idx + 1}`}</span>
                                <span className={`badge ${nic.is_connected ? 'badge-success' : 'badge-error'}`} style={{ fontSize: '0.75rem' }}>
                                    {nic.is_connected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>MAC Address</span>
                                    <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                                        {nic.mac_address || '-'}
                                    </span>
                                </div>
                                {nic.nic_type && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Type</span>
                                        <span>{nic.nic_type}</span>
                                    </div>
                                )}

                                {/* IP Address Section */}
                                <div style={{ marginTop: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 }}>IP Addresses:</span>
                                        {!addingIp && isAdmin && (
                                            <button
                                                className="btn btn-sm btn-link"
                                                style={{ padding: '0', height: 'auto', fontSize: '0.75rem' }}
                                                onClick={() => {
                                                    // Pre-fill with first IP if available
                                                    const currentIp = getEffectiveIp(nic);
                                                    setNewIp(currentIp || '');
                                                    setAddingIp(idx);
                                                }}
                                            >
                                                <Edit2 size={12} style={{ marginRight: '4px' }} />
                                                {getEffectiveIp(nic) ? 'Edit' : 'Add IP'}
                                            </button>
                                        )}
                                    </div>

                                    {addingIp === idx ? (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                                            <input
                                                type="text"
                                                className="form-input form-input-sm"
                                                style={{ flex: 1 }}
                                                placeholder="Enter IP address..."
                                                value={newIp}
                                                onChange={(e) => setNewIp(e.target.value)}
                                                autoFocus
                                            />
                                            <button className="btn btn-sm btn-primary" onClick={() => handleSaveIp(nic)}>Save</button>
                                            <button className="btn btn-sm btn-secondary" onClick={() => { setAddingIp(false); setNewIp(''); }}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                                            {/* Display Manual IPs for this NIC first */}
                                            {getManualIp(nic) ? (
                                                <span className="badge badge-primary" style={{ fontFamily: 'monospace', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {getManualIp(nic)}
                                                    <span title="Manual Override" style={{ fontSize: '0.6em', opacity: 0.8 }}> (Manual)</span>
                                                </span>
                                            ) : (
                                                /* Fallback to Fact IPs */
                                                nic.ip_addresses?.length > 0 ? nic.ip_addresses.map((ip, ipIdx) => (
                                                    <span key={ipIdx} className="badge badge-neutral" style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                                        {ip.ip_address}
                                                    </span>
                                                )) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontStyle: 'italic' }}>
                                                        No IP Detected
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                            No network interfaces detected
                        </div>
                    )}
                </div>
            </div >

            {/* Notes */}
            {/* Notes Section */}
            {
                (isAdmin || vm.notes) && (
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 className="card-title" style={{ margin: 0 }}>Notes</h3>
                            {isAdmin && !editMode && (
                                <button className="btn btn-sm btn-secondary" onClick={() => setEditMode(true)}>Edit</button>
                            )}
                            {editMode && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn btn-sm btn-primary" onClick={handleSaveManual}>Save</button>
                                    <button className="btn btn-sm btn-secondary" onClick={() => {
                                        setEditMode(false);
                                        setManualData({ ...manualData, notes: vm.notes || '' });
                                    }}>Cancel</button>
                                </div>
                            )}
                        </div>
                        {editMode ? (
                            <textarea
                                className="form-input"
                                rows={4}
                                value={manualData.notes}
                                onChange={(e) => setManualData({ ...manualData, notes: e.target.value })}
                                placeholder="Add notes about this VM..."
                            />
                        ) : (
                            <p style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{vm.notes || 'No notes'}</p>
                        )}
                    </div>
                )
            }

            {/* Change History */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <History size={18} style={{ marginRight: '8px' }} /> Change History
                    </h3>
                </div>

                {changes.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 20px' }}>
                        <History size={48} />
                        <h3>No Changes Recorded</h3>
                        <p>Changes will appear here after syncs detect modifications</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Type</th>
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
                                            <span className="badge badge-warning">{change.change_type}</span>
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
        </div >
    );
}
