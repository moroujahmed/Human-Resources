# 03 — StaffHub PostgreSQL 16 Database Schema & Integrity Constraints

## 1. Global Database Standards & Invariants

- **Engine:** PostgreSQL 16 (with `pgcrypto` and `btree_gist` extensions enabled).
- **ORM Mapping:** Defined in `apps/api/prisma/schema.prisma`, paired with custom SQL inside Prisma migrations for **partial unique indexes**, **functional case-insensitive indexes**, **`EXCLUDE USING gist` overlap constraints**, **`CHECK` constraints**, and **immutability triggers**.
- **Primary Keys:** `UUID` (`DEFAULT gen_random_uuid()`).
- **Timestamps & Dates (`Africa/Kampala`):**
  - Event/audit columns use `TIMESTAMPTZ` stored in UTC and evaluated in `Africa/Kampala` (`EAT`, `UTC+3`).
  - Calendar business-day columns (`work_date`, `start_date`, `end_date`, `holiday_date`, `hire_date`, `last_working_day`) use `DATE` interpreted strictly in `Africa/Kampala`.
- **Monetary Precision (`UGX`):** `NUMERIC(14, 2)` for line items and `NUMERIC(16, 2)` for payroll run totals. Floating-point types (`REAL`, `DOUBLE PRECISION`) are strictly forbidden.
- **Retention & No Permanent Deletion:** Core workforce, financial, asset, and audit foreign keys MUST use `ON DELETE RESTRICT`—never `ON DELETE CASCADE`—preventing accidental deletion of employee or payroll history.
- **Encrypted PII Storage:** Sensitive columns (`bank_account_encrypted`, `nin_encrypted`) store `AES-256-GCM` authenticated payloads formatted as `v1:<base64_iv>:<base64_auth_tag>:<base64_ciphertext>`.
- **Optimistic Concurrency Control:** High-contention mutable tables (`employees`, `leave_balances`, `payroll_runs`, `assets`, `offboarding_cases`, `staff_requisitions`, `job_offers`) include `version INTEGER NOT NULL DEFAULT 1`. Updates MUST filter `WHERE id = $1 AND version = $2` and increment `version`.

---

## 2. Database Extensions & PostgreSQL Enumerated Types

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE user_role AS ENUM (
  'SYSTEM_ADMIN',
  'HR_MANAGER',
  'RECRUITER',
  'LINE_MANAGER',
  'PAYROLL_OFFICER',
  'ASSET_OFFICER',
  'EMPLOYEE'
);

CREATE TYPE employee_status AS ENUM (
  'ONBOARDING',
  'ACTIVE',
  'OFFBOARDING',
  'EXITED'
);

CREATE TYPE requisition_status AS ENUM (
  'PENDING_HR',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE vacancy_status AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'CLOSED',
  'FILLED'
);

CREATE TYPE application_status AS ENUM (
  'APPLIED',
  'SHORTLISTED',
  'INTERVIEWING',
  'OFFER_STAGE',
  'HIRED',
  'REJECTED',
  'WITHDRAWN'
);

CREATE TYPE offer_status AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'SENT',
  'ACCEPTED',
  'DECLINED',
  'CONVERTED'
);

CREATE TYPE onboarding_task_role AS ENUM (
  'HR_MANAGER',
  'LINE_MANAGER',
  'EMPLOYEE',
  'ASSET_OFFICER'
);

CREATE TYPE sensitive_change_field AS ENUM (
  'LEGAL_NAME',
  'BANK_DETAILS',
  'NATIONAL_ID_NIN'
);

CREATE TYPE approval_status AS ENUM (
  'PENDING',
  'PENDING_HR',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE attendance_status AS ENUM (
  'PRESENT_ON_TIME',
  'PRESENT_GRACE',
  'LATE',
  'ABSENT',
  'ON_LEAVE',
  'HOLIDAY',
  'DAY_OFF'
);

CREATE TYPE tax_residency AS ENUM (
  'RESIDENT',
  'NON_RESIDENT'
);

CREATE TYPE payroll_run_status AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'LOCKED'
);

CREATE TYPE asset_condition AS ENUM (
  'NEW',
  'GOOD',
  'FAIR',
  'DAMAGED',
  'LOST',
  'RETIRED'
);

CREATE TYPE asset_assignment_status AS ENUM (
  'PENDING_ACKNOWLEDGEMENT',
  'ACKNOWLEDGED',
  'RETURNED',
  'CLOSED_DAMAGED',
  'CLOSED_LOST'
);

CREATE TYPE offboarding_exit_type AS ENUM (
  'RESIGNATION',
  'CONTRACT_EXPIRY',
  'TERMINATION',
  'RETIREMENT'
);

CREATE TYPE offboarding_status AS ENUM (
  'IN_PROGRESS',
  'CLEARED',
  'DEACTIVATED'
);

CREATE TYPE clearance_track_type AS ENUM (
  'ASSET_RETURN',
  'OPERATIONAL_HANDOVER',
  'FINANCE_LOANS',
  'HR_EXIT'
);

