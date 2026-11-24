CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$ BEGIN
    CREATE TYPE "RequisitionStatus" AS ENUM ('PENDING_HR','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "VacancyStatus" AS ENUM ('DRAFT','PUBLISHED','CLOSED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED','SHORTLISTED','INTERVIEWING','OFFERED','REJECTED','OFFER_ACCEPTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "OfferStatus" AS ENUM ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','SENT','ACCEPTED','CONVERTED','EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING','APPROVED','REJECTED','PENDING_HR','PENDING_MANAGER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "TaxResidency" AS ENUM ('RESIDENT','NON_RESIDENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "SensitiveChangeField" AS ENUM ('LEGAL_NAME','BANK_DETAILS','NATIONAL_ID_NIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "OnboardingTaskRole" AS ENUM ('EMPLOYEE','HR_MANAGER','ASSET_OFFICER','LINE_MANAGER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT_ON_TIME','PRESENT_GRACE','LATE','ABSENT','ON_LEAVE','HOLIDAY','DAY_OFF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING_MANAGER','PENDING_HR','APPROVED','REJECTED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT','PENDING_APPROVAL','APPROVED','LOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "AssetCondition" AS ENUM ('NEW','GOOD','FAIR','DAMAGED','LOST','RETIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "AssetAssignmentStatus" AS ENUM ('PENDING_ACKNOWLEDGEMENT','ACKNOWLEDGED','RETURNED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "OffboardingExitType" AS ENUM ('RESIGNATION','CONTRACT_EXPIRY','TERMINATION','RETIREMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "OffboardingStatus" AS ENUM ('IN_PROGRESS','CLEARED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "ClearanceTrackType" AS ENUM ('ASSET_RETURN','OPERATIONAL_HANDOVER','FINANCE_LOANS','HR_EXIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "ClearanceStatus" AS ENUM ('PENDING','BLOCKED','CLEARED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE departments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 code VARCHAR(24) NOT NULL UNIQUE,
 name VARCHAR(120) NOT NULL UNIQUE,
 is_active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE work_schedules (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name VARCHAR(120) NOT NULL UNIQUE,
 shift_start_time TIME NOT NULL DEFAULT '08:00:00',
 shift_end_time TIME NOT NULL DEFAULT '17:00:00',
 grace_period_minutes INTEGER NOT NULL DEFAULT 15 CHECK (grace_period_minutes BETWEEN 0 AND 120),
 working_days_bitmap SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5}',
 is_default BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT chk_work_schedule_valid_bitmap CHECK (
   working_days_bitmap IS NOT NULL AND cardinality(working_days_bitmap) > 0
   AND working_days_bitmap <@ ARRAY[1,2,3,4,5,6,7]::SMALLINT[]
 )
);

INSERT INTO departments(id,code,name,is_active) VALUES ('00000000-0000-4000-8000-000000000101','UNASSIGNED','Unassigned',true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO work_schedules(id,name,shift_start_time,shift_end_time,grace_period_minutes,working_days_bitmap,is_default)
VALUES ('00000000-0000-4000-8000-000000000102','Unassigned Schedule','08:00:00','17:00:00',15,'{1,2,3,4,5}',false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE employees
 ADD COLUMN IF NOT EXISTS converted_from_offer_id UUID,
 ADD COLUMN IF NOT EXISTS work_email VARCHAR(255),
 ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255),
 ADD COLUMN IF NOT EXISTS phone VARCHAR(40) NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS residential_address TEXT,
 ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(150),
 ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(40),
 ADD COLUMN IF NOT EXISTS job_title VARCHAR(150) NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS employment_type VARCHAR(40) NOT NULL DEFAULT 'FULL_TIME',
 ADD COLUMN IF NOT EXISTS department_id UUID,
 ADD COLUMN IF NOT EXISTS manager_id UUID,
 ADD COLUMN IF NOT EXISTS work_schedule_id UUID,
 ADD COLUMN IF NOT EXISTS tax_residency "TaxResidency" NOT NULL DEFAULT 'RESIDENT',
 ADD COLUMN IF NOT EXISTS base_salary_ugx NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (base_salary_ugx >= 0),
 ADD COLUMN IF NOT EXISTS recurring_allowances_ugx NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (recurring_allowances_ugx >= 0),
 ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120),
 ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(120),
 ADD COLUMN IF NOT EXISTS bank_account_encrypted TEXT,
 ADD COLUMN IF NOT EXISTS bank_account_bidx CHAR(64),
 ADD COLUMN IF NOT EXISTS bank_account_last4 CHAR(4),
 ADD COLUMN IF NOT EXISTS nin_encrypted TEXT,
 ADD COLUMN IF NOT EXISTS nin_bidx CHAR(64),
 ADD COLUMN IF NOT EXISTS nin_last4 CHAR(4),
 ADD COLUMN IF NOT EXISTS ura_tin VARCHAR(30),
 ADD COLUMN IF NOT EXISTS nssf_number VARCHAR(30),
 ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

UPDATE employees SET work_email = COALESCE(work_email, (SELECT email FROM users WHERE users.id = employees.user_id));
ALTER TABLE employees ALTER COLUMN work_email SET NOT NULL;
ALTER TABLE employees ALTER COLUMN department_id SET DEFAULT '00000000-0000-4000-8000-000000000101';
ALTER TABLE employees ALTER COLUMN work_schedule_id SET DEFAULT '00000000-0000-4000-8000-000000000102';
UPDATE employees SET department_id = '00000000-0000-4000-8000-000000000101' WHERE department_id IS NULL;
UPDATE employees SET work_schedule_id = '00000000-0000-4000-8000-000000000102' WHERE work_schedule_id IS NULL;
ALTER TABLE employees ALTER COLUMN department_id SET NOT NULL;
ALTER TABLE employees ALTER COLUMN work_schedule_id SET NOT NULL;
ALTER TABLE employees ALTER COLUMN employee_code TYPE VARCHAR(30);
ALTER TABLE employees ALTER COLUMN legal_name TYPE VARCHAR(160);

ALTER TABLE employees
 ADD CONSTRAINT uq_employees_work_email UNIQUE(work_email),
 ADD CONSTRAINT uq_employees_converted_offer UNIQUE(converted_from_offer_id),
 ADD CONSTRAINT uq_employees_bank_account_bidx UNIQUE(bank_account_bidx),
 ADD CONSTRAINT uq_employees_nin_bidx UNIQUE(nin_bidx),
 ADD CONSTRAINT fk_employees_department FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_employees_schedule FOREIGN KEY(work_schedule_id) REFERENCES work_schedules(id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_employees_manager FOREIGN KEY(manager_id) REFERENCES employees(id) ON DELETE RESTRICT,
 ADD CONSTRAINT chk_employees_manager_not_self CHECK(manager_id IS NULL OR manager_id <> id),
 ADD CONSTRAINT chk_employees_bank_bidx_format CHECK(bank_account_bidx IS NULL OR bank_account_bidx ~ '^[0-9a-f]{64}$'),
 ADD CONSTRAINT chk_employees_nin_bidx_format CHECK(nin_bidx IS NULL OR nin_bidx ~ '^[0-9a-f]{64}$');

CREATE TABLE acting_delegations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 delegator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 delegate_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 starts_at TIMESTAMPTZ(6) NOT NULL,
 ends_at TIMESTAMPTZ(6) NOT NULL,
 reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
 is_active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT chk_delegation_users_differ CHECK(delegator_user_id <> delegate_user_id),
 CONSTRAINT chk_delegation_period CHECK(ends_at > starts_at)
);
CREATE INDEX idx_acting_delegations_delegator ON acting_delegations(delegator_user_id,is_active);
CREATE INDEX idx_acting_delegations_delegate ON acting_delegations(delegate_user_id,is_active);

CREATE TABLE public_holidays (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 holiday_date DATE NOT NULL UNIQUE,
 name VARCHAR(150) NOT NULL,
 year INTEGER NOT NULL,
 created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE statutory_tax_policies (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 policy_name VARCHAR(120) NOT NULL,
 effective_from DATE NOT NULL,
 effective_to DATE,
 nssf_employee_rate NUMERIC(5,4) NOT NULL CHECK(nssf_employee_rate >= 0),
 nssf_employer_rate NUMERIC(5,4) NOT NULL CHECK(nssf_employer_rate >= 0),
 paye_resident_brackets JSONB NOT NULL,
 paye_non_resident_brackets JSONB NOT NULL,
 lst_tiers JSONB NOT NULL,
 lst_collection_months SMALLINT[] NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT true,
 review_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK(review_status IN ('DRAFT','APPROVED','RETIRED')),
 legal_source_reference TEXT,
 approved_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 approved_at TIMESTAMPTZ(6),
 created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT chk_policy_dates CHECK(effective_to IS NULL OR effective_to >= effective_from),
 CONSTRAINT chk_approved_tax_policy_complete CHECK(
   review_status <> 'APPROVED' OR (
     length(trim(COALESCE(legal_source_reference,''))) > 0
     AND approved_by_user_id IS NOT NULL
     AND approved_at IS NOT NULL
     AND approved_by_user_id <> created_by_user_id
   )
 )
);

CREATE TABLE audit_logs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 actor_role VARCHAR(40) NOT NULL,
 on_behalf_of_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 action VARCHAR(80) NOT NULL,
 entity_type VARCHAR(60) NOT NULL,
 entity_id UUID,
 old_values JSONB,
 new_values JSONB,
 reason TEXT,
 ip_address INET,
 request_id UUID,
 checksum_sha256 CHAR(64) NOT NULL CHECK(checksum_sha256 ~ '^[0-9a-f]{64}$'),
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type,entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id,created_at DESC);

CREATE TABLE idempotency_keys (
 key VARCHAR(128) NOT NULL,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 endpoint VARCHAR(150) NOT NULL,
 request_hash CHAR(64) NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
 response_status INTEGER NOT NULL,
 response_body JSONB NOT NULL,
 expires_at TIMESTAMPTZ(6) NOT NULL,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,endpoint,key)
);

CREATE TABLE staff_requisitions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 requisition_code VARCHAR(30) NOT NULL UNIQUE,
 requested_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
 job_title VARCHAR(150) NOT NULL,
 headcount INTEGER NOT NULL DEFAULT 1 CHECK(headcount >= 1),
 employment_type VARCHAR(40) NOT NULL,
 justification TEXT NOT NULL,
 target_start_date DATE NOT NULL,
 status "RequisitionStatus" NOT NULL DEFAULT 'PENDING_HR',
 reviewed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 reviewed_at TIMESTAMPTZ(6),
 decision_reason TEXT,
 version INTEGER NOT NULL DEFAULT 1,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT chk_requisition_rejection_reason CHECK(status <> 'REJECTED' OR length(trim(COALESCE(decision_reason,''))) > 0)
);

CREATE TABLE vacancies (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 vacancy_code VARCHAR(30) NOT NULL UNIQUE,
 requisition_id UUID NOT NULL UNIQUE REFERENCES staff_requisitions(id) ON DELETE RESTRICT,
 published_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 title VARCHAR(150) NOT NULL,
 location VARCHAR(120) NOT NULL DEFAULT 'Kampala HQ',
 description TEXT NOT NULL,
 requirements TEXT NOT NULL,
 salary_band_min_ugx NUMERIC(14,2),
 salary_band_max_ugx NUMERIC(14,2),
 closing_at TIMESTAMPTZ(6) NOT NULL,
 status "VacancyStatus" NOT NULL DEFAULT 'DRAFT',
 published_at TIMESTAMPTZ(6),
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT chk_vacancy_salary_band CHECK(salary_band_max_ugx IS NULL OR salary_band_min_ugx IS NULL OR salary_band_max_ugx >= salary_band_min_ugx)
);

CREATE TABLE job_applications (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 application_code VARCHAR(30) NOT NULL UNIQUE,
 vacancy_id UUID NOT NULL REFERENCES vacancies(id) ON DELETE RESTRICT,
 full_name VARCHAR(150) NOT NULL,
 applicant_email VARCHAR(255) NOT NULL,
 phone VARCHAR(40) NOT NULL,
 expected_gross_ugx NUMERIC(14,2),
 earliest_start_date DATE,
 cover_note TEXT NOT NULL,
 cv_storage_key TEXT NOT NULL,
 cv_original_filename VARCHAR(255) NOT NULL,
 cv_mime_type VARCHAR(100) NOT NULL,
 status "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
 stage_notes TEXT,
 submitted_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_application_vacancy_email ON job_applications(vacancy_id,LOWER(BTRIM(applicant_email)));

CREATE TABLE interviews (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE RESTRICT,
 scheduled_at TIMESTAMPTZ(6) NOT NULL,
 interview_mode VARCHAR(40) NOT NULL,
 location_or_link VARCHAR(255) NOT NULL,
 interviewer_user_ids UUID[] NOT NULL,
 score NUMERIC(4,2) CHECK(score IS NULL OR (score >= 0 AND score <= 5)),
 feedback TEXT,
 outcome VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
 created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE job_offers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id UUID NOT NULL UNIQUE REFERENCES job_applications(id) ON DELETE RESTRICT,
 prepared_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 offered_job_title VARCHAR(150) NOT NULL,
 department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
 reporting_manager_id UUID,
 offered_base_salary_ugx NUMERIC(14,2) NOT NULL CHECK(offered_base_salary_ugx > 0),
 offered_allowances_ugx NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(offered_allowances_ugx >= 0),
 proposed_start_date DATE NOT NULL,
 offer_expires_at TIMESTAMPTZ(6) NOT NULL,
 status "OfferStatus" NOT NULL DEFAULT 'DRAFT',
 approved_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 approved_at TIMESTAMPTZ(6),
 decision_reason TEXT,
 sent_at TIMESTAMPTZ(6),
 accepted_at TIMESTAMPTZ(6),
 offer_pdf_storage_key TEXT,
 version INTEGER NOT NULL DEFAULT 1,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT chk_offer_approval_complete CHECK(
   status NOT IN ('APPROVED','SENT','ACCEPTED','CONVERTED') OR approved_by_user_id IS NOT NULL
 ),
 CONSTRAINT chk_offer_rejection_reason CHECK(status <> 'REJECTED' OR length(trim(COALESCE(decision_reason,''))) > 0)
);

ALTER TABLE employees
 ADD CONSTRAINT fk_employees_converted_offer FOREIGN KEY(converted_from_offer_id) REFERENCES job_offers(id) ON DELETE RESTRICT;
ALTER TABLE job_offers
 ADD CONSTRAINT fk_job_offers_reporting_manager FOREIGN KEY(reporting_manager_id) REFERENCES employees(id) ON DELETE RESTRICT;

CREATE TABLE onboarding_checklists (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_id UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE RESTRICT,
 status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
 completed_at TIMESTAMPTZ(6),
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE onboarding_tasks (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 checklist_id UUID NOT NULL REFERENCES onboarding_checklists(id) ON DELETE RESTRICT,
 assigned_role "OnboardingTaskRole" NOT NULL,
 assigned_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 title VARCHAR(200) NOT NULL,
 is_completed BOOLEAN NOT NULL DEFAULT false,
 completed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 completed_at TIMESTAMPTZ(6),
 sort_order INTEGER NOT NULL,
 CONSTRAINT chk_onboarding_task_completion CHECK(
   (is_completed = false AND completed_by_user_id IS NULL AND completed_at IS NULL)
   OR (is_completed = true AND completed_by_user_id IS NOT NULL AND completed_at IS NOT NULL)
 )
);

CREATE TABLE profile_change_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
 field_type "SensitiveChangeField" NOT NULL,
 old_value_json JSONB NOT NULL,
 new_value_json JSONB NOT NULL,
 supporting_doc_key TEXT,
 request_reason TEXT NOT NULL CHECK(length(trim(request_reason)) > 0),
 status "ApprovalStatus" NOT NULL DEFAULT 'PENDING_HR',
 reviewed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 reviewed_at TIMESTAMPTZ(6),
 decision_reason TEXT,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT chk_profile_rejection_reason CHECK(status <> 'REJECTED' OR length(trim(COALESCE(decision_reason,''))) > 0)
);

CREATE TABLE performance_reviews (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
 reviewer_manager_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
 review_period VARCHAR(60) NOT NULL,
 objectives_json JSONB NOT NULL,
 self_assessment TEXT,
 manager_feedback TEXT,
 rating NUMERIC(3,2) CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5)),
 status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SELF_REVIEW_SUBMITTED','COMPLETED')),
 completed_at TIMESTAMPTZ(6),
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE leave_types (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 code VARCHAR(30) NOT NULL UNIQUE,
 name VARCHAR(100) NOT NULL,
 annual_entitlement_days NUMERIC(5,2) NOT NULL CHECK(annual_entitlement_days >= 0),
 is_paid BOOLEAN NOT NULL DEFAULT true,
 requires_hr_approval BOOLEAN NOT NULL DEFAULT false,
 hr_approval_threshold_days NUMERIC(5,2) CHECK(hr_approval_threshold_days IS NULL OR hr_approval_threshold_days >= 0),
 max_carry_over_days NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK(max_carry_over_days >= 0),
 is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE leave_balances (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
 leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
 year INTEGER NOT NULL,
 entitled_days NUMERIC(5,2) NOT NULL CHECK(entitled_days >= 0),
 carried_over_days NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK(carried_over_days >= 0),
 used_days NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK(used_days >= 0),
 pending_days NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK(pending_days >= 0),
 version INTEGER NOT NULL DEFAULT 1,
 updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT uq_leave_balance UNIQUE(employee_id,leave_type_id,year),
 CONSTRAINT chk_leave_balance_reserve CHECK(entitled_days = 0 OR (used_days + pending_days <= entitled_days + carried_over_days))
);

CREATE TABLE leave_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
 leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
 start_date DATE NOT NULL,
 end_date DATE NOT NULL CHECK(end_date >= start_date),
 half_day_period VARCHAR(20) NOT NULL DEFAULT 'FULL' CHECK(half_day_period IN ('FULL','MORNING','AFTERNOON')),
 working_days NUMERIC(5,2) NOT NULL CHECK(working_days > 0),
 reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
 handover_employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
 attachment_key TEXT,
 status "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING_MANAGER',
 manager_reviewed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 manager_reviewed_at TIMESTAMPTZ(6),
 hr_reviewed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 hr_reviewed_at TIMESTAMPTZ(6),
 decision_reason TEXT,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT chk_leave_half_day_single_date CHECK(half_day_period = 'FULL' OR start_date = end_date),
 CONSTRAINT chk_leave_rejection_reason CHECK(status NOT IN ('REJECTED','CANCELLED') OR length(trim(COALESCE(decision_reason,''))) > 0)
);
ALTER TABLE leave_requests
 ADD CONSTRAINT excl_leave_no_overlap
 EXCLUDE USING gist (employee_id WITH =, daterange(start_date,end_date,'[]') WITH &&)
 WHERE (status IN ('PENDING_MANAGER','PENDING_HR','APPROVED'));

CREATE TABLE leave_request_year_allocations (
 leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE RESTRICT,
 year INTEGER NOT NULL,
 working_days NUMERIC(5,2) NOT NULL CHECK(working_days > 0),
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 PRIMARY KEY(leave_request_id,year)
);

CREATE TABLE attendance_records (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
 work_date DATE NOT NULL,
 schedule_id UUID NOT NULL REFERENCES work_schedules(id) ON DELETE RESTRICT,
 check_in_at TIMESTAMPTZ(6),
 check_out_at TIMESTAMPTZ(6),
 worked_minutes INTEGER CHECK(worked_minutes IS NULL OR worked_minutes >= 0),
 leave_days NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK(leave_days IN (0,0.5,1)),
 leave_type_id UUID REFERENCES leave_types(id) ON DELETE RESTRICT,
 leave_request_id UUID,
 status "AttendanceStatus" NOT NULL,
 is_manual_correction BOOLEAN NOT NULL DEFAULT false,
 notes TEXT,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT uq_attendance_employee_day UNIQUE(employee_id,work_date),
 CONSTRAINT chk_attendance_leave_consistency CHECK(
   (leave_days = 0 AND leave_type_id IS NULL AND leave_request_id IS NULL)
   OR (leave_days > 0 AND leave_type_id IS NOT NULL AND leave_request_id IS NOT NULL)
 ),
 CONSTRAINT chk_attendance_checkout_requires_checkin CHECK(check_out_at IS NULL OR check_in_at IS NOT NULL),
 CONSTRAINT chk_attendance_checkout_after_checkin CHECK(check_out_at IS NULL OR check_out_at >= check_in_at)
);
CREATE INDEX idx_attendance_work_date ON attendance_records(work_date DESC,status);
ALTER TABLE attendance_records
 ADD CONSTRAINT fk_attendance_leave_request FOREIGN KEY(leave_request_id) REFERENCES leave_requests(id) ON DELETE RESTRICT;

CREATE TABLE attendance_correction_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
 work_date DATE NOT NULL,
 attendance_record_id UUID REFERENCES attendance_records(id) ON DELETE RESTRICT,
 requested_check_in_at TIMESTAMPTZ(6) NOT NULL,
 requested_check_out_at TIMESTAMPTZ(6),
 reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
 status "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
 reviewed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 reviewed_at TIMESTAMPTZ(6),
 decision_reason TEXT,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT chk_attendance_correction_checkout CHECK(requested_check_out_at IS NULL OR requested_check_out_at >= requested_check_in_at),
 CONSTRAINT chk_attendance_correction_rejection_reason CHECK(status <> 'REJECTED' OR length(trim(COALESCE(decision_reason,''))) > 0)
);

CREATE TABLE attendance_period_locks (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 year INTEGER NOT NULL,
 month SMALLINT NOT NULL CHECK(month BETWEEN 1 AND 12),
 locked_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 locked_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT uq_attendance_period_lock UNIQUE(year,month)
);

CREATE TABLE staff_loans (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
 loan_reference VARCHAR(40) NOT NULL UNIQUE,
 description VARCHAR(180) NOT NULL,
 principal_ugx NUMERIC(14,2) NOT NULL CHECK(principal_ugx > 0),
 monthly_installment_ugx NUMERIC(14,2) NOT NULL CHECK(monthly_installment_ugx > 0),
 remaining_balance_ugx NUMERIC(14,2) NOT NULL CHECK(remaining_balance_ugx >= 0),
 status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SETTLED')),
 version INTEGER NOT NULL DEFAULT 1,
 created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE payroll_runs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 run_code VARCHAR(30) NOT NULL UNIQUE,
 year INTEGER NOT NULL,
 month SMALLINT NOT NULL CHECK(month BETWEEN 1 AND 12),
 policy_id UUID NOT NULL REFERENCES statutory_tax_policies(id) ON DELETE RESTRICT,
 attendance_lock_id UUID NOT NULL REFERENCES attendance_period_locks(id) ON DELETE RESTRICT,
 status "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
 total_gross_ugx NUMERIC(16,2) NOT NULL DEFAULT 0,
 total_nssf_employee_ugx NUMERIC(16,2) NOT NULL DEFAULT 0,
 total_nssf_employer_ugx NUMERIC(16,2) NOT NULL DEFAULT 0,
 total_paye_ugx NUMERIC(16,2) NOT NULL DEFAULT 0,
 total_lst_ugx NUMERIC(16,2) NOT NULL DEFAULT 0,
 total_net_pay_ugx NUMERIC(16,2) NOT NULL DEFAULT 0,
 prepared_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 submitted_at TIMESTAMPTZ(6),
 approved_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 approved_at TIMESTAMPTZ(6),
 locked_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 locked_at TIMESTAMPTZ(6),
 decision_reason TEXT,
 version INTEGER NOT NULL DEFAULT 1,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT uq_payroll_run_period UNIQUE(year,month),
 CONSTRAINT chk_payroll_preparer_approver_differ CHECK(approved_by_user_id IS NULL OR approved_by_user_id <> prepared_by_user_id)
);

CREATE TABLE payroll_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,
 employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
 working_days_in_month INTEGER NOT NULL,
 days_present INTEGER NOT NULL,
 paid_leave_days NUMERIC(5,2) NOT NULL DEFAULT 0,
 absent_or_unpaid_days NUMERIC(5,2) NOT NULL DEFAULT 0,
 base_salary_ugx NUMERIC(14,2) NOT NULL,
 allowances_ugx NUMERIC(14,2) NOT NULL DEFAULT 0,
 bonus_or_arrears_ugx NUMERIC(14,2) NOT NULL DEFAULT 0,
 unpaid_deduction_ugx NUMERIC(14,2) NOT NULL DEFAULT 0,
 gross_pay_ugx NUMERIC(14,2) NOT NULL CHECK(gross_pay_ugx >= 0),
 nssf_employee_ugx NUMERIC(14,2) NOT NULL,
 nssf_employer_ugx NUMERIC(14,2) NOT NULL,
 paye_ugx NUMERIC(14,2) NOT NULL,
 lst_ugx NUMERIC(14,2) NOT NULL DEFAULT 0,
 loan_deduction_ugx NUMERIC(14,2) NOT NULL DEFAULT 0,
 other_deductions_ugx NUMERIC(14,2) NOT NULL DEFAULT 0,
 net_pay_ugx NUMERIC(14,2) NOT NULL CHECK(net_pay_ugx >= 0),
 notes TEXT,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT uq_payroll_item UNIQUE(payroll_run_id,employee_id),
 CONSTRAINT chk_payroll_statutory_no_negative CHECK(nssf_employee_ugx >= 0 AND nssf_employer_ugx >= 0 AND paye_ugx >= 0 AND lst_ugx >= 0)
);

CREATE TABLE payroll_loan_deductions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 payroll_item_id UUID NOT NULL REFERENCES payroll_items(id) ON DELETE RESTRICT,
 staff_loan_id UUID NOT NULL REFERENCES staff_loans(id) ON DELETE RESTRICT,
 deducted_amount_ugx NUMERIC(14,2) NOT NULL CHECK(deducted_amount_ugx > 0),
 balance_before_ugx NUMERIC(14,2) NOT NULL CHECK(balance_before_ugx >= 0),
 balance_after_ugx NUMERIC(14,2) NOT NULL CHECK(balance_after_ugx >= 0),
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT uq_payroll_loan_deduction UNIQUE(payroll_item_id,staff_loan_id)
);

