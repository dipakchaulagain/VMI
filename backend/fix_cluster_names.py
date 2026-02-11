"""Fix incorrect cluster_name values in vm_fact table using raw SQL."""
from app import create_app, db

app = create_app()
with app.app_context():
    # Count buggy records
    result = db.session.execute(db.text("""
        SELECT COUNT(*) FROM vm_fact vf
        JOIN vm v ON v.id = vf.vm_id
        WHERE v.platform = 'vmware'
        AND vf.cluster_name = vf.hostname
        AND vf.cluster_name IS NOT NULL
    """))
    buggy = result.scalar()
    print(f"Found {buggy} VMware VMs with cluster_name == hostname")
    
    if buggy > 0:
        db.session.execute(db.text("""
            UPDATE vm_fact SET cluster_name = NULL
            WHERE vm_id IN (
                SELECT vf.vm_id FROM vm_fact vf
                JOIN vm v ON v.id = vf.vm_id
                WHERE v.platform = 'vmware'
                AND vf.cluster_name = vf.hostname
                AND vf.cluster_name IS NOT NULL
            )
        """))
        db.session.commit()
        print(f"Fixed {buggy} records - set cluster_name to NULL")
    
    # Verify
    result = db.session.execute(db.text("""
        SELECT COUNT(*) FROM vm_fact vf
        JOIN vm v ON v.id = vf.vm_id
        WHERE v.platform = 'vmware'
        AND vf.cluster_name = vf.hostname
        AND vf.cluster_name IS NOT NULL
    """))
    remaining = result.scalar()
    print(f"Remaining buggy records: {remaining}")
