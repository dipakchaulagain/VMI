from flask import Blueprint, jsonify, request, g
from app import db
from app.models.division import Division
from app.utils.decorators import login_required, admin_required, password_reset_not_required
from app.utils.audit import log_action

divisions_bp = Blueprint('divisions', __name__)

@divisions_bp.route('', methods=['GET'])
@login_required
@password_reset_not_required
def list_divisions():
    """List all divisions with VM counts"""
    from app.models.vm import VM, VMManual
    
    # Query divisions with VM counts
    # Join Division with VMManual to count VMs, filtered by is_deleted False
    results = db.session.query(
        Division,
        db.func.count(VM.id).label('vm_count')
    ).outerjoin(VMManual, Division.id == VMManual.division_id)\
     .outerjoin(VM, VMManual.vm_id == VM.id)\
     .filter(db.or_(VM.is_deleted == False, VM.id == None))\
     .group_by(Division.id).all()
    
    divisions_data = []
    for division, vm_count in results:
        d_dict = division.to_dict()
        d_dict['vm_count'] = vm_count
        divisions_data.append(d_dict)
        
    return jsonify({'divisions': divisions_data})

@divisions_bp.route('', methods=['POST'])
@admin_required
@password_reset_not_required
def create_division():
    """Create a new division"""
    data = request.get_json()
    
    if not data.get('name') or not data.get('department'):
        return jsonify({'error': 'Name and Department are required'}), 400
        
    division = Division(
        name=data['name'],
        department=data['department']
    )
    
    db.session.add(division)
    db.session.commit()
    
    log_action('CREATE', 'DIVISION', str(division.id), data)
    
    return jsonify({'division': division.to_dict(), 'message': 'Division created'}), 201

@divisions_bp.route('/<int:id>', methods=['PUT'])
@admin_required
@password_reset_not_required
def update_division(id):
    """Update a division"""
    division = Division.query.get_or_404(id)
    data = request.get_json()
    
    if 'name' in data:
        division.name = data['name']
    if 'department' in data:
        division.department = data['department']
        
    db.session.commit()
    
    log_action('UPDATE', 'DIVISION', str(id), data)
    
    return jsonify({'division': division.to_dict(), 'message': 'Division updated'})

@divisions_bp.route('/<int:id>', methods=['DELETE'])
@admin_required
@password_reset_not_required
def delete_division(id):
    """Delete a division"""
    division = Division.query.get_or_404(id)
    
    # Check if any VMs are using this division
    from app.models.vm import VMManual
    if VMManual.query.filter_by(division_id=id).first():
        return jsonify({'error': 'Cannot delete division as it is assigned to one or more VMs'}), 400
        
    db.session.delete(division)
    db.session.commit()
    
    log_action('DELETE', 'DIVISION', str(id))
    
    return jsonify({'message': 'Division deleted'})
