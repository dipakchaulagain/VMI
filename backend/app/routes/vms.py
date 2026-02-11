from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone
from app import db
from app.models.vm import VM, VMFact, VMNicFact, VMNicIpFact, VMDiskFact, VMManual, VMTag, VMIpManual, VMCustomField
from app.models.owner import Owner
from app.models.network import VMwareNetwork
from app.models.host import Host
from app.utils.decorators import login_required, admin_required, password_reset_not_required
from app.utils.audit import log_action

vms_bp = Blueprint('vms', __name__)


@vms_bp.route('', methods=['GET'])
@login_required
@password_reset_not_required
def list_vms():
    """List all VMs with effective values"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    search = request.args.get('search', '').strip()
    platform = request.args.get('platform', '').strip()
    power_state = request.args.get('power_state', '').strip()
    environment = request.args.get('environment', '').strip()
    cluster = request.args.get('cluster', '').strip()
    owner_id = request.args.get('owner_id', type=int)
    network = request.args.get('network', '').strip()
    host_identifier = request.args.get('host_identifier', '').strip()
    os_type = request.args.get('os_type', '').strip()
    os_family = request.args.get('os_family', '').strip()
    tag = request.args.get('tag', '').strip()
    include_deleted = request.args.get('include_deleted', 'false').lower() == 'true'
    
    query = VM.query
    
    # Filter deleted
    if not include_deleted:
        query = query.filter(VM.is_deleted == False)
    
    # Search (name, UUID, or IP address)
    if search:
        search_filter = f'%{search}%'
        # Get VM IDs that match by IP address (cast INET to text for ILIKE)
        ip_vm_ids_nic = db.session.query(VMNicIpFact.nic_id).join(
            VMNicFact, VMNicIpFact.nic_id == VMNicFact.id
        ).filter(db.cast(VMNicIpFact.ip_address, db.String).ilike(search_filter)).subquery()
        
        vm_ids_from_nic = db.session.query(VMNicFact.vm_id).filter(
            VMNicFact.id.in_(db.select(ip_vm_ids_nic))
        ).subquery()
        
        ip_vm_ids_manual = db.session.query(VMIpManual.vm_id).filter(
            db.cast(VMIpManual.ip_address, db.String).ilike(search_filter)
        ).subquery()
        
        query = query.filter(
            db.or_(
                VM.vm_name.ilike(search_filter),
                VM.vm_uuid.ilike(search_filter),
                VM.id.in_(db.select(vm_ids_from_nic)),
                VM.id.in_(db.select(ip_vm_ids_manual))
            )
        )
    
    # Platform filter
    if platform:
        query = query.filter(VM.platform == platform)
    
    # Power state filter
    if power_state:
        query = query.join(VMFact).filter(VMFact.power_state == power_state)
    
    # Environment filter
    if environment:
        query = query.join(VMManual).filter(VMManual.environment == environment)
    
    # Cluster filter
    if cluster:
        query = query.join(VMFact).filter(VMFact.cluster_name == cluster)
    
    # Owner filter (business or technical owner)
    if owner_id:
        query = query.join(VMManual).filter(
            db.or_(
                VMManual.business_owner_id == owner_id,
                VMManual.technical_owner_id == owner_id
            )
        )
    
    # Network filter (network name or network ID)
    if network:
        query = query.join(VMNicFact).filter(
            db.or_(
                VMNicFact.network_name.ilike(f'%{network}%'),
                VMNicFact.network_name == network
            )
        ).distinct()
    
    # Host identifier filter
    if host_identifier:
        if not hasattr(query, '_vmfact_joined'):
            query = query.join(VMFact)
        query = query.filter(VMFact.host_identifier == host_identifier)
    
    # OS Type filter
    if os_type:
        if not hasattr(query, '_vmfact_joined'):
            query = query.join(VMFact)
        query = query.filter(VMFact.os_type.ilike(f'%{os_type}%'))
    
    # OS Family filter
    # OS Family filter
    if os_family:
        if not hasattr(query, '_vmfact_joined'):
            query = query.join(VMFact)
            query._vmfact_joined = True
        
        # Check if VMManual is already joined (unlikely here but good practice)
        # Note: We use outerjoin because not all VMs have manual entries
        # We catch the case where VMManual is missing using a property check specific to this request context if needed,
        # but standard SQLAlchemy outerjoin is idempotent-ish if done correctly on query construction flow here.
        # However, to avoid duplicate joins if multiple filters were to use it (none currently do in this block), we can just join.
        query = query.outerjoin(VMManual)

        query = query.filter(
            db.or_(
                # Method 1: Manual Override is True and Matches
                db.and_(
                    VMManual.override_os_family == True, 
                    VMManual.manual_os_family.ilike(os_family)
                ),
                # Method 2: Manual Override is False/Null and Fact Matches
                db.and_(
                    db.or_(VMManual.override_os_family == None, VMManual.override_os_family == False),
                    VMFact.os_family.ilike(os_family)
                )
            )
        )
    
    # Tag filter
    if tag:
        query = query.join(VMTag).filter(VMTag.tag_value.ilike(tag))
    
    # Sorting
    sort_by = request.args.get('sort_by', 'vm_name')
    sort_order = request.args.get('order', 'asc')
    
    sort_column = VM.vm_name
    query_joined = False
    
    if sort_by == 'vm_name':
        sort_column = VM.vm_name
    elif sort_by == 'platform':
        sort_column = VM.platform
    elif sort_by == 'power_state':
        if not query_joined:
            query = query.join(VMFact)
            query_joined = True
        sort_column = VMFact.power_state
    elif sort_by == 'cluster_name':
        if not query_joined:
            query = query.join(VMFact)
            query_joined = True
        sort_column = VMFact.cluster_name
    elif sort_by == 'memory_gb':
        if not query_joined:
            query = query.join(VMFact)
            query_joined = True
        sort_column = VMFact.memory_mb
    elif sort_by == 'total_vcpus':
        if not query_joined:
            query = query.join(VMFact)
            query_joined = True
        sort_column = VMFact.total_vcpus
    elif sort_by == 'environment':
        query = query.join(VMManual)
        sort_column = VMManual.environment
    elif sort_by == 'total_disk_gb':
        # Sorting by aggregated disk size is complex in ORM, skipping for now or defaults to name
        # A proper implementation would require a subquery or aggregation
        sort_column = VM.vm_name

    if sort_order == 'desc':
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    # Build host IP -> hostname mapping
    hosts = Host.query.all()
    host_map = {h.hypervisor_ip: h.hostname for h in hosts if h.hypervisor_ip}
    
    # Enrich VMs with host_hostname
    vms_data = []
    for vm in pagination.items:
        vm_dict = vm.to_effective_dict()
        host_ip = vm_dict.get('host_identifier')
        vm_dict['host_hostname'] = host_map.get(host_ip) if host_ip else None
        vms_data.append(vm_dict)
    
    return jsonify({
        'vms': vms_data,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    })


@vms_bp.route('/summary', methods=['GET'])
@login_required
@password_reset_not_required
def get_summary():
    """Get VM summary statistics"""
    # Total counts
    total_vms = VM.query.filter(VM.is_deleted == False).count()
    deleted_vms = VM.query.filter(VM.is_deleted == True).count()
    
    # By platform
    by_platform = db.session.query(
        VM.platform,
        db.func.count(VM.id)
    ).filter(VM.is_deleted == False).group_by(VM.platform).all()
    
    # By power state
    by_power_state = db.session.query(
        VMFact.power_state,
        db.func.count(VMFact.vm_id)
    ).join(VM).filter(VM.is_deleted == False).group_by(VMFact.power_state).all()
    
    # By cluster
    by_cluster = db.session.query(
        VMFact.cluster_name,
        db.func.count(VMFact.vm_id)
    ).join(VM).filter(VM.is_deleted == False).group_by(VMFact.cluster_name).all()
    
    # By environment
    by_environment = db.session.query(
        VMManual.environment,
        db.func.count(VMManual.vm_id)
    ).join(VM).filter(VM.is_deleted == False).group_by(VMManual.environment).all()
    
    # By OS Family (with manual override support)
    effective_os_family = db.case(
        (VMManual.override_os_family == True, VMManual.manual_os_family),
        else_=VMFact.os_family
    ).label('effective_os_family')
    
    by_os_family_query = db.session.query(
        effective_os_family,
        db.func.count(VM.id)
    ).select_from(VM).outerjoin(VMManual).join(VMFact).filter(VM.is_deleted == False).group_by(effective_os_family).all()
    
    # Process OS Family data
    os_family_stats = {}
    for family, count in by_os_family_query:
        if not family:
            key = 'Unknown/Unspecified'
        else:
            key = family.title() # Normalize to Title Case (Linux, Windows)
            
        os_family_stats[key] = os_family_stats.get(key, 0) + count
    
    # Distinct tags
    all_tags = db.session.query(
        VMTag.tag_value
    ).distinct().order_by(VMTag.tag_value).all()
    tags_list = [t[0] for t in all_tags if t[0]]
    
    return jsonify({
        'total_vms': total_vms,
        'deleted_vms': deleted_vms,
        'by_platform': {p[0]: p[1] for p in by_platform if p[0]},
        'by_power_state': {p[0]: p[1] for p in by_power_state if p[0]},
        'by_cluster': {c[0]: c[1] for c in by_cluster if c[0]},
        'by_environment': {e[0]: e[1] for e in by_environment if e[0]},
        'by_os_family': os_family_stats,
        'tags': tags_list
    })


@vms_bp.route('/export', methods=['GET'])
@login_required
@password_reset_not_required
def export_vms():
    """Export VM inventory as CSV"""
    import csv
    import io
    from flask import make_response

    platform = request.args.get('platform', '').strip()
    power_state = request.args.get('power_state', '').strip()
    os_family = request.args.get('os_family', '').strip()
    
    query = VM.query.filter(VM.is_deleted == False)
    
    if platform:
        query = query.filter(VM.platform == platform)
    
    if power_state:
        query = query.join(VMFact).filter(VMFact.power_state == power_state)
    
    if os_family:
        query = query.join(VMFact).outerjoin(VMManual).filter(
            db.or_(
                db.and_(VMManual.override_os_family == True, VMManual.manual_os_family.ilike(os_family)),
                db.and_(
                    db.or_(VMManual.override_os_family == None, VMManual.override_os_family == False),
                    VMFact.os_family.ilike(os_family)
                )
            )
        )
    
    query = query.order_by(VM.vm_name)
    vms = query.all()
    
    # Build lookups
    hosts = Host.query.all()
    host_map = {h.hypervisor_ip: h.hostname for h in hosts if h.hypervisor_ip}
    
    owners = Owner.query.all()
    owner_map = {o.id: o.full_name for o in owners}
    
    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    headers = [
        'VM Name', 'Platform', 'UUID', 'Power State', 'OS Type', 'OS Family',
        'Cluster', 'Host IP', 'Host Name', 'vCPUs', 'Memory (MB)',
        'Total Disk (GB)', 'Total NICs', 'IP Addresses', 'Networks',
        'Business Owner', 'Technical Owner', 'Environment', 'Tags',
        'Created', 'Last Updated'
    ]
    writer.writerow(headers)
    
    for vm in vms:
        vm_dict = vm.to_effective_dict()
        
        # Collect IPs
        ips = []
        for nic in vm.nics:
            for ip in nic.ip_addresses:
                if ip.ip_address:
                    ips.append(ip.ip_address)
        for ip in vm.manual_ips:
            if ip.ip_address:
                ips.append(ip.ip_address)
        
        # Collect networks
        networks = set()
        for nic in vm.nics:
            if nic.network_name:
                networks.add(nic.network_name)
        
        # Get owner names
        business_owner = ''
        technical_owner = ''
        if vm.manual:
            if vm.manual.business_owner_id:
                business_owner = owner_map.get(vm.manual.business_owner_id, '')
            if vm.manual.technical_owner_id:
                technical_owner = owner_map.get(vm.manual.technical_owner_id, '')
        
        # Get tags
        tags = ', '.join([t.tag_value for t in vm.tags])
        
        # Get environment
        environment = vm.manual.environment if vm.manual else ''
        
        host_ip = vm_dict.get('host_identifier', '')
        host_name = host_map.get(host_ip, '') if host_ip else ''
        
        writer.writerow([
            vm.vm_name,
            vm.platform,
            vm.vm_uuid,
            vm_dict.get('power_state', ''),
            vm_dict.get('os_type', ''),
            vm_dict.get('os_family', ''),
            vm_dict.get('cluster_name', ''),
            host_ip,
            host_name,
            vm_dict.get('total_vcpus', ''),
            vm_dict.get('memory_mb', ''),
            vm_dict.get('total_disk_gb', ''),
            vm_dict.get('total_nics', ''),
            '; '.join(ips),
            '; '.join(networks),
            business_owner,
            technical_owner,
            environment or '',
            tags,
            vm_dict.get('creation_date', ''),
            vm_dict.get('last_update_date', '')
        ])
    
    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = 'attachment; filename=vm_inventory_export.csv'
    return response


@vms_bp.route('/<int:vm_id>', methods=['GET'])
@login_required
@password_reset_not_required
def get_vm(vm_id):
    """Get a specific VM with all details"""
    vm = VM.query.get_or_404(vm_id)
    
    data = vm.to_effective_dict()
    
    # Get VMware network name mapping
    network_mapping = VMwareNetwork.get_name_mapping()
    
    # Add detailed information
    if vm.fact:
        data['fact'] = vm.fact.to_dict()
    
    # NICs with resolved network names
    nics_data = []
    for nic in vm.nics:
        nic_dict = nic.to_dict()
        # Add friendly network name
        network_id = nic.network_name  # This might be like "network-18894" or "dvportgroup-10279"
        if network_id and network_id in network_mapping:
            nic_dict['network_display_name'] = network_mapping[network_id]
        else:
            nic_dict['network_display_name'] = network_id  # Use original if no mapping
        nics_data.append(nic_dict)
    data['nics'] = nics_data
    
    # Disks
    data['disks'] = [disk.to_dict() for disk in vm.disks]
    
    # Tags
    data['tags'] = [tag.to_dict() for tag in vm.tags]
    
    # Manual IPs
    data['manual_ips'] = [ip.to_dict() for ip in vm.manual_ips]
    
    # Custom fields
    data['custom_fields'] = [cf.to_dict() for cf in vm.custom_fields]
    
    # Effective IPs (manual first, then fact)
    effective_ips = []
    for ip in vm.manual_ips:
        effective_ips.append({
            'ip_address': ip.ip_address,
            'label': ip.label,
            'is_primary': ip.is_primary,
            'source': 'MANUAL',
            'rank': 1
        })
    for nic in vm.nics:
        network_name = network_mapping.get(nic.network_name, nic.network_name)
        for ip in nic.ip_addresses:
            effective_ips.append({
                'ip_address': ip.ip_address,
                'label': network_name,
                'is_primary': False,
                'source': 'FACT',
                'rank': 2
            })
    data['effective_ips'] = effective_ips
    
    return jsonify({'vm': data})


@vms_bp.route('/<int:vm_id>/manual', methods=['PUT'])
@admin_required
@password_reset_not_required
def update_manual(vm_id):
    """Update manual fields for a VM"""
    vm = VM.query.get_or_404(vm_id)
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Get or create manual record
    manual = vm.manual
    if not manual:
        manual = VMManual(vm_id=vm_id)
        db.session.add(manual)
    
    # Update ownership
    if 'business_owner_id' in data:
        owner_id = data['business_owner_id']
        # Convert empty string to None for bigint field
        if owner_id == '' or owner_id is None:
            manual.business_owner_id = None
        else:
            owner = Owner.query.get(owner_id)
            if not owner:
                return jsonify({'error': 'Business owner not found'}), 400
            manual.business_owner_id = owner_id
    
    if 'technical_owner_id' in data:
        owner_id = data['technical_owner_id']
        # Convert empty string to None for bigint field
        if owner_id == '' or owner_id is None:
            manual.technical_owner_id = None
        else:
            owner = Owner.query.get(owner_id)
            if not owner:
                return jsonify({'error': 'Technical owner not found'}), 400
            manual.technical_owner_id = owner_id
    
    # Update other fields
    if 'project_name' in data:
        manual.project_name = data['project_name']
    if 'environment' in data:
        manual.environment = data['environment']
    if 'notes' in data:
        manual.notes = data['notes']
    
    # Override flags and values
    if 'override_power_state' in data:
        manual.override_power_state = data['override_power_state']
    if 'manual_power_state' in data:
        manual.manual_power_state = data['manual_power_state']
    if 'override_cluster' in data:
        manual.override_cluster = data['override_cluster']
    if 'manual_cluster_name' in data:
        manual.manual_cluster_name = data['manual_cluster_name']
    if 'override_hostname' in data:
        manual.override_hostname = data['override_hostname']
    if 'manual_hostname' in data:
        manual.manual_hostname = data['manual_hostname']
    if 'override_os_type' in data:
        manual.override_os_type = data['override_os_type']
    if 'manual_os_type' in data:
        manual.manual_os_type = data['manual_os_type']
    if 'override_os_family' in data:
        manual.override_os_family = data['override_os_family']
    if 'manual_os_family' in data:
        manual.manual_os_family = data['manual_os_family']
    
    manual.updated_by = g.current_user.username
    manual.updated_at = datetime.now(timezone.utc)
    
    db.session.commit()
    
    # Audit log
    log_action('UPDATE', 'VM', str(vm_id), {'changes': list(data.keys()), 'manual': True})
    
    return jsonify({
        'manual': manual.to_dict(),
        'message': 'Manual data updated successfully'
    })


@vms_bp.route('/<int:vm_id>/tags', methods=['GET'])
@login_required
@password_reset_not_required
def get_tags(vm_id):
    """Get tags for a VM"""
    vm = VM.query.get_or_404(vm_id)
    return jsonify({'tags': [tag.to_dict() for tag in vm.tags]})


@vms_bp.route('/<int:vm_id>/tags', methods=['POST'])
@admin_required
@password_reset_not_required
def add_tag(vm_id):
    """Add a tag to a VM"""
    vm = VM.query.get_or_404(vm_id)
    data = request.get_json()
    
    if not data or not data.get('tag_value'):
        return jsonify({'error': 'tag_value is required'}), 400
    
    # Check if this exact tag already exists for this VM
    existing = VMTag.query.filter_by(vm_id=vm_id, tag_value=data['tag_value']).first()
    if not existing:
        tag = VMTag(
            vm_id=vm_id,
            tag_value=data['tag_value'],
            created_by=g.current_user.username
        )
        db.session.add(tag)
        db.session.commit()
    
    return jsonify({
        'tags': [tag.to_dict() for tag in vm.tags],
        'message': 'Tag added successfully'
    })


@vms_bp.route('/<int:vm_id>/tags/<int:tag_id>', methods=['DELETE'])
@admin_required
@password_reset_not_required
def remove_tag(vm_id, tag_id):
    """Remove a tag from a VM by ID"""
    tag = VMTag.query.filter_by(vm_id=vm_id, id=tag_id).first_or_404()
    db.session.delete(tag)
    db.session.commit()
    
    return jsonify({'message': 'Tag removed successfully'})


@vms_bp.route('/<int:vm_id>/manual-ips', methods=['GET'])
@login_required
@password_reset_not_required
def get_manual_ips(vm_id):
    """Get manual IPs for a VM"""
    vm = VM.query.get_or_404(vm_id)
    return jsonify({'manual_ips': [ip.to_dict() for ip in vm.manual_ips]})


@vms_bp.route('/<int:vm_id>/manual-ips', methods=['POST'])
@admin_required
@password_reset_not_required
def add_manual_ip(vm_id):
    """Add a manual IP to a VM"""
    vm = VM.query.get_or_404(vm_id)
    data = request.get_json()
    
    if not data or not data.get('ip_address'):
        return jsonify({'error': 'ip_address is required'}), 400
    
    # Check if IP exists for this VM
    existing = VMIpManual.query.filter_by(vm_id=vm_id, ip_address=data['ip_address']).first()
    if existing:
        existing.label = data.get('label', existing.label)
        existing.is_primary = data.get('is_primary', existing.is_primary)
        existing.notes = data.get('notes', existing.notes)
    else:
        ip = VMIpManual(
            vm_id=vm_id,
            ip_address=data['ip_address'],
            label=data.get('label'),
            is_primary=data.get('is_primary', False),
            notes=data.get('notes'),
            created_by=g.current_user.username
        )
        db.session.add(ip)
    
    db.session.commit()
    
    return jsonify({
        'manual_ips': [ip.to_dict() for ip in vm.manual_ips],
        'message': 'Manual IP added successfully'
    })


@vms_bp.route('/<int:vm_id>/manual-ips/<int:ip_id>', methods=['DELETE'])
@admin_required
@password_reset_not_required
def remove_manual_ip(vm_id, ip_id):
    """Remove a manual IP from a VM"""
    ip = VMIpManual.query.filter_by(id=ip_id, vm_id=vm_id).first_or_404()
    db.session.delete(ip)
    db.session.commit()
    
    return jsonify({'message': 'Manual IP removed successfully'})


@vms_bp.route('/<int:vm_id>/custom-fields', methods=['GET'])
@login_required
@password_reset_not_required
def get_custom_fields(vm_id):
    """Get custom fields for a VM"""
    vm = VM.query.get_or_404(vm_id)
    return jsonify({'custom_fields': [cf.to_dict() for cf in vm.custom_fields]})


@vms_bp.route('/<int:vm_id>/custom-fields', methods=['POST'])
@admin_required
@password_reset_not_required
def set_custom_field(vm_id):
    """Set a custom field on a VM"""
    vm = VM.query.get_or_404(vm_id)
    data = request.get_json()
    
    if not data or not data.get('field_key') or not data.get('field_value'):
        return jsonify({'error': 'field_key and field_value are required'}), 400
    
    # Check if field exists
    existing = VMCustomField.query.filter_by(vm_id=vm_id, field_key=data['field_key']).first()
    if existing:
        existing.field_value = data['field_value']
        existing.updated_by = g.current_user.username
    else:
        cf = VMCustomField(
            vm_id=vm_id,
            field_key=data['field_key'],
            field_value=data['field_value'],
            updated_by=g.current_user.username
        )
        db.session.add(cf)
    
    db.session.commit()
    
    return jsonify({
        'custom_fields': [cf.to_dict() for cf in vm.custom_fields],
        'message': 'Custom field set successfully'
    })


@vms_bp.route('/<int:vm_id>/custom-fields/<field_key>', methods=['DELETE'])
@admin_required
@password_reset_not_required
def remove_custom_field(vm_id, field_key):
    """Remove a custom field from a VM"""
    cf = VMCustomField.query.filter_by(vm_id=vm_id, field_key=field_key).first_or_404()
    db.session.delete(cf)
    db.session.commit()
    
    return jsonify({'message': 'Custom field removed successfully'})
