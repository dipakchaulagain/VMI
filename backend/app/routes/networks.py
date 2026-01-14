from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone
from app import db
from app.models.network import Network, VMwareNetwork
from app.models.vm import VMNicFact
from app.utils.decorators import login_required, admin_required, password_reset_not_required
import requests
from flask import current_app

networks_bp = Blueprint('networks', __name__)


@networks_bp.route('/summary', methods=['GET'])
@login_required
@password_reset_not_required
def get_network_summary():
    """Get network statistics"""
    total = Network.query.count()
    vmware = Network.query.filter_by(platform='vmware').count()
    nutanix = Network.query.filter_by(platform='nutanix').count()
    
    # Calculate In Use
    # Get all network identifiers used by VMs
    used_identifiers = set()
    vm_networks = db.session.query(VMNicFact.network_name).distinct().all()
    for (net_name,) in vm_networks:
        if net_name:
            used_identifiers.add(net_name)
    
    # Count networks that match any used identifier
    # We fetch all networks to do this matching in python to handle the ID vs Name logic
    # Optimization: If networks table is huge, this might be slow, but for <1000 it's fine.
    all_networks = Network.query.all()
    in_use_count = 0
    
    for net in all_networks:
        # Check if this network is used
        # VMware uses network_id, Nutanix uses name usually
        is_used = False
        if net.network_id in used_identifiers:
            is_used = True
        elif net.name in used_identifiers:
            is_used = True
            
        if is_used:
            in_use_count += 1
            
    not_in_use = total - in_use_count
    
    return jsonify({
        'total': total,
        'vmware': vmware,
        'nutanix': nutanix,
        'in_use': in_use_count,
        'not_in_use': not_in_use
    })


