# RLS Strategy — Row-Level Security for Enterprise RBAC

## Overview

Row-Level Security (RLS) is the database-layer enforcement of the platform's authorization model. It works in concert with the BFF-layer middleware (see ADR-002: Defense in Depth).

## Two Access Patterns

The platform has two distinct access patterns, each with different RLS rules:

### 1. Customer Self-Service Access
Customers access only their own data. RLS enforces `auth_id = auth.uid()`.

```sql
-- Example: customers table
CREATE POLICY customers_read_self
  ON public.customers FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());
```

### 2. Staff Role-Based Access
Staff access data based on their assigned roles and permissions. RLS uses the `has_permission()` helper function.

```sql
-- Example: staff reading customer records
CREATE POLICY customers_read_staff
  ON public.customers FOR SELECT
  TO authenticated
  USING (public.has_permission('customers.read'));
```

## Helper Functions (Migration 00003)

Three SQL functions power RLS decisions:

| Function | Purpose | Returns |
|---|---|---|
| `is_staff()` | Checks if current user is an active staff member | boolean |
| `has_permission(p_permission text)` | Checks if current user has a specific permission | boolean |
| `has_role(p_role_name text)` | Checks if current user has a specific role | boolean |

These functions are `SECURITY DEFINER` (run with the function owner's privileges, not the caller's) so they can query `staff_users` and `staff_role_assignments` even when the calling user doesn't have direct SELECT access to those tables.

## Policy Naming Convention

```
<table>_<action>_<scope>
```

Examples:
- `customers_read_self` — customer reads own record
- `customers_read_staff` — staff reads customer records
- `customers_update_self` — customer updates own record
- `customers_update_staff` — staff updates customer records
- `audit_insert_authenticated` — any authenticated user inserts audit
- `audit_read_staff` — staff with audit.read reads audit log
- `roles_write_super_admin` — super_admin manages roles

## Role → Permission Matrix (Phase 1)

| Permission | super_admin | operations | loan_officer | finance | compliance | customer_support | marketing |
|---|---|---|---|---|---|---|---|
| customers.read | ✅ | ✅ | ✅ | | ✅ | ✅ | ✅ |
| customers.create | ✅ | | | | | | |
| customers.update | ✅ | ✅ | | | | ✅ | |
| customers.delete | ✅ | | | | | | |
| staff.read | ✅ | ✅ | | | | | |
| staff.create | ✅ | | | | | | |
| staff.update | ✅ | | | | | | |
| staff.delete | ✅ | | | | | | |
| roles.read | ✅ | | | | | | |
| roles.create | ✅ | | | | | | |
| roles.update | ✅ | | | | | | |
| roles.delete | ✅ | | | | | | |
| loans.read | ✅ | ✅ | ✅ | ✅ | ✅ | | |
| loans.approve | ✅ | ✅ | ✅ | | | | |
| loans.reject | ✅ | ✅ | ✅ | | | | |
| loans.disburse | ✅ | | | ✅ | | | |
| savings.read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| wallet.read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| ledger.read | ✅ | ✅ | | ✅ | | | |
| audit.read | ✅ | ✅ | | ✅ | ✅ | | |
| audit.export | ✅ | | | | ✅ | | |
| config.read | ✅ | ✅ | | | | | |
| config.update | ✅ | | | | | | |
| compliance.read | ✅ | ✅ | ✅ | | ✅ | ✅ | |
| compliance.update | ✅ | | | | ✅ | | |
| reporting.read | ✅ | ✅ | | ✅ | ✅ | | ✅ |
| reporting.export | ✅ | | | ✅ | | | |

## Service Role Bypass

Supabase's `service_role` key bypasses RLS entirely. This is used for:
- Server-side operations (cron jobs, webhooks, background workers)
- Migrations and schema management
- Administrative operations that need cross-user access

**Rule:** Server-side code using `service_role` MUST go through domain module functions that implement their own authorization checks. Never expose `service_role` queries directly to API routes.

## Scale Consideration (Flagged for CTO)

At 10K users, the `has_permission()` function performs a sub-query join across `staff_users`, `staff_role_assignments`, and `role_permissions` on every RLS check. At 1M+ users with millions of rows, this could become a performance bottleneck.

**Mitigation options (Phase 2+):**
1. Cache the current user's permissions in a JWT custom claim (Supabase supports this via `auth.users.raw_user_meta_data` or a custom trigger).
2. Materialized view of active permissions per staff member.
3. Postgres `SECURITY LABEL` for direct policy matching without function calls.

**Recommendation:** Start with function-based checks (clean, auditable). Move to JWT-claim-based checks if profiling shows RLS as a bottleneck at scale.

## Tables Without RLS (Phase 1)

The following system tables do NOT have RLS enabled:
- `auth.users` — managed by Supabase Auth, not directly accessible
- `auth.sessions` — managed by Supabase Auth

All `public.*` tables created in Phase 1 have RLS enabled.
