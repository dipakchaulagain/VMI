from app import create_app,db
from app.models.system_api import SystemApi
import requests
import json
import sys

app = create_app()

with app.app_context():
    # Fetch VMware VM syncing API
    apis = SystemApi.query.filter_by(resource_type='vmware_vm_host', is_active=True).all()
    
    print(f"Found {len(apis)} active APIs", flush=True)
    
    for api in apis:
        print(f"Testing API: {api.name} ({api.url})", flush=True)
        try:
            headers = api.headers or {}
            response = requests.request(
                method=api.method,
                url=api.url,
                headers=headers,
                json=api.payload,
                timeout=30,
                verify=False
            )
            data = response.json()
            
            # Print first VM to see structure
            item = None
            if isinstance(data, list) and len(data) > 0:
                item = data[0]
            elif isinstance(data, dict) and 'vms' in data and len(data['vms']) > 0:
                item = data['vms'][0]
            
            if item:
                print("--- Full Item Keys ---", flush=True)
                for k, v in item.items():
                    print(f"{k}: {v}", flush=True)
            else:
                print("No VM data found or empty list", flush=True)
                
        except Exception as e:
            print(f"Error calling API: {e}", flush=True)
    print("Done.", flush=True)
