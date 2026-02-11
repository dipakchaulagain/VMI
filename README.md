# VM Inventory Management Platform (VMI)

A comprehensive web platform for managing VM inventory across Nutanix and VMware platforms with user authentication, ownership tracking, change detection, and manual override capabilities.

## Features

### Core Features
- **Multi-Platform Support**: Sync VMs from both Nutanix and VMware via n8n webhook.
- **Change Tracking**: Automatically detect and log changes in power state, CPU, memory, disk, network, and placement.
- **Audit Logging**: Comprehensive activity log tracking user logins, VM updates, owner changes, and system configuration modifications.
- **Dashboard Analytics**:
  - Real-time platform distribution stats.
  - Comprehensive Network Statistics (Total, In Use, Not In Use).
  - Change history and power state summary.

### Inventory Management
- **Advanced Filtering**: Filter by Name, IP, UUID, Owner, Network, OS Type, OS Family, etc.
- **Tags & Manual Overrides**: Add tags, manually override IP addresses (preserving them across syncs), and update VM details.
- **Quick Actions**: "Quick Assign Technical Owner" directly from the list view (Admin only).
- **Export**: Export filtered inventory to CSV.

### User & Owner Management
- **Role-Based Access Control**: Admin and Viewer roles.
- **Owner Tracking**: Distinct tracking for Business Owner and Technical Owner per VM.
- **Session Management**: Secure session handling with timeouts.

## Technology Stack

- **Backend**: Flask (Python 3.11), SQLAlchemy
- **Frontend**: React + Vite
- **Database**: PostgreSQL 15
- **Containerization**: Docker Compose

## Quick Start

### Prerequisites
- Docker and Docker Compose installed.

### Start the Application
```bash
# Start all services
docker-compose up -d --build
```

### Access
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api

### Default Login
- **Username**: `admin`
- **Password**: `Admin@123` (Reset required on first login)

## Database Schema

The platform uses PostgreSQL with the following main tables:

### Core Identity
- **`users`**: Application users (id, username, password_hash, role, full_name, etc.).
- **`user_sessions`**: Active user sessions.
- **`owners`**: VM owners (id, name, email, department, etc.).

### VM Inventory
- **`vm`**: Master VM table (stable identity).
- **`vm_fact`**: Synced platform data (cpu, memory, power_state, etc.).
- **`vm_manual`**: Manual overrides (technical_owner_id, business_owner_id, notes, etc.).
- **`vm_nic_fact`**: Network interface details.
- **`vm_nic_ip_fact`**: IP addresses associated with NICs.
- **`vm_disk_fact`**: Disk usage details.
- **`vm_tag`**: Custom tags associated with VMs.

### Networking & Sync
- **`vmware_network`**: Mapped VMware networks.
- **`vm_sync_run`**: History of synchronization runs.
- **`vm_change_history`**: Log of detected changes during sync.

### Sub-Systems
- **`audit_logs`**: User activity logs (action, user, resource, details).
- **`site_settings`**: System configuration (sync intervals, etc.).
- **`system_apis`**: Registered external APIs.

## API Endpoints

### Authentication
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Auditing
- `GET /api/audit` - List activity logs
- `GET /api/audit/types` - Get log filter options

### VM Operations
- `GET /api/vms`
- `PUT /api/vms/:id/manual` - Update VM details/owners
- `POST /api/vms/:id/tags`

### Sync Management
- `POST /api/sync/nutanix`
- `POST /api/sync/vmware`
- `POST /api/sync/all`

## License
Internal use only.
