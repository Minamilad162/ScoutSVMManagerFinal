# Release 110 — New Year Terms RLS Fix

## Problem
New-year preparation failed while cloning/creating terms with:

`new row violates row-level security policy for table "terms"`

The canonical policies only had a read policy for `terms`; there was no admin write policy.

## Fix
Added migration:

`supabase/19_new_year_terms_rls_fix.sql`

It:
- allows authenticated ScoutSVM admins to insert/update/delete `terms`;
- keeps writes denied to non-admin users;
- adds authenticated read + admin write policies for `term_meeting_dates` when that table exists;
- is safe to run repeatedly.

The year-setup API now also converts raw RLS errors into a clearer admin-facing message.

## Deployment
Run migration 19 in Supabase SQL Editor, then retry **تجهيز السنة**. No data cleanup or recreation is required.

## QA
- Static QA PASS
- TS/TSX transpile PASS
- CSS PASS
- Service Worker syntax PASS
