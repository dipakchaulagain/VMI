from datetime import datetime, timezone
from app import db


class Network(db.Model):
    """Unified network table for VMware and Nutanix networks"""
    __tablename__ = 'networks'
    
    id = db.Column(db.BigInteger, primary_key=True)
    platform = db.Column(db.String(20), nullable=False)  # vmware | nutanix
    network_id = db.Column(db.String(100), nullable=False)  # e.g. "network-18894", subnet UUID
    name = db.Column(db.String(255), nullable=False)  # e.g. "PROD-21-NET"
    vlan_id = db.Column(db.Integer)  # Manually set VLAN ID
    description = db.Column(db.Text)  # Optional description
    last_sync_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        db.UniqueConstraint('platform', 'network_id', name='uq_network_platform_id'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'platform': self.platform,
            'network_id': self.network_id,
            'name': self.name,
            'vlan_id': self.vlan_id,
            'description': self.description,
            'last_sync_at': self.last_sync_at.isoformat() if self.last_sync_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def get_name_by_id(cls, platform, network_id):
        """Get friendly name for a network ID"""
        if not network_id:
            return None
        network = cls.query.filter_by(platform=platform, network_id=network_id).first()
        return network.name if network else None
    
    @classmethod
    def get_vmware_name_mapping(cls):
        """Get all VMware network ID to name mappings as a dict"""
        networks = cls.query.filter_by(platform='vmware').all()
        return {n.network_id: n.name for n in networks}


# Keep VMwareNetwork as alias for backward compatibility
class VMwareNetwork(db.Model):
    """VMware network mapping - maps network IDs to friendly names (Legacy - use Network instead)"""
    __tablename__ = 'vmware_networks'
    
    id = db.Column(db.BigInteger, primary_key=True)
    network_id = db.Column(db.String(100), nullable=False, unique=True)
    name = db.Column(db.String(255), nullable=False)
    last_sync_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    def to_dict(self):
        return {
            'id': self.id,
            'network_id': self.network_id,
            'name': self.name,
            'last_sync_at': self.last_sync_at.isoformat() if self.last_sync_at else None
        }
    
    @classmethod
    def get_name_by_id(cls, network_id):
        """Get friendly name for a network ID"""
        if not network_id:
            return None
        network = cls.query.filter_by(network_id=network_id).first()
        return network.name if network else None
    
    @classmethod
    def get_name_mapping(cls):
        """Get all network ID to name mappings as a dict"""
        networks = cls.query.all()
        return {n.network_id: n.name for n in networks}
