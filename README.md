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

## Project Architecture

The application follows a modern containerized architecture:

### Frontend (`/frontend`)
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS / Vanilla CSS (project specific)
- **Deployment**: Served via Nginx in a Docker container.
- **Key Components**:
    - **Dashboard**: Visual analytics of VM data.
    - **Inventory**: Data grid with filtering, sorting, and manual edits.
    - **Admin Settings**: User management, System API configuration, and Audit logs.

### Backend (`/backend`)
- **Framework**: Flask (Python 3.11)
- **WSGI Server**: Gunicorn
- **ORM**: SQLAlchemy
- **Authentication**: JWT-based session management (`UserSession` table).
- **Workers**: Handles synchronous API requests and background sync jobs.

### Nginx Reverse Proxy
-   **Role**: Reverse Proxy & SSL Termination.
-   **Routing**:
    -   `/` -> Frontend (`vmi_frontend:3000`)
    -   `/api` -> Backend (`vmi_backend:5000`)
-   **Security**: Handles SSL/TLS encryption and redirects HTTP to HTTPS.

### Database (`postgres`)
- **System**: PostgreSQL 15 (Alpine)
- **Persistence**: Validated relational schema with foreign key constraints.

### Services (Docker Compose)
- **`frontend`**: Exposes port `3000`. Connects to backend API.
- **`backend`**: Exposes port `5000`. Connects to PostgreSQL.
- **`postgres`**: Stores all application data.
- **`nginx`**: Public-facing reverse proxy (Ports 80 & 443).

## Technology Stack

- **Backend**: Flask (Python 3.11), SQLAlchemy, Marshmallow
- **Frontend**: React, Vite, Lucide React
- **Database**: PostgreSQL 15
- **Containerization**: Docker Compose

## Quick Start

### Prerequisites
- Docker and Docker Compose installed.

### Configuration

#### 1. SSL Certificates
Create an `ssl` directory in the project root and place your SSL certificates there:
-   `ssl/fullchain.crt`
-   `ssl/privkey.key`

> **Note**: The file names must match what is defined in your Nginx configuration.

#### 2. Nginx Configuration
Copy the example configuration file:
```bash
cp nginx/conf.d/default.conf.example nginx/conf.d/default.conf
```
Edit `nginx/conf.d/default.conf` if you need to change the domain name or certificate paths.

### Start the Application
```bash
# Start all services
docker-compose up -d --build
```

### Access
- **Application**: https://vmi-uat.your-domain.com (or your configured domain)
- **Frontend (Internal)**: Not exposed directly.
- **Backend API (Internal)**: Not exposed directly.

### Default Login
- **Username**: `admin`
- **Password**: `Admin@123` (Reset required on first login)

## Complete Database Structure

The database consists of the following tables and relationships.

### Core Identity & Access

#### `users`
| Column | Type | Details |
|--------|------|---------|
| `id` | BigInteger | Primary Key |
| `username` | String(50) | Unique, Not Null |
| `password_hash` | String(255) | Not Null |
| `full_name` | String(255) | Not Null |
| `email` | String(255) | Unique, Not Null |
| `role` | String(20) | Default: 'viewer' |
| `designation` | String(100) | |
| `department` | String(100) | |
| `is_active` | Boolean | Default: True |
| `must_reset_password` | Boolean | Default: False |
| `last_login_at` | DateTime | |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

#### `user_sessions`
| Column | Type | Details |
|--------|------|---------|
| `id` | BigInteger | Primary Key |
| `user_id` | BigInteger | FK -> `users.id` (Cascade) |
| `token_hash` | String(255) | Unique, Not Null |
| `expires_at` | DateTime | Not Null |
| `is_valid` | Boolean | Default: True |
| `ip_address` | String(45) | |
| `user_agent` | Text | |
| `last_activity` | DateTime | |
| `created_at` | DateTime | |

#### `owners`
| Column | Type | Details |
|--------|------|---------|
| `id` | BigInteger | Primary Key |
| `full_name` | String(255) | Not Null |
| `email` | String(255) | Unique, Not Null |
| `designation` | String(100) | |
| `department` | String(100) | |
| `user_id` | BigInteger | FK -> `users.id` (Set Null) |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

### VM Inventory Data

#### `vm` (Master Table)
| Column | Type | Details |
|--------|------|---------|
| `id` | BigInteger | Primary Key |
| `platform` | String(20) | 'nutanix' or 'vmware', Not Null |
| `vm_uuid` | String(64) | Not Null |
| `vm_name` | String(255) | Not Null |
| `bios_uuid` | String(64) | |
| `is_deleted` | Boolean | Default: False |
| `deleted_at` | DateTime | |
| `deleted_by` | Text | |
| `delete_reason` | Text | |
| `first_seen_at` | DateTime | |
| `last_seen_at` | DateTime | |
| `last_sync_run_id` | BigInteger | FK -> `vm_sync_run.id` |
| **Constraint** | Unique | (`platform`, `vm_uuid`) |

#### `vm_fact` (Synced Platform Data)
| Column | Type | Details |
|--------|------|---------|
| `vm_id` | BigInteger | PK, FK -> `vm.id` (Cascade) |
| `power_state` | String(20) | |
| `hypervisor_type` | String(20) | |
| `cluster_name` | String(255) | |
| `host_identifier` | String(255) | |
| `hostname` | String(255) | |
| `os_type` | String(255) | |
| `os_family` | String(50) | |
| `total_vcpus` | Integer | |
| `num_sockets` | Integer | |
| `cores_per_socket` | Integer | |
| `memory_mb` | Integer | |
| `total_disks` | Integer | |
| `total_disk_gb` | Numeric(12, 2) | |
| `total_nics` | Integer | |
| `creation_date` | DateTime | |
| `last_update_date` | DateTime | |
| `fact_updated_at` | DateTime | |
| `raw` | JSON | Full raw payload |

