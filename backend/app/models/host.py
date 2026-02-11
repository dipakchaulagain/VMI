from datetime import datetime, timezone
from app import db


class Host(db.Model):
    """Hypervisor/Host information from VMware ESXi and Nutanix"""
    __tablename__ = 'hosts'
    
    id = db.Column(db.BigInteger, primary_key=True)
    platform = db.Column(db.String(20), nullable=False)  # vmware | nutanix
    host_id = db.Column(db.String(100), nullable=False)  # Platform-specific ID
    hostname = db.Column(db.String(255), nullable=False)
    hypervisor_ip = db.Column(db.String(50))
    hypervisor_name = db.Column(db.String(255))  # ESXi version or Nutanix version
    cpu_model = db.Column(db.String(255))
    cpu_cores_physical = db.Column(db.Integer, default=0)
    ram_gb = db.Column(db.Integer, default=0)
    last_sync_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        db.UniqueConstraint('platform', 'host_id', name='uq_host_platform_id'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'platform': self.platform,
            'host_id': self.host_id,
            'hostname': self.hostname,
            'hypervisor_ip': self.hypervisor_ip,
            'hypervisor_name': self.hypervisor_name,
            'cpu_model': self.cpu_model,
            'cpu_cores_physical': self.cpu_cores_physical,
            'ram_gb': self.ram_gb,
            'last_sync_at': self.last_sync_at.isoformat() if self.last_sync_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
