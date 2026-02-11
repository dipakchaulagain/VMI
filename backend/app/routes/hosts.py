from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from app import db
from app.models.host import Host
from app.models.vm import VM, VMFact
from app.utils.decorators import login_required, admin_required, password_reset_not_required
import requests
from flask import current_app

hosts_bp = Blueprint('hosts', __name__)


@hosts_bp.route('', methods=['GET'])
@login_required
@password_reset_not_required
def list_hosts():
    """List all hypervisor hosts with optional filtering"""
    platform = request.args.get('platform', '').strip()
    search = request.args.get('search', '').strip()
    
    query = Host.query
    
    if platform:
        query = query.filter(Host.platform == platform)
    
    if search:
        search_filter = f'%{search}%'
        query = query.filter(
            db.or_(
                Host.hostname.ilike(search_filter),
                Host.hypervisor_ip.ilike(search_filter),
                Host.cpu_model.ilike(search_filter)
            )
        )
    
    query = query.order_by(Host.platform, Host.hostname)
    hosts = query.all()
    
    # Calculate totals
    vmware_count = Host.query.filter_by(platform='vmware').count()
    nutanix_count = Host.query.filter_by(platform='nutanix').count()
    
    # Calculate total resources
    total_cores = db.session.query(db.func.sum(Host.cpu_cores_physical)).scalar() or 0
    total_ram = db.session.query(db.func.sum(Host.ram_gb)).scalar() or 0
    
    # Calculate VM counts per host (by host_identifier matching hypervisor_ip)
    vm_counts = db.session.query(
        VMFact.host_identifier,
        db.func.count(VMFact.vm_id)
    ).join(VM).filter(VM.is_deleted == False).group_by(VMFact.host_identifier).all()
    
    count_map = {ip: count for ip, count in vm_counts if ip}
    
    # Build hosts data with vm_count
    hosts_data = []
    for h in hosts:
        host_dict = h.to_dict()
        host_dict['vm_count'] = count_map.get(h.hypervisor_ip, 0)
        hosts_data.append(host_dict)
    
    return jsonify({
        'hosts': hosts_data,
        'total': len(hosts),
        'vmware_count': vmware_count,
        'nutanix_count': nutanix_count,
        'total_cores': total_cores,
        'total_ram_gb': total_ram
    })


@hosts_bp.route('/summary', methods=['GET'])
@login_required
@password_reset_not_required
def get_host_summary():
    """Get hypervisor summary statistics"""
    vmware_count = Host.query.filter_by(platform='vmware').count()
    nutanix_count = Host.query.filter_by(platform='nutanix').count()
    
    vmware_cores = db.session.query(db.func.sum(Host.cpu_cores_physical)).filter(Host.platform == 'vmware').scalar() or 0
    nutanix_cores = db.session.query(db.func.sum(Host.cpu_cores_physical)).filter(Host.platform == 'nutanix').scalar() or 0
    
    vmware_ram = db.session.query(db.func.sum(Host.ram_gb)).filter(Host.platform == 'vmware').scalar() or 0
    nutanix_ram = db.session.query(db.func.sum(Host.ram_gb)).filter(Host.platform == 'nutanix').scalar() or 0
    
    return jsonify({
        'total_hosts': vmware_count + nutanix_count,
        'vmware': {
            'count': vmware_count,
            'total_cores': vmware_cores,
            'total_ram_gb': vmware_ram
        },
        'nutanix': {
            'count': nutanix_count,
            'total_cores': nutanix_cores,
            'total_ram_gb': nutanix_ram
        },
        'totals': {
            'cores': vmware_cores + nutanix_cores,
            'ram_gb': vmware_ram + nutanix_ram
        }
    })


@hosts_bp.route('/sync', methods=['POST'])
@admin_required
def sync_hosts():
    """Sync hosts from both platforms or specific one"""
    platform = request.args.get('platform')
    from app.services.sync_service import SyncService
    service = SyncService()
    results = service.sync_hosts(platform)
    
    return jsonify({
        'message': f"Host sync completed for {platform or 'all platforms'}",
        'results': results
    })



