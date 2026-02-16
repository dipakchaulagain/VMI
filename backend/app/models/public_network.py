from datetime import datetime, timezone
from app import db

class VMPublicNetwork(db.Model):
    """Public Network details for a VM (SNAT/DNAT)"""
    __tablename__ = 'vm_public_network'

    vm_id = db.Column(db.BigInteger, db.ForeignKey('vm.id', ondelete='CASCADE'), primary_key=True)
    
    snat_ip = db.Column(db.String(50))
    dnat_ip = db.Column(db.String(50))
    dnat_exposed_ports = db.Column(db.Text)  # Comma separated list or description
    dnat_source_region = db.Column(db.String(100)) # e.g. "Global", "NP", "US"
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    updated_by = db.Column(db.Text)

    def to_dict(self):
        return {
            'vm_id': self.vm_id,
            'snat_ip': self.snat_ip,
            'dnat_ip': self.dnat_ip,
            'dnat_exposed_ports': self.dnat_exposed_ports,
            'dnat_source_region': self.dnat_source_region,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'updated_by': self.updated_by
        }
