from app import create_app, db
from app.models.vm import VMFact, VMManual

app = create_app()

with app.app_context():
    print("--- VMFact OS Families ---")
    facts = db.session.query(VMFact.os_family, db.func.count(VMFact.vm_id)).group_by(VMFact.os_family).all()
    for os_family, count in facts:
        print(f"'{os_family}': {count}")

    print("\n--- VMManual OS Families ---")
    manuals = db.session.query(VMManual.manual_os_family, db.func.count(VMManual.vm_id)).group_by(VMManual.manual_os_family).all()
    for os_family, count in manuals:
        print(f"'{os_family}': {count}")
