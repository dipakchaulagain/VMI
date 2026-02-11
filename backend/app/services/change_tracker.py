"""
Change Tracker Service

Detects changes between old and new VM data during sync operations.
"""
from datetime import datetime, timezone
from app import db
from app.models.sync import VMChangeHistory


class ChangeTracker:
    """Tracks changes in VM data between syncs"""
    
    CHANGE_TYPES = {
        'POWER_STATE': ['power_state'],
        'CPU': ['total_vcpus', 'num_sockets', 'cores_per_socket', 'vcpus_per_socket'],
        'MEMORY': ['memory_mb'],
        'HOST': ['host_identifier'],
        'CLUSTER': ['cluster_name'],
    }
    
    def __init__(self, sync_run_id=None):
        self.sync_run_id = sync_run_id
        self.changes = []
    
    def compare_facts(self, vm_id, old_fact, new_fact_data):
        """
        Compare old fact with new fact data and record changes.
        
        Args:
            vm_id: The VM ID
            old_fact: The existing VMFact object (or None if new VM)
            new_fact_data: Dictionary with new fact values
        """
        if not old_fact:
            return  # New VM, no changes to track
        
        changes = []
        
        # Check each change type category
        for change_type, fields in self.CHANGE_TYPES.items():
            for field in fields:
                old_value = getattr(old_fact, field, None)
                new_value = new_fact_data.get(field)
                
                # Convert to comparable types
                old_str = str(old_value) if old_value is not None else None
                new_str = str(new_value) if new_value is not None else None
                
                if old_str != new_str and (old_str or new_str):
                    changes.append({
                        'vm_id': vm_id,
                        'sync_run_id': self.sync_run_id,
                        'change_type': change_type,
                        'field_name': field,
                        'old_value': old_str,
                        'new_value': new_str,
                        'changed_at': datetime.now(timezone.utc)
                    })
        
        self.changes.extend(changes)
        return changes
    
    def compare_disks(self, vm_id, old_disks, new_disks_data):
        """
        Compare old disks with new disk data and record changes.
        
        Args:
            vm_id: The VM ID
            old_disks: List of existing VMDiskFact objects
            new_disks_data: List of dictionaries with new disk data
        """
        changes = []
        
        # Create lookup by disk identifier (uuid or key)
        old_disk_map = {}
        for disk in old_disks:
            key = disk.disk_uuid or disk.disk_key or str(disk.id)
            old_disk_map[key] = disk
        
        new_disk_map = {}
        for disk in new_disks_data:
            key = disk.get('disk_uuid') or disk.get('disk_key') or str(hash(str(disk)))
            new_disk_map[key] = disk
        
        # Check for added disks
        for key, disk in new_disk_map.items():
            if key not in old_disk_map:
                changes.append({
                    'vm_id': vm_id,
                    'sync_run_id': self.sync_run_id,
                    'change_type': 'DISK',
                    'field_name': 'disk_added',
                    'old_value': None,
                    'new_value': f"{disk.get('disk_label', 'Unknown')} ({disk.get('size_gb', 0)} GB)",
                    'changed_at': datetime.now(timezone.utc)
                })
        
        # Check for removed disks
        for key, disk in old_disk_map.items():
            if key not in new_disk_map:
                changes.append({
                    'vm_id': vm_id,
                    'sync_run_id': self.sync_run_id,
                    'change_type': 'DISK',
                    'field_name': 'disk_removed',
                    'old_value': f"{disk.disk_label or 'Unknown'} ({disk.size_gb or 0} GB)",
                    'new_value': None,
                    'changed_at': datetime.now(timezone.utc)
                })
        
        # Check for size changes
        for key in set(old_disk_map.keys()) & set(new_disk_map.keys()):
            old_disk = old_disk_map[key]
            new_disk = new_disk_map[key]
            
            old_size = float(old_disk.size_gb) if old_disk.size_gb else 0
            new_size = float(new_disk.get('size_gb', 0) or 0)
            
            if abs(old_size - new_size) > 0.01:  # Allow small floating point differences
                changes.append({
                    'vm_id': vm_id,
                    'sync_run_id': self.sync_run_id,
                    'change_type': 'DISK',
                    'field_name': 'disk_size_changed',
                    'old_value': f"{old_disk.disk_label or 'Unknown'}: {old_size} GB",
                    'new_value': f"{new_disk.get('disk_label', 'Unknown')}: {new_size} GB",
                    'changed_at': datetime.now(timezone.utc)
                })
        
        self.changes.extend(changes)
        return changes
    
    def compare_nics(self, vm_id, old_nics, new_nics_data):
        """
        Compare old NICs with new NIC data and record changes.
        
        Args:
            vm_id: The VM ID
            old_nics: List of existing VMNicFact objects
            new_nics_data: List of dictionaries with new NIC data
        """
        changes = []
        
        # Create lookup by MAC address
        old_nic_map = {nic.mac_address: nic for nic in old_nics if nic.mac_address}
        new_nic_map = {nic.get('mac_address'): nic for nic in new_nics_data if nic.get('mac_address')}
        
        # Check for added NICs
        for mac, nic in new_nic_map.items():
            if mac and mac not in old_nic_map:
                changes.append({
                    'vm_id': vm_id,
                    'sync_run_id': self.sync_run_id,
                    'change_type': 'NIC',
                    'field_name': 'nic_added',
                    'old_value': None,
                    'new_value': f"{nic.get('network_name', 'Unknown')} ({mac})",
                    'changed_at': datetime.now(timezone.utc)
                })
        
        # Check for removed NICs
        for mac, nic in old_nic_map.items():
            if mac and mac not in new_nic_map:
                changes.append({
                    'vm_id': vm_id,
                    'sync_run_id': self.sync_run_id,
                    'change_type': 'NIC',
                    'field_name': 'nic_removed',
                    'old_value': f"{nic.network_name or 'Unknown'} ({mac})",
                    'new_value': None,
                    'changed_at': datetime.now(timezone.utc)
                })
        
        self.changes.extend(changes)
        return changes
    
    def compare_ips(self, vm_id, old_nics, new_nics_data):
        """
        Compare IPs between old and new NIC data.
        
        Args:
            vm_id: The VM ID
            old_nics: List of existing VMNicFact objects with ip_addresses
            new_nics_data: List of dictionaries with new NIC data including IPs
        """
        changes = []
        
        # Collect all old IPs
        old_ips = set()
        for nic in old_nics:
            for ip in nic.ip_addresses:
                old_ips.add(ip.ip_address)
        
        # Collect all new IPs
        new_ips = set()
        for nic in new_nics_data:
            for ip in nic.get('ip_addresses', []):
                new_ips.add(ip.get('ip_address') or ip.get('ip'))
        
        # Check for added IPs
        for ip in new_ips - old_ips:
            if ip:
                changes.append({
                    'vm_id': vm_id,
                    'sync_run_id': self.sync_run_id,
                    'change_type': 'IP',
                    'field_name': 'ip_added',
                    'old_value': None,
                    'new_value': ip,
                    'changed_at': datetime.now(timezone.utc)
                })
        
        # Check for removed IPs
        for ip in old_ips - new_ips:
            if ip:
                changes.append({
                    'vm_id': vm_id,
                    'sync_run_id': self.sync_run_id,
                    'change_type': 'IP',
                    'field_name': 'ip_removed',
                    'old_value': ip,
                    'new_value': None,
                    'changed_at': datetime.now(timezone.utc)
                })
        
        self.changes.extend(changes)
        return changes
    
    def save_changes(self):
        """Save all tracked changes to database"""
        for change_data in self.changes:
            change = VMChangeHistory(**change_data)
            db.session.add(change)
        
        db.session.flush()
        saved_count = len(self.changes)
        self.changes = []
        return saved_count
