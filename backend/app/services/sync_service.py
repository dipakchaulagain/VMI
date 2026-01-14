"""
VM Sync Service

Handles syncing VM data from Nutanix and VMware platforms.
"""
import requests
from datetime import datetime
from flask import current_app
from app import db
from app.models.vm import VM, VMFact, VMNicFact, VMNicIpFact, VMDiskFact
from app.models.sync import VMSyncRun
from app.services.change_tracker import ChangeTracker


class SyncService:
    """Service for syncing VM data from external platforms"""
    
    PLATFORM_NUTANIX = 'nutanix'
    PLATFORM_VMWARE = 'vmware'
    
    def __init__(self):
        self.api_url = current_app.config['SYNC_API_URL']
    
    def sync_platform(self, platform):
        """
        Sync VMs from a specific platform.
        
        Args:
            platform: 'nutanix' or 'vmware'
        
        Returns:
            dict with sync results
        """
        # Create sync run record
        sync_run = VMSyncRun(
            platform=platform,
            status='RUNNING'
        )
        db.session.add(sync_run)
        db.session.commit()
        
        try:
            # Fetch data from API
            response = requests.post(
                self.api_url,
                json={'infra': platform},
                timeout=120
            )
            response.raise_for_status()
            data = response.json()
            
            # Parse response based on platform
            if platform == self.PLATFORM_NUTANIX:
                vms_data = self._parse_nutanix_response(data)
            else:
                vms_data = self._parse_vmware_response(data)
            
            # Initialize change tracker
            change_tracker = ChangeTracker(sync_run_id=sync_run.id)
            
            # Process VMs
            seen_vm_ids = []
            for vm_data in vms_data:
                vm_id = self._process_vm(platform, vm_data, sync_run.id, change_tracker)
                if vm_id:
                    seen_vm_ids.append(vm_id)
            
            # Save change history
            changes_count = change_tracker.save_changes()
            
            # Soft delete VMs not seen in this sync
            deleted_count = self._soft_delete_missing(platform, sync_run.id, seen_vm_ids)
            
            # Update sync run
            sync_run.finished_at = datetime.utcnow()
            sync_run.status = 'SUCCESS'
            sync_run.vm_count_seen = len(seen_vm_ids)
            sync_run.details = {
                'vms_processed': len(seen_vm_ids),
                'vms_deleted': deleted_count,
                'changes_detected': changes_count
            }
            db.session.commit()
            
            return {
                'status': 'success',
                'sync_run_id': sync_run.id,
                'vms_processed': len(seen_vm_ids),
                'vms_deleted': deleted_count,
                'changes_detected': changes_count
            }
            
        except Exception as e:
            sync_run.finished_at = datetime.utcnow()
            sync_run.status = 'FAILED'
            sync_run.details = {'error': str(e)}
            db.session.commit()
            
            return {
                'status': 'error',
                'sync_run_id': sync_run.id,
                'error': str(e)
            }
    
    def _parse_nutanix_response(self, data):
        """Parse Nutanix API response"""
        vms = []
        
        # Handle array response
        if isinstance(data, list):
            for item in data:
                if 'vms' in item:
                    vms.extend(item['vms'])
        elif isinstance(data, dict) and 'vms' in data:
            vms = data['vms']
        
        return vms
    
    def _parse_vmware_response(self, data):
        """Parse VMware API response"""
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and 'vms' in data:
            return data['vms']
        return []
    
    def _process_vm(self, platform, vm_data, sync_run_id, change_tracker):
        """
        Process a single VM from API data.
        
        Returns:
            VM ID if processed successfully
        """
        vm_uuid = vm_data.get('uuid')
        if not vm_uuid:
            return None
        
        # Find or create VM
        vm = VM.query.filter_by(platform=platform, vm_uuid=vm_uuid).first()
        is_new_vm = vm is None
        
        if is_new_vm:
            vm = VM(
                platform=platform,
                vm_uuid=vm_uuid,
                vm_name=vm_data.get('name', 'Unknown'),
                bios_uuid=vm_data.get('bios_uuid')
            )
            db.session.add(vm)
            db.session.flush()
        else:
            # Update existing VM
            vm.vm_name = vm_data.get('name', vm.vm_name)
            vm.bios_uuid = vm_data.get('bios_uuid', vm.bios_uuid)
            vm.is_deleted = False
            vm.deleted_at = None
            vm.deleted_by = None
            vm.delete_reason = None
        
        vm.last_seen_at = datetime.utcnow()
        vm.last_sync_run_id = sync_run_id
        
        # Prepare fact data
        if platform == self.PLATFORM_NUTANIX:
            fact_data = self._extract_nutanix_facts(vm_data)
            nics_data = self._extract_nutanix_nics(vm_data)
            disks_data = self._extract_nutanix_disks(vm_data)
        else:
            fact_data = self._extract_vmware_facts(vm_data)
            nics_data = self._extract_vmware_nics(vm_data)
            disks_data = self._extract_vmware_disks(vm_data)
        
        # Track changes if not new VM
        if not is_new_vm and vm.fact:
            change_tracker.compare_facts(vm.id, vm.fact, fact_data)
            change_tracker.compare_disks(vm.id, list(vm.disks), disks_data)
            change_tracker.compare_nics(vm.id, list(vm.nics), nics_data)
            change_tracker.compare_ips(vm.id, list(vm.nics), nics_data)
        
        # Update or create fact
        self._update_fact(vm.id, fact_data, vm_data)
        
        # Update NICs and IPs
        self._update_nics(vm.id, nics_data)
        
        # Update disks
        self._update_disks(vm.id, disks_data)
        
        db.session.flush()
        return vm.id
    
    def _extract_nutanix_facts(self, vm_data):
        """Extract fact data from Nutanix VM"""
        cpu = vm_data.get('cpu', {})
        ram = vm_data.get('ram', {})
        summary = vm_data.get('summary', {})
        
        creation_date = None
        if vm_data.get('creation_date') and vm_data['creation_date'] != 'N/A':
            try:
                creation_date = datetime.fromisoformat(vm_data['creation_date'].replace('Z', '+00:00'))
            except:
                pass
        
        last_update = None
        if vm_data.get('last_update_date') and vm_data['last_update_date'] != 'N/A':
            try:
                last_update = datetime.fromisoformat(vm_data['last_update_date'].replace('Z', '+00:00'))
            except:
                pass
        
        return {
            'power_state': vm_data.get('status'),
            'hypervisor_type': vm_data.get('hypervisor_type', 'AHV'),
            'cluster_name': vm_data.get('cluster'),
            'host_identifier': vm_data.get('host'),
            'os_type': vm_data.get('os_type'),
            'os_family': None,
            'hostname': None,
            'total_vcpus': cpu.get('total_vcpus'),
            'num_sockets': cpu.get('num_sockets'),
            'cores_per_socket': None,
            'vcpus_per_socket': cpu.get('vcpus_per_socket'),
            'threads_per_core': cpu.get('threads_per_core'),
            'cpu_hot_add': None,
            'cpu_hot_remove': None,
            'memory_mb': ram.get('size_mib'),
            'mem_hot_add': None,
            'mem_hot_add_limit_mb': None,
            'total_disks': summary.get('total_disks'),
            'total_disk_gb': float(summary.get('total_disk_size_gib', 0) or 0),
            'total_nics': summary.get('total_nics'),
            'creation_date': creation_date,
            'last_update_date': last_update
        }
    
    def _extract_vmware_facts(self, vm_data):
        """Extract fact data from VMware VM"""
        cpu = vm_data.get('cpu', {})
        ram = vm_data.get('ram', {})
        summary = vm_data.get('summary', {})
        
        creation_date = None
        if vm_data.get('creation_date') and vm_data['creation_date'] != 'N/A':
            try:
                creation_date = datetime.fromisoformat(vm_data['creation_date'].replace('Z', '+00:00'))
            except:
                pass
        
        last_update = None
        if vm_data.get('last_update_date') and vm_data['last_update_date'] != 'N/A':
            try:
                last_update = datetime.fromisoformat(vm_data['last_update_date'].replace('Z', '+00:00'))
            except:
                pass
        
        return {
            'power_state': vm_data.get('status'),
            'hypervisor_type': 'ESXi',
            'cluster_name': vm_data.get('cluster'),
            'host_identifier': vm_data.get('host'),
            'os_type': vm_data.get('os_type'),
            'os_family': vm_data.get('os_family'),
            'hostname': vm_data.get('host_name'),
            'total_vcpus': cpu.get('total_vcpus'),
            'num_sockets': cpu.get('num_sockets'),
            'cores_per_socket': cpu.get('cores_per_socket'),
            'vcpus_per_socket': cpu.get('vcpus_per_socket'),
            'threads_per_core': None,
            'cpu_hot_add': cpu.get('hot_add_enabled'),
            'cpu_hot_remove': cpu.get('hot_remove_enabled'),
            'memory_mb': ram.get('size_mib'),
            'mem_hot_add': ram.get('hot_add_enabled'),
            'mem_hot_add_limit_mb': ram.get('hot_add_limit_mib'),
            'total_disks': summary.get('total_disks'),
            'total_disk_gb': float(summary.get('total_disk_size_gib', 0) or 0),
            'total_nics': summary.get('total_nics'),
            'creation_date': creation_date,
            'last_update_date': last_update
        }
    
    def _extract_nutanix_nics(self, vm_data):
        """Extract NIC data from Nutanix VM"""
        nics = []
        for nic in vm_data.get('nics', []):
            nic_data = {
                'nic_uuid': nic.get('uuid'),
                'label': None,
                'mac_address': nic.get('mac_address'),
                'nic_type': nic.get('nic_type'),
                'network_name': nic.get('subnet'),
                'vlan_mode': nic.get('vlan_mode'),
                'is_connected': nic.get('is_connected'),
                'state': None,
                'ip_addresses': []
            }
            
            for ip in nic.get('ip_addresses', []):
                nic_data['ip_addresses'].append({
                    'ip_address': ip.get('ip'),
                    'ip_type': ip.get('type')
                })
            
            nics.append(nic_data)
        
        return nics
    
    def _extract_vmware_nics(self, vm_data):
        """Extract NIC data from VMware VM"""
        nics = []
        for nic in vm_data.get('nics', []):
            nic_data = {
                'nic_uuid': None,
                'label': nic.get('label'),
                'mac_address': nic.get('mac_address'),
                'nic_type': nic.get('nic_type'),
                'network_name': nic.get('network'),
                'vlan_mode': None,
                'is_connected': nic.get('is_connected'),
                'state': nic.get('state'),
                'ip_addresses': []
            }
            
            for ip in nic.get('ip_addresses', []):
                nic_data['ip_addresses'].append({
                    'ip_address': ip.get('ip'),
                    'ip_type': ip.get('type')
                })
            
            nics.append(nic_data)
        
        return nics
    
    def _extract_nutanix_disks(self, vm_data):
        """Extract disk data from Nutanix VM"""
        disks = []
        for disk in vm_data.get('disks', []):
            disks.append({
                'disk_uuid': disk.get('uuid'),
                'disk_key': None,
                'disk_label': None,
                'device_type': disk.get('device_type'),
                'adapter_type': disk.get('adapter_type'),
                'size_gb': float(disk.get('size_gib', 0) or 0),
                'backing_type': None,
                'backing_path': None,
                'storage_name': disk.get('storage_container'),
                'is_image': disk.get('is_image'),
                'scsi_bus': None,
                'scsi_unit': disk.get('device_index')
            })
        return disks
    
    def _extract_vmware_disks(self, vm_data):
        """Extract disk data from VMware VM"""
        disks = []
        for disk in vm_data.get('disks', []):
            disks.append({
                'disk_uuid': None,
                'disk_key': disk.get('key'),
                'disk_label': disk.get('label'),
                'device_type': disk.get('device_type'),
                'adapter_type': disk.get('adapter_type'),
                'size_gb': float(disk.get('size_gib', 0) or 0),
                'backing_type': disk.get('backing_type'),
                'backing_path': disk.get('vmdk_file'),
                'storage_name': None,
                'is_image': disk.get('is_image'),
                'scsi_bus': disk.get('scsi_bus'),
                'scsi_unit': disk.get('scsi_unit')
            })
        return disks
    
    def _update_fact(self, vm_id, fact_data, raw_data):
        """Update or create VM fact record"""
        fact = VMFact.query.get(vm_id)
        
        if not fact:
            fact = VMFact(vm_id=vm_id)
            db.session.add(fact)
        
        for key, value in fact_data.items():
            setattr(fact, key, value)
        
        fact.raw = raw_data
        fact.fact_updated_at = datetime.utcnow()
    
    def _update_nics(self, vm_id, nics_data):
        """Update NIC records for a VM"""
        # 1. Capture existing valid IPs (non-169.254) to preserve them if sync returns only APIPA
        existing_ips = {} # mac_address -> [list of ip dictionaries]
        
        current_nics = VMNicFact.query.filter_by(vm_id=vm_id).all()
        for nic in current_nics:
            if not nic.mac_address:
                continue
                
            valid_ips = []
            for ip in nic.ip_addresses:
                if ip.ip_address and not ip.ip_address.startswith('169.254'):
                    valid_ips.append({
                        'ip_address': ip.ip_address,
                        'ip_type': ip.ip_type
                    })
            
            if valid_ips:
                existing_ips[nic.mac_address] = valid_ips

        # Delete existing NICs (cascade deletes IPs)
        VMNicFact.query.filter_by(vm_id=vm_id).delete()
        db.session.flush()  # Ensure deletes are processed first
        
        # Create new NICs
        for nic_data in nics_data:
            nic = VMNicFact(
                vm_id=vm_id,
                nic_uuid=nic_data.get('nic_uuid'),
                label=nic_data.get('label'),
                mac_address=nic_data.get('mac_address'),
                nic_type=nic_data.get('nic_type'),
                network_name=nic_data.get('network_name'),
                vlan_mode=nic_data.get('vlan_mode'),
                is_connected=nic_data.get('is_connected'),
                state=nic_data.get('state')
            )
            db.session.add(nic)
            db.session.flush()
            
            # Add IPs - deduplicate by IP address (same IP can have multiple types)
            new_ips_to_add = []
            seen_ips = set()
            incoming_has_valid_ip = False
            
            # Check incoming IPs
            for ip_data in nic_data.get('ip_addresses', []):
                ip_addr = ip_data.get('ip_address')
                if ip_addr:
                    if not ip_addr.startswith('169.254'):
                        incoming_has_valid_ip = True
                    
                    if ip_addr not in seen_ips:
                        seen_ips.add(ip_addr)
                        new_ips_to_add.append(ip_data)
            
            # Logic: If incoming has no valid IPs (only APIPA or none), attempt to restore old valid IPs
            if not incoming_has_valid_ip and nic.mac_address in existing_ips:
                # Restore previous valid IPs
                # First clear any 169.254 addresses we might have queued up to replace them with the good ones
                # OR we can keep 169.254 as secondary, but let's just restore the good state to avoid confusion
                new_ips_to_add = existing_ips[nic.mac_address]
            
            # Commit IPs
            for ip_data in new_ips_to_add:
                 # Re-check seen_ips for the restored ones if we mixed them (in this logic we replaced, but good to be safe)
                 # Since we replaced the list, we can just add them.
                 # Wait, if we replaced the list, we might have duplicates if we iterate blindly?
                 # No, existing_ips list was already deduplicated/sanitized when reading.
                 
                 # If we are restoring, we should make sure we don't violate unique constraints if logic was complex.
                 # Here: we either use the NEW list (which was deduped) OR the OLD list (which matches schema).
                 
                 ip = VMNicIpFact(
                    nic_id=nic.id,
                    ip_address=ip_data.get('ip_address'),
                    ip_type=ip_data.get('ip_type')
                )
                 db.session.add(ip)
    
    def _update_disks(self, vm_id, disks_data):
        """Update disk records for a VM"""
        # Delete existing disks
        VMDiskFact.query.filter_by(vm_id=vm_id).delete()
        
        # Create new disks
        for disk_data in disks_data:
            disk = VMDiskFact(
                vm_id=vm_id,
                disk_uuid=disk_data.get('disk_uuid'),
                disk_key=disk_data.get('disk_key'),
                disk_label=disk_data.get('disk_label'),
                device_type=disk_data.get('device_type'),
                adapter_type=disk_data.get('adapter_type'),
                size_gb=disk_data.get('size_gb'),
                backing_type=disk_data.get('backing_type'),
                backing_path=disk_data.get('backing_path'),
                storage_name=disk_data.get('storage_name'),
                is_image=disk_data.get('is_image'),
                scsi_bus=disk_data.get('scsi_bus'),
                scsi_unit=disk_data.get('scsi_unit')
            )
            db.session.add(disk)
    
    def _soft_delete_missing(self, platform, sync_run_id, seen_vm_ids):
        """Soft delete VMs not seen in this sync"""
        deleted_count = VM.query.filter(
            VM.platform == platform,
            VM.last_sync_run_id != sync_run_id,
            VM.is_deleted == False,
            ~VM.id.in_(seen_vm_ids) if seen_vm_ids else True
        ).update({
            'is_deleted': True,
            'deleted_at': datetime.utcnow(),
            'deleted_by': 'sync-job',
            'delete_reason': 'Not present in latest sync',
            'last_sync_run_id': sync_run_id
        }, synchronize_session=False)
        
        return deleted_count
