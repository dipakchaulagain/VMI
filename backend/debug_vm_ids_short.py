from app import create_app,db
from app.models.system_api import SystemApi
from app.models.vm import VM
import requests
import json
import sys

app = create_app()

with app.app_context():
    print("Starting script...", flush=True)
    # 2. Fetch raw data from vmware_vm API
    print("Finding API...", flush=True)
    api = SystemApi.query.filter_by(resource_type='vmware_vm', is_active=True).first()
    if api:
        try:
            print(f"Calling API: {api.url}", flush=True)
            print(f"Payload: {api.payload}", flush=True)
            headers = api.headers or {}
            response = requests.request(
                method=api.method,
                url=api.url,
                headers=headers,
                json=api.payload,
                timeout=5,
                verify=False
            )
            print(f"Status Code: {response.status_code}", flush=True)
            data = response.json()
            
            item = None
            if isinstance(data, list) and len(data) > 0:
                item = data[0]
            elif isinstance(data, dict) and 'vms' in data and len(data['vms']) > 0:
                item = data['vms'][0]
            
            if item:
                print("Item keys:", list(item.keys()), flush=True)
                keys = ['id', 'uuid', 'vm_id', 'moid', 'name', 'bios_uuid', 'host', 'host_id']
                for k in keys:
                    val = item.get(k)
                    print(f"{k}: {val}", flush=True)
            else:
                print("No VM data found", flush=True)
                
        except requests.exceptions.Timeout:
            print("API request timed out after 5 seconds.", flush=True)
        except Exception as e:
            print(f"Error calling API: {e}", flush=True)
    else:
        print("No API found", flush=True)
    print("Done.", flush=True)
