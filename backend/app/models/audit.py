from datetime import datetime, timezone
from app import db

class AuditLog(db.Model):
    """Audit log for user activities"""
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    username = db.Column(db.String(255))  # Snapshot in case user is deleted
    action = db.Column(db.String(50), nullable=False)  # LOGIN, UPDATE, CREATE, DELETE
    resource_type = db.Column(db.String(50))  # VM, USER, OWNER, SYSTEM
    resource_id = db.Column(db.String(100))
    details = db.Column(db.JSON)
    ip_address = db.Column(db.String(45))
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user = db.relationship('User', backref=db.backref('audit_logs', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.username,
            'action': self.action,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'details': self.details,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
