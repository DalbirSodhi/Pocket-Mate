alter table public.profiles
add column pay_cycle_anchor_date date;

comment on column public.profiles.pay_cycle_anchor_date is
'A known payday used to calculate the active pay cycle and next payday.';
