from datetime import datetime, timezone
from flask import request, g
from app import db
from app.models.audit import AuditLog

def log_action(action, resource_type, resource_id=None, details=None, user=None):
    """
    Log an audit action
    
    Args:
        action (str): Action name (e.g., LOGIN, UPDATE)
        resource_type (str): Type of resource affected (e.g., USER, VM)
        resource_id (str): ID of the resource
        details (dict): Additional details about the action
        user (User): User performing the action (defaults to g.current_user)
    """
    try:
        # Determine user
        if user:
            user_id = user.id
            username = user.username
        elif hasattr(g, 'current_user') and g.current_user:
            user_id = g.current_user.id
            username = g.current_user.username
        else:
            user_id = None
            username = 'System/Guest'
            
        # Get IP
        ip_address = request.remote_addr if request else None
            
        log = AuditLog(
            user_id=user_id,
            username=username,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            details=details,
            ip_address=ip_address,
            created_at=datetime.now(timezone.utc)
        )
        
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        # Don't fail the request if logging fails, but maybe log to stderr
        print(f"Failed to write audit log: {e}")
        db.session.rollback()
