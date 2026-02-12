from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from .config import config

db = SQLAlchemy()
migrate = Migrate()


def create_app(config_name='default'):
    """Application factory"""
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    
    # Import models to ensure they are registered with SQLAlchemy
    # This is crucial for migrations
    with app.app_context():
        from . import models
    # Allow CORS from any origin (Authentication is via Token, no cookies/credentials)
    CORS(app, origins='*')
    
    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.users import users_bp
    from .routes.owners import owners_bp
    from .routes.vms import vms_bp
    from .routes.sync import sync_bp
    from .routes.changes import changes_bp
    from .routes.networks import networks_bp
    from .routes.settings import settings_bp
    from .routes.hosts import hosts_bp
    from .routes.audit import audit_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(owners_bp, url_prefix='/api/owners')
    app.register_blueprint(vms_bp, url_prefix='/api/vms')
    app.register_blueprint(sync_bp, url_prefix='/api/sync')
    app.register_blueprint(changes_bp, url_prefix='/api/changes')
    app.register_blueprint(networks_bp, url_prefix='/api/networks')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    app.register_blueprint(hosts_bp, url_prefix='/api/hosts')
    app.register_blueprint(audit_bp, url_prefix='/api/audit')
    
    # Health check endpoint
    @app.route('/api/health')
    def health():
        return {'status': 'healthy'}
    
    # Initialize scheduler after app is created
    @app.before_request
    def init_scheduler_once():
        if not hasattr(app, '_scheduler_initialized'):
            app._scheduler_initialized = True
            from .services.scheduler import init_scheduler
            init_scheduler(app)
    
    return app
