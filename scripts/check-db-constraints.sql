BEGIN;

INSERT INTO users (id, email, password_hash, role)
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'User@Example.com',
    'test-hash',
    'EMPLOYEE'
);

DO $$
BEGIN
    IF NOT (SELECT must_change_password FROM users
            WHERE id = '00000000-0000-4000-8000-000000000001')
       OR (SELECT failed_login_attempts FROM users
           WHERE id = '00000000-0000-4000-8000-000000000001') <> 0 THEN
        RAISE EXCEPTION 'Unexpected identity security defaults';
    END IF;
END $$;

DO $$
BEGIN
    INSERT INTO users (email, password_hash, role)
    VALUES (' user@example.com ', 'test-hash', 'EMPLOYEE');
    RAISE EXCEPTION 'Expected normalized email uniqueness constraint';
EXCEPTION WHEN unique_violation THEN
    NULL;
END $$;

DO $$
BEGIN
    UPDATE users
    SET failed_login_attempts = -1
    WHERE id = '00000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Expected nonnegative login attempts constraint';
EXCEPTION WHEN check_violation THEN
    NULL;
END $$;

DO $$
BEGIN
    UPDATE users
    SET authz_version = 0
    WHERE id = '00000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Expected positive authorization version constraint';
EXCEPTION WHEN check_violation THEN
    NULL;
END $$;

DO $$
BEGIN
    INSERT INTO employees (user_id, employee_code, legal_name, hire_date, last_working_day)
    VALUES (
        '00000000-0000-4000-8000-000000000001',
        'EMP-TEST',
        'Test Employee',
        DATE '2026-04-10',
        DATE '2026-04-09'
    );
    RAISE EXCEPTION 'Expected employment date constraint';
EXCEPTION WHEN check_violation THEN
    NULL;
END $$;

INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
VALUES (
    '00000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    now() + interval '30 minutes'
);

DO $$
BEGIN
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (
        '00000000-0000-4000-8000-000000000001',
        repeat('z', 64),
        now() + interval '30 minutes'
    );
    RAISE EXCEPTION 'Expected password-reset token hash constraint';
EXCEPTION WHEN check_violation THEN
    NULL;
END $$;

DO $$
BEGIN
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (
        '00000000-0000-4000-8000-000000000001',
        repeat('a', 64),
        now() + interval '30 minutes'
    );
    RAISE EXCEPTION 'Expected password-reset token uniqueness constraint';
EXCEPTION WHEN unique_violation THEN
    NULL;
END $$;

DO $$
BEGIN
    INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
    VALUES (
        '00000000-0000-4000-8000-000000000001',
        repeat('z', 64),
        '00000000-0000-4000-8000-000000000002',
        now() + interval '7 days'
    );
    RAISE EXCEPTION 'Expected refresh-token hash constraint';
EXCEPTION WHEN check_violation THEN
    NULL;
END $$;

DO $$
BEGIN
    INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
    VALUES (
        '00000000-0000-4000-8000-000000000099',
        repeat('b', 64),
        '00000000-0000-4000-8000-000000000002',
        now() + interval '7 days'
    );
    RAISE EXCEPTION 'Expected refresh-token user foreign key constraint';
EXCEPTION WHEN foreign_key_violation THEN
    NULL;
END $$;

DO $$
BEGIN
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (
        '00000000-0000-4000-8000-000000000099',
        repeat('c', 64),
        now() + interval '30 minutes'
    );
    RAISE EXCEPTION 'Expected password-reset user foreign key constraint';
EXCEPTION WHEN foreign_key_violation THEN
    NULL;
END $$;

ROLLBACK;
