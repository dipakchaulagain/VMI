-- VMI Database Schema
-- Run order: 001_initial_schema.sql

BEGIN;

-- =========================================
-- 1) USERS TABLE (login-protected users)
-- =========================================
CREATE TABLE IF NOT EXISTS users (
    id                  BIGSERIAL PRIMARY KEY,
    full_name           VARCHAR(255) NOT NULL,
    email               VARCHAR(255) NOT NULL UNIQUE,
    designation         VARCHAR(100),
    department          VARCHAR(100),
    username            VARCHAR(50) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    role                VARCHAR(20) NOT NULL DEFAULT 'viewer',  -- admin / viewer
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_role CHECK (role IN ('admin', 'viewer'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =========================================
-- 2) USER SESSIONS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    is_valid        BOOLEAN NOT NULL DEFAULT TRUE,
    ip_address      VARCHAR(45),
    user_agent      TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash);

-- =========================================
-- 3) OWNERS TABLE (VM ownership)
-- =========================================
CREATE TABLE IF NOT EXISTS owners (
    id              BIGSERIAL PRIMARY KEY,
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    designation     VARCHAR(100),
    department      VARCHAR(100),
    user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_owners_email ON owners(email);
CREATE INDEX IF NOT EXISTS idx_owners_user ON owners(user_id);

-- =========================================
-- 4) SYNC RUN AUDIT
-- =========================================
CREATE TABLE IF NOT EXISTS vm_sync_run (
    id              BIGSERIAL PRIMARY KEY,
    platform        VARCHAR(20) NOT NULL,          -- vmware | nutanix
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'RUNNING', -- RUNNING/SUCCESS/FAILED
    vm_count_seen   INT DEFAULT 0,
    details         JSONB                           -- store errors, durations, etc.
);

CREATE INDEX IF NOT EXISTS idx_vm_sync_run_platform_started
ON vm_sync_run(platform, started_at DESC);

-- =========================================
-- 5) MASTER VM TABLE (stable identity + soft delete)
-- =========================================
CREATE TABLE IF NOT EXISTS vm (
    id                  BIGSERIAL PRIMARY KEY,

    -- Stable identity
    platform            VARCHAR(20) NOT NULL,      -- vmware | nutanix
    vm_uuid             VARCHAR(64) NOT NULL,      -- platform UUID
    vm_name             VARCHAR(255) NOT NULL,
    bios_uuid           VARCHAR(64),               -- VMware only (optional)

    -- Soft delete
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMPTZ,
    deleted_by          TEXT,
    delete_reason       TEXT,

    -- Tracking
    first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_sync_run_id    BIGINT REFERENCES vm_sync_run(id),

    -- Optional: a stable "inventory id" you expose to users
    inventory_key       TEXT GENERATED ALWAYS AS (platform || ':' || vm_uuid) STORED,

    UNIQUE (platform, vm_uuid)
);

CREATE INDEX IF NOT EXISTS idx_vm_platform_uuid ON vm(platform, vm_uuid);
CREATE INDEX IF NOT EXISTS idx_vm_name ON vm(vm_name);
CREATE INDEX IF NOT EXISTS idx_vm_is_deleted ON vm(is_deleted);