CREATE TYPE clearance_status AS ENUM (
  'PENDING',
  'BLOCKED',
  'CLEARED'
);
```

---

## 3. Domain 1: Identity, Authentication & Delegations

### 3.1 `users`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | User account ID |
| `email` | `VARCHAR(255)` | `NOT NULL` | Case-insensitive unique via functional index |
| `password_hash` | `TEXT` | `NOT NULL` | `Argon2id` hash |
| `role` | `user_role` | `NOT NULL` | Primary assigned role |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT true` | Set `false` upon exit deactivation |
| `must_change_password` | `BOOLEAN` | `NOT NULL DEFAULT true` | Enforced on first sign-in or admin reset |
| `failed_login_attempts` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0)` | Brute-force lockout counter |
| `locked_until` | `TIMESTAMPTZ` | `NULL` | Temporary lockout expiration |
| `last_login_at` | `TIMESTAMPTZ` | `NULL` | |
| `deactivated_at` | `TIMESTAMPTZ` | `NULL` | Populated on exit deactivation |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Indexes:**
  - `CREATE UNIQUE INDEX uq_users_email_lower ON users (LOWER(TRIM(email)));`

### 3.2 `refresh_tokens`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | |
| `token_hash` | `CHAR(64)` | `NOT NULL UNIQUE` | SHA-256 hex digest of opaque cookie token |
| `family_id` | `UUID` | `NOT NULL` | Enables token-reuse theft detection |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | 7-day TTL |
| `revoked_at` | `TIMESTAMPTZ` | `NULL` | Revoked on rotation, logout, password reset, or exit |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Indexes:** `CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens (user_id) WHERE revoked_at IS NULL;`

### 3.3 `password_reset_tokens`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | |
| `token_hash` | `CHAR(64)` | `NOT NULL UNIQUE` | Single-use SHA-256 token hash |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | 30-minute TTL |
| `used_at` | `TIMESTAMPTZ` | `NULL` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 3.4 `acting_delegations`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `delegator_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | Manager or HR delegating authority |
| `delegate_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | Acting approver |
| `scope` | `VARCHAR(40)` | `NOT NULL DEFAULT 'LINE_APPROVALS'` | `LINE_APPROVALS`, `HR_APPROVALS` |
| `starts_at` | `TIMESTAMPTZ` | `NOT NULL` | |
| `ends_at` | `TIMESTAMPTZ` | `NOT NULL` | |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT true` | |
| `reason` | `TEXT` | `NOT NULL CHECK (length(trim(reason)) > 0)` | |
| `created_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraints:** `CHECK (delegator_user_id <> delegate_user_id)`, `CHECK (ends_at > starts_at)`

---

## 4. Domain 2: Organization Structure & Configurable Policies

### 4.1 `departments`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `code` | `VARCHAR(24)` | `NOT NULL UNIQUE` | e.g., `FIN-OPS`, `PPL-CUL`, `IT-GOV` |
| `name` | `VARCHAR(120)` | `NOT NULL UNIQUE` | |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT true` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 4.2 `work_schedules`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `name` | `VARCHAR(120)` | `NOT NULL UNIQUE` | e.g., `Kampala Standard Office (Mon–Fri)` |
| `shift_start_time` | `TIME` | `NOT NULL DEFAULT '08:00:00'` | Local `Africa/Kampala` time |
| `shift_end_time` | `TIME` | `NOT NULL DEFAULT '17:00:00'` | Local `Africa/Kampala` time |
| `grace_period_minutes` | `INTEGER` | `NOT NULL DEFAULT 15 CHECK (grace_period_minutes BETWEEN 0 AND 120)` | |
| `working_days_bitmap` | `SMALLINT[]` | `NOT NULL DEFAULT '{1,2,3,4,5}'` | ISO weekdays `1=Mon ... 7=Sun` |
| `is_default` | `BOOLEAN` | `NOT NULL DEFAULT false` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 4.3 `public_holidays`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `holiday_date` | `DATE` | `NOT NULL UNIQUE` | Calendar date (`Africa/Kampala`) |
| `name` | `VARCHAR(150)` | `NOT NULL` | |
| `year` | `INTEGER` | `NOT NULL` | |
| `created_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 4.4 `statutory_tax_policies`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `policy_name` | `VARCHAR(120)` | `NOT NULL` | e.g., `Uganda FY 2026/27 Statutory Policy` |
| `effective_from` | `DATE` | `NOT NULL` | e.g., `2026-07-01` |
| `effective_to` | `DATE` | `NULL` | `NULL` = currently active |
| `nssf_employee_rate` | `NUMERIC(5,4)` | `NOT NULL DEFAULT 0.0500` | `5%` |
| `nssf_employer_rate` | `NUMERIC(5,4)` | `NOT NULL DEFAULT 0.1000` | `10%` |
| `paye_resident_brackets` | `JSONB` | `NOT NULL` | Array of `{minUgx, maxUgx, baseTaxUgx, rate}` |
| `paye_non_resident_brackets` | `JSONB` | `NOT NULL` | Non-resident monthly bands |
| `lst_tiers` | `JSONB` | `NOT NULL` | Annual LST bands up to `100,000 UGX` |
| `lst_collection_months` | `SMALLINT[]` | `NOT NULL DEFAULT '{7,8,9,10}'` | Jul–Oct (4 equal instalments) |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT true` | |
| `created_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

---

## 5. Domain 3: Immutable Audit Trail & Idempotency

### 5.1 `audit_logs` *(Protected by PostgreSQL Append-Only Trigger)*
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `actor_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | `NULL` for cron/public events |
| `actor_role` | `VARCHAR(40)` | `NOT NULL` | Snapshot at action time |
| `on_behalf_of_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | Populated under acting delegation |
| `action` | `VARCHAR(80)` | `NOT NULL` | e.g., `LEAVE_REJECTED`, `PAYROLL_LOCKED`, `EXPORT_EFT` |
| `entity_type` | `VARCHAR(60)` | `NOT NULL` | e.g., `PayrollRun`, `Employee`, `Asset` |
| `entity_id` | `UUID` | `NULL` | Target primary key |
| `old_values` | `JSONB` | `NULL` | Redacted snapshot |
| `new_values` | `JSONB` | `NULL` | Redacted snapshot |
| `reason` | `TEXT` | `NULL` | Mandatory on rejections, corrections, adjustments |
| `ip_address` | `INET` | `NULL` | |
| `request_id` | `UUID` | `NULL` | Request trace ID |
| `checksum_sha256` | `CHAR(64)` | `NOT NULL` | Integrity digest |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Indexes:**
  - `CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);`
  - `CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);`
  - `CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_user_id, created_at DESC);`

### 5.2 `idempotency_keys`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `key` | `VARCHAR(128)` | `PRIMARY KEY` | Client-supplied UUID |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | |
| `endpoint` | `VARCHAR(150)` | `NOT NULL` | |
| `request_hash` | `CHAR(64)` | `NOT NULL` | SHA-256 of canonical request body |
| `response_status` | `INTEGER` | `NOT NULL` | |
| `response_body` | `JSONB` | `NOT NULL` | Cached deterministic reply |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | 24h TTL |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

---

## 6. Domain 4: Recruitment, Offers & Public Applications

### 6.1 `staff_requisitions`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `requisition_code` | `VARCHAR(30)` | `NOT NULL UNIQUE` | e.g., `REQ-2026-042` |
| `requested_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | Line Manager or HR |
| `department_id` | `UUID` | `NOT NULL REFERENCES departments(id) ON DELETE RESTRICT` | |
| `job_title` | `VARCHAR(150)` | `NOT NULL` | |
| `headcount` | `INTEGER` | `NOT NULL DEFAULT 1 CHECK (headcount >= 1)` | |
| `employment_type` | `VARCHAR(40)` | `NOT NULL` | `FULL_TIME`, `CONTRACT`, `INTERN` |
| `justification` | `TEXT` | `NOT NULL` | |
| `target_start_date` | `DATE` | `NOT NULL` | |
| `status` | `requisition_status` | `NOT NULL DEFAULT 'PENDING_HR'` | |
| `reviewed_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | HR Manager |
| `reviewed_at` | `TIMESTAMPTZ` | `NULL` | |
| `decision_reason` | `TEXT` | `NULL` | Mandatory if `REJECTED` |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 6.2 `vacancies`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `vacancy_code` | `VARCHAR(30)` | `NOT NULL UNIQUE` | e.g., `VAC-2026-042` |
| `requisition_id` | `UUID` | `NOT NULL UNIQUE REFERENCES staff_requisitions(id) ON DELETE RESTRICT` | Must be `APPROVED` |
| `published_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | Recruiter |
| `title` | `VARCHAR(150)` | `NOT NULL` | |
| `location` | `VARCHAR(120)` | `NOT NULL DEFAULT 'Kampala HQ'` | |
| `description` | `TEXT` | `NOT NULL` | |
| `requirements` | `TEXT` | `NOT NULL` | |
| `salary_band_min_ugx` | `NUMERIC(14,2)` | `NULL` | |
| `salary_band_max_ugx` | `NUMERIC(14,2)` | `NULL` | `CHECK (salary_band_max_ugx IS NULL OR salary_band_min_ugx IS NULL OR salary_band_max_ugx >= salary_band_min_ugx)` |
| `closing_at` | `TIMESTAMPTZ` | `NOT NULL` | Enforced in `Africa/Kampala` |
| `status` | `vacancy_status` | `NOT NULL DEFAULT 'DRAFT'` | |
| `published_at` | `TIMESTAMPTZ` | `NULL` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 6.3 `job_applications`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `application_code` | `VARCHAR(30)` | `NOT NULL UNIQUE` | e.g., `APP-84920` |
| `vacancy_id` | `UUID` | `NOT NULL REFERENCES vacancies(id) ON DELETE RESTRICT` | |
| `full_name` | `VARCHAR(150)` | `NOT NULL` | |
| `applicant_email` | `VARCHAR(255)` | `NOT NULL` | Case-insensitive unique per vacancy |
| `phone` | `VARCHAR(40)` | `NOT NULL` | |
| `expected_gross_ugx` | `NUMERIC(14,2)` | `NULL` | |
| `earliest_start_date` | `DATE` | `NULL` | |
| `cover_note` | `TEXT` | `NOT NULL` | |
| `cv_storage_key` | `TEXT` | `NOT NULL` | Private S3/MinIO/R2 key |
| `cv_original_filename` | `VARCHAR(255)` | `NOT NULL` | Sanitized display name |
| `cv_mime_type` | `VARCHAR(100)` | `NOT NULL` | Magic-byte verified |
| `status` | `application_status` | `NOT NULL DEFAULT 'APPLIED'` | |
| `stage_notes` | `TEXT` | `NULL` | |
| `submitted_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **CRITICAL CONSTRAINT:**
```sql
CREATE UNIQUE INDEX uq_application_vacancy_email
  ON job_applications (vacancy_id, LOWER(TRIM(applicant_email)));
