from flask import Blueprint, request, jsonify, g
from datetime import datetime
from app import db
from app.models.user import User
from app.utils.decorators import login_required, admin_required, password_reset_not_required

users_bp = Blueprint('users', __name__)


@users_bp.route('', methods=['GET'])
@admin_required
@password_reset_not_required
def list_users():
    """List all users"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '').strip()
    
    query = User.query
    
    if search:
        search_filter = f'%{search}%'
        query = query.filter(
            db.or_(
                User.username.ilike(search_filter),
                User.full_name.ilike(search_filter),
                User.email.ilike(search_filter),
                User.department.ilike(search_filter)
            )
        )
    
    query = query.order_by(User.full_name)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'users': [u.to_dict() for u in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    })


@users_bp.route('/<int:user_id>', methods=['GET'])
@admin_required
@password_reset_not_required
def get_user(user_id):
    """Get a specific user"""
    user = User.query.get_or_404(user_id)
    return jsonify({'user': user.to_dict()})


@users_bp.route('', methods=['POST'])
@admin_required
@password_reset_not_required
def create_user():
    """Create a new user"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Required fields
    required = ['full_name', 'email', 'username', 'password']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400
    
    # Check for existing username or email
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    # Validate role
    role = data.get('role', 'viewer')
    if role not in ['admin', 'viewer']:
        return jsonify({'error': 'Role must be admin or viewer'}), 400
    
    # Create user
    user = User(
        full_name=data['full_name'].strip(),
        email=data['email'].strip().lower(),
        designation=data.get('designation', '').strip(),
        department=data.get('department', '').strip(),
        username=data['username'].strip(),
        role=role,
        is_active=data.get('is_active', True),
        must_reset_password=data.get('must_reset_password', True)
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'user': user.to_dict(), 'message': 'User created successfully'}), 201


@users_bp.route('/<int:user_id>', methods=['PUT'])
@admin_required
@password_reset_not_required
def update_user(user_id):
    """Update a user"""
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Check for username/email conflicts
    if 'username' in data and data['username'] != user.username:
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        user.username = data['username'].strip()
    
    if 'email' in data and data['email'] != user.email:
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        user.email = data['email'].strip().lower()
    
    # Update fields
    if 'full_name' in data:
        user.full_name = data['full_name'].strip()
    if 'designation' in data:
        user.designation = data['designation'].strip()
    if 'department' in data:
        user.department = data['department'].strip()
    if 'role' in data:
        if data['role'] not in ['admin', 'viewer']:
            return jsonify({'error': 'Role must be admin or viewer'}), 400
        user.role = data['role']
    if 'is_active' in data:
        user.is_active = data['is_active']
    if 'password' in data and data['password']:
        user.set_password(data['password'])
        user.must_reset_password = data.get('must_reset_password', False)
    
    user.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({'user': user.to_dict(), 'message': 'User updated successfully'})


@users_bp.route('/<int:user_id>', methods=['DELETE'])
@admin_required
@password_reset_not_required
def delete_user(user_id):
    """Delete a user"""
    user = User.query.get_or_404(user_id)
    
    # Prevent self-deletion
    if user.id == g.current_user.id:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    
    db.session.delete(user)
    db.session.commit()
    
    return jsonify({'message': 'User deleted successfully'})
