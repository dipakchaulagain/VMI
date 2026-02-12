"""
Database initialization script
Creates tables and default admin user
"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from app.models.user import User


def init_db():
    """Initialize database and create default admin user"""
    config_name = os.getenv('FLASK_CONFIG', 'default')
    app = create_app(config_name)
    
    with app.app_context():
        # Create all tables
        db.create_all()
        
        # Check if admin user exists
        admin = User.query.filter_by(username='admin').first()
        
        if not admin:
            print("Creating default admin user...")
            admin = User(
                full_name='System Administrator',
                email='admin@localhost',
                designation='Administrator',
                department='IT',
                username='admin',
                role='admin',
                is_active=True,
                must_reset_password=True
            )
            admin.set_password('Admin@123')
            db.session.add(admin)
            db.session.commit()
            print("Default admin user created!")
            print("  Username: admin")
            print("  Password: Admin@123")
            print("  (Password reset required on first login)")
        else:
            print("Admin user already exists.")


if __name__ == '__main__':
    init_db()