```

### 6.4 `interviews`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `application_id` | `UUID` | `NOT NULL REFERENCES job_applications(id) ON DELETE RESTRICT` | |
| `scheduled_at` | `TIMESTAMPTZ` | `NOT NULL` | Kampala EAT |
| `interview_mode` | `VARCHAR(40)` | `NOT NULL` | `IN_PERSON`, `VIDEO_CALL`, `PANEL` |
| `location_or_link` | `VARCHAR(255)` | `NOT NULL` | |
| `interviewer_user_ids` | `UUID[]` | `NOT NULL` | |
| `score` | `NUMERIC(4,2)` | `NULL CHECK (score IS NULL OR (score >= 0 AND score <= 5.00))` | |
| `feedback` | `TEXT` | `NULL` | |
| `outcome` | `VARCHAR(30)` | `NOT NULL DEFAULT 'SCHEDULED'` | `SCHEDULED`, `PASSED`, `FAILED`, `CANCELLED` |
| `created_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 6.5 `job_offers`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `application_id` | `UUID` | `NOT NULL UNIQUE REFERENCES job_applications(id) ON DELETE RESTRICT` | |
| `prepared_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `offered_job_title` | `VARCHAR(150)` | `NOT NULL` | |
| `department_id` | `UUID` | `NOT NULL REFERENCES departments(id) ON DELETE RESTRICT` | |
| `reporting_manager_id` | `UUID` | `NULL` | FK added to `employees(id)` in Part 2 |
| `offered_base_salary_ugx` | `NUMERIC(14,2)` | `NOT NULL CHECK (offered_base_salary_ugx > 0)` | |
| `offered_allowances_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0 CHECK (offered_allowances_ugx >= 0)` | |
| `proposed_start_date` | `DATE` | `NOT NULL` | |
| `offer_expires_at` | `TIMESTAMPTZ` | `NOT NULL` | |
| `status` | `offer_status` | `NOT NULL DEFAULT 'DRAFT'` | |
| `approved_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | HR Manager |
| `approved_at` | `TIMESTAMPTZ` | `NULL` | |
| `decision_reason` | `TEXT` | `NULL` | Required if `REJECTED` |
| `sent_at` | `TIMESTAMPTZ` | `NULL` | |
| `accepted_at` | `TIMESTAMPTZ` | `NULL` | |
| `offer_pdf_storage_key` | `TEXT` | `NULL` | |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraint:** `CHECK (status NOT IN ('APPROVED','SENT','ACCEPTED','CONVERTED') OR approved_by_user_id IS NOT NULL)`

