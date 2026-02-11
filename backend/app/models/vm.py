from datetime import datetime, timezone
from app import db


class VM(db.Model):
    """Master VM table"""
    __tablename__ = 'vm'
    
    id = db.Column(db.BigInteger, primary_key=True)
    platform = db.Column(db.String(20), nullable=False)
    vm_uuid = db.Column(db.String(64), nullable=False)
    vm_name = db.Column(db.String(255), nullable=False)
    bios_uuid = db.Column(db.String(64))
    
    is_deleted = db.Column(db.Boolean, nullable=False, default=False)
    deleted_at = db.Column(db.DateTime(timezone=True))
    deleted_by = db.Column(db.Text)
    delete_reason = db.Column(db.Text)
    
    first_seen_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_seen_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_sync_run_id = db.Column(db.BigInteger, db.ForeignKey('vm_sync_run.id'))
    
    __table_args__ = (db.UniqueConstraint('platform', 'vm_uuid'),)
    
    # Relationships
    fact = db.relationship('VMFact', backref='vm', uselist=False, cascade='all, delete-orphan')
    nics = db.relationship('VMNicFact', backref='vm', lazy='dynamic', cascade='all, delete-orphan')
    disks = db.relationship('VMDiskFact', backref='vm', lazy='dynamic', cascade='all, delete-orphan')
    manual = db.relationship('VMManual', backref='vm', uselist=False, cascade='all, delete-orphan')
    tags = db.relationship('VMTag', backref='vm', lazy='dynamic', cascade='all, delete-orphan')
    manual_ips = db.relationship('VMIpManual', backref='vm', lazy='dynamic', cascade='all, delete-orphan')
    custom_fields = db.relationship('VMCustomField', backref='vm', lazy='dynamic', cascade='all, delete-orphan')
    
    @property
    def inventory_key(self):
        return f"{self.platform}:{self.vm_uuid}"
    
    def to_dict(self, include_details=False):
        """Convert to dictionary"""
        data = {
            'id': self.id,
            'platform': self.platform,
            'vm_uuid': self.vm_uuid,
            'inventory_key': self.inventory_key,
            'vm_name': self.vm_name,
            'bios_uuid': self.bios_uuid,
            'is_deleted': self.is_deleted,
            'first_seen_at': self.first_seen_at.isoformat() if self.first_seen_at else None,
            'last_seen_at': self.last_seen_at.isoformat() if self.last_seen_at else None
        }
        
        if include_details and self.fact:
            data['fact'] = self.fact.to_dict()
        if include_details and self.manual:
            data['manual'] = self.manual.to_dict()
        
        return data
    
    def to_effective_dict(self):
        """Convert to effective dictionary with manual overrides applied"""
        fact = self.fact
        manual = self.manual
        
        data = {
            'id': self.id,
            'platform': self.platform,
            'vm_uuid': self.vm_uuid,
            'inventory_key': self.inventory_key,
            'vm_name': self.vm_name,
            'bios_uuid': self.bios_uuid,
            'is_deleted': self.is_deleted,
            'first_seen_at': self.first_seen_at.isoformat() if self.first_seen_at else None,
            'last_seen_at': self.last_seen_at.isoformat() if self.last_seen_at else None,
        }
        
        # Apply fact data
        if fact:
            # Apply manual overrides where enabled
            power_state = fact.power_state
            cluster_name = fact.cluster_name
            hostname = fact.hostname
            os_type = fact.os_type
            os_family = fact.os_family
            
            if manual:
                if manual.override_power_state:
                    power_state = manual.manual_power_state
                if manual.override_cluster:
                    cluster_name = manual.manual_cluster_name
                if manual.override_hostname:
                    hostname = manual.manual_hostname
                if manual.override_os_type:
                    os_type = manual.manual_os_type
                if manual.override_os_family:
                    os_family = manual.manual_os_family
            
            data.update({
                'power_state': power_state,
                'cluster_name': cluster_name,
                'host_identifier': fact.host_identifier,
                'hypervisor_type': fact.hypervisor_type,
                'hostname': hostname,
                'hostname': hostname,
                'os_type': os_type,
                'os_type': os_type,
                'os_family': os_family,
                'total_vcpus': fact.total_vcpus,
                'total_vcpus': fact.total_vcpus,
                'memory_gb': round(fact.memory_mb / 1024, 2) if fact.memory_mb else None,
                'total_disks': fact.total_disks,
                'total_disk_gb': float(fact.total_disk_gb) if fact.total_disk_gb else None,
                'total_nics': fact.total_nics,
                'creation_date': fact.creation_date.isoformat() if fact.creation_date else None,
                'last_update_date': fact.last_update_date.isoformat() if fact.last_update_date else None,
                'fact_updated_at': fact.fact_updated_at.isoformat() if fact.fact_updated_at else None
            })
        
        # Apply manual ownership data
        if manual:
            data.update({
                'business_owner_id': manual.business_owner_id,
                'technical_owner_id': manual.technical_owner_id,
                'project_name': manual.project_name,
                'environment': manual.environment,
                'notes': manual.notes
            })
            
            # Include owner details if available
            if manual.business_owner:
                data['business_owner'] = manual.business_owner.full_name
                data['business_owner_email'] = manual.business_owner.email
            if manual.technical_owner:
                data['technical_owner'] = manual.technical_owner.full_name
                data['technical_owner_email'] = manual.technical_owner.email
        
        # Include Tags
        data['tags'] = [tag.to_dict() for tag in self.tags]

        # Determine First Available IP
        first_ip = None
        
        # 1. Priority: Manual IPs
        # First check for primary manual IP
        for manual_ip in self.manual_ips:
            if manual_ip.is_primary and manual_ip.ip_address:
                first_ip = manual_ip.ip_address
                break
        
        # If no primary, check any manual IP
        if not first_ip:
            for manual_ip in self.manual_ips:
                if manual_ip.ip_address:
                    first_ip = manual_ip.ip_address
                    break
        
        # 2. Priority: NIC IPs (if no manual IP found)
        if not first_ip:
            nic_ips = []
            for nic in self.nics:
                for ip in nic.ip_addresses:
                    if ip.ip_address:
                        nic_ips.append(ip.ip_address)
            
            # Filter for non-APIPA first
            valid_ips = [ip for ip in nic_ips if not ip.startswith('169.254')]
            
            if valid_ips:
                first_ip = valid_ips[0]
            elif nic_ips:
                # Fallback to whatever we have (even if it is 169.254)
                first_ip = nic_ips[0]
        
        data['ip_address'] = first_ip

        return data


