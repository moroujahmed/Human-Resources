CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "UserRole" AS ENUM (
    'SYSTEM_ADMIN',
    'HR_MANAGER',
    'RECRUITER',
    'LINE_MANAGER',
    'PAYROLL_OFFICER',
    'ASSET_OFFICER',
    'EMPLOYEE'
);

CREATE TYPE "EmployeeStatus" AS ENUM (
    'ONBOARDING',
    'ACTIVE',
    'OFFBOARDING',
    'EXITED'
);

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "authz_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_users_authz_version_positive" CHECK ("authz_version" > 0)
);

CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "employee_code" VARCHAR(40) NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ONBOARDING',
    "hire_date" DATE NOT NULL,
    "last_working_day" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employees_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_employees_last_day_after_hire" CHECK (
        "last_working_day" IS NULL OR "last_working_day" >= "hire_date"
    )
);

CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_refresh_tokens_hash_format" CHECK ("token_hash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "uq_users_email_lower" ON "users" (LOWER(BTRIM("email")));
CREATE INDEX "idx_users_email" ON "users" ("email");
CREATE UNIQUE INDEX "uq_employees_user_id" ON "employees" ("user_id");
CREATE UNIQUE INDEX "uq_employees_employee_code" ON "employees" ("employee_code");
CREATE UNIQUE INDEX "uq_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash");
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens" ("user_id");
CREATE INDEX "idx_refresh_tokens_family" ON "refresh_tokens" ("family_id");
CREATE INDEX "idx_refresh_tokens_user_active"
    ON "refresh_tokens" ("user_id")
    WHERE "revoked_at" IS NULL;

ALTER TABLE "employees"
    ADD CONSTRAINT "employees_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