---

## 7. Domain 5: Employee Records, Onboarding, Sensitive Changes & Performance

### 7.1 `employees`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_code` | `VARCHAR(30)` | `NOT NULL UNIQUE` | e.g., `UG-EMP-0518` |
| `user_id` | `UUID` | `NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT` | |
| `converted_from_offer_id` | `UUID` | `NULL UNIQUE REFERENCES job_offers(id) ON DELETE RESTRICT` | 1 offer $\rightarrow$ max 1 employee |
| `legal_name` | `VARCHAR(160)` | `NOT NULL` | |
| `work_email` | `VARCHAR(255)` | `NOT NULL UNIQUE` | |
| `personal_email` | `VARCHAR(255)` | `NULL` | Self-service editable |
| `phone` | `VARCHAR(40)` | `NOT NULL` | Self-service editable |
| `residential_address` | `TEXT` | `NULL` | Self-service editable |
| `emergency_contact_name` | `VARCHAR(150)` | `NULL` | Self-service editable |
| `emergency_contact_phone` | `VARCHAR(40)` | `NULL` | Self-service editable |
| `job_title` | `VARCHAR(150)` | `NOT NULL` | |
| `employment_type` | `VARCHAR(40)` | `NOT NULL` | |
| `department_id` | `UUID` | `NOT NULL REFERENCES departments(id) ON DELETE RESTRICT` | |
| `manager_id` | `UUID` | `NULL REFERENCES employees(id) ON DELETE RESTRICT` | Direct Line Manager |
| `work_schedule_id` | `UUID` | `NOT NULL REFERENCES work_schedules(id) ON DELETE RESTRICT` | |
| `hire_date` | `DATE` | `NOT NULL` | |
| `last_working_day` | `DATE` | `NULL` | Set during offboarding |
| `status` | `employee_status` | `NOT NULL DEFAULT 'ONBOARDING'` | |
| `tax_residency` | `tax_residency` | `NOT NULL DEFAULT 'RESIDENT'` | |
| `base_salary_ugx` | `NUMERIC(14,2)` | `NOT NULL CHECK (base_salary_ugx >= 0)` | Restricted |
| `recurring_allowances_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0 CHECK (recurring_allowances_ugx >= 0)` | Restricted |
| `bank_name` | `VARCHAR(120)` | `NULL` | Restricted |
| `bank_branch` | `VARCHAR(120)` | `NULL` | Restricted |
| `bank_account_encrypted` | `TEXT` | `NULL` | `AES-256-GCM` ciphertext |
| `bank_account_last4` | `CHAR(4)` | `NULL` | Safe masked suffix |
| `nin_encrypted` | `TEXT` | `NULL` | `AES-256-GCM` ciphertext |
| `nin_last4` | `CHAR(4)` | `NULL` | Masked suffix |
| `ura_tin` | `VARCHAR(30)` | `NULL` | Restricted |
| `nssf_number` | `VARCHAR(30)` | `NULL` | Restricted |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraint:** `CHECK (manager_id IS NULL OR manager_id <> id)`

### 7.2 `onboarding_checklists` & `onboarding_tasks`
- **`onboarding_checklists`:** `id (UUID PK)`, `employee_id (UUID UNIQUE NOT NULL REFERENCES employees(id) ON DELETE RESTRICT)`, `status (VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS')`, `completed_at (TIMESTAMPTZ NULL)`, `created_at (TIMESTAMPTZ NOT NULL DEFAULT now())`.
- **`onboarding_tasks`:** `id (UUID PK)`, `checklist_id (UUID NOT NULL REFERENCES onboarding_checklists(id) ON DELETE RESTRICT)`, `assigned_role (onboarding_task_role NOT NULL)`, `assigned_user_id (UUID NULL REFERENCES users(id) ON DELETE RESTRICT)`, `title (VARCHAR(200) NOT NULL)`, `is_completed (BOOLEAN NOT NULL DEFAULT false)`, `completed_by_user_id (UUID NULL REFERENCES users(id) ON DELETE RESTRICT)`, `completed_at (TIMESTAMPTZ NULL)`, `sort_order (INTEGER NOT NULL)`.

