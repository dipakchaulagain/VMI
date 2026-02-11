from app import create_app,db
from app.models.system_api import SystemApi

app = create_app()

with app.app_context():
    print("--- All System APIs ---")
    apis = SystemApi.query.all()
    for api in apis:
        print(f"ID: {api.id}, Name: {api.name}, Resource Type: {api.resource_type}, Active: {api.is_active}")
        print(f"URL: {api.url}")
        print("-" * 20)
