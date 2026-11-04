# Audit Log — Phase 1

تمت إضافة المرحلة الأولى من سجل العمليات داخل المشروع، وتشمل:

## 1) صفحة جديدة للإدارة
- `src/pages/AdminAuditLog.tsx`
- Route جديد: `/app/admin-audit-log`
- رابط مباشر في القائمة الجانبية وفي الصفحة الرئيسية للأدمن

## 2) API منظمة للقراءة والكتابة
- `src/features/audit/api.ts`
- قراءة من `v_audit_log_readable`
- فلترة حسب:
  - السنة الحالية
  - الفريق
  - الموديول
  - العملية
  - مستوى الأهمية
  - التاريخ
  - البحث الحر

## 3) تسجيل فعلي للعمليات الأهم
تمت إضافة app-side audit logging في:
- `src/features/scoutYears/api.ts`
  - إنشاء / تحديث سنة
  - تعيين السنة الحالية
  - نسخ الهيكل
  - نسخ الترمات والمواعيد
  - مزامنة legacy state
- `src/features/scoutYears/adminRosterApi.ts`
  - تحديث عضو داخل السنة الحالية
  - إضافة دور
  - حذف دور
- `src/pages/MyCampCollections.tsx`
  - تسجيل دفعة
  - تغيير حالة المشاركة
- `src/pages/CampInstallmentDetails.tsx`
  - تسجيل دفعة
  - تغيير حالة المشاركة

## 4) إصلاحات إضافية
- تثبيت `AdminSecretary.tsx`
- تثبيت `TeamStatistics.tsx`

## ملاحظة
تعتمد الصفحة على وجود:
- `audit_log` بعد تطوير الجدول
- `v_audit_log_readable`

كما تم الاتفاق سابقًا في SQL.
