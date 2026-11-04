# Release 77 — Evaluation Status Flag

## تم
- إضافة Flag في جدول تقييم الفريق يوضح أن الشخص تم تقييمه.
- إضافة نفس الـFlag في جدول تقييمات الأدمن.
- الـFlag يظهر فقط عند وجود قيمة فعلية في:
  - ملاحظات إيجابية.
  - ملاحظات سلبية.
  - Voice Note محفوظة وغير محذوفة.
- لا يظهر الـFlag لمجرد وجود صف تقييم فارغ.
- تحديث حالة الـFlag مباشرة بعد حفظ الملاحظات.
- تحديث حالة الـFlag مباشرة بعد إضافة أو حذف Voice Note من داخل Popup التقييم.

## نطاق التعديل
- `src/pages/LegionEvaluations.tsx`
- `src/pages/AdminEvaluations.tsx`
- `src/features/evaluations/TermVoiceNotes.tsx`

## Safety
- لا يوجد SQL جديد.
- لا يوجد تغيير في الصلاحيات.
- لا يوجد تغيير في RLS.
- لا يوجد تغيير في أسئلة التقييم المخفية مؤقتًا.
- لا يوجد تغيير في حساب الحضور/الغياب.

## Build note
Local build could not be verified in this container because `vite` is not available in `node_modules/.bin`.
Run locally:

```bash
npm install
npm run build
```
