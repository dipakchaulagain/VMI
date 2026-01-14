from functools import wraps
from flask import request, jsonify, current_app, g
import hashlib
from datetime import datetime
from app import db
from app.models.user import User, UserSession


def get_token_from_request():
    """Extract token from Authorization header"""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]
    return None


def hash_token(token):
    """Hash token for storage"""
    return hashlib.sha256(token.encode()).hexdigest()


def login_required(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        
        token_hash = hash_token(token)
        session = UserSession.query.filter_by(token_hash=token_hash, is_valid=True).first()
        
        if not session:
            return jsonify({'error': 'Invalid or expired session'}), 401
        
        # Check session expiration
        inactive_timeout = current_app.config['SESSION_INACTIVE_TIMEOUT']
        max_age = current_app.config['SESSION_MAX_AGE']
        
        if session.is_expired(inactive_timeout, max_age):
            session.is_valid = False
            db.session.commit()
            return jsonify({'error': 'Session expired'}), 401
        
        # Get user
        user = session.user
        if not user or not user.is_active:
            return jsonify({'error': 'User not found or inactive'}), 401
        
        # Update last activity
        session.update_activity()
        db.session.commit()
        
        # Store user in g for access in route
        g.current_user = user
        g.current_session = session
        
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if g.current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated


def password_reset_not_required(f):
    """Decorator to check if password reset is not required"""
    @wraps(f)
    def decorated(*args, **kwargs):
        if hasattr(g, 'current_user') and g.current_user.must_reset_password:
            return jsonify({
                'error': 'Password reset required',
                'must_reset_password': True
            }), 403
        return f(*args, **kwargs)
    return decorated
