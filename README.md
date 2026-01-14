# VM Inventory Management Platform (VMI)

A comprehensive web platform for managing VM inventory across Nutanix and VMware platforms with user authentication, ownership tracking, change detection, and manual override capabilities.

## Features

- **Multi-Platform Support**: Sync VMs from both Nutanix and VMware via n8n webhook
- **Change Tracking**: Automatically detect and log changes in power state, CPU, memory, disk, network, and placement
- **Advanced IP Management**:
  - Intelligent sync preserves valid IPs when 169.x.x.x (APIPA) addresses are detected
  - Manual IP overrides take precedence over detected IPs
  - Support for adding/editing IPs on any network interface
- **Dashboard Analytics**:
  - Real-time platform distribution stats
  - Comprehensive Network Statistics (Total, In Use, Not In Use)
  - Change history and power state summary
- **Enhanced Inventory**:
  - Custom column visibility toggle
  - Filter by Name, IP, UUID, Owner, or Network
  - "First Available IP" and Tag badges directly in the list
- **User Management**: Role-based access control (admin, viewer)
- **Owner Management**: Track business and technical owners for VMs
- **Forced Password Reset**: Default admin requires password reset on first login
- **Session Management**: 30-minute inactive timeout, 1-day maximum session

## Technology Stack

- **Backend**: Flask (Python 3.11)
- **Frontend**: React + Vite
- **Database**: PostgreSQL 15
- **Containerization**: Docker Compose

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Port 3000, 5000, and 5432 available

### Start the Application

```bash
# Clone or navigate to project directory
cd VMI

# Start all services
docker-compose up -d

# Wait for services to start (about 30 seconds)
docker-compose logs -f
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api

### Default Login

- **Username**: `admin`
- **Password**: `Admin@123`

> ⚠️ You will be required to reset the password on first login.

## Development Setup

### Backend (without Docker)

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Set environment variables
set DATABASE_URL=postgresql://vmi_user:vmi_secret_2024@localhost:5432/vmi_db
set SECRET_KEY=your-dev-secret-key

# Run the application
python run.py
```

### Frontend (without Docker)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/reset-password` - Reset password

### Users (Admin only)
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Owners
- `GET /api/owners` - List owners
- `POST /api/owners` - Create owner (Admin)
- `PUT /api/owners/:id` - Update owner (Admin)
- `DELETE /api/owners/:id` - Delete owner (Admin)

### VMs
- `GET /api/vms` - List VMs (with filters)
- `GET /api/vms/:id` - Get VM details
- `GET /api/vms/summary` - Get VM statistics
- `PUT /api/vms/:id/manual` - Update manual fields (Admin)
- `POST /api/vms/:id/tags` - Add tag (Admin)
- `DELETE /api/vms/:id/tags/:key` - Remove tag (Admin)

### Sync (Admin only)
- `POST /api/sync/nutanix` - Sync Nutanix VMs
- `POST /api/sync/vmware` - Sync VMware VMs
- `POST /api/sync/all` - Sync all platforms
- `GET /api/sync/runs` - List sync runs
- `GET /api/sync/status` - Get sync status

### Changes
- `GET /api/changes` - List all changes
- `GET /api/changes/summary` - Get change summary
- `GET /api/changes/vm/:id` - Get VM change history

## Database Schema

The platform uses PostgreSQL with the following main tables:

- `users` - Login users with roles
- `user_sessions` - Session tracking
- `owners` - VM ownership
- `vm` - Master VM table (stable identity)
- `vm_fact` - Platform facts (from sync)
- `vm_nic_fact` / `vm_nic_ip_fact` - Network facts
- `vm_disk_fact` - Disk facts
- `vm_manual` - Manual overrides
- `vm_tag` - Tags
- `vm_ip_manual` - Manual IP addresses
- `vm_custom_field` - Custom fields
- `vm_sync_run` - Sync run audit
- `vm_change_history` - Change tracking

## Configuration

Environment variables (set in `docker-compose.yml`):

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | postgresql://vmi_user:vmi_secret_2024@postgres:5432/vmi_db |
| SECRET_KEY | Flask secret key | (change in production) |
| SESSION_INACTIVE_TIMEOUT | Inactive session timeout (seconds) | 1800 (30 min) |
| SESSION_MAX_AGE | Maximum session age (seconds) | 86400 (1 day) |
| SYNC_API_URL | n8n webhook URL | https://n8n.dishhome.com.np/webhook/... |
| TZ | Container Timezone | Asia/Kathmandu |

## License

Internal use only.