### 7.3 `profile_change_requests`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `field_type` | `sensitive_change_field` | `NOT NULL` | `LEGAL_NAME`, `BANK_DETAILS`, `NATIONAL_ID_NIN` |
| `old_value_json` | `JSONB` | `NOT NULL` | Encrypted/masked snapshot |
| `new_value_json` | `JSONB` | `NOT NULL` | Requested update payload |
| `supporting_doc_key` | `TEXT` | `NULL` | Private S3 key |
| `request_reason` | `TEXT` | `NOT NULL CHECK (length(trim(request_reason)) > 0)` | |
| `status` | `approval_status` | `NOT NULL DEFAULT 'PENDING_HR'` | |
| `reviewed_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | HR Manager (`<> employee.user_id`) |
| `reviewed_at` | `TIMESTAMPTZ` | `NULL` | |
| `decision_reason` | `TEXT` | `NULL` | Mandatory if `REJECTED` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 7.4 `performance_reviews`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `reviewer_manager_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `review_period` | `VARCHAR(60)` | `NOT NULL` | e.g., `2026-Q4` |
| `objectives_json` | `JSONB` | `NOT NULL` | Array of objectives + weights |
| `self_assessment` | `TEXT` | `NULL` | |
| `manager_feedback` | `TEXT` | `NULL` | |
| `rating` | `NUMERIC(3,2)` | `NULL CHECK (rating IS NULL OR (rating >= 1.00 AND rating <= 5.00))` | |
| `status` | `VARCHAR(30)` | `NOT NULL DEFAULT 'DRAFT'` | `DRAFT`, `SELF_REVIEW_SUBMITTED`, `COMPLETED` |
| `completed_at` | `TIMESTAMPTZ` | `NULL` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

---

## 8. Deferred Foreign Keys (Post-`employees` Creation)

```sql
ALTER TABLE job_offers
  ADD CONSTRAINT fk_job_offers_reporting_manager
  FOREIGN KEY (reporting_manager_id) REFERENCES employees(id) ON DELETE RESTRICT;
```

---

## 9. Domain 6: Attendance, Corrections & Period Locks

### 9.1 `attendance_records`
*(Strictly zero biometric or GPS latitude/longitude columns.)*
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `work_date` | `DATE` | `NOT NULL` | Calendar working day in `Africa/Kampala` (`EAT`) |
| `schedule_id` | `UUID` | `NOT NULL REFERENCES work_schedules(id) ON DELETE RESTRICT` | Snapshot of active schedule for that date |
| `check_in_at` | `TIMESTAMPTZ` | `NULL` | UTC timestamp of browser check-in |
| `check_out_at` | `TIMESTAMPTZ` | `NULL` | UTC timestamp of browser check-out |
| `worked_minutes` | `INTEGER` | `NULL CHECK (worked_minutes IS NULL OR worked_minutes >= 0)` | Calculated on check-out or correction |
| `status` | `attendance_status` | `NOT NULL` | `PRESENT_ON_TIME`, `PRESENT_GRACE`, `LATE`, `ABSENT`, `ON_LEAVE`, `HOLIDAY`, `DAY_OFF` |
| `is_manual_correction` | `BOOLEAN` | `NOT NULL DEFAULT false` | True if modified by approved correction |
| `notes` | `TEXT` | `NULL` | e.g., EOD reconciliation or approved leave reference |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraints & Indexes:**
  - `UNIQUE (employee_id, work_date)` — **Enforces at most 1 attendance record per employee per working day.**
  - `CHECK (check_out_at IS NULL OR check_in_at IS NOT NULL)` — **Enforces Check-Out ONLY after Check-In.**
  - `CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)` — Prevents invalid negative work time.
  - `CREATE INDEX idx_attendance_work_date ON attendance_records (work_date DESC, status);`

### 9.2 `attendance_correction_requests`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `work_date` | `DATE` | `NOT NULL` | Target working day (`Africa/Kampala`) |
| `attendance_record_id` | `UUID` | `NULL REFERENCES attendance_records(id) ON DELETE RESTRICT` | `NULL` if correcting an `ABSENT` missed check-in |
| `requested_check_in_at` | `TIMESTAMPTZ` | `NOT NULL` | |
| `requested_check_out_at` | `TIMESTAMPTZ` | `NULL` | `CHECK (requested_check_out_at IS NULL OR requested_check_out_at >= requested_check_in_at)` |
| `reason` | `TEXT` | `NOT NULL CHECK (length(trim(reason)) > 0)` | Mandatory explanation |
| `status` | `approval_status` | `NOT NULL DEFAULT 'PENDING'` | `PENDING` $\rightarrow$ `APPROVED` / `REJECTED` |
| `reviewed_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | Line Manager (or active delegate) |
| `reviewed_at` | `TIMESTAMPTZ` | `NULL` | |
| `decision_reason` | `TEXT` | `NULL` | Mandatory if `REJECTED` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 9.3 `attendance_period_locks`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `year` | `INTEGER` | `NOT NULL` | |
| `month` | `SMALLINT` | `NOT NULL CHECK (month BETWEEN 1 AND 12)` | |
| `locked_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | HR Manager or Payroll Officer |
| `locked_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraint:** `UNIQUE (year, month)`

---

## 10. Domain 7: Leave Management & Working-Day Balances

### 10.1 `leave_types`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `code` | `VARCHAR(30)` | `NOT NULL UNIQUE` | `ANNUAL`, `SICK`, `COMPASSIONATE`, `MATERNITY`, `PATERNITY`, `STUDY`, `UNPAID` |
| `name` | `VARCHAR(100)` | `NOT NULL` | |
| `annual_entitlement_days` | `NUMERIC(5,2)` | `NOT NULL DEFAULT 21.00 CHECK (annual_entitlement_days >= 0)` | `0` = uncapped/unpaid |
| `is_paid` | `BOOLEAN` | `NOT NULL DEFAULT true` | Feeds payroll unpaid-day deduction logic |
| `requires_hr_approval` | `BOOLEAN` | `NOT NULL DEFAULT false` | True for special leaves requiring HR stage |
| `hr_approval_threshold_days` | `NUMERIC(5,2)` | `NULL` | e.g., `5.00` (requests `> 5` days route to HR after Manager) |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT true` | |

