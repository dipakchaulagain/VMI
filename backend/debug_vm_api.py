from app import create_app,db
from app.models.system_api import SystemApi
import requests
import json

app = create_app()

with app.app_context():
    # Fetch VMware VM syncing API
    apis = SystemApi.query.filter_by(resource_type='vmware_host', is_active=True).all()
    # Note: resource_type 'vmware_host' is used for syncing HOSTS. 
    # But for VMs, the resource type is usually 'vmware_inventory' or similar?
    # Let's check what resource_type is used for VM Sync.
    
    # In sync_service.py: 
    # sync_platform('vmware') calls SystemApi.query.filter_by(resource_type='vmware', is_active=True)
    
    apis = SystemApi.query.filter_by(resource_type='vmware', is_active=True).all()
    print(f"Found {len(apis)} active VMware VM APIs")
    
    for api in apis:
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
                print("--- Sample VM Data ---")
                print(json.dumps(data[0], indent=2))
            elif isinstance(data, dict) and 'vms' in data and len(data['vms']) > 0:
                print("--- Sample VM Data ---")
                print(json.dumps(data['vms'][0], indent=2))
            else:
                print("No VM data found or empty list")
                
        except Exception as e:
            print(f"Error calling API: {e}")
