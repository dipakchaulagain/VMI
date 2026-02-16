import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { vmsApi, ownersApi, divisionsApi, authApi } from '../services/api';
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
    Layout,
    UserCog
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
    const [sortBy, setSortBy] = useState('vm_name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [osFamily, setOsFamily] = useState('');
    const [tag, setTag] = useState('');
    const [ownerId, setOwnerId] = useState('');
    const [divisionId, setDivisionId] = useState('');
    const [tags, setTags] = useState([]);
    const [owners, setOwners] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);

    // Modal state for Quick Assign Tech Owner
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedVm, setSelectedVm] = useState(null);
    const [selectedTechOwner, setSelectedTechOwner] = useState('');
    const [assigning, setAssigning] = useState(false);

    // Get filter params from URL
    const platformParam = searchParams.get('platform');
    const powerStateParam = searchParams.get('power_state');
    const osFamilyParam = searchParams.get('os_family');
    const clusterParam = searchParams.get('cluster');
    const ownerIdParam = searchParams.get('owner_id');
    const networkParam = searchParams.get('network');
    const hostIdentifierParam = searchParams.get('host_identifier');
    const divisionIdParam = searchParams.get('division_id');
    const filterActive = platformParam || powerStateParam || osFamilyParam || clusterParam || ownerIdParam || networkParam || hostIdentifierParam || divisionIdParam;

    useEffect(() => {
        loadVMs();
        checkUserRole();
    }, [page, platform, powerState, platformParam, powerStateParam, osFamilyParam, clusterParam, ownerIdParam, networkParam, hostIdentifierParam, divisionIdParam, osFamily, tag, ownerId, divisionId, sortBy, sortOrder]);

    const checkUserRole = async () => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                setCurrentUser(user);
            } catch (e) {
                console.error("Error parsing user from local storage", e);
            }
        }
    };

    // Load tags, owners, and divisions for filter dropdowns
    useEffect(() => {
        const loadFilterData = async () => {
            try {
                const [summaryRes, ownersRes, divisionsRes] = await Promise.all([
                    vmsApi.getSummary(),
                    ownersApi.list(),
                    divisionsApi.list()
                ]);
                if (summaryRes.data.tags) setTags(summaryRes.data.tags);
                if (ownersRes.data.owners) setOwners(ownersRes.data.owners);
                if (divisionsRes.data.divisions) setDivisions(divisionsRes.data.divisions);
            } catch (error) {
                console.error('Failed to load filter data:', error);
            }
        };
        loadFilterData();
    }, []);

    const loadVMs = async () => {
        setLoading(true);
        try {
            const response = await vmsApi.list({
                page,
                per_page: 20,
                search: search || undefined,
                platform: platformParam || platform || undefined,
                power_state: powerStateParam || powerState || undefined,
                network: networkParam || undefined,
                host_identifier: hostIdentifierParam || undefined,
                os_family: osFamilyParam || osFamily || undefined,
                cluster: clusterParam || undefined,
                tag: tag || undefined,
                owner_id: ownerIdParam || ownerId || undefined,
                division_id: divisionIdParam || divisionId || undefined,
                sort_by: sortBy,
                order: sortOrder
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

    const handleOSTypeUpdate = async (vmId, newType) => {
        if (!newType) return;
        try {
            await vmsApi.updateManual(vmId, {
                override_os_type: true,
                manual_os_type: newType
            });
            // Update local state
            setVms(prev => prev.map(vm =>
                vm.id === vmId ? { ...vm, os_type: newType } : vm
            ));
        } catch (error) {
            console.error('Failed to update OS Type:', error);
        }
    };

    const handleOSFamilyUpdate = async (vmId, newFamily) => {
        if (!newFamily) return;
        try {
            await vmsApi.updateManual(vmId, {
                override_os_family: true,
                manual_os_family: newFamily
            });
            // Update local state
            setVms(prev => prev.map(vm =>
                vm.id === vmId ? { ...vm, os_family: newFamily } : vm
            ));
        } catch (error) {
            console.error('Failed to update OS Family:', error);
        }
    };

    const openAssignModal = (vm) => {
        setSelectedVm(vm);
        setSelectedTechOwner(vm.technical_owner_id || '');
        setShowAssignModal(true);
    };

    const closeAssignModal = () => {
        setShowAssignModal(false);
        setSelectedVm(null);
        setSelectedTechOwner('');
    };

    const handleAssignOwner = async () => {
        if (!selectedVm) return;
        setAssigning(true);
        try {
            await vmsApi.updateManual(selectedVm.id, {
                technical_owner_id: selectedTechOwner || null
            });

            // Update local state
            setVms(prev => prev.map(vm =>
                vm.id === selectedVm.id ? { ...vm, technical_owner_id: selectedTechOwner } : vm
            ));

            closeAssignModal();
        } catch (error) {
            console.error('Failed to assign technical owner:', error);
            alert('Failed to update technical owner');
        } finally {
            setAssigning(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        loadVMs();
    };

    const handleSort = (column) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
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
        cluster_name: { label: 'Cluster', visible: false },
        host: { label: 'Host', visible: true },
        os_type: { label: 'OS Type', visible: false },
        os_family: { label: 'OS Family', visible: true },
        total_vcpus: { label: 'vCPUs', visible: false },
        memory_gb: { label: 'Memory', visible: true },
        total_disk_gb: { label: 'Storage', visible: true },
        environment: { label: 'Environment', visible: false },
        has_public_ip: { label: 'Public IP', visible: false },
        has_dns_record: { label: 'DNS Record', visible: false },
    });

    const toggleColumn = (key) => {
        setColumns(prev => ({
            ...prev,
            [key]: { ...prev[key], visible: !prev[key].visible }
        }));
    };

    const isAdmin = currentUser?.role === 'admin';

    return (
        <div>
            {/* Active Filter Indicator */}
            {filterActive && (
                <div className="alert alert-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        <span>Filtering VMs by:</span>
                        {platformParam && <span className="badge badge-info">Platform: {platformParam}</span>}
                        {powerStateParam && <span className="badge badge-info">Power: {powerStateParam}</span>}
                        {osFamilyParam && <span className="badge badge-info">OS: {osFamilyParam}</span>}
                        {clusterParam && <span className="badge badge-info">Cluster: {clusterParam}</span>}
                        {ownerIdParam && <span className="badge badge-info">Owner ID: {ownerIdParam}</span>}
                        {networkParam && <span className="badge badge-info">Network: {networkParam}</span>}
                        {divisionIdParam && <span className="badge badge-info">Division: {divisions.find(d => d.id.toString() === divisionIdParam)?.name || divisionIdParam}</span>}
                    </div>
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

                        {!platformParam && (
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
                        )}

                        {!powerStateParam && (
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
                        )}

                        {!osFamilyParam && (
                            <select
                                className="form-input form-select"
                                value={osFamily}
                                onChange={(e) => { setOsFamily(e.target.value); setPage(1); }}
                                style={{ width: 'auto', minWidth: '140px' }}
                            >
                                <option value="">All OS Families</option>
                                <option value="Windows">Windows</option>
                                <option value="Linux">Linux</option>
                                <option value="Other">Other</option>
                                <option value="N/A">N/A</option>
                            </select>
                        )}

                        <select
                            className="form-input form-select"
                            value={tag}
                            onChange={(e) => { setTag(e.target.value); setPage(1); }}
                            style={{ width: 'auto', minWidth: '140px' }}
                        >
                            <option value="">All Tags</option>
                            {tags.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>

                        {!ownerIdParam && (
                            <select
                                className="form-input form-select"
                                value={ownerId}
                                onChange={(e) => { setOwnerId(e.target.value); setPage(1); }}
                                style={{ width: 'auto', minWidth: '150px' }}
                            >
                                <option value="">All Owners</option>
                                {owners.map(o => (
                                    <option key={o.id} value={o.id}>{o.full_name}</option>
                                ))}
                            </select>
                        )}

                        {!divisionIdParam && (
                            <select
                                className="form-input form-select"
                                value={divisionId}
                                onChange={(e) => { setDivisionId(e.target.value); setPage(1); }}
                                style={{ width: 'auto', minWidth: '150px' }}
                            >
                                <option value="">All Divisions</option>
                                {divisions.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        )}

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
                                <th onClick={() => handleSort('vm_name')} style={{ cursor: 'pointer' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        VM Name {sortBy === 'vm_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </div>
                                </th>
                                {columns.ip_address.visible && <th>IP Address</th>}
                                {columns.tags.visible && <th>Tags</th>}
                                {columns.platform.visible && (
                                    <th onClick={() => handleSort('platform')} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            Platform {sortBy === 'platform' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </div>
                                    </th>
                                )}
                                {columns.power_state.visible && (
                                    <th onClick={() => handleSort('power_state')} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            Power {sortBy === 'power_state' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </div>
                                    </th>
                                )}
                                {columns.cluster_name.visible && (
                                    <th onClick={() => handleSort('cluster_name')} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            Cluster {sortBy === 'cluster_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </div>
                                    </th>
                                )}
                                {columns.host.visible && <th>Host</th>}
                                {columns.os_type.visible && <th>OS Type</th>}
                                {columns.os_family.visible && <th>OS Family</th>}
                                {columns.total_vcpus.visible && (
                                    <th onClick={() => handleSort('total_vcpus')} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            vCPUs {sortBy === 'total_vcpus' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </div>
                                    </th>
                                )}
                                {columns.memory_gb.visible && (
                                    <th onClick={() => handleSort('memory_gb')} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            Memory {sortBy === 'memory_gb' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </div>
                                    </th>
                                )}
                                {columns.total_disk_gb.visible && (
                                    <th onClick={() => handleSort('total_disk_gb')} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            Storage {sortBy === 'total_disk_gb' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </div>
                                    </th>
                                )}
                                {columns.environment.visible && (
                                    <th onClick={() => handleSort('environment')} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            Environment {sortBy === 'environment' && (sortOrder === 'asc' ? '↑' : '↓')}
                                        </div>
                                    </th>
                                )}
                                {columns.has_public_ip.visible && <th>Public IP</th>}
                                {columns.has_dns_record.visible && <th>DNS</th>}
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

                                    {/* Host */}
                                    {columns.host.visible && (
                                        <td style={{ color: 'var(--text-secondary)' }}>
                                            {vm.host_hostname || vm.host_identifier || '-'}
                                        </td>
                                    )}

                                    {/* OS Type */}
                                    {columns.os_type.visible && (
                                        <td>
                                            {(!vm.os_type || vm.os_type === 'Not Specified') ? (
                                                <select
                                                    className="form-input form-select"
                                                    style={{ padding: '2px 4px', fontSize: '0.875rem', height: 'auto', width: 'auto' }}
                                                    value=""
                                                    onChange={(e) => handleOSTypeUpdate(vm.id, e.target.value)}
                                                >
                                                    <option value="" disabled>Set OS</option>
                                                    <option value="Windows">Windows</option>
                                                    <option value="Linux">Linux</option>
                                                </select>
                                            ) : (
                                                vm.os_type
                                            )}
                                        </td>
                                    )}

                                    {/* OS Family */}
                                    {columns.os_family.visible && (
                                        <td>
                                            {(!vm.os_family || vm.os_family === 'Not Specified') ? (
                                                <select
                                                    className="form-input form-select"
                                                    style={{ padding: '2px 4px', fontSize: '0.875rem', height: 'auto', width: 'auto' }}
                                                    value=""
                                                    onChange={(e) => handleOSFamilyUpdate(vm.id, e.target.value)}
                                                >
                                                    <option value="" disabled>Set Family</option>
                                                    <option value="Windows">Windows</option>
                                                    <option value="Linux">Linux</option>
                                                    <option value="Other">Other</option>
                                                    <option value="N/A">N/A</option>
                                                </select>
                                            ) : (
                                                vm.os_family
                                            )}
                                        </td>
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

                                    {/* Public IP Flag */}
                                    {columns.has_public_ip.visible && (
                                        <td>
                                            {vm.has_public_ip ? (
                                                <span className="badge badge-success">Yes</span>
                                            ) : (
                                                <span className="badge badge-neutral" style={{ opacity: 0.5 }}>No</span>
                                            )}
                                        </td>
                                    )}

                                    {/* DNS Record Flag */}
                                    {columns.has_dns_record.visible && (
                                        <td>
                                            {vm.has_dns_record ? (
                                                <span className="badge badge-success">Yes</span>
                                            ) : (
                                                <span className="badge badge-neutral" style={{ opacity: 0.5 }}>No</span>
                                            )}
                                        </td>
                                    )}

                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <Link to={`/vms/${vm.id}`} className="btn btn-sm btn-secondary">
                                                <Eye size={14} /> View
                                            </Link>
                                            {isAdmin && (
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => openAssignModal(vm)}
                                                    title="Assign Technical Owner"
                                                >
                                                    <UserCog size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )
            }

            {/* Pagination */}
            {
                totalPages > 1 && (
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
                )
            }

            {/* Quick Assign Tech Owner Modal */}
            {
                showAssignModal && selectedVm && (
                    <div className="modal-overlay">
                        <div className="modal-content" style={{ width: '400px', backgroundColor: 'var(--bg-secondary)' }}>
                            <div className="modal-header">
                                <h3>Assign Technical Owner</h3>
                                <button className="btn btn-icon" onClick={closeAssignModal}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px' }}>VM Name</label>
                                    <div style={{ padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', marginBottom: '16px' }}>
                                        {selectedVm.vm_name}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="techOwnerSelect" style={{ display: 'block', marginBottom: '8px' }}>Technical Owner</label>
                                    <select
                                        id="techOwnerSelect"
                                        className="form-input form-select"
                                        value={selectedTechOwner}
                                        onChange={(e) => setSelectedTechOwner(e.target.value)}
                                        style={{ width: '100%' }}
                                    >
                                        <option value="">Select Technical Owner</option>
                                        {owners.map(owner => (
                                            <option key={owner.id} value={owner.id}>
                                                {owner.full_name} ({owner.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                                <button className="btn btn-secondary" onClick={closeAssignModal} disabled={assigning}>
                                    Cancel
                                </button>
                                <button className="btn btn-primary" onClick={handleAssignOwner} disabled={assigning}>
                                    {assigning ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
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
