# Release 31 — Camp Collections Multi Chef Access Fix

## الهدف
حل مشكلة ظهور صفحة `/app/my-camp-collections` لشخص واحد فقط عندما يكون هناك أكثر من `Chef de legion` على نفس الفريق.

## المشكلة
كانت القائمة الجانبية تعرض صفحة **تحصيل المعسكرات** فقط عندما يكون المستخدم هو `collector_member_id` داخل جدول `camp_installment_teams`.
لذلك إذا كان هناك 2 `Chef de legion` على نفس الفريق، يظهر الرابط للشخص المختار كمسؤول تحصيل مباشر فقط، ولا يظهر للـ Chef الآخر رغم أنه على نفس الفريق.

## ما تم تعديله

### 1. `src/components/SideNav.tsx`
- تم تغيير منطق إظهار رابط **تحصيل المعسكرات**.
- الرابط يظهر الآن إذا كان المستخدم:
  - هو مسؤول التحصيل المباشر `collector_member_id`، أو
  - لديه دور `chef_de_legion` على فريق موجود في `camp_installment_teams`، أو
  - لديه دور `responsable_finance` على فريق موجود في `camp_installment_teams`.

### 2. `src/pages/MyCampCollections.tsx`
- تم دعم تحميل بيانات التحصيل حسب صلاحية الفريق، وليس فقط حسب `collector_member_id`.
- الصفحة الآن تدمج بين:
  - البيانات القادمة من views القديمة `v_my_camp_collections_summary`, `v_my_camp_collection_members`, `v_my_camp_collection_payments`.
  - fallback مباشر من الجداول الأساسية للفريق المسموح للمستخدم به.
- هذا يسمح لأي `Chef de legion` على نفس الفريق بمشاهدة نفس تحصيلات الفريق.
- تم تحديث رسالة Empty State لتوضح أن الظهور يعتمد على إضافة الفريق للمعسكر أو اختيار المستخدم كمسؤول تحصيل.

## SQL
لا يوجد SQL Migration إجباري مضاف في هذه النسخة.

إذا ظهرت البيانات في القائمة ولكن حدث خطأ صلاحيات عند تسجيل دفعة أو تغيير حالة المشاركة، فالمشكلة ستكون من RLS Policies في Supabase وليست من الواجهة. وقتها نحتاج SQL policy منفصل يسمح لـ `chef_de_legion` على نفس `team_id` بالتعامل مع:
- `camp_installment_teams`
- `camp_installment_members`
- `camp_installment_payments`
- RPC: `set_camp_member_participation`

## التحقق
تم تشغيل:

```bash
npm run build
```

والـ build تم بنجاح.
