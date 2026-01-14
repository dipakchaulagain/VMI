from flask import Blueprint, request, jsonify
from datetime import datetime
from app import db
from app.models.owner import Owner
from app.models.user import User
from app.models.vm import VMManual
from app.utils.decorators import login_required, admin_required, password_reset_not_required

owners_bp = Blueprint('owners', __name__)


@owners_bp.route('', methods=['GET'])
@login_required
@password_reset_not_required
def list_owners():
    """List all owners with VM counts"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    search = request.args.get('search', '').strip()
    
    query = Owner.query
    
    if search:
        search_filter = f'%{search}%'
        query = query.filter(
            db.or_(
                Owner.full_name.ilike(search_filter),
                Owner.email.ilike(search_filter),
                Owner.department.ilike(search_filter)
            )
        )
    
    query = query.order_by(Owner.full_name)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    # Get VM counts for each owner
    owner_ids = [o.id for o in pagination.items]
    
    # Count VMs where owner is business_owner
    business_counts = db.session.query(
        VMManual.business_owner_id,
        db.func.count(VMManual.vm_id)
    ).filter(VMManual.business_owner_id.in_(owner_ids)).group_by(VMManual.business_owner_id).all()
    business_count_map = {oid: count for oid, count in business_counts}
    
    # Count VMs where owner is technical_owner
    technical_counts = db.session.query(
        VMManual.technical_owner_id,
        db.func.count(VMManual.vm_id)
    ).filter(VMManual.technical_owner_id.in_(owner_ids)).group_by(VMManual.technical_owner_id).all()
    technical_count_map = {oid: count for oid, count in technical_counts}
    
    # Build response with VM counts
    owners_data = []
    for owner in pagination.items:
        owner_dict = owner.to_dict()
        business_count = business_count_map.get(owner.id, 0)
        technical_count = technical_count_map.get(owner.id, 0)
        owner_dict['vm_count_business'] = business_count
        owner_dict['vm_count_technical'] = technical_count
        owner_dict['vm_count_total'] = business_count + technical_count
        owners_data.append(owner_dict)
    
    return jsonify({
        'owners': owners_data,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    })


@owners_bp.route('/<int:owner_id>', methods=['GET'])
@login_required
@password_reset_not_required
def get_owner(owner_id):
    """Get a specific owner"""
    owner = Owner.query.get_or_404(owner_id)
    return jsonify({'owner': owner.to_dict()})


@owners_bp.route('', methods=['POST'])
@admin_required
@password_reset_not_required
def create_owner():
    """Create a new owner"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Required fields
    if not data.get('full_name'):
        return jsonify({'error': 'full_name is required'}), 400
    if not data.get('email'):
        return jsonify({'error': 'email is required'}), 400
    
    # Check for existing email
    if Owner.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Owner with this email already exists'}), 400
    
    # Validate user_id if provided
    user_id = data.get('user_id')
    if user_id:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 400
    
    # Create owner
    owner = Owner(
        full_name=data['full_name'].strip(),
        email=data['email'].strip().lower(),
        designation=data.get('designation', '').strip(),
        department=data.get('department', '').strip(),
        user_id=user_id
    )
    
    db.session.add(owner)
    db.session.commit()
    
    return jsonify({'owner': owner.to_dict(), 'message': 'Owner created successfully'}), 201


@owners_bp.route('/<int:owner_id>', methods=['PUT'])
@admin_required
@password_reset_not_required
def update_owner(owner_id):
    """Update an owner"""
    owner = Owner.query.get_or_404(owner_id)
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Check for email conflicts
    if 'email' in data and data['email'] != owner.email:
        if Owner.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Owner with this email already exists'}), 400
        owner.email = data['email'].strip().lower()
    
    # Update fields
    if 'full_name' in data:
        owner.full_name = data['full_name'].strip()
    if 'designation' in data:
        owner.designation = data['designation'].strip()
    if 'department' in data:
        owner.department = data['department'].strip()
    if 'user_id' in data:
        if data['user_id']:
            user = User.query.get(data['user_id'])
            if not user:
                return jsonify({'error': 'User not found'}), 400
        owner.user_id = data['user_id']
    
    owner.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({'owner': owner.to_dict(), 'message': 'Owner updated successfully'})


@owners_bp.route('/<int:owner_id>', methods=['DELETE'])
@admin_required
@password_reset_not_required
def delete_owner(owner_id):
    """Delete an owner"""
    owner = Owner.query.get_or_404(owner_id)
    
    db.session.delete(owner)
    db.session.commit()
    
    return jsonify({'message': 'Owner deleted successfully'})


@owners_bp.route('/from-user/<int:user_id>', methods=['POST'])
@admin_required
@password_reset_not_required
def create_owner_from_user(user_id):
    """Create an owner from an existing user"""
    user = User.query.get_or_404(user_id)
    
    # Check if owner already exists for this user
    existing = Owner.query.filter_by(user_id=user_id).first()
    if existing:
        return jsonify({'error': 'Owner already exists for this user', 'owner': existing.to_dict()}), 400
    
    # Check if owner with same email exists
    existing_email = Owner.query.filter_by(email=user.email).first()
    if existing_email:
        # Link existing owner to user
        existing_email.user_id = user_id
        db.session.commit()
        return jsonify({'owner': existing_email.to_dict(), 'message': 'Existing owner linked to user'})
    
    # Create new owner from user
    owner = Owner(
        full_name=user.full_name,
        email=user.email,
        designation=user.designation,
        department=user.department,
        user_id=user.id
    )
    
    db.session.add(owner)
    db.session.commit()
    
    return jsonify({'owner': owner.to_dict(), 'message': 'Owner created from user'}), 201
