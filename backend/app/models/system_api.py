from datetime import datetime, timezone
from app import db

class SystemApi(db.Model):
    """Configuration for external system APIs (webhooks, sync endpoints)"""
    __tablename__ = 'system_api'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    method = db.Column(db.String(10), default='POST')
    headers = db.Column(db.JSON)
    payload = db.Column(db.JSON)
    response_schema = db.Column(db.JSON) # Expected response format for documentation/validation
    
    # Resource type identifies what this API is used for
    # enum: vmware_host, nutanix_host, vmware_vm, nutanix_vm, etc.
    resource_type = db.Column(db.String(50), nullable=False)
    
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'url': self.url,
            'method': self.method,
            'headers': self.headers,
            'payload': self.payload,
            'response_schema': self.response_schema,
            'resource_type': self.resource_type,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
