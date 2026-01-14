import os
from datetime import timedelta

class Config:
    """Base configuration"""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-me')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-me')
    
    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 
        'postgresql://vmi_user:vmi_secret_2024@localhost:5432/vmi_db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Session settings
    SESSION_INACTIVE_TIMEOUT = int(os.environ.get('SESSION_INACTIVE_TIMEOUT', 1800))  # 30 min
    SESSION_MAX_AGE = int(os.environ.get('SESSION_MAX_AGE', 86400))  # 1 day
    
    # External API
    SYNC_API_URL = os.environ.get('SYNC_API_URL', 
        'https://n8n.dishhome.com.np/webhook/bd89be2a-7de0-4c1c-acd4-56f2b7077daf')


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
