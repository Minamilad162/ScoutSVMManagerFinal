import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../components/ui/Toaster'
import {
  downloadSecretaryForm,
  listSecretaryForms,
  SECRETARY_FORM_MAX_BYTES,
  signedSecretaryFormUrl,
  uploadSecretaryForm,
  validSecretaryPdf,
  type SecretaryForm,
} from './api'

type Props = {
  teamId: string
  teamName: string
  scoutYearId: string
  scoutYearLabel: string
  userId: string | null
  canUpload: boolean
  refreshKey?: number
  onUploaded?: () => void
}

function humanSize(size: number) {
  return size >= 1024 * 1024 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.ceil(size / 1024))} KB`
}
function dateLabel(iso: string) {
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}
function formTitle(file: File) {
  return file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'استمارة جديدة'
}

export function SecretaryFormsWorkspace({
  teamId, teamName, scoutYearId, scoutYearLabel, userId, canUpload, refreshKey = 0, onUploaded,
}: Props) {
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement | null>(null)
  const previewRequest = useRef(0)
  const [forms, setForms] = useState<SecretaryForm[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ id: string; url: string } | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [chosenFiles, setChosenFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [downloadId, setDownloadId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    previewRequest.current++
    setForms([])
    setExpandedId(null)
    setPreview(null)
    setError('')
    if (!teamId || !scoutYearId) { setLoading(false); return }
    setLoading(true)
    listSecretaryForms(teamId, scoutYearId)
      .then((list) => { if (active) setForms(list) })
      .catch((err: any) => { if (active) setError(err.message || 'تعذر تحميل الاستمارات. تأكد من تثبيت تحديث قاعدة البيانات.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [teamId, scoutYearId, refreshKey, reloadKey])

  // A new team or year must never carry a previous team's pending upload.
  useEffect(() => {
    setChosenFiles([])
    setTitle('')
    setSearch('')
    if (fileInput.current) fileInput.current.value = ''
  }, [teamId, scoutYearId])

  const visible = useMemo(() => forms.filter((item) =>
    `${item.title} ${item.file_name}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  ), [forms, search])
  const totalSize = useMemo(() => forms.reduce((sum, item) => sum + Number(item.file_size_bytes || 0), 0), [forms])

  function handleChoose(files: FileList | File[] | null) {
    if (!files?.length) return
    const picked = Array.from(files)
    const invalid = picked.find((item) => validSecretaryPdf(item))
    if (invalid) {
      toast.error(`${invalid.name}: ${validSecretaryPdf(invalid)}`)
      if (fileInput.current) fileInput.current.value = ''
      return
    }
    setChosenFiles(picked)
    setTitle(picked.length === 1 ? formTitle(picked[0]) : '')
  }

  async function submit() {
    if (!canUpload || !userId || !teamId || !scoutYearId || uploading || !chosenFiles.length) return
    if (chosenFiles.length === 1 && !title.trim()) { toast.error('اكتب اسم الاستمارة.'); return }
    setUploading(true)
    let completed = 0
    try {
      for (const file of chosenFiles) {
        await uploadSecretaryForm({
          file,
          teamId,
          scoutYearId,
          userId,
          title: chosenFiles.length === 1 ? title : formTitle(file),
        })
        completed++
      }
      toast.success(`تم رفع ${completed} ${completed === 1 ? 'استمارة' : 'استمارات'} بنجاح`)
    } catch (e: any) {
      toast.error(`${e.message || 'تعذر رفع الملف'}${completed ? ` — تم حفظ ${completed} ملف قبل الخطأ.` : ''}`)
    } finally {
      if (completed) {
        // In partial-success cases keep failed files selected so they can be retried.
        setChosenFiles((files) => files.slice(completed))
        setTitle('')
        if (fileInput.current) fileInput.current.value = ''
        setReloadKey((value) => value + 1)
        onUploaded?.()
      }
      setUploading(false)
    }
  }

  async function toggleForm(form: SecretaryForm) {
    const requestId = ++previewRequest.current
    if (expandedId === form.id) { setExpandedId(null); setPreview(null); setOpeningId(null); return }
    setExpandedId(form.id)
    setPreview(null)
    setOpeningId(form.id)
    try {
      const url = await signedSecretaryFormUrl(form.storage_path)
      if (previewRequest.current === requestId) setPreview({ id: form.id, url })
    } catch (e: any) {
      if (previewRequest.current === requestId) toast.error(e.message || 'تعذر فتح PDF')
    } finally { if (previewRequest.current === requestId) setOpeningId(null) }
  }

  async function download(form: SecretaryForm) {
    setDownloadId(form.id)
    try { await downloadSecretaryForm(form) }
    catch (e: any) { toast.error(e.message || 'تعذر تحميل الملف') }
    finally { setDownloadId(null) }
  }

  return (
    <div className="secforms-workspace" dir="rtl">
      <header className="secforms-hero">
        <span className="secforms-hero-symbol" aria-hidden="true">📋</span>
        <div>
          <small>أرشيف السكرتارية · {scoutYearLabel}</small>
          <h2>استمارات {teamName || 'الفريق'}</h2>
          <p>جميع الاستمارات محفوظة حسب الفريق والسنة الكشفية، افتح أي بطاقة لمعاينة ملف PDF.</p>
        </div>
      </header>

      <div className="secforms-metrics">
        <div className="secforms-metric"><span>📄 إجمالي الاستمارات</span><strong>{forms.length}</strong></div>
        <div className="secforms-metric"><span>🗂️ حجم الملفات</span><strong>{humanSize(totalSize)}</strong></div>
        <div className="secforms-metric"><span>📅 السنة الكشفية</span><strong>{scoutYearLabel || '—'}</strong></div>
      </div>

      {canUpload ? (
        <section className="secforms-upload" aria-label="رفع استمارات الفريق">
          <div className="secforms-section-heading">
            <div><h3>رفع استمارات جديدة</h3><p>يمكن لمدير السكرتارية رفع ملفات الفريق المختار، ولسكرتير الفريق رفع ملفات فريقه فقط.</p></div>
            <span className="secforms-pill">الرفع إلى {teamName} · {scoutYearLabel}</span>
          </div>
          <input
            ref={fileInput} type="file" id={`secforms-upload-${teamId}`} accept=".pdf,application/pdf"
            multiple className="sr-only" onChange={(e) => handleChoose(e.target.files)}
          />
          <div className="secforms-upload-content">
            <label className="secforms-drop" htmlFor={`secforms-upload-${teamId}`}>
              <span aria-hidden="true">☁</span>
              <strong>{chosenFiles.length ? `تم اختيار ${chosenFiles.length} ملف` : 'اضغط هنا لاختيار ملفات PDF'}</strong>
              <small>PDF فقط • حتى {SECRETARY_FORM_MAX_BYTES / 1048576} MB لكل ملف</small>
            </label>
            <div className="secforms-upload-controls">
              {chosenFiles.length === 1 ? (
                <label className="secforms-field">اسم الاستمارة
                  <input maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: استمارات الترم الأول" />
                </label>
              ) : chosenFiles.length > 1 ? (
                <p className="secforms-upload-hint">سيُستخدم اسم كل ملف كعنوان للاستمارة. {chosenFiles.length} ملفات جاهزة للرفع.</p>
              ) : (
                <p className="secforms-upload-hint">الملفات خاصة بالفريق ومش متاحة للعامة. تقدر ترفع أكثر من ملف لكل سنة.</p>
              )}
              <button type="button" className="secforms-primary" disabled={uploading || !chosenFiles.length} onClick={submit}>
                {uploading ? 'جارٍ رفع الملفات...' : `↑ رفع استمارات ${teamName}`}
              </button>
            </div>
          </div>
          {chosenFiles.length > 0 && <div className="secforms-chosen-files" aria-live="polite">
            {chosenFiles.map((file, i) => <span key={`${file.name}-${i}`}>📕 {file.name} ({humanSize(file.size)})</span>)}
          </div>}
        </section>
      ) : (
        <div className="secforms-readonly">🔒 الاستعراض متاح هنا؛ الرفع مسموح لمدير السكرتارية العام أو سكرتير هذا الفريق في السنة الكشفية الحالية فقط.</div>
      )}

      <section className="secforms-list" aria-label="استمارات الفريق">
        <div className="secforms-section-heading">
          <div><h3>ملفات الاستمارات</h3><p>استمارات {teamName} · {scoutYearLabel}</p></div>
          <label className="secforms-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن استمارة..." aria-label="البحث عن استمارة" /></label>
        </div>
        <div className="secforms-year-bar"><span>▦ السنة الكشفية {scoutYearLabel}</span><span>{visible.length} استمارة</span></div>
        {error && <div role="alert" className="secforms-error">{error} <button type="button" onClick={() => setReloadKey((n) => n + 1)}>إعادة المحاولة</button></div>}
        {loading ? <div className="secforms-empty">جارٍ تحميل استمارات الفريق...</div>
          : !error && visible.length === 0 ? <div className="secforms-empty">📂 {search ? 'لا توجد استمارات مطابقة للبحث.' : 'لا توجد استمارات مرفوعة لهذا الفريق في السنة المختارة.'}</div>
          : visible.map((form) => (
            <article key={form.id} className={`secforms-item ${expandedId === form.id ? 'is-open' : ''}`}>
              <button type="button" className="secforms-item-toggle" onClick={() => void toggleForm(form)} aria-expanded={expandedId === form.id} aria-controls={`secform-preview-${form.id}`}>
                <span className="secforms-file-icon" aria-hidden="true">PDF</span>
                <span className="secforms-file-info"><strong>{form.title}</strong><small>تاريخ الرفع: {dateLabel(form.created_at)} · {humanSize(Number(form.file_size_bytes))}</small></span>
                <span className="secforms-file-action">{expandedId === form.id ? 'إغلاق' : 'فتح الاستمارة'} <span aria-hidden="true">{expandedId === form.id ? '⌃' : '⌄'}</span></span>
              </button>
              {expandedId === form.id && <div id={`secform-preview-${form.id}`} className="secforms-preview">
                <div className="secforms-preview-toolbar">
                  <span title={form.file_name}>📕 {form.file_name}</span>
                  <div>
                    {preview?.id === form.id && <a href={preview.url} target="_blank" rel="noopener noreferrer" className="secforms-secondary">↗ فتح في تبويب جديد</a>}
                    <button type="button" className="secforms-secondary" disabled={downloadId === form.id} onClick={() => void download(form)}>{downloadId === form.id ? 'جارٍ التحميل...' : '↓ تحميل PDF'}</button>
                  </div>
                </div>
                {openingId === form.id ? <p className="secforms-preview-loading">جارٍ تجهيز معاينة آمنة...</p>
                  : preview?.id === form.id ? <iframe title={`معاينة ${form.title}`} src={preview.url} className="secforms-pdf-frame" />
                  : <p className="secforms-preview-loading">تعذر عرض المعاينة. جرّب فتح الاستمارة مرة أخرى.</p>}
              </div>}
            </article>
          ))}
      </section>
    </div>
  )
}
