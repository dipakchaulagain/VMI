from datetime import datetime
from app import db


class Owner(db.Model):
    """Owner model for VM ownership"""
    __tablename__ = 'owners'
    
    id = db.Column(db.BigInteger, primary_key=True)
    full_name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    designation = db.Column(db.String(100))
    department = db.Column(db.String(100))
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='SET NULL'))
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'full_name': self.full_name,
            'email': self.email,
            'designation': self.designation,
            'department': self.department,
            'user_id': self.user_id,
            'linked_user': self.linked_user.username if self.linked_user else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
