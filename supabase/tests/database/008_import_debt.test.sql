begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select ok(not has_function_privilege('anon', 'public.commit_transaction_import(uuid)', 'EXECUTE'), 'anonymous users cannot post imports');
select ok(not has_function_privilege('anon', 'public.rollback_transaction_import(uuid)', 'EXECUTE'), 'anonymous users cannot roll back imports');
select ok(has_function_privilege('authenticated', 'public.commit_transaction_import(uuid)', 'EXECUTE'), 'authenticated users can post owned imports');
select ok(has_function_privilege('authenticated', 'public.rollback_transaction_import(uuid)', 'EXECUTE'), 'authenticated users can roll back owned imports');

insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-000000000001', 'import-one@example.com'),
  ('b0000000-0000-0000-0000-000000000002', 'import-two@example.com');
insert into public.profiles (id, display_name) values
  ('b0000000-0000-0000-0000-000000000001', 'Import One'),
  ('b0000000-0000-0000-0000-000000000002', 'Import Two');
insert into public.expense_categories (id, user_id, name) values
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Imported'),
  ('b1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Private');
insert into public.financial_accounts (id, user_id, name, account_type) values
  ('b2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Loan one', 'loan'),
  ('b2000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Loan two', 'loan');
insert into public.debt_settings (account_id, user_id, apr_basis_points, minimum_payment_cents) values
  ('b2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 1299, 5000),
  ('b2000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 1999, 6000);
insert into public.transaction_import_batches (id, user_id, file_name, row_count) values
  ('b3000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'one.csv', 1),
  ('b3000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'two.csv', 0);
insert into public.transaction_import_rows (
  batch_id, user_id, row_number, transaction_type, amount_cents, occurred_on,
  description, category_id, account_id, fingerprint
) values (
  'b3000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
  1, 'expense', 2500, '2026-08-05', 'Imported lunch',
  'b1000000-0000-0000-0000-000000000001', null, '2026-08-05|expense|2500|imported lunch'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*) from public.transaction_import_batches), 1::bigint, 'import batches are owner isolated');
select is((select count(*) from public.debt_settings), 1::bigint, 'debt settings are owner isolated');
select throws_ok(
  $$select public.commit_transaction_import('b3000000-0000-0000-0000-000000000002')$$,
  'P0001', 'Staged import was not found.', 'a user cannot post another user import'
);
select lives_ok($$select public.commit_transaction_import('b3000000-0000-0000-0000-000000000001')$$, 'owned staged import can be posted');
select is((select count(*) from public.transaction_import_rows where status = 'posted'), 1::bigint, 'posted row records its state');
select is((select count(*) from public.expenses where merchant = 'Imported lunch'), 1::bigint, 'posting creates the ledger expense');
select lives_ok($$select public.rollback_transaction_import('b3000000-0000-0000-0000-000000000001')$$, 'posted import can be rolled back');
select is((select count(*) from public.expenses where merchant = 'Imported lunch'), 0::bigint, 'rollback removes the imported ledger entry');
select throws_ok(
  $$insert into public.debt_settings (account_id, user_id) values ('b2000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001')$$,
  '23503', null, 'debt settings cannot reference another user account'
);

select * from finish();
rollback;
