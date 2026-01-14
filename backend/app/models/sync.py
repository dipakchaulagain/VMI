from datetime import datetime
from app import db


class VMSyncRun(db.Model):
    """Sync run audit table"""
    __tablename__ = 'vm_sync_run'
    
    id = db.Column(db.BigInteger, primary_key=True)
    platform = db.Column(db.String(20), nullable=False)
    started_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    finished_at = db.Column(db.DateTime(timezone=True))
    status = db.Column(db.String(20), nullable=False, default='RUNNING')
    vm_count_seen = db.Column(db.Integer, default=0)
    details = db.Column(db.JSON)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'platform': self.platform,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'finished_at': self.finished_at.isoformat() if self.finished_at else None,
            'status': self.status,
            'vm_count_seen': self.vm_count_seen,
            'details': self.details
        }


class VMChangeHistory(db.Model):
    """Track VM changes between syncs"""
    __tablename__ = 'vm_change_history'
    
    id = db.Column(db.BigInteger, primary_key=True)
    vm_id = db.Column(db.BigInteger, db.ForeignKey('vm.id', ondelete='CASCADE'), nullable=False)
    sync_run_id = db.Column(db.BigInteger, db.ForeignKey('vm_sync_run.id'))
    change_type = db.Column(db.String(50), nullable=False)
    field_name = db.Column(db.String(100), nullable=False)
    old_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    changed_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    
    # Relationships
    vm = db.relationship('VM', backref='changes')
    sync_run = db.relationship('VMSyncRun', backref='changes')
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'vm_id': self.vm_id,
            'vm_name': self.vm.vm_name if self.vm else None,
            'sync_run_id': self.sync_run_id,
            'change_type': self.change_type,
            'field_name': self.field_name,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'changed_at': self.changed_at.isoformat() if self.changed_at else None
        }