-- =========================================
-- 6) VM FACTS (platform truth, overwritten on sync)
-- =========================================
CREATE TABLE IF NOT EXISTS vm_fact (
    vm_id               BIGINT PRIMARY KEY REFERENCES vm(id) ON DELETE CASCADE,

    -- Status / placement
    power_state         VARCHAR(20),              -- ON/OFF/SUSPENDED
    hypervisor_type     VARCHAR(20),              -- AHV/ESXi
    cluster_name        VARCHAR(255),
    host_identifier     VARCHAR(255),             -- host ip or hostname

    -- OS
    os_type             VARCHAR(255),
    os_family           VARCHAR(50),
    hostname            VARCHAR(255),

    -- CPU
    total_vcpus         INT,
    num_sockets         INT,
    cores_per_socket    INT,
    vcpus_per_socket    INT,
    threads_per_core    INT,
    cpu_hot_add         BOOLEAN,
    cpu_hot_remove      BOOLEAN,

    -- Memory
    memory_mb           INT,
    mem_hot_add         BOOLEAN,
    mem_hot_add_limit_mb INT,

    -- Storage summary
    total_disks         INT,
    total_disk_gb       NUMERIC(12,2),

    -- Network summary
    total_nics          INT,

    -- Lifecycle (if platform provides)
    creation_date       TIMESTAMPTZ,
    last_update_date    TIMESTAMPTZ,

    -- Raw payload
    raw                 JSONB,

    -- fact timestamp
    fact_updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vm_fact_cluster ON vm_fact(cluster_name);
CREATE INDEX IF NOT EXISTS idx_vm_fact_host ON vm_fact(host_identifier);

-- =========================================
-- 7) NIC FACTS + IP FACTS
-- =========================================
CREATE TABLE IF NOT EXISTS vm_nic_fact (
    id                  BIGSERIAL PRIMARY KEY,
    vm_id               BIGINT NOT NULL REFERENCES vm(id) ON DELETE CASCADE,

    nic_uuid            VARCHAR(64),
    label               VARCHAR(255),
    mac_address         VARCHAR(32),
    nic_type            VARCHAR(50),
    network_name        VARCHAR(255),
    vlan_mode           VARCHAR(50),
    is_connected        BOOLEAN,
    state               VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_vm_nic_fact_vm ON vm_nic_fact(vm_id);
CREATE INDEX IF NOT EXISTS idx_vm_nic_fact_mac ON vm_nic_fact(mac_address);
-- Unique index on vm_id and mac_address (if mac exists)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vm_nic_fact_unique ON vm_nic_fact(vm_id, mac_address) WHERE mac_address IS NOT NULL;

CREATE TABLE IF NOT EXISTS vm_nic_ip_fact (
    nic_id              BIGINT NOT NULL REFERENCES vm_nic_fact(id) ON DELETE CASCADE,
    ip_address          INET NOT NULL,
    ip_type             VARCHAR(50),
    PRIMARY KEY (nic_id, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_vm_nic_ip_fact_ip ON vm_nic_ip_fact(ip_address);

-- =========================================
-- 8) DISK FACTS
-- =========================================
CREATE TABLE IF NOT EXISTS vm_disk_fact (
    id                  BIGSERIAL PRIMARY KEY,
    vm_id               BIGINT NOT NULL REFERENCES vm(id) ON DELETE CASCADE,

    disk_uuid           VARCHAR(64),
    disk_key            VARCHAR(64),
    disk_label          VARCHAR(255),
    device_type         VARCHAR(50),
    adapter_type        VARCHAR(50),

    size_gb             NUMERIC(12,2),

    backing_type        VARCHAR(50),
    backing_path        TEXT,
    storage_name        VARCHAR(255),

    is_image            BOOLEAN,

    scsi_bus            INT,
    scsi_unit           INT
);

CREATE INDEX IF NOT EXISTS idx_vm_disk_fact_vm ON vm_disk_fact(vm_id);

-- =========================================
-- 9) MANUAL VM OVERRIDES
-- =========================================
CREATE TABLE IF NOT EXISTS vm_manual (
    vm_id               BIGINT PRIMARY KEY REFERENCES vm(id) ON DELETE CASCADE,

    -- Ownership / governance
    business_owner_id   BIGINT REFERENCES owners(id) ON DELETE SET NULL,
    technical_owner_id  BIGINT REFERENCES owners(id) ON DELETE SET NULL,
    project_name        VARCHAR(255),
    environment         VARCHAR(50),              -- prod/dev/test/dr

    -- Notes
    notes               TEXT,

    -- Manual override flags
    override_power_state BOOLEAN DEFAULT FALSE,
    override_cluster     BOOLEAN DEFAULT FALSE,
    override_hostname    BOOLEAN DEFAULT FALSE,

    -- Manual values
    manual_power_state  VARCHAR(20),
    manual_cluster_name VARCHAR(255),
    manual_hostname     VARCHAR(255),

    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by          TEXT DEFAULT CURRENT_USER
);

CREATE INDEX IF NOT EXISTS idx_vm_manual_env ON vm_manual(environment);
CREATE INDEX IF NOT EXISTS idx_vm_manual_business_owner ON vm_manual(business_owner_id);

-- =========================================
-- 10) TAGS
-- =========================================
CREATE TABLE IF NOT EXISTS vm_tag (
    id          BIGSERIAL PRIMARY KEY,
    vm_id       BIGINT NOT NULL REFERENCES vm(id) ON DELETE CASCADE,
    tag_value   VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  TEXT DEFAULT CURRENT_USER
);

CREATE INDEX IF NOT EXISTS idx_vm_tag_vm_id ON vm_tag(vm_id);
CREATE INDEX IF NOT EXISTS idx_vm_tag_value ON vm_tag(tag_value);

