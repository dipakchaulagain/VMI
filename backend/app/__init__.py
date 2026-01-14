from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from .config import config

db = SQLAlchemy()


def create_app(config_name='default'):
    """Application factory"""
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    CORS(app, supports_credentials=True, origins=['http://localhost:3000'])
    
    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.users import users_bp
    from .routes.owners import owners_bp
    from .routes.vms import vms_bp
    from .routes.sync import sync_bp
    from .routes.changes import changes_bp
    from .routes.networks import networks_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(owners_bp, url_prefix='/api/owners')
    app.register_blueprint(vms_bp, url_prefix='/api/vms')
    app.register_blueprint(sync_bp, url_prefix='/api/sync')
    app.register_blueprint(changes_bp, url_prefix='/api/changes')
    app.register_blueprint(networks_bp, url_prefix='/api/networks')
    
    # Health check endpoint
    @app.route('/api/health')
    def health():
        return {'status': 'healthy'}
    
    return app
