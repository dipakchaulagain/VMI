from app import create_app, db
from app.models.user import User

app = create_app('development')


def init_db():
    """Initialize database and create default admin user"""
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


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
