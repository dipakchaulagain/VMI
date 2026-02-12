from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from app import db
from app.models.sync import VMSyncRun
from app.models.network import VMwareNetwork
from app.services.sync_service import SyncService
from app.utils.decorators import login_required, admin_required, password_reset_not_required
import requests
from flask import current_app
from app.utils.audit import log_action

sync_bp = Blueprint('sync', __name__)


@sync_bp.route('/nutanix', methods=['POST'])
@admin_required
@password_reset_not_required
def sync_nutanix():
    """Trigger sync for Nutanix platform"""
    service = SyncService()
    result = service.sync_platform('nutanix')
    
    if result['status'] == 'error':
        log_action('SYNC_ERROR', 'PLATFORM', 'nutanix', {'error': result.get('error')})
        return jsonify(result), 500
    
    log_action('SYNC_TRIGGER', 'PLATFORM', 'nutanix', {'status': 'success'})
    return jsonify(result)


@sync_bp.route('/vmware', methods=['POST'])
@admin_required
@password_reset_not_required
def sync_vmware():
    """Trigger sync for VMware platform"""
    service = SyncService()
    result = service.sync_platform('vmware')
    
    if result['status'] == 'error':
        log_action('SYNC_ERROR', 'PLATFORM', 'vmware', {'error': result.get('error')})
        return jsonify(result), 500
    
    log_action('SYNC_TRIGGER', 'PLATFORM', 'vmware', {'status': 'success'})
    return jsonify(result)


@sync_bp.route('/all', methods=['POST'])
@admin_required
@password_reset_not_required
def sync_all():
    """Trigger sync for all platforms"""
    service = SyncService()
    
    results = {
        'nutanix': service.sync_platform('nutanix'),
        'vmware': service.sync_platform('vmware'),
        'hosts': service.sync_hosts(),

        'networks': {
            'vmware': service.sync_networks('vmware'),
            'nutanix': service.sync_networks('nutanix')
        }
    }
    
    # Check if any failed
    has_error = False
    
    # Check VM syncs
    if results['nutanix']['status'] == 'error' or results['vmware']['status'] == 'error':
        has_error = True
        
    # Check host errors
    if results['hosts']['vmware']['errors'] or results['hosts']['nutanix']['errors']:
        # This is a soft error (partial success maybe), but let's flag it
        has_error = True
        
    # Check network errors
    if results['networks']['vmware']['errors'] or results['networks']['nutanix']['errors']:
        has_error = True

    if has_error:
        log_action('SYNC_Trigger', 'ALL', 'all', {'status': 'partial', 'results': results})
        return jsonify({
            'status': 'partial',
            'results': results
        }), 207  # Multi-Status
    
    log_action('SYNC_TRIGGER', 'ALL', 'all', {'status': 'success'})
    return jsonify({
        'status': 'success',
        'results': results
    })





@sync_bp.route('/networks', methods=['POST'])
@admin_required
@password_reset_not_required
def sync_networks():
    """Sync Network mappings (VMware/Nutanix)"""
    # Optional platform param, default to vmware to match legacy behavior or sync both?
    # The original endpoint only did VMware (with 'vw-network' payload).
    # Let's sync both or Check params?
    # For now, let's sync VMware as that mimics the original intent, 
    # but since we have a service, maybe just sync both?
    
    # Original behavior was specifically reaching out to a URL that returned VMware networks.
    # Let's use SyncService for VMware.
    
    service = SyncService()
    result = service.sync_networks('vmware')
    
    if result.get('errors'):
         log_action('SYNC_ERROR', 'NETWORK', 'vmware', {'errors': result.get('errors')})
         return jsonify({
             'status': 'warning', 
             'results': result
         }), 200
         
    log_action('SYNC_TRIGGER', 'NETWORK', 'vmware', {'status': 'success', 'count': result.get('synced', 0)})
    return jsonify({
        'status': 'success',
        'networks_synced': result.get('synced', 0)
    })


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