class VMFact(db.Model):
    """VM facts from platform"""
    __tablename__ = 'vm_fact'
    
    vm_id = db.Column(db.BigInteger, db.ForeignKey('vm.id', ondelete='CASCADE'), primary_key=True)
    
    power_state = db.Column(db.String(20))
    hypervisor_type = db.Column(db.String(20))
    cluster_name = db.Column(db.String(255))
    host_identifier = db.Column(db.String(255))
    
    os_type = db.Column(db.String(255))
    os_family = db.Column(db.String(50))
    hostname = db.Column(db.String(255))
    
    total_vcpus = db.Column(db.Integer)
    num_sockets = db.Column(db.Integer)
    cores_per_socket = db.Column(db.Integer)
    vcpus_per_socket = db.Column(db.Integer)
    threads_per_core = db.Column(db.Integer)
    cpu_hot_add = db.Column(db.Boolean)
    cpu_hot_remove = db.Column(db.Boolean)
    
    memory_mb = db.Column(db.Integer)
    mem_hot_add = db.Column(db.Boolean)
    mem_hot_add_limit_mb = db.Column(db.Integer)
    
    total_disks = db.Column(db.Integer)
    total_disk_gb = db.Column(db.Numeric(12, 2))
    total_nics = db.Column(db.Integer)
    
    creation_date = db.Column(db.DateTime(timezone=True))
    last_update_date = db.Column(db.DateTime(timezone=True))
    
    raw = db.Column(db.JSON)
    fact_updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'vm_id': self.vm_id,
            'power_state': self.power_state,
            'hypervisor_type': self.hypervisor_type,
            'cluster_name': self.cluster_name,
            'host_identifier': self.host_identifier,
            'os_type': self.os_type,
            'os_family': self.os_family,
            'hostname': self.hostname,
            'total_vcpus': self.total_vcpus,
            'num_sockets': self.num_sockets,
            'cores_per_socket': self.cores_per_socket,
            'vcpus_per_socket': self.vcpus_per_socket,
            'threads_per_core': self.threads_per_core,
            'cpu_hot_add': self.cpu_hot_add,
            'cpu_hot_remove': self.cpu_hot_remove,
            'memory_mb': self.memory_mb,
            'memory_gb': round(self.memory_mb / 1024, 2) if self.memory_mb else None,
            'mem_hot_add': self.mem_hot_add,
            'mem_hot_add_limit_mb': self.mem_hot_add_limit_mb,
            'total_disks': self.total_disks,
            'total_disk_gb': float(self.total_disk_gb) if self.total_disk_gb else None,
            'total_nics': self.total_nics,
            'creation_date': self.creation_date.isoformat() if self.creation_date else None,
            'last_update_date': self.last_update_date.isoformat() if self.last_update_date else None,
            'fact_updated_at': self.fact_updated_at.isoformat() if self.fact_updated_at else None
        }