CREATE TABLE payroll_adjustments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 payroll_item_id UUID NOT NULL REFERENCES payroll_items(id) ON DELETE RESTRICT,
 adjustment_type VARCHAR(20) NOT NULL CHECK(adjustment_type IN ('ADDITION','DEDUCTION')),
 category VARCHAR(60) NOT NULL,
 amount_ugx NUMERIC(14,2) NOT NULL CHECK(amount_ugx > 0),
 reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
 status "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
 requested_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 approved_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 approved_at TIMESTAMPTZ(6),
 decision_reason TEXT,
 applied_in_run_id UUID REFERENCES payroll_runs(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT chk_payroll_adjustment_approver CHECK(approved_by_user_id IS NULL OR approved_by_user_id <> requested_by_user_id),
 CONSTRAINT chk_payroll_adjustment_rejection_reason CHECK(status <> 'REJECTED' OR length(trim(COALESCE(decision_reason,''))) > 0)
);

CREATE TABLE payslips (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 payroll_item_id UUID NOT NULL UNIQUE REFERENCES payroll_items(id) ON DELETE RESTRICT,
 payslip_number VARCHAR(40) NOT NULL UNIQUE,
 verification_code VARCHAR(32) NOT NULL UNIQUE,
 document_sha256 CHAR(64),
 pdf_storage_key TEXT,
 generation_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(generation_status IN ('PENDING','GENERATING','READY','FAILED')),
 generation_error_code VARCHAR(80),
 published_at TIMESTAMPTZ(6),
 CONSTRAINT chk_payslip_ready_consistency CHECK(
   generation_status <> 'READY'
   OR (document_sha256 IS NOT NULL AND pdf_storage_key IS NOT NULL AND published_at IS NOT NULL)
 ),
 CONSTRAINT chk_payslip_sha_format CHECK(document_sha256 IS NULL OR document_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE async_outbox (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 event_type VARCHAR(80) NOT NULL,
 aggregate_type VARCHAR(60) NOT NULL,
 aggregate_id UUID NOT NULL,
 idempotency_key VARCHAR(160) NOT NULL UNIQUE,
 payload JSONB NOT NULL DEFAULT '{}'::jsonb,
 status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','COMPLETED','FAILED')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
 available_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 processed_at TIMESTAMPTZ(6),
 last_error_code VARCHAR(80),
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX idx_async_outbox_pending ON async_outbox(available_at,created_at) WHERE status IN ('PENDING','FAILED');

CREATE TABLE assets (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 asset_tag VARCHAR(30) NOT NULL UNIQUE,
 serial_number VARCHAR(100) UNIQUE,
 name VARCHAR(150) NOT NULL,
 category VARCHAR(60) NOT NULL,
 purchase_value_ugx NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(purchase_value_ugx >= 0),
 condition "AssetCondition" NOT NULL DEFAULT 'GOOD',
 notes TEXT,
 version INTEGER NOT NULL DEFAULT 1,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE asset_assignments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
 employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
 issued_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 issued_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 status "AssetAssignmentStatus" NOT NULL DEFAULT 'PENDING_ACKNOWLEDGEMENT',
 acknowledged_at TIMESTAMPTZ(6),
 returned_at TIMESTAMPTZ(6),
 received_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 return_condition "AssetCondition",
 incident_notes TEXT,
 CONSTRAINT chk_asset_assignment_acknowledgement CHECK(
   status <> 'ACKNOWLEDGED' OR acknowledged_at IS NOT NULL
 ),
 CONSTRAINT chk_asset_assignment_return CHECK(
   returned_at IS NULL OR status = 'RETURNED'
 ),
 CONSTRAINT chk_asset_assignment_incident_notes CHECK(
   return_condition IS NULL OR return_condition NOT IN ('DAMAGED','LOST')
   OR length(trim(COALESCE(incident_notes,''))) > 0
 )
);
CREATE UNIQUE INDEX uq_asset_single_active_custody
 ON asset_assignments(asset_id)
 WHERE returned_at IS NULL AND status IN ('PENDING_ACKNOWLEDGEMENT','ACKNOWLEDGED');

CREATE TABLE offboarding_cases (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_id UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE RESTRICT,
 exit_type "OffboardingExitType" NOT NULL,
 notice_date DATE NOT NULL,
 last_working_day DATE NOT NULL,
 exit_reason TEXT NOT NULL CHECK(length(trim(exit_reason)) > 0),
 status "OffboardingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
 initiated_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 finalized_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 finalized_at TIMESTAMPTZ(6),
 deactivated_at TIMESTAMPTZ(6),
 version INTEGER NOT NULL DEFAULT 1,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT chk_offboarding_dates CHECK(last_working_day >= notice_date)
);

CREATE TABLE offboarding_clearance_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 offboarding_case_id UUID NOT NULL REFERENCES offboarding_cases(id) ON DELETE RESTRICT,
 track_type "ClearanceTrackType" NOT NULL,
 assigned_role "UserRole" NOT NULL,
 status "ClearanceStatus" NOT NULL DEFAULT 'PENDING',
 blocker_summary TEXT,
 cleared_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 cleared_at TIMESTAMPTZ(6),
 notes TEXT,
 CONSTRAINT uq_offboarding_clearance_track UNIQUE(offboarding_case_id,track_type),
 CONSTRAINT chk_clearance_blocker_consistency CHECK(
   status <> 'BLOCKED' OR length(trim(COALESCE(blocker_summary,''))) > 0
 )
);

CREATE TABLE notifications (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 category VARCHAR(40) NOT NULL,
 title VARCHAR(180) NOT NULL,
 message TEXT NOT NULL,
 action_url VARCHAR(255),
 entity_type VARCHAR(60),
 entity_id UUID,
 is_read BOOLEAN NOT NULL DEFAULT false,
 resolved_at TIMESTAMPTZ(6),
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id,created_at DESC) WHERE is_read = false;

ALTER TABLE statutory_tax_policies
 ADD CONSTRAINT excl_approved_tax_policy_effective_period
 EXCLUDE USING gist (
   daterange(effective_from,COALESCE(effective_to,'infinity'::date),'[]') WITH &&
 ) WHERE (review_status = 'APPROVED');

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
 RAISE EXCEPTION 'audit_logs is append-only and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE OR REPLACE FUNCTION prevent_locked_payroll_item_mutation()
RETURNS TRIGGER AS $$
DECLARE parent_status "PayrollRunStatus";
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