### 10.2 `leave_balances`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `leave_type_id` | `UUID` | `NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT` | |
| `year` | `INTEGER` | `NOT NULL` | Leave calendar year |
| `entitled_days` | `NUMERIC(5,2)` | `NOT NULL CHECK (entitled_days >= 0)` | |
| `carried_over_days` | `NUMERIC(5,2)` | `NOT NULL DEFAULT 0 CHECK (carried_over_days >= 0)` | |
| `used_days` | `NUMERIC(5,2)` | `NOT NULL DEFAULT 0 CHECK (used_days >= 0)` | Incremented on final `APPROVED` |
| `pending_days` | `NUMERIC(5,2)` | `NOT NULL DEFAULT 0 CHECK (pending_days >= 0)` | Reserved while `PENDING_*` |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | Optimistic lock |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraints:**
  - `UNIQUE (employee_id, leave_type_id, year)`
  - `CHECK (used_days + pending_days <= entitled_days + carried_over_days)` — **Enforces sufficient available balance at the database level.**

### 10.3 `leave_requests`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `leave_type_id` | `UUID` | `NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT` | |
| `start_date` | `DATE` | `NOT NULL` | Inclusive (`Africa/Kampala`) |
| `end_date` | `DATE` | `NOT NULL CHECK (end_date >= start_date)` | Inclusive (`Africa/Kampala`) |
| `working_days` | `NUMERIC(5,2)` | `NOT NULL CHECK (working_days > 0)` | Excludes days-off & Ugandan public holidays |
| `reason` | `TEXT` | `NOT NULL CHECK (length(trim(reason)) > 0)` | Mandatory |
| `handover_employee_id` | `UUID` | `NULL REFERENCES employees(id) ON DELETE RESTRICT` | Optional backup colleague |
| `attachment_key` | `TEXT` | `NULL` | Private S3 key for medical/exam proof |
| `status` | `VARCHAR(30)` | `NOT NULL DEFAULT 'PENDING_MANAGER'` | `PENDING_MANAGER`, `PENDING_HR`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `manager_reviewed_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `manager_reviewed_at` | `TIMESTAMPTZ` | `NULL` | |
| `hr_reviewed_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `hr_reviewed_at` | `TIMESTAMPTZ` | `NULL` | |
| `decision_reason` | `TEXT` | `NULL` | Mandatory if `REJECTED` or HR-revoked |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **CRITICAL POSTGRESQL EXCLUSION CONSTRAINT (Prevents Overlapping Pending or Approved Leave):**
```sql
ALTER TABLE leave_requests
  ADD CONSTRAINT excl_leave_no_overlap
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
  WHERE (status IN ('PENDING_MANAGER', 'PENDING_HR', 'APPROVED'));
```

---

## 11. Domain 8: Payroll (`UGX`), Loans, Adjustments & Verifiable Payslips

### 11.1 `staff_loans`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `loan_reference` | `VARCHAR(40)` | `NOT NULL UNIQUE` | e.g., `LN-2026-008` |
| `description` | `VARCHAR(180)` | `NOT NULL` | Salary Advance / Staff SACCO Loan |
| `principal_ugx` | `NUMERIC(14,2)` | `NOT NULL CHECK (principal_ugx > 0)` | |
| `monthly_installment_ugx` | `NUMERIC(14,2)` | `NOT NULL CHECK (monthly_installment_ugx > 0)` | |
| `remaining_balance_ugx` | `NUMERIC(14,2)` | `NOT NULL CHECK (remaining_balance_ugx >= 0)` | Checked by Offboarding Clearance |
| `status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'ACTIVE'` | `ACTIVE`, `SETTLED` |
| `created_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 11.2 `payroll_runs`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `run_code` | `VARCHAR(30)` | `NOT NULL UNIQUE` | e.g., `PR-UG-2026-11` |
| `year` | `INTEGER` | `NOT NULL` | |
| `month` | `SMALLINT` | `NOT NULL CHECK (month BETWEEN 1 AND 12)` | |
| `policy_id` | `UUID` | `NOT NULL REFERENCES statutory_tax_policies(id) ON DELETE RESTRICT` | Snapshots effective tax policy |
| `attendance_lock_id` | `UUID` | `NOT NULL REFERENCES attendance_period_locks(id) ON DELETE RESTRICT` | Enforces locked attendance input |
| `status` | `payroll_run_status` | `NOT NULL DEFAULT 'DRAFT'` | `DRAFT` $\rightarrow$ `PENDING_APPROVAL` $\rightarrow$ `APPROVED` $\rightarrow$ `LOCKED` |
| `total_gross_ugx` | `NUMERIC(16,2)` | `NOT NULL DEFAULT 0` | |
| `total_nssf_employee_ugx` | `NUMERIC(16,2)` | `NOT NULL DEFAULT 0` | |
| `total_nssf_employer_ugx` | `NUMERIC(16,2)` | `NOT NULL DEFAULT 0` | |
| `total_paye_ugx` | `NUMERIC(16,2)` | `NOT NULL DEFAULT 0` | |
| `total_lst_ugx` | `NUMERIC(16,2)` | `NOT NULL DEFAULT 0` | |
| `total_net_pay_ugx` | `NUMERIC(16,2)` | `NOT NULL DEFAULT 0` | |
| `prepared_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | Payroll Officer |
| `submitted_at` | `TIMESTAMPTZ` | `NULL` | |
| `approved_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | Authorised Approver |
| `approved_at` | `TIMESTAMPTZ` | `NULL` | |
| `locked_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `locked_at` | `TIMESTAMPTZ` | `NULL` | |
| `decision_reason` | `TEXT` | `NULL` | Mandatory if returned to draft |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraints:**
  - `UNIQUE (year, month)`
  - `CHECK (approved_by_user_id IS NULL OR approved_by_user_id <> prepared_by_user_id)` — **Enforces Separation of Duties.**

