#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting backend entrypoint..."

# Run database migrations
echo "Running database migrations..."
flask db upgrade

# Initialize database (seed admin user)
echo "Initializing database data..."
python init_db.py

# Start Gunicorn
echo "Starting Gunicorn..."
exec gunicorn --bind 0.0.0.0:5000 --workers 4 run:app
