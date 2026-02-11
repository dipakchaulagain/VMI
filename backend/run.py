from app import create_app, db
from app.models.user import User
from app.models.system_api import SystemApi

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
            
        # Migration: Add response_schema column if it doesn't exist
        try:
            with db.engine.connect() as conn:
                from sqlalchemy import text
                # Check if column exists
                result = conn.execute(text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name='system_api' AND column_name='response_schema'"
                ))
                if not result.fetchone():
                    print("Migrating database: Adding response_schema to system_api table...")
                    conn.execute(text("ALTER TABLE system_api ADD COLUMN response_schema JSON"))
                    conn.commit()
                    print("Migration complete.")
                    
                    # Seed default schemas
                    print("Seeding default response schemas...")
                    _seed_response_schemas()
        except Exception as e:
            print(f"Migration warning: {e}")

def _seed_response_schemas():
    """Seed default response schemas for existing APIs"""
    from app.models.system_api import SystemApi
    
    defaults = {
        'vmware_vm': [
            {"vm_name": "VM-01", "power_state": "poweredOn", "cpu_count": 4, "memory_gb": 8, "ip_address": "192.168.1.100"}
        ],
        'nutanix_vm': [
            {"name": "VM-01", "power_state": "ON", "num_vcpus": 4, "memory_mb": 8192, "ip_addresses": ["192.168.1.100"]}
        ],
        'vmware_host': [
            {"host_id": "host-1", "hostname": "esxi-01.local", "hypervisor_ip": "10.0.0.1", "cpu_model": "Intel Xeon", "cpu_cores_physical": 32, "ram_gb": 256}
        ],
        'nutanix_host': [
            {"host_id": "host-1", "name": "NTNX-Node-A", "hypervisor_ip": "10.0.0.1", "cpu_model": "Intel Xeon", "cpu_cores_physical": 32, "ram_gb": 256}
        ],
        'vmware_network': [
            {"vm-network": [{"network": "net-101", "name": "VM Network"}]}
        ],
        'nutanix_network': [
            {"name": "User_VLAN", "vlan_id": 100}
        ]
    }
    
    try:
        apis = SystemApi.query.filter(SystemApi.response_schema == None).all()
        count = 0
        for api in apis:
            if api.resource_type in defaults:
                api.response_schema = defaults[api.resource_type]
                count += 1
        
        if count > 0:
            db.session.commit()
            print(f"Seeded response schemas for {count} APIs")
    except Exception as e:
        print(f"Failed to seed schemas: {e}")


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
