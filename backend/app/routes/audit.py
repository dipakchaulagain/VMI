from flask import Blueprint, request, jsonify
from app.models.audit import AuditLog
from app.utils.decorators import login_required, admin_required, password_reset_not_required

audit_bp = Blueprint('audit', __name__)

@audit_bp.route('', methods=['GET'])
@login_required
@password_reset_not_required
def list_logs():
    """List audit logs with filtering"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    action = request.args.get('action', '').strip()
    resource_type = request.args.get('resource_type', '').strip()
    username = request.args.get('username', '').strip()
    
    query = AuditLog.query
    
    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if username:
        query = query.filter(AuditLog.username.ilike(f'%{username}%'))
        
    # Default sort by newest
    query = query.order_by(AuditLog.created_at.desc())
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'logs': [log.to_dict() for log in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    })

@audit_bp.route('/types', methods=['GET'])
@login_required
@password_reset_not_required
def get_types():
    """Get unique action types and resource types for filters"""
    from app import db
    
    actions = db.session.query(AuditLog.action).distinct().order_by(AuditLog.action).all()
    resources = db.session.query(AuditLog.resource_type).distinct().order_by(AuditLog.resource_type).all()
    
    return jsonify({
        'actions': [a[0] for a in actions if a[0]],
        'resource_types': [r[0] for r in resources if r[0]]
    })
