from flask import Blueprint, request, jsonify, g
from datetime import datetime
from app import db
from app.models.vm import VM, VMFact, VMNicFact, VMNicIpFact, VMDiskFact, VMManual, VMTag, VMIpManual, VMCustomField
from app.models.owner import Owner
from app.models.network import VMwareNetwork
from app.utils.decorators import login_required, admin_required, password_reset_not_required

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
    
    query = query.order_by(VM.vm_name)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'vms': [vm.to_effective_dict() for vm in pagination.items],
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
    
    return jsonify({
        'total_vms': total_vms,
        'deleted_vms': deleted_vms,
        'by_platform': {p[0]: p[1] for p in by_platform if p[0]},
        'by_power_state': {p[0]: p[1] for p in by_power_state if p[0]},
        'by_cluster': {c[0]: c[1] for c in by_cluster if c[0]},
        'by_environment': {e[0]: e[1] for e in by_environment if e[0]}
    })


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
    
    manual.updated_by = g.current_user.username
    manual.updated_at = datetime.utcnow()
    
    db.session.commit()
    
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
