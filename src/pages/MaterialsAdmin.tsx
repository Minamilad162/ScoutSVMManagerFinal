import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/PageLoader'
import { LoadingButton } from '../components/ui/LoadingButton'
import { useToast } from '../components/ui/Toaster'
import { useRoleGate } from '../hooks/useRoleGate'
import { InlineAlert } from '../components/ui/InlineAlert'
import { EmptyState } from '../components/ui/EmptyState'
import scoutBackpack from '../assets/scout-theme/scout-backpack.webp'
import '../features/materialImages/materialImages.css'
import { loadMaterialImageCatalog, materialPhotoUrl, removeMaterialPhoto, saveMaterialPhoto } from '../features/materialImages/api'
import { validateMaterialImage } from '../features/materialImages/rules'

type Material = {
  id: string
  name: string
  description: string | null
  total_qty: number
  active: boolean
  storage_location_id: string | null
  image_path: string | null
  storage_locations?: { name: string }
}
type StorLoc = { id: string; name: string; description: string | null; active: boolean }
type Zone = { id: string; name: string; active: boolean }
type AdminTab = 'materials' | 'storage' | 'zones'

type IconKind = 'box' | 'storage' | 'zone' | 'active' | 'inactive' | 'search' | 'edit' | 'alert'

function InventoryGlyph({ kind = 'box' }: { kind?: IconKind }) {
  const common = { viewBox: '0 0 48 48', 'aria-hidden': true }
  if (kind === 'storage') return <svg {...common}><path d="M8 10h32v30H8zM8 20h32M18 20v20M30 20v20M13 15h8M27 15h8"/></svg>
  if (kind === 'zone') return <svg {...common}><path d="M24 42s14-10 14-23a14 14 0 1 0-28 0c0 13 14 23 14 23Z"/><circle cx="24" cy="19" r="5"/></svg>
  if (kind === 'active') return <svg {...common}><circle cx="24" cy="24" r="17"/><path d="m16 24 5 5 11-12"/></svg>
  if (kind === 'inactive') return <svg {...common}><circle cx="24" cy="24" r="17"/><path d="M16 16l16 16M32 16 16 32"/></svg>
  if (kind === 'search') return <svg {...common}><circle cx="21" cy="21" r="11"/><path d="m30 30 10 10"/></svg>
  if (kind === 'edit') return <svg {...common}><path d="M9 39h8L39 17l-8-8L9 31v8Z"/><path d="m27 13 8 8"/></svg>
  if (kind === 'alert') return <svg {...common}><path d="M24 6 43 40H5L24 6Z"/><path d="M24 17v11M24 34h.01"/></svg>
  return <svg {...common}><path d="m24 6 17 9v18l-17 9-17-9V15l17-9Z"/><path d="m7 15 17 9 17-9M24 24v18"/></svg>
}

