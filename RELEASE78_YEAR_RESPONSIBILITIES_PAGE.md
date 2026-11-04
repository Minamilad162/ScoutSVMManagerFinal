# Release 78 — Year Responsibilities Page

## تم
- إضافة صفحة جديدة: **مسؤوليات السنة**.
- إضافة Route: `/app/year-responsibilities`.
- إضافة الصفحة في الـsidebar للأدمن فقط.
- إضافة Shortcut في الصفحة الرئيسية للإدارة.
- إضافة Events/تنظيمات من نفس الصفحة.
- عرض الشيفات/القادة أصحاب الأكونتات فقط من السنة الحالية.
- فلترة بالشخص، الفريق، حالة التكليف، والـEvent المختار.
- Assignment لأكتر من شخص على نفس الـEvent.
- الشخص الواحد ممكن يتكلف في أكتر من Event.
- Flag واضح للشخص الذي لم يتم تكليفه في أي Event قبل كده.
- Bulk assign / bulk remove للنتائج الظاهرة.

## SQL جديد
شغّل الملف:

```sql
supabase/13_year_responsibilities.sql
```

## جداول جديدة
- `year_responsibility_events`
- `year_responsibility_assignments`

## حماية
- قراءة البيانات لأي authenticated user.
- الإضافة/التعديل/الحذف للأدمن فقط.
- منع تكليف Equipiers أو أعضاء بدون login account.
- منع اختلاف سنة التكليف عن سنة الـEvent.

## بدون تغيير
- لا تغيير في منطق التقييمات.
- لا تغيير في المحاضر.
- لا تغيير في إدارة السنة الحالية.
- لا تغيير في صلاحيات الصفحات القديمة.
