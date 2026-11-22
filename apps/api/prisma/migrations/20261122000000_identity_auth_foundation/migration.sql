ALTER TABLE "users"
    ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "locked_until" TIMESTAMPTZ(6),
    ADD COLUMN "last_login_at" TIMESTAMPTZ(6),
    ADD COLUMN "deactivated_at" TIMESTAMPTZ(6),
    ADD CONSTRAINT "chk_users_failed_login_attempts_nonnegative"
        CHECK ("failed_login_attempts" >= 0);

CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_password_reset_tokens_hash_format"
        CHECK ("token_hash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "uq_password_reset_tokens_token_hash"
    ON "password_reset_tokens" ("token_hash");
CREATE INDEX "idx_password_reset_tokens_user"
    ON "password_reset_tokens" ("user_id");

ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