#### `vm_manual` (User Overrides)
| Column | Type | Details |
|--------|------|---------|
| `vm_id` | BigInteger | PK, FK -> `vm.id` (Cascade) |
| `business_owner_id` | BigInteger | FK -> `owners.id` (Set Null) |
| `technical_owner_id` | BigInteger | FK -> `owners.id` (Set Null) |
| `project_name` | String(255) | |
| `environment` | String(50) | |
| `notes` | Text | |
| `override_power_state` | Boolean | Default: False |
| `manual_power_state` | String(20) | |
| `override_cluster` | Boolean | Default: False |
| `manual_cluster_name`| String(255) | |
| `override_hostname` | Boolean | Default: False |
| `manual_hostname` | String(255) | |
| `override_os_type` | Boolean | Default: False |
| `manual_os_type` | String(100) | |
| `updated_at` | DateTime | |
| `updated_by` | Text | |

#### `vm_nic_fact`
| Column | Type | Details |
|--------|------|---------|
| `id` | BigInteger | Primary Key |
| `vm_id` | BigInteger | FK -> `vm.id` (Cascade) |
| `nic_uuid` | String(64) | |
| `mac_address` | String(32) | |
| `network_name` | String(255) | |
| `is_connected` | Boolean | |
| `state` | String(50) | |
| `vlan_mode` | String(50) | |

#### `vm_nic_ip_fact`
| Column | Type | Details |
|--------|------|---------|
| `nic_id` | BigInteger | PK, FK -> `vm_nic_fact.id` |
| `ip_address` | String(50) | PK |
| `ip_type` | String(50) | |

#### `vm_disk_fact`
| Column | Type | Details |
|--------|------|---------|
| `id` | BigInteger | Primary Key |
| `vm_id` | BigInteger | FK -> `vm.id` (Cascade) |
| `disk_uuid` | String(64) | |
| `disk_label` | String(255) | |
| `size_gb` | Numeric(12, 2) | |
| `storage_name` | String(255) | |
| `backing_type` | String(50) | |

#### `vm_tag`
| Column | Type | Details |
|--------|------|---------|
| `id` | BigInteger | Primary Key |
| `vm_id` | BigInteger | FK -> `vm.id` (Cascade) |
| `tag_value` | String(255) | |
| `created_by` | Text | |

#### `vm_ip_manual`
| Column | Type | Details |
|--------|------|---------|
| `id` | BigInteger | Primary Key |
| `vm_id` | BigInteger | FK -> `vm.id` (Cascade) |
| `ip_address` | String(50) | |
| `is_primary` | Boolean | |
| `label` | String(255) | |

#### `vm_custom_field`
| Column | Type | Details |
|--------|------|---------|
| `vm_id` | BigInteger | PK, FK -> `vm.id` (Cascade) |
| `field_key` | String(100) | PK |
| `field_value` | Text | |

### Hardware & Network Inventory

#### `hosts`
| Column | Type | Details |
|--------|------|---------|
| `id` | BigInteger | Primary Key |
| `platform` | String(20) | |
| `host_id` | String(100) | |
| `hostname` | String(255) | |
| `hypervisor_ip` | String(50) | |
| `hypervisor_name` | String(255) | |
| `cpu_model` | String(255) | |
| `cpu_cores_physical` | Integer | |
| `ram_gb` | Integer | |
| **Constraint** | Unique | (`platform`, `host_id`) |

#### `networks`
| Column | Type | Details |
|--------|------|---------|
| `id` | BigInteger | Primary Key |
| `platform` | String(20) | |
| `network_id` | String(100) | |
| `name` | String(255) | |
| `vlan_id` | Integer | |
| `description` | Text | |
| **Constraint** | Unique | (`platform`, `network_id`) |

### System Configuration & Logging

#### `audit_logs`
| Column | Type | Details |
|--------|------|---------|
| `id` | BigInteger | Primary Key |
| `user_id` | BigInteger | FK -> `users.id` (Set Null) |
| `action` | String(50) | LOGIN, UPDATE, etc. |
| `resource_type` | String(50) | VM, USER, etc. |
| `resource_id` | String(100) | |
| `details` | JSON | |
| `ip_address` | String(45) | |
| `created_at` | DateTime | |

#### `site_settings`
| Column | Type | Details |
|--------|------|---------|
| `id` | Integer | Primary Key |
| `key` | String(100) | Unique |
| `value` | Text | |
| `description` | String(255) | |

#### `system_api`
| Column | Type | Details |
|--------|------|---------|
| `id` | Integer | Primary Key |
| `name` | String(100) | |
| `url` | String(500) | |
| `method` | String(10) | |
| `resource_type` | String(50) | |
| `is_active` | Boolean | |

#### `vm_sync_run`
| Column | Type | Details |
|--------|------|---------|
| `id` | BigInteger | Primary Key |
| `platform` | String(20) | |
| `status` | String(20) | |
| `vm_count_seen` | Integer | |
| `started_at` | DateTime | |
| `finished_at` | DateTime | |

#### `vm_change_history`
| Column | Type | Details |
|--------|------|---------|
| `id` | BigInteger | Primary Key |
| `vm_id` | BigInteger | FK -> `vm.id` (Cascade) |
| `sync_run_id` | BigInteger | FK -> `vm_sync_run.id` |
| `change_type` | String(50) | |
| `field_name` | String(100) | |
| `old_value` | Text | |
| `new_value` | Text | |
| `changed_at` | DateTime | |

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