### 11.3 `payroll_items`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `payroll_run_id` | `UUID` | `NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `working_days_in_month` | `INTEGER` | `NOT NULL` | Locked attendance snapshot |
| `days_present` | `INTEGER` | `NOT NULL` | |
| `paid_leave_days` | `NUMERIC(5,2)` | `NOT NULL DEFAULT 0` | |
| `absent_or_unpaid_days` | `NUMERIC(5,2)` | `NOT NULL DEFAULT 0` | |
| `base_salary_ugx` | `NUMERIC(14,2)` | `NOT NULL` | |
| `allowances_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` | |
| `bonus_or_arrears_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` | |
| `unpaid_deduction_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` | |
| `gross_pay_ugx` | `NUMERIC(14,2)` | `NOT NULL` | |
| `nssf_employee_ugx` | `NUMERIC(14,2)` | `NOT NULL` | `5%` of gross |
| `nssf_employer_ugx` | `NUMERIC(14,2)` | `NOT NULL` | `10%` employer cost |
| `paye_ugx` | `NUMERIC(14,2)` | `NOT NULL` | Calculated from `policy_id` |
| `lst_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` | Local Service Tax |
| `loan_deduction_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` | |
| `other_deductions_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` | |
| `net_pay_ugx` | `NUMERIC(14,2)` | `NOT NULL` | `gross - nssf_emp - paye - lst - loan - other` |
| `notes` | `TEXT` | `NULL` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Constraint:** `UNIQUE (payroll_run_id, employee_id)`

### 11.4 `payroll_adjustments` *(Post-Lock Authorised Corrections)*
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `payroll_item_id` | `UUID` | `NOT NULL REFERENCES payroll_items(id) ON DELETE RESTRICT` | Target locked item |
| `adjustment_type` | `VARCHAR(20)` | `NOT NULL CHECK (adjustment_type IN ('ADDITION', 'DEDUCTION'))` | |
| `category` | `VARCHAR(60)` | `NOT NULL` | e.g., `OVERTIME_ARREARS`, `TAX_CORRECTION` |
| `amount_ugx` | `NUMERIC(14,2)` | `NOT NULL CHECK (amount_ugx > 0)` | |
| `reason` | `TEXT` | `NOT NULL CHECK (length(trim(reason)) > 0)` | Mandatory audit justification |
| `status` | `approval_status` | `NOT NULL DEFAULT 'PENDING'` | `PENDING` $\rightarrow$ `APPROVED` / `REJECTED` |
| `requested_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | Payroll Officer |
| `approved_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | Authorised Approver (`<> requested_by_user_id`) |
| `approved_at` | `TIMESTAMPTZ` | `NULL` | |
| `decision_reason` | `TEXT` | `NULL` | Mandatory if `REJECTED` |
| `applied_in_run_id` | `UUID` | `NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT` | Linked next run when settled |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 11.5 `payslips`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `payroll_item_id` | `UUID` | `NOT NULL UNIQUE REFERENCES payroll_items(id) ON DELETE RESTRICT` | |
| `payslip_number` | `VARCHAR(40)` | `NOT NULL UNIQUE` | e.g., `PAY-202611-0412` |
| `verification_code` | `VARCHAR(32)` | `NOT NULL UNIQUE` | Embedded in QR Code URL |
| `document_sha256` | `CHAR(64)` | `NOT NULL` | Tamper-evidence hash |
| `pdf_storage_key` | `TEXT` | `NOT NULL` | Private S3 key |
| `published_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

---

## 12. Domain 9: Company Asset Custody

### 12.1 `assets`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `asset_tag` | `VARCHAR(30)` | `NOT NULL UNIQUE` | e.g., `#AST-064` |
| `serial_number` | `VARCHAR(100)` | `NULL UNIQUE` | |
| `name` | `VARCHAR(150)` | `NOT NULL` | e.g., `Lenovo ThinkPad T14 Gen 3` |
| `category` | `VARCHAR(60)` | `NOT NULL` | `LAPTOP`, `MONITOR`, `MOBILE`, `VEHICLE`, `BADGE` |
| `purchase_value_ugx` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0 CHECK (purchase_value_ugx >= 0)` | |
| `condition` | `asset_condition` | `NOT NULL DEFAULT 'GOOD'` | |
| `notes` | `TEXT` | `NULL` | |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 12.2 `asset_assignments`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `asset_id` | `UUID` | `NOT NULL REFERENCES assets(id) ON DELETE RESTRICT` | |
| `employee_id` | `UUID` | `NOT NULL REFERENCES employees(id) ON DELETE RESTRICT` | |
| `issued_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | Asset Officer |
| `issued_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |
| `status` | `asset_assignment_status` | `NOT NULL DEFAULT 'PENDING_ACKNOWLEDGEMENT'` | |
| `acknowledged_at` | `TIMESTAMPTZ` | `NULL` | Employee confirmation timestamp |
| `returned_at` | `TIMESTAMPTZ` | `NULL` | |
| `received_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | Asset Officer |
| `return_condition` | `asset_condition` | `NULL` | |
| `incident_notes` | `TEXT` | `NULL` | Mandatory if `DAMAGED` or `LOST` |

