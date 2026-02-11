from flask import Blueprint, request, jsonify
from app import db
from app.models.settings import SiteSettings
from app.utils.decorators import login_required, admin_required, password_reset_not_required
from app.utils.audit import log_action

settings_bp = Blueprint('settings', __name__)


@settings_bp.route('', methods=['GET'])
@login_required
@password_reset_not_required
def get_settings():
    """Get all site settings"""
    settings = SiteSettings.query.all()
    return jsonify({
        'settings': [s.to_dict() for s in settings]
    })


@settings_bp.route('/sync', methods=['GET'])
@login_required
@password_reset_not_required
def get_sync_settings():
    """Get sync-related settings"""
    sync_enabled = SiteSettings.get(SiteSettings.SYNC_ENABLED, 'false')
    sync_interval = SiteSettings.get(SiteSettings.SYNC_INTERVAL_MINUTES, '60')
    sync_last_run = SiteSettings.get(SiteSettings.SYNC_LAST_RUN, None)
    
    return jsonify({
        'sync_enabled': sync_enabled == 'true',
        'sync_interval_minutes': int(sync_interval) if sync_interval else 60,
        'sync_last_run': sync_last_run
    })


@settings_bp.route('/sync', methods=['PUT'])
@admin_required
def update_sync_settings():
    """Update sync settings (admin only)"""
    data = request.get_json()
    
    if 'sync_enabled' in data:
        SiteSettings.set(SiteSettings.SYNC_ENABLED, 'true' if data['sync_enabled'] else 'false')
    
    if 'sync_interval_minutes' in data:
        interval = int(data['sync_interval_minutes'])
        if interval < 5:
            return jsonify({'error': 'Minimum interval is 5 minutes'}), 400
        if interval > 1440:  # 24 hours
            return jsonify({'error': 'Maximum interval is 1440 minutes (24 hours)'}), 400
        SiteSettings.set(SiteSettings.SYNC_INTERVAL_MINUTES, str(interval))
    
    # Notify scheduler to reschedule if needed
    from app.services.scheduler import reschedule_sync
    reschedule_sync()
    
    log_action('UPDATE', 'SETTINGS', 'sync', {'changes': list(data.keys())})
    
    return jsonify({'message': 'Sync settings updated successfully'})


@settings_bp.route('/apis', methods=['GET'])
@login_required
@password_reset_not_required
def get_apis():
    """Get all system APIs"""
    from app.models.system_api import SystemApi
    apis = SystemApi.query.order_by(SystemApi.name).all()
    return jsonify({
        'apis': [api.to_dict() for api in apis]
    })


@settings_bp.route('/apis', methods=['POST'])
@admin_required
def create_api():
    """Create a new system API"""
    from app.models.system_api import SystemApi
    data = request.get_json()
    
    # Validation
    if not data.get('name') or not data.get('url'):
        return jsonify({'error': 'Name and URL are required'}), 400
        
    api = SystemApi(
        name=data['name'],
        url=data['url'],
        method=data.get('method', 'POST'),
        headers=data.get('headers'),
        payload=data.get('payload'),
        resource_type=data.get('resource_type', 'custom'),
        is_active=data.get('is_active', True)
    )
    
    db.session.add(api)
    db.session.commit()
    
    log_action('CREATE', 'API', str(api.id), {'name': api.name, 'url': api.url})
    
    return jsonify({'message': 'API created successfully', 'api': api.to_dict()}), 201


@settings_bp.route('/apis/<int:id>', methods=['PUT'])
@admin_required
def update_api(id):
    """Update a system API"""
    from app.models.system_api import SystemApi
    api = SystemApi.query.get_or_404(id)
    data = request.get_json()
    
    if 'name' in data:
        api.name = data['name']
    if 'url' in data:
        api.url = data['url']
    if 'method' in data:
        api.method = data['method']
    if 'headers' in data:
        api.headers = data['headers']
    if 'payload' in data:
        api.payload = data['payload']
    if 'resource_type' in data:
        api.resource_type = data['resource_type']
        api.is_active = data['is_active']
        
    db.session.commit()
    
    log_action('UPDATE', 'API', str(api.id), {'changes': list(data.keys())})
    
    return jsonify({'message': 'API updated successfully', 'api': api.to_dict()})


@settings_bp.route('/apis/<int:id>', methods=['DELETE'])
@admin_required
def delete_api(id):
    """Delete a system API"""
    from app.models.system_api import SystemApi
    api = SystemApi.query.get_or_404(id)
    db.session.delete(api)
    db.session.commit()
    
    log_action('DELETE', 'API', str(id), {'name': api.name})
    
    return jsonify({'message': 'API deleted successfully'})
