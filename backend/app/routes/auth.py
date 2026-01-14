from flask import Blueprint, request, jsonify, current_app, g
from datetime import datetime, timedelta
import secrets
import hashlib
from app import db
from app.models.user import User, UserSession
from app.utils.decorators import login_required, hash_token

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    
    # Find user
    user = User.query.filter_by(username=username).first()
    
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid username or password'}), 401
    
    if not user.is_active:
        return jsonify({'error': 'Account is disabled'}), 401
    
    # Generate token
    token = secrets.token_urlsafe(32)
    token_hash = hash_token(token)
    
    # Calculate expiration (max age = 1 day)
    max_age = current_app.config['SESSION_MAX_AGE']
    expires_at = datetime.utcnow() + timedelta(seconds=max_age)
    
    # Create session
    session = UserSession(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent', '')[:500]
    )
    
    # Update last login
    user.last_login_at = datetime.utcnow()
    
    db.session.add(session)
    db.session.commit()
    
    return jsonify({
        'token': token,
        'user': user.to_dict(),
        'must_reset_password': user.must_reset_password,
        'expires_at': expires_at.isoformat()
    })


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """User logout endpoint"""
    g.current_session.is_valid = False
    db.session.commit()
    
    return jsonify({'message': 'Logged out successfully'})


@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    """Get current user info"""
    return jsonify({
        'user': g.current_user.to_dict(),
        'must_reset_password': g.current_user.must_reset_password
    })


@auth_bp.route('/reset-password', methods=['POST'])
@login_required
def reset_password():
    """Reset password endpoint"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')
    confirm_password = data.get('confirm_password', '')
    
    if not current_password or not new_password:
        return jsonify({'error': 'Current and new password are required'}), 400
    
    if new_password != confirm_password:
        return jsonify({'error': 'New passwords do not match'}), 400
    
    if len(new_password) < 8:
        return jsonify({'error': 'New password must be at least 8 characters'}), 400
    
    user = g.current_user
    
    # Verify current password
    if not user.check_password(current_password):
        return jsonify({'error': 'Current password is incorrect'}), 401
    
    # Don't allow same password
    if current_password == new_password:
        return jsonify({'error': 'New password must be different from current password'}), 400
    
    # Update password
    user.set_password(new_password)
    user.must_reset_password = False
    user.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'message': 'Password reset successfully',
        'user': user.to_dict()
    })


@auth_bp.route('/sessions', methods=['GET'])
@login_required
def get_sessions():
    """Get current user's active sessions"""
    sessions = UserSession.query.filter_by(
        user_id=g.current_user.id,
        is_valid=True
    ).order_by(UserSession.last_activity.desc()).all()
    
    inactive_timeout = current_app.config['SESSION_INACTIVE_TIMEOUT']
    max_age = current_app.config['SESSION_MAX_AGE']
    
    active_sessions = []
    for session in sessions:
        if not session.is_expired(inactive_timeout, max_age):
            active_sessions.append({
                'id': session.id,
                'created_at': session.created_at.isoformat(),
                'last_activity': session.last_activity.isoformat(),
                'ip_address': session.ip_address,
                'is_current': session.id == g.current_session.id
            })
    
    return jsonify({'sessions': active_sessions})


@auth_bp.route('/sessions/<int:session_id>', methods=['DELETE'])
@login_required
def revoke_session(session_id):
    """Revoke a specific session"""
    session = UserSession.query.filter_by(
        id=session_id,
        user_id=g.current_user.id
    ).first()
    
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    
    session.is_valid = False
    db.session.commit()
    
    return jsonify({'message': 'Session revoked'})
