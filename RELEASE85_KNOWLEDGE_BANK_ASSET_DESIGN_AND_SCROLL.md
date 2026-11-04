# Release 85 — Knowledge Bank Asset Design and Chat Scroll

## تم
- تركيب صفحة بنك المعرفة باستخدام الصور/الأصول الجاهزة بدل الرسومات المصنوعة بالـCSS فقط.
- إضافة خلفية المعسكر/الجبال/الشجر كصورة فعلية داخل الصفحة.
- إضافة طبقة بانوراما شفافة أسفل الصفحة للعمق البصري.
- إضافة شخصية الكشاف الكاريكاتير كصورة فعلية مستقلة يمكن تحريكها وتكبيرها وتصغيرها بدون دمجها في الخلفية.
- إضافة صورة البوصلة داخل الكارت الجانبي.
- إضافة علامة الكشافة داخل العنوان والكارت الجانبي.
- إضافة اللافتة الخشبية كصورة مستقلة بجانب شخصية الكشاف.
- ضبط منطقة الشات لتكون بارتفاع ثابت.
- ضبط رسائل الشات لتعمل Scroll داخلي بدل زيادة طول الصفحة مع كل رسالة.
- الحفاظ على نفس Guardrails والصلاحيات والمنطق السابق لبنك المعرفة.

## Assets الجديدة
تمت إضافة الصور تحت:

```text
public/knowledge/camp-background.png
public/knowledge/camp-panorama.png
public/knowledge/scout-boy.png
public/knowledge/scout-boy-presenting.png
public/knowledge/compass.png
public/knowledge/scout-emblem.png
public/knowledge/signpost.png
```

## ملاحظات
- لا يوجد SQL جديد.
- لا يوجد تغيير في الصلاحيات.
- لا يوجد تغيير في منطق إجابات بنك المعرفة.
- تم الحفاظ على الـSide Navigation الحالي وعدم إضافة top menu داخل صفحة بنك المعرفة.

## Build
محاولة `npm run build` توقفت في البيئة الحالية بسبب عدم وجود `vite` داخل `node_modules/.bin`.
