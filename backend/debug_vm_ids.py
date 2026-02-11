from app import create_app,db
from app.models.system_api import SystemApi
from app.models.vm import VM
import requests
import json

app = create_app()

with app.app_context():
    # 1. Check a sample VM record in DB
    print("--- Sample VM Record (DB) ---")
    vm = VM.query.filter_by(platform='vmware').first()
    if vm:
        print(f"Name: {vm.vm_name}")
        print(f"UUID: {vm.vm_uuid}")
        print(f"BIOS UUID: {vm.bios_uuid}")
        print(f"ID: {vm.id}")
    else:
        print("No VMware VMs found in DB.")

    # 2. Fetch raw data from vmware_vm API
    print("\n--- Raw Data from vmware_vm API ---")
    api = SystemApi.query.filter_by(resource_type='vmware_vm', is_active=True).first()
    if api:
        print(f"Testing API: {api.name} ({api.url})")
        try:
            headers = api.headers or {}
            response = requests.request(
                method=api.method,
                url=api.url,
                headers=headers,
                json=api.payload,
                timeout=60
            )
            data = response.json()
            
            # Print first VM to see structure
            if isinstance(data, list) and len(data) > 0:
                print("First item in list:")
                print(json.dumps(data[0], indent=2))
            elif isinstance(data, dict) and 'vms' in data and len(data['vms']) > 0:
                print("First item in 'vms':")
                print(json.dumps(data['vms'][0], indent=2))
            else:
                print("No VM data found or empty list")
                
        except Exception as e:
            print(f"Error calling API: {e}")
    else:
        print("No active API found for resource_type='vmware_vm'")
