from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from app import db
from app.models.sync import VMSyncRun
from app.models.network import VMwareNetwork
from app.services.sync_service import SyncService
from app.utils.decorators import login_required, admin_required, password_reset_not_required
import requests
from flask import current_app

sync_bp = Blueprint('sync', __name__)


@sync_bp.route('/nutanix', methods=['POST'])
@admin_required
@password_reset_not_required
def sync_nutanix():
    """Trigger sync for Nutanix platform"""
    service = SyncService()
    result = service.sync_platform('nutanix')
    
    if result['status'] == 'error':
        return jsonify(result), 500
    
    return jsonify(result)


@sync_bp.route('/vmware', methods=['POST'])
@admin_required
@password_reset_not_required
def sync_vmware():
    """Trigger sync for VMware platform"""
    service = SyncService()
    result = service.sync_platform('vmware')
    
    if result['status'] == 'error':
        return jsonify(result), 500
    
    return jsonify(result)


@sync_bp.route('/all', methods=['POST'])
@admin_required
@password_reset_not_required
def sync_all():
    """Trigger sync for all platforms"""
    service = SyncService()
    
    results = {
        'nutanix': service.sync_platform('nutanix'),
        'vmware': service.sync_platform('vmware')
    }
    
    # Check if any failed
    if any(r['status'] == 'error' for r in results.values()):
        return jsonify({
            'status': 'partial',
            'results': results
        }), 207  # Multi-Status
    
    return jsonify({
        'status': 'success',
        'results': results
    })


@sync_bp.route('/networks', methods=['POST'])
@admin_required
@password_reset_not_required
def sync_networks():
    """Sync VMware network mappings"""
    try:
        api_url = current_app.config['SYNC_API_URL']
        response = requests.post(
            api_url,
            json={'infra': 'vw-network'},
            timeout=60
        )
        response.raise_for_status()
        data = response.json()
        
        # Parse response - it's an array with vm-network key
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
            
            existing = VMwareNetwork.query.filter_by(network_id=network_id).first()
            if existing:
                existing.name = name
                existing.last_sync_at = datetime.now(timezone.utc)
            else:
                new_net = VMwareNetwork(
                    network_id=network_id,
                    name=name
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


@sync_bp.route('/networks', methods=['GET'])
@login_required
@password_reset_not_required
def list_networks():
    """List all synced VMware networks"""
    networks = VMwareNetwork.query.order_by(VMwareNetwork.name).all()
    return jsonify({
        'networks': [n.to_dict() for n in networks],
        'total': len(networks)
    })


@sync_bp.route('/runs', methods=['GET'])
@admin_required
@password_reset_not_required
def list_sync_runs():
    """List sync runs"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    platform = request.args.get('platform', '').strip()
    status = request.args.get('status', '').strip()
    
    query = VMSyncRun.query
    
    if platform:
        query = query.filter(VMSyncRun.platform == platform)
    if status:
        query = query.filter(VMSyncRun.status == status)
    
    query = query.order_by(VMSyncRun.started_at.desc())
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'runs': [r.to_dict() for r in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    })


@sync_bp.route('/runs/<int:run_id>', methods=['GET'])
@admin_required
@password_reset_not_required
def get_sync_run(run_id):
    """Get a specific sync run"""
    run = VMSyncRun.query.get_or_404(run_id)
    
    data = run.to_dict()
    data['changes'] = [c.to_dict() for c in run.changes[:100]]  # Limit to 100 changes
    
    return jsonify({'run': data})


@sync_bp.route('/status', methods=['GET'])
@admin_required
@password_reset_not_required
def get_sync_status():
    """Get overall sync status"""
    # Get latest run for each platform
    latest_nutanix = VMSyncRun.query.filter_by(
        platform='nutanix'
    ).order_by(VMSyncRun.started_at.desc()).first()
    
    latest_vmware = VMSyncRun.query.filter_by(
        platform='vmware'
    ).order_by(VMSyncRun.started_at.desc()).first()
    
    # Check for running syncs
    running = VMSyncRun.query.filter_by(status='RUNNING').count()
    
    # Get network count
    network_count = VMwareNetwork.query.count()
    
    return jsonify({
        'nutanix': latest_nutanix.to_dict() if latest_nutanix else None,
        'vmware': latest_vmware.to_dict() if latest_vmware else None,
        'syncs_running': running,
        'vmware_networks_count': network_count
    })
