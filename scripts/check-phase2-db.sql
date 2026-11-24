BEGIN;

INSERT INTO users(id,email,password_hash,role,is_active,must_change_password,failed_login_attempts,authz_version)
VALUES
 ('20000000-0000-4000-8000-000000000001','phase2-a@example.invalid','scrypt$test$test','EMPLOYEE',true,false,0,1),
 ('20000000-0000-4000-8000-000000000002','phase2-b@example.invalid','scrypt$test$test','HR_MANAGER',true,false,0,1);

INSERT INTO departments(id,code,name,is_active) VALUES ('20000000-0000-4000-8000-000000000003','P2-TST','Phase 2 Test',true);
INSERT INTO work_schedules(id,name,shift_start_time,shift_end_time,grace_period_minutes,working_days_bitmap,is_default)
VALUES ('20000000-0000-4000-8000-000000000004','Phase 2 Test Schedule','08:00','17:00',15,'{1,2,3,4,5}',false);
INSERT INTO employees(id,user_id,employee_code,legal_name,work_email,phone,department_id,work_schedule_id,hire_date,status,job_title,employment_type)
VALUES
 ('20000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','P2-0001','Phase Two A','phase2-a@example.invalid','+256700000001','20000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000004','2026-01-01','ACTIVE','Tester','FULL_TIME'),
 ('20000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000002','P2-0002','Phase Two B','phase2-b@example.invalid','+256700000002','20000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000004','2026-01-01','ACTIVE','HR Tester','FULL_TIME');

INSERT INTO leave_types(id,code,name,annual_entitlement_days,is_paid,requires_hr_approval,max_carry_over_days)
VALUES ('20000000-0000-4000-8000-000000000007','P2_ANNUAL','Phase 2 Annual',21,true,false,0);

INSERT INTO leave_balances(employee_id,leave_type_id,year,entitled_days,carried_over_days,used_days,pending_days)
VALUES ('20000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000007',2026,21,0,0,0);

INSERT INTO leave_requests(id,employee_id,leave_type_id,start_date,end_date,half_day_period,working_days,reason,status)
VALUES ('20000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000007','2026-11-23','2026-11-24','FULL',2,'Approved overlap fixture','APPROVED');

DO $$
BEGIN
  INSERT INTO leave_requests(employee_id,leave_type_id,start_date,end_date,half_day_period,working_days,reason,status)
  VALUES ('20000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000007','2026-11-24','2026-11-25','FULL',2,'Must overlap','PENDING_MANAGER');
  RAISE EXCEPTION 'Leave overlap constraint did not reject request';
EXCEPTION WHEN exclusion_violation THEN NULL;
END $$;

DO $$
BEGIN
  INSERT INTO leave_requests(employee_id,leave_type_id,start_date,end_date,half_day_period,working_days,reason,status)
  VALUES ('20000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000007','2026-11-25','2026-11-25','MORNING',0.5,'  ','PENDING_MANAGER');
  RAISE EXCEPTION 'Mandatory leave reason constraint did not reject request';
EXCEPTION WHEN check_violation THEN NULL;
END $$;

INSERT INTO assets(id,asset_tag,serial_number,name,category,purchase_value_ugx,condition)
VALUES ('20000000-0000-4000-8000-000000000009','#P2-064','P2-SERIAL','Phase 2 Laptop','LAPTOP',6500000,'GOOD');

INSERT INTO asset_assignments(id,asset_id,employee_id,issued_by_user_id,status,acknowledged_at)
VALUES ('20000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000002','ACKNOWLEDGED',now());

DO $$
BEGIN
  INSERT INTO asset_assignments(asset_id,employee_id,issued_by_user_id,status)
  VALUES ('20000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000002','PENDING_ACKNOWLEDGEMENT');
  RAISE EXCEPTION 'Active asset custody constraint did not reject second assignee';
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

INSERT INTO statutory_tax_policies(
 id,policy_name,effective_from,effective_to,nssf_employee_rate,nssf_employer_rate,
 paye_resident_brackets,paye_non_resident_brackets,lst_tiers,lst_collection_months,
 review_status,legal_source_reference,approved_by_user_id,approved_at,created_by_user_id
) VALUES (
 '20000000-0000-4000-8000-000000000011','Phase 2 Synthetic Policy','2026-01-01','2026-06-30',0.05,0.10,
 '[]','[]','[]','{10}'::SMALLINT[],'APPROVED','Synthetic test fixture',
 '20000000-0000-4000-8000-000000000002',now(),'20000000-0000-4000-8000-000000000001'
);

INSERT INTO attendance_period_locks(id,year,month,locked_by_user_id)
VALUES ('20000000-0000-4000-8000-000000000012',2026,12,'20000000-0000-4000-8000-000000000002')
ON CONFLICT (year,month) DO NOTHING;

INSERT INTO payroll_runs(id,run_code,year,month,policy_id,attendance_lock_id,status,prepared_by_user_id)
VALUES ('20000000-0000-4000-8000-000000000013','P2-2026-12',2026,12,'20000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000012','LOCKED','20000000-0000-4000-8000-000000000002')
ON CONFLICT (year,month) DO NOTHING;

INSERT INTO payroll_items(id,payroll_run_id,employee_id,working_days_in_month,days_present,base_salary_ugx,gross_pay_ugx,nssf_employee_ugx,nssf_employer_ugx,paye_ugx,net_pay_ugx)
VALUES ('20000000-0000-4000-8000-000000000014','20000000-0000-4000-8000-000000000013','20000000-0000-4000-8000-000000000005',22,22,4200000,4200000,210000,420000,0,3990000);

DO $$
BEGIN
  UPDATE payroll_items SET base_salary_ugx = 1 WHERE id = '20000000-0000-4000-8000-000000000014';
  RAISE EXCEPTION 'Locked payroll immutability trigger did not reject mutation';
EXCEPTION WHEN raise_exception THEN NULL;
END $$;

DO $$
BEGIN
  INSERT INTO payroll_runs(run_code,year,month,policy_id,attendance_lock_id,status,prepared_by_user_id,approved_by_user_id)
  VALUES ('P2-SEPARATION',2026,11,'20000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000012','APPROVED','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'Payroll separation-of-duties constraint did not reject request';
EXCEPTION WHEN check_violation THEN NULL;
END $$;

DO $$
BEGIN
  INSERT INTO payslips(payroll_item_id,payslip_number,verification_code,generation_status)
  VALUES ('20000000-0000-4000-8000-000000000014','P2-SLIP-001','P2VERIFY','READY');
  RAISE EXCEPTION 'Payslip READY consistency constraint did not reject incomplete artifact';
EXCEPTION WHEN check_violation THEN NULL;
END $$;

INSERT INTO audit_logs(actor_user_id,actor_role,action,entity_type,entity_id,checksum_sha256)
VALUES ('20000000-0000-4000-8000-000000000001','EMPLOYEE','PHASE2_CONSTRAINT_TEST','TestEntity','20000000-0000-4000-8000-000000000014','0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

DO $$
BEGIN
  UPDATE audit_logs SET action = 'CHANGED' WHERE entity_type = 'TestEntity';
  RAISE EXCEPTION 'Audit immutability trigger did not reject mutation';
EXCEPTION WHEN raise_exception THEN NULL;
END $$;

ROLLBACK;
