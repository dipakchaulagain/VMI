from datetime import datetime, timezone
from app import db
import bcrypt


class User(db.Model):
    """User model for authentication"""
    __tablename__ = 'users'
    
    id = db.Column(db.BigInteger, primary_key=True)
    full_name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    designation = db.Column(db.String(100))
    department = db.Column(db.String(100))
    username = db.Column(db.String(50), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='viewer')
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    must_reset_password = db.Column(db.Boolean, nullable=False, default=False)
    last_login_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    sessions = db.relationship('UserSession', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    owner = db.relationship('Owner', backref='linked_user', uselist=False)
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password):
        """Verify password"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def to_dict(self, include_sensitive=False):
        """Convert to dictionary"""
        data = {
            'id': self.id,
            'full_name': self.full_name,
            'email': self.email,
            'designation': self.designation,
            'department': self.department,
            'username': self.username,
            'role': self.role,
            'is_active': self.is_active,
            'must_reset_password': self.must_reset_password,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        return data


class UserSession(db.Model):
    """User session tracking"""
    __tablename__ = 'user_sessions'
    
    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    token_hash = db.Column(db.String(255), nullable=False, unique=True)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_activity = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    is_valid = db.Column(db.Boolean, nullable=False, default=True)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    
    def is_expired(self, inactive_timeout_seconds, max_age_seconds):
        """Check if session is expired based on inactivity or max age"""
        now = datetime.now(timezone.utc)
        
        # Make dates timezone-aware if they aren't
        created = self.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        
        last_act = self.last_activity
        if last_act.tzinfo is None:
            last_act = last_act.replace(tzinfo=timezone.utc)
        
        expires = self.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        
        # Check max age (1 day)
        if (now - created).total_seconds() > max_age_seconds:
            return True
        
        # Check inactivity (30 minutes)
        if (now - last_act).total_seconds() > inactive_timeout_seconds:
            return True
        
        # Check explicit expiration
        if now > expires:
            return True
        
        return False
    
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = datetime.now(timezone.utc)

