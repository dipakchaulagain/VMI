"""
Scheduler Service for automated sync jobs
"""
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

# Global scheduler instance
scheduler = BackgroundScheduler()
_app = None


def init_scheduler(app):
    """Initialize the scheduler with the Flask app context"""
    global _app
    _app = app
    
    with app.app_context():
        from app.models.settings import SiteSettings
        from app import db
        
        # Initialize default settings
        try:
            SiteSettings.init_defaults()
            # Start the scheduler - ONLY if DB is ready
            if not scheduler.running:
                scheduler.start()
                print("[Scheduler] Started")
            
            # Schedule sync job based on settings
            reschedule_sync()
        except Exception as e:
            print(f"[Scheduler] Failed to initialize defaults or start scheduler (likely DB not ready): {e}")


def reschedule_sync():
    """Reschedule the sync job based on current settings"""
    global _app
    
    if not _app:
        return
    
    with _app.app_context():
        from app.models.settings import SiteSettings
        
        # Remove existing sync job if any
        try:
            scheduler.remove_job('scheduled_sync')
            print("[Scheduler] Removed existing sync job")
        except:
            pass
        
        sync_enabled = SiteSettings.get(SiteSettings.SYNC_ENABLED, 'false') == 'true'
        
        if sync_enabled:
            interval_minutes = int(SiteSettings.get(SiteSettings.SYNC_INTERVAL_MINUTES, '60') or '60')
            
            scheduler.add_job(
                func=run_scheduled_sync,
                trigger=IntervalTrigger(minutes=interval_minutes),
                id='scheduled_sync',
                name='Scheduled Sync All Platforms',
                replace_existing=True
            )
            print(f"[Scheduler] Sync job scheduled every {interval_minutes} minutes")
        else:
            print("[Scheduler] Sync is disabled")


def run_scheduled_sync():
    """Execute the scheduled sync"""
    global _app
    
    if not _app:
        return
    
    with _app.app_context():
        from app.services.sync_service import SyncService
        from app.models.settings import SiteSettings
        from app import db
        
        print(f"[Scheduler] Running scheduled sync at {datetime.now(timezone.utc).isoformat()}")
        
        try:
            sync_service = SyncService()
            
            # Sync VMware VMs
            try:
                result = sync_service.sync_platform('vmware')
                print(f"[Scheduler] VMware sync complete: {result.get('stats', {})}")
            except Exception as e:
                print(f"[Scheduler] VMware sync error: {e}")
            
            # Sync Nutanix VMs
            try:
                result = sync_service.sync_platform('nutanix')
                print(f"[Scheduler] Nutanix sync complete: {result.get('stats', {})}")
            except Exception as e:
                print(f"[Scheduler] Nutanix sync error: {e}")
            
            # Sync Hosts (Hypervisors)
            try:
                from app.routes.hosts import _upsert_host
                from flask import current_app
                import requests
                
                from app.models.system_api import SystemApi
                
                # Sync VMware hosts
                try:
                    apis = SystemApi.query.filter_by(resource_type='vmware_host', is_active=True).all()
                    for api in apis:
                        try:
                            response = requests.request(
                                method=api.method,
                                url=api.url,
                                headers=api.headers,
                                json=api.payload,
                                timeout=60
                            )
                            
                            if response.status_code == 200:
                                hosts_data = response.json()
                                for host_data in hosts_data:
                                    _upsert_host('vmware', host_data)
                                print(f"[Scheduler] VMware hosts synced via {api.name}: {len(hosts_data)}")
                            else:
                                print(f"[Scheduler] API {api.name} returned {response.status_code}")
                        except Exception as e:
                            print(f"[Scheduler] API {api.name} error: {e}")
                except Exception as e:
                    print(f"[Scheduler] VMware sync error: {e}")

                # Sync Nutanix hosts
                try:
                    apis = SystemApi.query.filter_by(resource_type='nutanix_host', is_active=True).all()
                    for api in apis:
                        try:
                            response = requests.request(
                                method=api.method,
                                url=api.url,
                                headers=api.headers,
                                json=api.payload,
                                timeout=60
                            )
                            
                            if response.status_code == 200:
                                hosts_data = response.json()
                                for host_data in hosts_data:
                                    _upsert_host('nutanix', host_data)
                                print(f"[Scheduler] Nutanix hosts synced via {api.name}: {len(hosts_data)}")
                            else:
                                print(f"[Scheduler] API {api.name} returned {response.status_code}")
                        except Exception as e:
                            print(f"[Scheduler] API {api.name} error: {e}")
                except Exception as e:
                    print(f"[Scheduler] Nutanix sync error: {e}")
                
                db.session.commit()
            except Exception as e:
                print(f"[Scheduler] Host sync error: {e}")
            
            # Update last run timestamp
            SiteSettings.set(SiteSettings.SYNC_LAST_RUN, datetime.now(timezone.utc).isoformat())
            
        except Exception as e:
            print(f"[Scheduler] Sync failed: {e}")


def shutdown_scheduler():
    """Shutdown the scheduler gracefully"""
    if scheduler.running:
        scheduler.shutdown()
        print("[Scheduler] Shutdown complete")