-- =========================================
-- 11) MANUAL IPs
-- =========================================
CREATE TABLE IF NOT EXISTS vm_ip_manual (
    id              BIGSERIAL PRIMARY KEY,
    vm_id           BIGINT NOT NULL REFERENCES vm(id) ON DELETE CASCADE,
    ip_address      INET NOT NULL,
    label           VARCHAR(255),
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      TEXT DEFAULT CURRENT_USER,
    UNIQUE (vm_id, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_vm_ip_manual_ip ON vm_ip_manual(ip_address);

-- =========================================
-- 12) FLEXIBLE MANUAL FIELDS
-- =========================================
CREATE TABLE IF NOT EXISTS vm_custom_field (
    vm_id       BIGINT NOT NULL REFERENCES vm(id) ON DELETE CASCADE,
    field_key   VARCHAR(100) NOT NULL,
    field_value TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  TEXT DEFAULT CURRENT_USER,
    PRIMARY KEY (vm_id, field_key)
);

-- =========================================
-- 13) VM CHANGE HISTORY
-- =========================================
CREATE TABLE IF NOT EXISTS vm_change_history (
    id              BIGSERIAL PRIMARY KEY,
    vm_id           BIGINT NOT NULL REFERENCES vm(id) ON DELETE CASCADE,
    sync_run_id     BIGINT REFERENCES vm_sync_run(id),
    change_type     VARCHAR(50) NOT NULL,  -- POWER_STATE/CPU/MEMORY/DISK/NIC/IP/HOST/CLUSTER
    field_name      VARCHAR(100) NOT NULL,
    old_value       TEXT,
    new_value       TEXT,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vm_change_history_vm ON vm_change_history(vm_id);
CREATE INDEX IF NOT EXISTS idx_vm_change_history_type ON vm_change_history(change_type);
CREATE INDEX IF NOT EXISTS idx_vm_change_history_changed ON vm_change_history(changed_at DESC);

-- =========================================
-- 14) EFFECTIVE VIEWS
-- =========================================

-- Effective one-row-per-VM
CREATE OR REPLACE VIEW v_vm_effective AS
SELECT
    v.id,
    v.platform,
    v.vm_uuid,
    v.inventory_key,
    v.vm_name,
    v.bios_uuid,

    v.is_deleted,
    v.deleted_at,
    v.deleted_by,
    v.delete_reason,

    v.first_seen_at,
    v.last_seen_at,
    v.last_sync_run_id,

    -- Power state: manual override if enabled else fact
    CASE
        WHEN m.override_power_state THEN m.manual_power_state
        ELSE f.power_state
    END AS power_state,

    -- Cluster: manual override if enabled else fact
    CASE
        WHEN m.override_cluster THEN m.manual_cluster_name
        ELSE f.cluster_name
    END AS cluster_name,

    f.host_identifier,
    f.hypervisor_type,

    -- Hostname: manual override if enabled else fact
    CASE
        WHEN m.override_hostname THEN m.manual_hostname
        ELSE f.hostname
    END AS hostname,

    f.os_type,
    f.os_family,

    -- Ownership (via owner IDs)
    bo.full_name AS business_owner,
    bo.email AS business_owner_email,
    to_owner.full_name AS technical_owner,
    to_owner.email AS technical_owner_email,
    m.project_name,
    m.environment,

    -- Capacity from facts
    f.total_vcpus,
    ROUND((f.memory_mb::NUMERIC / 1024), 2) AS memory_gb,
    f.total_disks,
    f.total_disk_gb,
    f.total_nics,

    f.creation_date,
    f.last_update_date,

    m.notes,

    f.fact_updated_at

FROM vm v
LEFT JOIN vm_fact f ON f.vm_id = v.id
LEFT JOIN vm_manual m ON m.vm_id = v.id
LEFT JOIN owners bo ON bo.id = m.business_owner_id
LEFT JOIN owners to_owner ON to_owner.id = m.technical_owner_id;

-- Effective list of IPs with precedence
CREATE OR REPLACE VIEW v_vm_effective_ips AS
SELECT
    v.id AS vm_id,
    v.inventory_key,
    v.platform,
    v.vm_name,
    ip.ip_address,
    ip.label,
    ip.is_primary,
    ip.source,
    ip.rank
FROM vm v
JOIN (
    SELECT
        vm_id,
        ip_address,
        label,
        is_primary,
        'MANUAL'::TEXT AS source,
        1 AS rank
    FROM vm_ip_manual

    UNION ALL

    SELECT
        n.vm_id,
        i.ip_address,
        n.network_name AS label,
        FALSE AS is_primary,
        'FACT'::TEXT AS source,
        2 AS rank
    FROM vm_nic_fact n
    JOIN vm_nic_ip_fact i ON i.nic_id = n.id
) ip ON ip.vm_id = v.id
WHERE v.is_deleted = FALSE;

-- =========================================
-- 15) DEFAULT ADMIN USER
-- Note: Default admin user is created by init_db.py script
-- with proper bcrypt password hashing.
-- Run: python init_db.py
-- =========================================

COMMIT;