class VMNicFact(db.Model):
    """VM NIC facts"""
    __tablename__ = 'vm_nic_fact'
    
    id = db.Column(db.BigInteger, primary_key=True)
    vm_id = db.Column(db.BigInteger, db.ForeignKey('vm.id', ondelete='CASCADE'), nullable=False)
    
    nic_uuid = db.Column(db.String(64))
    label = db.Column(db.String(255))
    mac_address = db.Column(db.String(32))
    nic_type = db.Column(db.String(50))
    network_name = db.Column(db.String(255))
    vlan_mode = db.Column(db.String(50))
    is_connected = db.Column(db.Boolean)
    state = db.Column(db.String(50))
    
    # Relationships
    ip_addresses = db.relationship('VMNicIpFact', backref='nic', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'vm_id': self.vm_id,
            'nic_uuid': self.nic_uuid,
            'label': self.label,
            'mac_address': self.mac_address,
            'nic_type': self.nic_type,
            'network_name': self.network_name,
            'vlan_mode': self.vlan_mode,
            'is_connected': self.is_connected,
            'state': self.state,
            'ip_addresses': [ip.to_dict() for ip in self.ip_addresses]
        }


class VMNicIpFact(db.Model):
    """VM NIC IP addresses"""
    __tablename__ = 'vm_nic_ip_fact'
    
    nic_id = db.Column(db.BigInteger, db.ForeignKey('vm_nic_fact.id', ondelete='CASCADE'), primary_key=True)
    ip_address = db.Column(db.String(50), primary_key=True)  # Using string for INET compatibility
    ip_type = db.Column(db.String(50))
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'nic_id': self.nic_id,
            'ip_address': self.ip_address,
            'ip_type': self.ip_type
        }


class VMDiskFact(db.Model):
    """VM disk facts"""
    __tablename__ = 'vm_disk_fact'
    
    id = db.Column(db.BigInteger, primary_key=True)
    vm_id = db.Column(db.BigInteger, db.ForeignKey('vm.id', ondelete='CASCADE'), nullable=False)
    
    disk_uuid = db.Column(db.String(64))
    disk_key = db.Column(db.String(64))
    disk_label = db.Column(db.String(255))
    device_type = db.Column(db.String(50))
    adapter_type = db.Column(db.String(50))
    
    size_gb = db.Column(db.Numeric(12, 2))
    
    backing_type = db.Column(db.String(50))
    backing_path = db.Column(db.Text)
    storage_name = db.Column(db.String(255))
    
    is_image = db.Column(db.Boolean)
    
    scsi_bus = db.Column(db.Integer)
    scsi_unit = db.Column(db.Integer)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'vm_id': self.vm_id,
            'disk_uuid': self.disk_uuid,
            'disk_key': self.disk_key,
            'disk_label': self.disk_label,
            'device_type': self.device_type,
            'adapter_type': self.adapter_type,
            'size_gb': float(self.size_gb) if self.size_gb else None,
            'backing_type': self.backing_type,
            'backing_path': self.backing_path,
            'storage_name': self.storage_name,
            'is_image': self.is_image,
            'scsi_bus': self.scsi_bus,
            'scsi_unit': self.scsi_unit
        }


