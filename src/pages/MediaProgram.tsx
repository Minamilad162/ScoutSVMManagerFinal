import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'
import { EmptyState } from '../components/ui/EmptyState'

export default function MediaProgram() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHero
        title="الصور والمنهج"
        eyebrow="مركز الوسائط"
        description="وصول سريع ومنظم إلى روابط الصور والمنهج والمواد المرجعية الخاصة بالفريق أو الموسم الحالي."
      />

      <SectionCard title="المحتوى المتاح" description="يمكن لاحقًا ربط هذه الصفحة بروابط Google Drive أو مكتبة وسائط داخلية بشكل أوضح.">
        <EmptyState
          title="لا توجد روابط مضافة بعد"
          description="أضف روابط الصور والمنهج أو المستندات المشتركة هنا ليصل لها المستخدمون بشكل أسرع من مكان واحد واضح."
        />
      </SectionCard>
    </div>
  )
}
