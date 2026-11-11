import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/ui/EmptyState'
import { InlineAlert } from '../components/ui/InlineAlert'
import { PageHero } from '../components/ui/PageHero'
import { PageLoader } from '../components/ui/PageLoader'
import { SectionCard } from '../components/ui/SectionCard'
import { useScoutYear } from '../components/ScoutYearProvider'
import { BestChefCard } from '../features/bestChefs/BestChefCard'
import { fetchBestChefsGallery, type BestChefGallerySection } from '../features/bestChefs/api'
import { getErrorMessage, logError } from '../lib/errors'

function termDateRangeLabel(start?: string | null, end?: string | null) {
  if (!start && !end) return null
  const fmt = (value?: string | null) => {
    if (!value) return '—'
    try {
      return new Date(value).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return value
    }
  }
  return `${fmt(start)} — ${fmt(end)}`
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

export default function BestChefsGallery() {
  const nav = useNavigate()
  const { currentScoutYear } = useScoutYear()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sections, setSections] = useState<BestChefGallerySection[]>([])

  useEffect(() => {
    const yearId = currentScoutYear?.id ?? null
    let cancelled = false
    setSections([])
    setError(null)
    if (!yearId) {
      setLoading(false)
      return
    }
    setLoading(true)
    void fetchBestChefsGallery(yearId)
      .then((rows) => {
        if (!cancelled) setSections(rows)
      })
      .catch((err) => {
        if (cancelled) return
        logError('BestChefsGallery.load', err as any)
        setError(getErrorMessage(err, 'تعذر تحميل أفضل الـ chefs'))
        setSections([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [currentScoutYear?.id])

  const today = toDateOnly(new Date())
  const highlightedTermId = useMemo(() => {
    const active = sections.find((section) => {
      const start = section.term.start_date
      const end = section.term.end_date
      return start && end && today >= start && today <= end
    })
    if (active) return active.term.id
    // A past or future term must never be presented as the current term.
    return null
  }, [sections, today])

  const totalSelected = sections.reduce((sum, section) => sum + section.items.length, 0)

  if (loading) return <PageLoader message="جاري تحميل أفضل الـ chefs..." />

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="⭐ Best Chefs"
        title="أفضل الـ chefs لكل ترم"
        badge={
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm">
            {currentScoutYear?.name || 'السنة الحالية'}
          </span>
        }
        description="صفحة عامة لكل الحسابات تعرض المختارين كأفضل الـ chefs في كل ترم داخل السنة الكشفية الحالية، بنفس الشكل المميز والواضح."
        actions={
          <button
            type="button"
            onClick={() => nav('/app')}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            رجوع للرئيسية
          </button>
        }
      />

      {error ? <InlineAlert tone="error" title="تعذر تحميل الصفحة">{error}</InlineAlert> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">عدد الترمات</div>
          <div className="mt-2 text-2xl font-black text-slate-900">{sections.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">إجمالي المختارين</div>
          <div className="mt-2 text-2xl font-black text-slate-900">{totalSelected}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">الترمات المختارة</div>
          <div className="mt-2 text-2xl font-black text-slate-900">{sections.filter((section) => section.items.length > 0).length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">السنة الحالية</div>
          <div className="mt-2 text-base font-bold text-slate-900">{currentScoutYear?.name || 'غير محددة'}</div>
        </div>
      </div>

      {!sections.length ? (
        <EmptyState
          title="لا توجد ترمات متاحة"
          description="لم يتم العثور على ترمات داخل السنة الحالية حتى الآن."
        />
      ) : (
        <div className="space-y-5">
          {sections.map((section) => {
            const highlighted = highlightedTermId === section.term.id
            return (
              <SectionCard
                key={section.term.id}
                title={
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{`⭐ أفضل الـ chefs — ${section.term.name}`}</span>
                    {highlighted ? (
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 shadow-sm">
                        الترم الحالي
                      </span>
                    ) : null}
                  </div>
                }
                description={termDateRangeLabel(section.term.start_date, section.term.end_date) || 'الترم المحدد داخل السنة الحالية'}
                tone={highlighted ? 'default' : 'subtle'}
              >
                {section.items.length ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {section.items.map((item, index) => (
                      <BestChefCard key={item.id} item={item} rank={index} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={`لم يتم اختيار أفضل chefs لـ ${section.term.name} بعد`}
                    description="عندما يختار الأدمن الأسماء المميزة لهذا الترم ستظهر هنا تلقائيًا لكل الحسابات."
                  />
                )}
              </SectionCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