@networks_bp.route('', methods=['GET'])
@login_required
@password_reset_not_required
def list_networks():
    """List all networks with optional filtering and pagination"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    platform = request.args.get('platform', '').strip()
    search = request.args.get('search', '').strip()
    has_vlan = request.args.get('has_vlan', '').strip()
    
    query = Network.query
    
    if platform:
        query = query.filter(Network.platform == platform)
    
    if search:
        search_filter = f'%{search}%'
        query = query.filter(
            db.or_(
                Network.name.ilike(search_filter),
                Network.network_id.ilike(search_filter)
            )
        )
    
    if has_vlan == 'true':
        query = query.filter(Network.vlan_id.isnot(None))
    elif has_vlan == 'false':
        query = query.filter(Network.vlan_id.is_(None))
    
    query = query.order_by(Network.platform, Network.name)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    # Get VM count for each network
    # For VMware: network_name stores the network ID (like "network-18894")
    # For Nutanix: network_name stores the subnet name
    network_vm_counts = {}
    
    # Get all network_name values and count VMs
    vm_count_query = db.session.query(
        VMNicFact.network_name,
        db.func.count(db.func.distinct(VMNicFact.vm_id))
    ).group_by(VMNicFact.network_name).all()
    
    for network_name, count in vm_count_query:
        if network_name:
            network_vm_counts[network_name] = count
    
    # Build response with VM counts
    networks_data = []
    for n in pagination.items:
        net_dict = n.to_dict()
        # Try to match by network_id first (VMware), then by name (Nutanix)
        vm_count = network_vm_counts.get(n.network_id, 0)
        if vm_count == 0:
            vm_count = network_vm_counts.get(n.name, 0)
        net_dict['vm_count'] = vm_count
        networks_data.append(net_dict)
    
    # Get counts
    vmware_count = Network.query.filter_by(platform='vmware').count()
    nutanix_count = Network.query.filter_by(platform='nutanix').count()
    with_vlan_count = Network.query.filter(Network.vlan_id.isnot(None)).count()
    
    return jsonify({
        'networks': networks_data,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
        'vmware_count': vmware_count,
        'nutanix_count': nutanix_count,
        'with_vlan_count': with_vlan_count
    })


@networks_bp.route('/<int:network_id>', methods=['GET'])
@login_required
@password_reset_not_required
def get_network(network_id):
    """Get a specific network"""
    network = Network.query.get_or_404(network_id)
    return jsonify({'network': network.to_dict()})


@networks_bp.route('/<int:network_id>', methods=['PUT'])
@admin_required
@password_reset_not_required
def update_network(network_id):
    """Update a network (VLAN ID, description)"""
    network = Network.query.get_or_404(network_id)
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    if 'vlan_id' in data:
        vlan = data['vlan_id']
        if vlan is not None and vlan != '':
            try:
                vlan = int(vlan)
                if vlan < 0 or vlan > 4095:
                    return jsonify({'error': 'VLAN ID must be between 0 and 4095'}), 400
            except ValueError:
                return jsonify({'error': 'Invalid VLAN ID'}), 400
            network.vlan_id = vlan
        else:
            network.vlan_id = None
    
    if 'description' in data:
        network.description = data['description']
    
    network.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    
    return jsonify({
        'network': network.to_dict(),
        'message': 'Network updated successfully'
    })


@networks_bp.route('/sync/vmware', methods=['POST'])
@admin_required
@password_reset_not_required
def sync_vmware_networks():
    """Sync VMware networks from n8n"""
    try:
        api_url = current_app.config['SYNC_API_URL']
        response = requests.post(
            api_url,
            json={'infra': 'vw-network'},
            timeout=60
        )
        response.raise_for_status()
        data = response.json()
        
        # Parse response
        networks = []
        if isinstance(data, list):
            for item in data:
                if 'vm-network' in item:
                    networks = item['vm-network']
                    break
        
        # Upsert networks
        count = 0
        for net in networks:
            network_id = net.get('network')
            name = net.get('name')
            
            if not network_id or not name:
                continue
            
            existing = Network.query.filter_by(platform='vmware', network_id=network_id).first()
            if existing:
                existing.name = name
                existing.last_sync_at = datetime.now(timezone.utc)
            else:
                new_net = Network(
                    platform='vmware',
                    network_id=network_id,
                    name=name
                )
                db.session.add(new_net)
            
            # Also update legacy VMwareNetwork table
            legacy = VMwareNetwork.query.filter_by(network_id=network_id).first()
            if legacy:
                legacy.name = name
                legacy.last_sync_at = datetime.now(timezone.utc)
            else:
                legacy = VMwareNetwork(network_id=network_id, name=name)
                db.session.add(legacy)
            
            count += 1
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'networks_synced': count
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500


@networks_bp.route('/sync/nutanix', methods=['POST'])
@admin_required
@password_reset_not_required
def sync_nutanix_networks():
    """Sync Nutanix subnets from n8n"""
    try:
        api_url = current_app.config['SYNC_API_URL']
        response = requests.post(
            api_url,
            json={'infra': 'ntx-network'},
            timeout=60
        )
        response.raise_for_status()
        data = response.json()
        
        # Parse response - it's a simple array of {name, vlan_id}
        networks = data if isinstance(data, list) else []
        
        # Upsert networks
        count = 0
        for net in networks:
            name = net.get('name')
            vlan_id = net.get('vlan_id')
            
            if not name:
                continue
            
            # Use name as network_id for Nutanix since we don't have UUID
            network_id = name
            
            existing = Network.query.filter_by(platform='nutanix', network_id=network_id).first()
            if existing:
                existing.name = name
                if vlan_id is not None:
                    existing.vlan_id = vlan_id
                existing.last_sync_at = datetime.now(timezone.utc)
            else:
                new_net = Network(
                    platform='nutanix',
                    network_id=network_id,
                    name=name,
                    vlan_id=vlan_id
                )
                db.session.add(new_net)
            count += 1
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'networks_synced': count
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500


@networks_bp.route('/summary', methods=['GET'])
@login_required
@password_reset_not_required  
def get_summary():
    """Get network summary statistics"""
    vmware_count = Network.query.filter_by(platform='vmware').count()
    nutanix_count = Network.query.filter_by(platform='nutanix').count()
    with_vlan = Network.query.filter(Network.vlan_id.isnot(None)).count()
    
    return jsonify({
        'total': vmware_count + nutanix_count,
        'vmware': vmware_count,
        'nutanix': nutanix_count,
        'with_vlan': with_vlan
    })
