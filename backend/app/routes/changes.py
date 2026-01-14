from flask import Blueprint, request, jsonify, g
from datetime import datetime
from app import db
from app.models.vm import VM
from app.models.sync import VMChangeHistory
from app.utils.decorators import login_required, password_reset_not_required

changes_bp = Blueprint('changes', __name__)


@changes_bp.route('', methods=['GET'])
@login_required
@password_reset_not_required
def list_changes():
    """List all recent VM changes"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    change_type = request.args.get('change_type', '').strip()
    platform = request.args.get('platform', '').strip()
    vm_id = request.args.get('vm_id', type=int)
    
    query = VMChangeHistory.query.join(VM)
    
    if change_type:
        query = query.filter(VMChangeHistory.change_type == change_type)
    
    if platform:
        query = query.filter(VM.platform == platform)
    
    if vm_id:
        query = query.filter(VMChangeHistory.vm_id == vm_id)
    
    query = query.order_by(VMChangeHistory.changed_at.desc())
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'changes': [c.to_dict() for c in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    })


@changes_bp.route('/summary', methods=['GET'])
@login_required
@password_reset_not_required
def get_changes_summary():
    """Get summary of recent changes"""
    # Last 24 hours
    from datetime import timedelta
    since = datetime.utcnow() - timedelta(hours=24)
    
    # Count by type
    by_type = db.session.query(
        VMChangeHistory.change_type,
        db.func.count(VMChangeHistory.id)
    ).filter(
        VMChangeHistory.changed_at >= since
    ).group_by(VMChangeHistory.change_type).all()
    
    # Count by platform
    by_platform = db.session.query(
        VM.platform,
        db.func.count(VMChangeHistory.id)
    ).join(VM).filter(
        VMChangeHistory.changed_at >= since
    ).group_by(VM.platform).all()
    
    # Total in last 24h
    total_24h = VMChangeHistory.query.filter(
        VMChangeHistory.changed_at >= since
    ).count()
    
    # Recent notable changes
    recent = VMChangeHistory.query.order_by(
        VMChangeHistory.changed_at.desc()
    ).limit(10).all()
    
    return jsonify({
        'total_24h': total_24h,
        'by_type': {t[0]: t[1] for t in by_type if t[0]},
        'by_platform': {p[0]: p[1] for p in by_platform if p[0]},
        'recent_changes': [c.to_dict() for c in recent]
    })


@changes_bp.route('/vm/<int:vm_id>', methods=['GET'])
@login_required
@password_reset_not_required
def get_vm_changes(vm_id):
    """Get change history for a specific VM"""
    vm = VM.query.get_or_404(vm_id)
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    query = VMChangeHistory.query.filter_by(
        vm_id=vm_id
    ).order_by(VMChangeHistory.changed_at.desc())
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'vm': {
            'id': vm.id,
            'vm_name': vm.vm_name,
            'platform': vm.platform
        },
        'changes': [c.to_dict() for c in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    })


@changes_bp.route('/types', methods=['GET'])
@login_required
@password_reset_not_required
def get_change_types():
    """Get list of change types"""
    return jsonify({
        'change_types': [
            {'value': 'POWER_STATE', 'label': 'Power State', 'description': 'VM power on/off/suspend'},
            {'value': 'CPU', 'label': 'CPU', 'description': 'CPU count or configuration changes'},
            {'value': 'MEMORY', 'label': 'Memory', 'description': 'Memory size changes'},
            {'value': 'DISK', 'label': 'Disk', 'description': 'Disk added/removed/resized'},
            {'value': 'NIC', 'label': 'Network', 'description': 'NIC added/removed'},
            {'value': 'IP', 'label': 'IP Address', 'description': 'IP address changes'},
            {'value': 'HOST', 'label': 'Host', 'description': 'VM migrated to different host'},
            {'value': 'CLUSTER', 'label': 'Cluster', 'description': 'VM moved to different cluster'}
        ]
    })