- **CRITICAL PARTIAL UNIQUE INDEX (Enforces Max 1 Active Assignee Per Asset):**
```sql
CREATE UNIQUE INDEX uq_asset_single_active_custody
  ON asset_assignments (asset_id)
  WHERE returned_at IS NULL
    AND status IN ('PENDING_ACKNOWLEDGEMENT', 'ACKNOWLEDGED');
```

---

## 13. Domain 10: Offboarding, Clearances & Notifications

### 13.1 `offboarding_cases`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `employee_id` | `UUID` | `NOT NULL UNIQUE REFERENCES employees(id) ON DELETE RESTRICT` | |
| `exit_type` | `offboarding_exit_type` | `NOT NULL` | |
| `notice_date` | `DATE` | `NOT NULL` | |
| `last_working_day` | `DATE` | `NOT NULL CHECK (last_working_day >= notice_date)` | |
| `exit_reason` | `TEXT` | `NOT NULL CHECK (length(trim(exit_reason)) > 0)` | |
| `status` | `offboarding_status` | `NOT NULL DEFAULT 'IN_PROGRESS'` | `IN_PROGRESS` $\rightarrow$ `CLEARED` $\rightarrow$ `DEACTIVATED` |
| `initiated_by_user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE RESTRICT` | HR Manager |
| `finalized_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `finalized_at` | `TIMESTAMPTZ` | `NULL` | |
| `deactivated_at` | `TIMESTAMPTZ` | `NULL` | Set after `last_working_day` |
| `version` | `INTEGER` | `NOT NULL DEFAULT 1` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

### 13.2 `offboarding_clearance_items`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `offboarding_case_id` | `UUID` | `NOT NULL REFERENCES offboarding_cases(id) ON DELETE RESTRICT` | |
| `track_type` | `clearance_track_type` | `NOT NULL` | `ASSET_RETURN`, `OPERATIONAL_HANDOVER`, `FINANCE_LOANS`, `HR_EXIT` |
| `assigned_role` | `user_role` | `NOT NULL` | |
| `status` | `clearance_status` | `NOT NULL DEFAULT 'PENDING'` | `PENDING`, `BLOCKED`, `CLEARED` |
| `blocker_summary` | `TEXT` | `NULL` | e.g., `Unreturned #AST-064 ThinkPad T14` |
| `cleared_by_user_id` | `UUID` | `NULL REFERENCES users(id) ON DELETE RESTRICT` | |
| `cleared_at` | `TIMESTAMPTZ` | `NULL` | |
| `notes` | `TEXT` | `NULL` | |

- **Constraint:** `UNIQUE (offboarding_case_id, track_type)`

### 13.3 `notifications`
| Column | Type | Constraints / Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Recipient |
| `category` | `VARCHAR(40)` | `NOT NULL` | `ACTION_REQUIRED`, `INFO`, `ALERT` |
| `title` | `VARCHAR(180)` | `NOT NULL` | Privacy-safe title |
| `message` | `TEXT` | `NOT NULL` | Zero salary/medical exposure |
| `action_url` | `VARCHAR(255)` | `NULL` | Deep link inside app |
| `entity_type` | `VARCHAR(60)` | `NULL` | |
| `entity_id` | `UUID` | `NULL` | |
| `is_read` | `BOOLEAN` | `NOT NULL DEFAULT false` | |
| `resolved_at` | `TIMESTAMPTZ` | `NULL` | Auto-resolved on completion |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | |

- **Index:** `CREATE INDEX idx_notifications_user_unread ON notifications (user_id, created_at DESC) WHERE is_read = false;`

---

## 14. Database-Level Immutability Triggers

Include these PostgreSQL triggers inside your initial Prisma SQL migration so immutability cannot be bypassed even by direct SQL bugs:

```sql
-- 1. Prevent UPDATE or DELETE on audit_logs (append-only enforcement)
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- 2. Prevent direct UPDATE or DELETE on payroll_items once parent payroll_runs is LOCKED
CREATE OR REPLACE FUNCTION prevent_locked_payroll_item_mutation()
RETURNS TRIGGER AS $$
DECLARE
  parent_status payroll_run_status;
BEGIN
  SELECT status INTO parent_status FROM payroll_runs WHERE id = OLD.payroll_run_id;
  IF parent_status = 'LOCKED' THEN
    RAISE EXCEPTION 'Cannot mutate payroll_items when payroll_run is LOCKED. Use payroll_adjustments.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payroll_items_locked_guard
  BEFORE UPDATE OR DELETE ON payroll_items
  FOR EACH ROW EXECUTE FUNCTION prevent_locked_payroll_item_mutation();
```