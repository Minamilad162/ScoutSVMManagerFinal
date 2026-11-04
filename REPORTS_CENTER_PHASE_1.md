# Reports Center — Phase 1

## الهدف
إضافة صفحة **مركز تقارير** واضحة ومنظمة تظهر لـ **Chef de Legion فقط**.

## ما الذي تم؟
- صفحة جديدة: `src/pages/ReportsCenter.tsx`
- API منظمة: `src/features/reports/api.ts`
- Route جديد: `/app/reports-center`
- إضافة اختصار في `SideNav` و `Home` لـ Chef de Legion فقط

## التقارير الحالية
- تقرير الميزانية حسب الترم
- تقرير الحضور حسب الترم
- تقرير المعسكرات والتحصيل
- تقرير الحالات

## Scope
- السنة الكشفية الحالية فقط
- فرق Chef de Legion فقط
- يمكن اختيار فريق محدد + ترم محدد أو كل الترمات
