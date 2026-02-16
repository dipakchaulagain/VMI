#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting backend entrypoint..."

# Skipping Alembic migrations (Direct schema initialization via init_db.py)

# Initialize database (seed admin user)
echo "Initializing database data..."
python init_db.py

# Start Gunicorn
echo "Starting Gunicorn..."
exec gunicorn --bind 0.0.0.0:5000 --workers 4 --timeout 300 run:app