class VMManual(db.Model):
    """Manual VM overrides"""
    __tablename__ = 'vm_manual'
    
    vm_id = db.Column(db.BigInteger, db.ForeignKey('vm.id', ondelete='CASCADE'), primary_key=True)
    
    business_owner_id = db.Column(db.BigInteger, db.ForeignKey('owners.id', ondelete='SET NULL'))
    technical_owner_id = db.Column(db.BigInteger, db.ForeignKey('owners.id', ondelete='SET NULL'))
    project_name = db.Column(db.String(255))
    environment = db.Column(db.String(50))
    
    notes = db.Column(db.Text)
    
    override_power_state = db.Column(db.Boolean, default=False)
    override_cluster = db.Column(db.Boolean, default=False)
    override_hostname = db.Column(db.Boolean, default=False)
    override_os_type = db.Column(db.Boolean, default=False)
    override_os_family = db.Column(db.Boolean, default=False)
    
    manual_power_state = db.Column(db.String(20))
    manual_cluster_name = db.Column(db.String(255))
    manual_hostname = db.Column(db.String(255))
    manual_os_type = db.Column(db.String(100))
    manual_os_family = db.Column(db.String(50))
    
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    updated_by = db.Column(db.Text)
    
    # Relationships
    business_owner = db.relationship('Owner', foreign_keys=[business_owner_id])
    technical_owner = db.relationship('Owner', foreign_keys=[technical_owner_id])
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'vm_id': self.vm_id,
            'business_owner_id': self.business_owner_id,
            'business_owner': self.business_owner.full_name if self.business_owner else None,
            'technical_owner_id': self.technical_owner_id,
            'technical_owner': self.technical_owner.full_name if self.technical_owner else None,
            'project_name': self.project_name,
            'environment': self.environment,
            'notes': self.notes,
            'override_power_state': self.override_power_state,
            'override_cluster': self.override_cluster,
            'override_hostname': self.override_hostname,
            'override_os_type': self.override_os_type,
            'override_os_family': self.override_os_family,
            'manual_power_state': self.manual_power_state,
            'manual_cluster_name': self.manual_cluster_name,
            'manual_hostname': self.manual_hostname,
            'manual_os_type': self.manual_os_type,
            'manual_os_family': self.manual_os_family,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'updated_by': self.updated_by
        }


class VMTag(db.Model):
    """VM tags"""
    __tablename__ = 'vm_tag'
    
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    vm_id = db.Column(db.BigInteger, db.ForeignKey('vm.id', ondelete='CASCADE'), index=True)
    tag_value = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_by = db.Column(db.Text)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'vm_id': self.vm_id,
            'tag_value': self.tag_value,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'created_by': self.created_by
        }


class VMIpManual(db.Model):
    """Manual IP addresses"""
    __tablename__ = 'vm_ip_manual'
    
    id = db.Column(db.BigInteger, primary_key=True)
    vm_id = db.Column(db.BigInteger, db.ForeignKey('vm.id', ondelete='CASCADE'), nullable=False)
    ip_address = db.Column(db.String(50), nullable=False)
    label = db.Column(db.String(255))
    is_primary = db.Column(db.Boolean, nullable=False, default=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_by = db.Column(db.Text)
    
    __table_args__ = (db.UniqueConstraint('vm_id', 'ip_address'),)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'vm_id': self.vm_id,
            'ip_address': self.ip_address,
            'label': self.label,
            'is_primary': self.is_primary,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'created_by': self.created_by
        }


class VMCustomField(db.Model):
    """Custom VM fields"""
    __tablename__ = 'vm_custom_field'
    
    vm_id = db.Column(db.BigInteger, db.ForeignKey('vm.id', ondelete='CASCADE'), primary_key=True)
    field_key = db.Column(db.String(100), primary_key=True)
    field_value = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    updated_by = db.Column(db.Text)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'vm_id': self.vm_id,
            'field_key': self.field_key,
            'field_value': self.field_value,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'updated_by': self.updated_by
        }
