from app import create_app,db
from app.models.vm import VM, VMFact
from app.models.host import Host
from app.models.sync import VMSyncRun
from sqlalchemy import func

app = create_app()

with app.app_context():
    print("--- VM Host Sync Debug ---")
    
    # 1. Check latest sync run for vmware_vm_hosts
    run = VMSyncRun.query.filter_by(platform='vmware_vm_hosts').order_by(VMSyncRun.started_at.desc()).first()
    if run:
        print(f"Latest Run ID: {run.id}")
        print(f"Status: {run.status}")
        print(f"Details: {run.details}")
    else:
        print("No vmware_vm_hosts sync run found.")

    # 2. Check VM distribution
    vm_count_vmware = VM.query.filter_by(platform='vmware', is_deleted=False).count()
    print(f"Total VMware VMs: {vm_count_vmware}")
    
    # 3. Check hosts
    host_count_vmware = Host.query.filter_by(platform='vmware').count()
    print(f"Total VMware Hosts: {host_count_vmware}")

    # 4. Check mappings
    mapped_vms = db.session.query(VMFact).join(VM).filter(
        VM.platform == 'vmware',
        VM.is_deleted == False,
        VMFact.host_identifier != None
    ).count()
    print(f"VMs with host_identifier: {mapped_vms}")

    # 5. List sample unwatched VMs
    unmapped = db.session.query(VM.vm_uuid).join(VMFact).filter(
        VM.platform == 'vmware',
        VM.is_deleted == False,
        VMFact.host_identifier == None
    ).limit(5).all()
    print(f"Sample unmapped VM UUIDs: {[u[0] for u in unmapped]}")

    # 6. List sample Host IDs
    hosts = Host.query.filter_by(platform='vmware').limit(5).all()
    print(f"Sample Host IDs: {[h.host_id for h in hosts]}")
