from datetime import datetime, timezone
from app import db


class SiteSettings(db.Model):
    """Site-wide settings including scheduled sync configuration"""
    __tablename__ = 'site_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text)
    description = db.Column(db.String(255))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Default settings keys
    SYNC_ENABLED = 'sync_enabled'
    SYNC_INTERVAL_MINUTES = 'sync_interval_minutes'
    SYNC_LAST_RUN = 'sync_last_run'
    
    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'value': self.value,
            'description': self.description,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def get(cls, key, default=None):
        """Get a setting value by key"""
        setting = cls.query.filter_by(key=key).first()
        return setting.value if setting else default
    
    @classmethod
    def set(cls, key, value, description=None):
        """Set a setting value"""
        setting = cls.query.filter_by(key=key).first()
        if setting:
            setting.value = value
            if description:
                setting.description = description
        else:
            setting = cls(key=key, value=value, description=description)
            db.session.add(setting)
        db.session.commit()
        return setting
    
    @classmethod
    def get_all_as_dict(cls):
        """Get all settings as a dictionary"""
        settings = cls.query.all()
        return {s.key: s.value for s in settings}
    
    @classmethod
    def init_defaults(cls):
        """Initialize default settings if they don't exist"""
        defaults = [
            (cls.SYNC_ENABLED, 'false', 'Enable scheduled sync'),
            (cls.SYNC_INTERVAL_MINUTES, '60', 'Sync interval in minutes'),
            (cls.SYNC_LAST_RUN, None, 'Last sync run timestamp'),
        ]
        for key, value, description in defaults:
            if not cls.query.filter_by(key=key).first():
                db.session.add(cls(key=key, value=value, description=description))
        db.session.commit()
