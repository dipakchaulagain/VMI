from datetime import datetime, timezone
from app import db

class VMDNSRecord(db.Model):
    """DNS Record details for a VM"""
    __tablename__ = 'vm_dns_record'

    id = db.Column(db.Integer, primary_key=True)
    vm_id = db.Column(db.BigInteger, db.ForeignKey('vm.id', ondelete='CASCADE'), nullable=False)
    
    internal_dns = db.Column(db.String(255))
    external_dns = db.Column(db.String(255))
    ssl_enabled = db.Column(db.Boolean, default=False, nullable=False)
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    updated_by = db.Column(db.Text)

    def to_dict(self):
        return {
            'vm_id': self.vm_id,
            'internal_dns': self.internal_dns,
            'external_dns': self.external_dns,
            'ssl_enabled': self.ssl_enabled,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'updated_by': self.updated_by
        }