export default function MaterialsAdmin() {
  const toast = useToast()
  const gate = useRoleGate()
  const [loading, setLoading] = useState(true)
  const [materials, setMaterials] = useState<Material[]>([])
  const [storLocs, setStorLocs] = useState<StorLoc[]>([])
  const [zones, setZones] = useState<Zone[]>([])

  const [mName, setMName] = useState('')
  const [mQty, setMQty] = useState<number | ''>('')
  const [mStor, setMStor] = useState('')
  const [mDesc, setMDesc] = useState('')
  const [mImage, setMImage] = useState<File | null>(null)
  const [mImagePreview, setMImagePreview] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [imagesEnabled, setImagesEnabled] = useState(true)
  const [savingM, setSavingM] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [sName, setSName] = useState('')
  const [sDesc, setSDesc] = useState('')
  const [savingS, setSavingS] = useState(false)
  const [zName, setZName] = useState('')
  const [savingZ, setSavingZ] = useState(false)

  const [tab, setTab] = useState<AdminTab>('materials')
  const [materialSearch, setMaterialSearch] = useState('')
  const [materialStatus, setMaterialStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [materialLocation, setMaterialLocation] = useState('all')
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 8

  const metrics = useMemo(() => ({
    materials: materials.length,
    activeMaterials: materials.filter((m) => m.active).length,
    inactiveMaterials: materials.filter((m) => !m.active).length,
    totalUnits: materials.reduce((sum, m) => sum + Number(m.total_qty || 0), 0),
    locations: storLocs.filter((s) => s.active).length,
    zones: zones.filter((z) => z.active).length,
    withoutLocation: materials.filter((m) => !m.storage_location_id).length,
  }), [materials, storLocs, zones])

  const filteredMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase()
    return materials.filter((material) => {
      const matchesSearch = !q || material.name.toLowerCase().includes(q) || (material.description || '').toLowerCase().includes(q) || (material.storage_locations?.name || '').toLowerCase().includes(q)
      const matchesStatus = materialStatus === 'all' || (materialStatus === 'active' ? material.active : !material.active)
      const matchesLocation = materialLocation === 'all' || material.storage_location_id === materialLocation || (materialLocation === 'none' && !material.storage_location_id)
      return matchesSearch && matchesStatus && matchesLocation
    })
  }, [materials, materialSearch, materialStatus, materialLocation])

  const totalPages = Math.max(1, Math.ceil(filteredMaterials.length / pageSize))
  const pagedMaterials = useMemo(() => {
    const start = (Math.min(page, totalPages) - 1) * pageSize
    return filteredMaterials.slice(start, start + pageSize)
  }, [filteredMaterials, page, totalPages])

  const selectedMaterial = useMemo(
    () => materials.find((material) => material.id === selectedMaterialId) || filteredMaterials[0] || materials[0] || null,
    [materials, filteredMaterials, selectedMaterialId]
  )

  useEffect(() => { void init() }, [])
  useEffect(() => {
    if (!mImage) { setMImagePreview(null); return }
    const preview = URL.createObjectURL(mImage)
    setMImagePreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [mImage])
  useEffect(() => { setPage(1) }, [materialSearch, materialStatus, materialLocation])
  useEffect(() => {
    if (!selectedMaterialId && materials[0]) setSelectedMaterialId(materials[0].id)
  }, [materials, selectedMaterialId])

  async function init() {
    setLoading(true)
    try {
      const [{ data: mats, error: me }, { data: sl, error: se }, { data: zs, error: ze }, imageCatalog] = await Promise.all([
        supabase.from('materials').select('id,name,description,total_qty,active,storage_location_id, storage_locations:storage_location_id(name)').order('name'),
        supabase.from('storage_locations').select('id,name,description,active').order('name'),
        supabase.from('field_zones').select('id,name,active').order('name'),
        loadMaterialImageCatalog(),
      ])
      if (me) throw me
      if (se) throw se
      if (ze) throw ze
      setImagesEnabled(imageCatalog.enabled)
      setMaterials(((mats as Material[]) ?? []).map((m) => ({ ...m, image_path: imageCatalog.paths.get(m.id) || null })))
      setStorLocs((sl as any) ?? [])
      setZones((zs as any) ?? [])
    } catch (e: any) {
      toast.error(e.message || 'تعذر تحميل الداتا')
    } finally {
      setLoading(false)
    }
  }

  function resetMaterialForm() {
    setEditId(null)
    setMName('')
    setMQty('')
    setMStor('')
    setMDesc('')
    setMImage(null)
    setRemoveImage(false)
  }

  function openNewMaterial() {
    setTab('materials')
    resetMaterialForm()
    requestAnimationFrame(() => document.getElementById('materials124-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  function startEdit(material: Material) {
    setTab('materials')
    setSelectedMaterialId(material.id)
    setEditId(material.id)
    setMName(material.name)
    setMQty(material.total_qty)
    setMStor(material.storage_location_id || '')
    setMDesc(material.description || '')
    setMImage(null)
    setRemoveImage(false)
    requestAnimationFrame(() => document.getElementById('materials124-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  function chooseMaterialImage(file: File | undefined) {
    if (!file) return
    const error = validateMaterialImage(file)
    if (error) { toast.error(error); return }
    setMImage(file)
    setRemoveImage(false)
  }

  async function saveMaterial() {
    if (!gate.canManageInventory()) return toast.error('ليست لديك صلاحية إدارة المخزون')
    if (!mName.trim()) return toast.error('ادخل اسم الأداة')
    const qty = Number(mQty)
    if (!isFinite(qty) || qty < 0) return toast.error('الكمية غير صالحة')
    if ((mImage || removeImage) && !imagesEnabled) return toast.error('ميزة صور الأدوات تحتاج تنفيذ Migration 26 على Supabase أولًا')

    setSavingM(true)
    try {
      let materialId = editId
      const previousPath = materials.find((item) => item.id === editId)?.image_path || null
      if (editId) {
        const { error } = await supabase.from('materials')
          .update({ name: mName.trim(), total_qty: qty, storage_location_id: mStor || null, description: mDesc || null })
          .eq('id', editId)
        if (error) throw error
      } else {
        const { data: created, error } = await supabase.from('materials')
          .insert({ name: mName.trim(), total_qty: qty, storage_location_id: mStor || null, description: mDesc || null })
          .select('id').single()
        if (error) throw error
        materialId = created.id
      }
      if (materialId && mImage) {
        try { await saveMaterialPhoto(materialId, mImage, previousPath) }
        catch (error: any) {
          toast.error(`تم حفظ بيانات الأداة لكن فشل رفع الصورة: ${error?.message || 'خطأ في التخزين'}`)
          await init()
          return
        }
      } else if (materialId && removeImage) {
        try { await removeMaterialPhoto(materialId, previousPath) }
        catch (error: any) {
          toast.error(`تم حفظ بيانات الأداة لكن تعذر إزالة الصورة: ${error?.message || ''}`)
          await init()
          return
        }
      }
      toast.success(editId ? 'تم تحديث الأداة وصورتها' : 'تم إضافة الأداة')
      resetMaterialForm()
      await init()
    } catch (e: any) {
      toast.error(e.message || 'تعذر الحفظ')
    } finally {
      setSavingM(false)
    }
  }

  async function toggleMaterialActive(id: string, current: boolean) {
    if (!gate.canManageInventory()) return
    const { error } = await supabase.from('materials').update({ active: !current }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('تم تحديث حالة الأداة'); await init() }
  }

  async function saveStorLoc() {
    if (!gate.canManageInventory()) return toast.error('ليست لديك صلاحية')
    if (!sName.trim()) return toast.error('ادخل اسم المكان')
    setSavingS(true)
    try {
      const { error } = await supabase.from('storage_locations').insert({ name: sName.trim(), description: sDesc || null })
      if (error) throw error
      setSName('')
      setSDesc('')
      toast.success('تم إضافة المكان')
      await init()
    } catch (e: any) {
      toast.error(e.message || 'تعذر الحفظ')
    } finally {
      setSavingS(false)
    }
  }

  async function toggleStorActive(id: string, current: boolean) {
    if (!gate.canManageInventory()) return
    const { error } = await supabase.from('storage_locations').update({ active: !current }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('تم التحديث'); await init() }
  }

  async function saveZone() {
    if (!gate.canManageInventory()) return toast.error('ليست لديك صلاحية')
    if (!zName.trim()) return toast.error('ادخل اسم القطاع')
    setSavingZ(true)
    try {
      const { error } = await supabase.from('field_zones').insert({ name: zName.trim() })
      if (error) throw error
      setZName('')
      toast.success('تم إضافة القطاع')
      await init()
    } catch (e: any) {
      toast.error(e.message || 'تعذر الحفظ')
    } finally {
      setSavingZ(false)
    }
  }

  async function toggleZoneActive(id: string, current: boolean) {
    if (!gate.canManageInventory()) return
    const { error } = await supabase.from('field_zones').update({ active: !current }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('تم التحديث'); await init() }
  }

  return (
    <div className="materials124-page space-y-5 p-4 md:p-6" dir="rtl">
      <PageLoader visible={loading} text="جاري تجهيز المخزون..." />

      <section className="materials124-hero">
        <div className="materials124-hero-copy">
          <span className="materials124-eyebrow">مركز إدارة الأدوات</span>
          <h1>إدارة الأدوات</h1>
          <p>إدارة وتنظيم أدوات ومعدات الفرقة الكشفية ومتابعة الكميات، حالة التفعيل ومكان التخزين من شاشة واحدة.</p>
          <div className="materials124-hero-actions">
            <button type="button" className="materials124-primary" onClick={openNewMaterial}><span>＋</span> إضافة أداة</button>
            <button type="button" className="materials124-secondary" onClick={() => setTab('storage')}><InventoryGlyph kind="storage" /> أماكن التخزين</button>
          </div>
        </div>
        <div className="materials124-hero-art" aria-hidden="true">
          <img src={scoutBackpack} alt="" />
          <span className="materials124-art-ring" />
        </div>
      </section>

      <section className="materials124-kpis" aria-label="ملخص المخزون">
        <article className="is-blue"><span><InventoryGlyph /></span><div><small>إجمالي الوحدات</small><strong>{metrics.totalUnits}</strong></div></article>
        <article className="is-green"><span><InventoryGlyph kind="active" /></span><div><small>أنواع مفعّلة</small><strong>{metrics.activeMaterials}</strong></div></article>
        <article className="is-orange"><span><InventoryGlyph kind="inactive" /></span><div><small>أنواع موقوفة</small><strong>{metrics.inactiveMaterials}</strong></div></article>
        <article className="is-gold"><span><InventoryGlyph kind="storage" /></span><div><small>أماكن التخزين</small><strong>{metrics.locations}</strong></div></article>
      </section>

      {!imagesEnabled && <InlineAlert tone="info" title="صور الأدوات غير مفعلة في قاعدة البيانات">يمكنك إدارة الأدوات كالمعتاد، لكن رفع الصور يحتاج تطبيق Migration 26 على Supabase.</InlineAlert>}
      {!gate.canManageInventory() && (
        <InlineAlert tone="info" title="وضع العرض فقط">هذه الشاشة متاحة للعرض فقط. الإدارة مسموحة للأدمن أو المسؤول العام للأدوات.</InlineAlert>
      )}

      <section className="materials124-tabs" role="tablist" aria-label="أقسام إدارة الأدوات">
        <button type="button" className={tab === 'materials' ? 'is-active' : ''} onClick={() => setTab('materials')}><InventoryGlyph /><span>الأدوات</span><b>{metrics.materials}</b></button>
        <button type="button" className={tab === 'storage' ? 'is-active' : ''} onClick={() => setTab('storage')}><InventoryGlyph kind="storage" /><span>أماكن التخزين</span><b>{storLocs.length}</b></button>
        <button type="button" className={tab === 'zones' ? 'is-active' : ''} onClick={() => setTab('zones')}><InventoryGlyph kind="zone" /><span>قطاعات الأرض</span><b>{zones.length}</b></button>
      </section>

      {tab === 'materials' && (
        <>
          <section className="materials124-toolbar">
            <label className="materials124-search">
              <InventoryGlyph kind="search" />
              <input value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} placeholder="ابحث باسم الأداة أو الوصف أو مكان التخزين..." />
            </label>
            <label><span>الحالة</span><select value={materialStatus} onChange={(e) => setMaterialStatus(e.target.value as any)}><option value="all">كل الحالات</option><option value="active">مفعّلة</option><option value="inactive">موقوفة</option></select></label>
            <label><span>مكان التخزين</span><select value={materialLocation} onChange={(e) => setMaterialLocation(e.target.value)}><option value="all">كل الأماكن</option><option value="none">بدون مكان تخزين</option>{storLocs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <button type="button" className="materials124-add-compact" onClick={openNewMaterial}>＋ إضافة أداة</button>
          </section>

          <div className="materials124-workspace">
            <section className="materials124-table-card">
              <div className="materials124-section-head">
                <div><span>قائمة المخزون</span><h2>الأدوات والمعدات</h2></div>
                <span className="materials124-count">{filteredMaterials.length} أداة</span>
              </div>

              {filteredMaterials.length === 0 ? <EmptyState title="لا توجد أدوات مطابقة" description="غيّر البحث أو الفلاتر الحالية." /> : (
                <div className="materials124-table-wrap">
                  <table className="materials124-table">
                    <thead><tr><th>الأداة</th><th>الموقع</th><th>الكمية</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
                    <tbody>
                      {pagedMaterials.map((material) => (
                        <tr key={material.id} className={selectedMaterial?.id === material.id ? 'is-selected' : ''} onClick={() => setSelectedMaterialId(material.id)}>
                          <td><div className="materials124-tool-name"><span className="materials124-tool-icon">{material.image_path && materialPhotoUrl(material.image_path) ? <img src={materialPhotoUrl(material.image_path)!} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} /> : null}<InventoryGlyph /></span><div><strong>{material.name}</strong><small>{material.description || 'بدون وصف'}</small></div></div></td>
                          <td><span className="materials124-location">{material.storage_locations?.name || 'بدون مكان تخزين'}</span></td>
                          <td><strong className="materials124-qty">{material.total_qty}</strong></td>
                          <td><span className={`materials124-state ${material.active ? 'is-active' : 'is-inactive'}`}>{material.active ? 'مفعّلة' : 'موقوفة'}</span></td>
                          <td><div className="materials124-row-actions"><button type="button" onClick={(e) => { e.stopPropagation(); startEdit(material) }} aria-label={`تعديل ${material.name}`}><InventoryGlyph kind="edit" /></button><button type="button" className={material.active ? 'danger' : 'success'} onClick={(e) => { e.stopPropagation(); void toggleMaterialActive(material.id, material.active) }} disabled={!gate.canManageInventory()}>{material.active ? 'إيقاف' : 'تفعيل'}</button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {filteredMaterials.length > pageSize && (
                <div className="materials124-pagination">
                  <span>عرض {(Math.min(page, totalPages) - 1) * pageSize + 1}–{Math.min(Math.min(page, totalPages) * pageSize, filteredMaterials.length)} من {filteredMaterials.length}</span>
                  <div><button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>‹</button>{Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2)).map((p) => <button type="button" key={p} className={page === p ? 'is-active' : ''} onClick={() => setPage(p)}>{p}</button>)}<button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>›</button></div>
                </div>
              )}
            </section>

            <aside className="materials124-side">
              <section className="materials124-detail-card">
                <div className="materials124-side-title"><div><span>تفاصيل الأداة</span><h2>{selectedMaterial?.name || 'اختر أداة'}</h2></div><span className="materials124-detail-icon"><InventoryGlyph /></span></div>
                {selectedMaterial ? (
                  <>
                    {selectedMaterial.image_path && materialPhotoUrl(selectedMaterial.image_path) && <div className="materials124-detail-photo"><img src={materialPhotoUrl(selectedMaterial.image_path)!} alt={`صورة ${selectedMaterial.name}`} onError={(e) => { e.currentTarget.style.display = 'none' }} /></div>}
                    <div className="materials124-detail-grid">
                      <div><small>الكمية الإجمالية</small><strong>{selectedMaterial.total_qty}</strong></div>
                      <div><small>الحالة</small><strong className={selectedMaterial.active ? 'good' : 'muted'}>{selectedMaterial.active ? 'مفعّلة' : 'موقوفة'}</strong></div>
                      <div><small>مكان التخزين</small><strong>{selectedMaterial.storage_locations?.name || 'غير محدد'}</strong></div>
                    </div>
                    <p className="materials124-description">{selectedMaterial.description || 'لا يوجد وصف مسجل لهذه الأداة.'}</p>
                    <div className="materials124-detail-actions"><button type="button" className="materials124-primary" onClick={() => startEdit(selectedMaterial)}><InventoryGlyph kind="edit" /> تعديل الأداة</button><button type="button" className="materials124-secondary" onClick={() => void toggleMaterialActive(selectedMaterial.id, selectedMaterial.active)} disabled={!gate.canManageInventory()}>{selectedMaterial.active ? 'إيقاف الأداة' : 'تفعيل الأداة'}</button></div>
                  </>
                ) : <EmptyState title="اختر أداة" description="اضغط على أي صف لعرض تفاصيله هنا." />}
              </section>

              <section className="materials124-alerts-card">
                <div className="materials124-side-title"><div><span>تنبيهات المخزون</span><h2>ملاحظات سريعة</h2></div><span className="materials124-detail-icon is-alert"><InventoryGlyph kind="alert" /></span></div>
                <div className="materials124-alert-list">
                  <div><span className="is-orange">!</span><p><strong>أدوات بدون مكان تخزين</strong><small>{metrics.withoutLocation} أداة تحتاج تحديد مكان تخزين.</small></p></div>
                  <div><span className="is-blue">i</span><p><strong>أدوات موقوفة</strong><small>{metrics.inactiveMaterials} نوع أداة موقوف حاليًا.</small></p></div>
                </div>
              </section>
            </aside>
          </div>

          <section id="materials124-editor" className="materials124-editor-card">
            <div className="materials124-section-head">
              <div><span>{editId ? 'تعديل الأداة المختارة' : 'إضافة أداة جديدة'}</span><h2>{editId ? mName || 'تعديل البيانات' : 'بيانات الأداة'}</h2></div>
              <span className="materials124-detail-icon"><InventoryGlyph kind={editId ? 'edit' : 'box'} /></span>
            </div>
            <div className="materials124-editor-grid">
              <label><span>اسم الأداة</span><input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="مثلاً: خيمة كبيرة" /></label>
              <label><span>الكمية الإجمالية</span><input type="number" min={0} value={mQty} onChange={(e) => setMQty(e.target.value === '' ? '' : Number(e.target.value))} /></label>
              <label><span>مكان التخزين</span><select value={mStor} onChange={(e) => setMStor(e.target.value)}><option value="">— بدون —</option>{storLocs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label className="materials124-editor-wide"><span>الوصف / ملاحظات</span><textarea rows={3} value={mDesc} onChange={(e) => setMDesc(e.target.value)} placeholder="وصف مختصر يساعد المسؤولين على معرفة الأداة..." /></label>
              <div className="materials124-editor-wide materials124-image-editor">
                <div className="materials124-image-preview">
                  {mImagePreview || (editId && !removeImage && materialPhotoUrl(materials.find((m) => m.id === editId)?.image_path)) ?
                    <img src={mImagePreview || materialPhotoUrl(materials.find((m) => m.id === editId)?.image_path)!} alt="معاينة صورة الأداة" /> :
                    <span><InventoryGlyph /></span>}
                </div>
                <div className="materials124-image-controls">
                  <strong>صورة الأداة</strong>
                  <small>تظهر الصورة في كروت حجز الأدوات. JPG أو PNG أو WebP — بحد أقصى 3MB.</small>
                  <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="اختيار صورة الأداة" disabled={!gate.canManageInventory() || !imagesEnabled} onChange={(e) => { chooseMaterialImage(e.target.files?.[0]); e.target.value = '' }} />
                  {(mImage || (editId && !removeImage && materials.some((m) => m.id === editId && m.image_path))) &&
                    <button type="button" className="materials124-secondary" disabled={!gate.canManageInventory() || !imagesEnabled} onClick={() => { setMImage(null); setRemoveImage(true) }}>إزالة الصورة</button>}
                  {!imagesEnabled && <small>يلزم تنفيذ Migration 26 قبل رفع الصور.</small>}
                </div>
              </div>
            </div>
            <div className="materials124-editor-actions">{editId && <button type="button" className="materials124-secondary" onClick={resetMaterialForm}>إلغاء التعديل</button>}<LoadingButton loading={savingM} onClick={saveMaterial} disabled={!gate.canManageInventory()}>{editId ? 'حفظ التعديل' : 'إضافة الأداة'}</LoadingButton></div>
          </section>
        </>
      )}

      {tab === 'storage' && (
        <section className="materials124-management-card">
          <div className="materials124-section-head"><div><span>تنظيم المخزن</span><h2>أماكن التخزين</h2></div><span className="materials124-detail-icon"><InventoryGlyph kind="storage" /></span></div>
          <div className="materials124-create-row">
            <label><span>اسم المكان</span><input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="مثلاً: دولاب A" /></label>
            <label><span>الوصف</span><input value={sDesc} onChange={(e) => setSDesc(e.target.value)} placeholder="مكانه أو محتواه..." /></label>
            <LoadingButton loading={savingS} onClick={saveStorLoc} disabled={!gate.canManageInventory()}>إضافة المكان</LoadingButton>
          </div>
          <div className="materials124-card-grid">
            {storLocs.map((storage) => <article key={storage.id} className={!storage.active ? 'is-inactive' : ''}><span><InventoryGlyph kind="storage" /></span><div><strong>{storage.name}</strong><small>{storage.description || 'بدون وصف'}</small></div><button type="button" className={`materials124-state ${storage.active ? 'is-active' : 'is-inactive'}`} onClick={() => toggleStorActive(storage.id, storage.active)} disabled={!gate.canManageInventory()}>{storage.active ? 'مفعّل' : 'موقوف'}</button></article>)}
          </div>
        </section>
      )}

      {tab === 'zones' && (
        <section className="materials124-management-card">
          <div className="materials124-section-head"><div><span>تجهيز الأرض</span><h2>قطاعات الأرض</h2></div><span className="materials124-detail-icon"><InventoryGlyph kind="zone" /></span></div>
          <div className="materials124-create-row is-zone">
            <label><span>اسم القطاع</span><input value={zName} onChange={(e) => setZName(e.target.value)} placeholder="A1 / B2 ..." /></label>
            <LoadingButton loading={savingZ} onClick={saveZone} disabled={!gate.canManageInventory()}>إضافة قطاع</LoadingButton>
          </div>
          <div className="materials124-card-grid">
            {zones.map((zone) => <article key={zone.id} className={!zone.active ? 'is-inactive' : ''}><span><InventoryGlyph kind="zone" /></span><div><strong>{zone.name}</strong><small>قطاع أرض</small></div><button type="button" className={`materials124-state ${zone.active ? 'is-active' : 'is-inactive'}`} onClick={() => toggleZoneActive(zone.id, zone.active)} disabled={!gate.canManageInventory()}>{zone.active ? 'مفعّل' : 'موقوف'}</button></article>)}
          </div>
        </section>
      )}
    </div>
  )
}
