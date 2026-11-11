import { supabase, isHistoricalScoutYearView } from '../../lib/supabase'

/** Private documents, never expose storage paths as public URLs. */
export const SECRETARY_FORMS_BUCKET = 'secretary-forms'
export const SECRETARY_FORM_MAX_BYTES = 10 * 1024 * 1024

export type SecretaryForm = {
  id: string
  team_id: string
  scout_year_id: string
  title: string
  file_name: string
  storage_path: string
  file_size_bytes: number
  uploaded_by: string
  created_at: string
}

export function validSecretaryPdf(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.pdf')) return 'الملفات المسموح بها هي PDF فقط.'
  if (file.type && file.type !== 'application/pdf' && file.type !== 'application/x-pdf') return 'نوع الملف غير مدعوم؛ اختر PDF.'
  if (file.size === 0) return 'الملف فارغ.'
  if (file.size > SECRETARY_FORM_MAX_BYTES) return 'الحد الأقصى لكل ملف 10 ميجابايت.'
  return null
}

export async function listSecretaryForms(teamId: string, scoutYearId: string): Promise<SecretaryForm[]> {
  if (!teamId || !scoutYearId) return []
  const rows: SecretaryForm[] = []
  const pageSize = 500
  let offset = 0
  while (true) {
    const { data, error } = await supabase.from('secretary_forms')
      .select('id,team_id,scout_year_id,title,file_name,storage_path,file_size_bytes,uploaded_by,created_at')
      .eq('team_id', teamId)
      .eq('scout_year_id', scoutYearId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...((data ?? []) as SecretaryForm[]))
    if (!data || data.length < pageSize) break
    offset += pageSize
  }
  return rows
}

export async function listSecretaryFormCounts(scoutYearId: string): Promise<Record<string, number>> {
  if (!scoutYearId) return {}
  const counts: Record<string, number> = {}
  let offset = 0
  const pageSize = 500
  while (true) {
    const { data, error } = await supabase.from('secretary_forms')
      .select('team_id').eq('scout_year_id', scoutYearId)
      .order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
    if (error) throw error
    for (const item of data ?? []) counts[item.team_id] = (counts[item.team_id] ?? 0) + 1
    if (!data || data.length < pageSize) break
    offset += pageSize
  }
  return counts
}

/** Validate PDF signature in addition to extension/MIME (server also restricts MIME and size). */
async function validatePdfBytes(file: File) {
  const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer())
  if (header !== '%PDF-') throw new Error('الملف المختار لا يحتوي على بيانات PDF صحيحة.')
}

export async function uploadSecretaryForm(args: {
  teamId: string
  scoutYearId: string
  title: string
  file: File
  userId: string
}): Promise<void> {
  const { teamId, scoutYearId, file, userId } = args
  const title = args.title.trim()
  const invalid = validSecretaryPdf(file)
  if (invalid) throw new Error(invalid)
  if (!title || title.length > 160) throw new Error('اكتب عنوانًا للملف لا يتجاوز 160 حرفًا.')
  if (!teamId || !scoutYearId || !userId) throw new Error('بيانات الفريق أو السنة أو المستخدم غير مكتملة.')
  if (isHistoricalScoutYearView()) throw new Error('لا يمكن رفع ملفات أثناء استعراض سنة أخرى.')
  await validatePdfBytes(file)

  const id = crypto.randomUUID()
  const storagePath = `${scoutYearId}/${teamId}/${id}.pdf`
  const { error: uploadError } = await supabase.storage.from(SECRETARY_FORMS_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: 'application/pdf' })
  if (uploadError) throw uploadError

  // Store metadata only when Storage confirms upload. On failure, remove the
  // caller-owned orphan if possible; never leave a success message without a row.
  const { error: metadataError } = await supabase.from('secretary_forms').insert({
    id,
    team_id: teamId,
    scout_year_id: scoutYearId,
    title,
    file_name: file.name.slice(0, 255),
    storage_path: storagePath,
    file_size_bytes: file.size,
    uploaded_by: userId,
  })
  if (metadataError) {
    await supabase.storage.from(SECRETARY_FORMS_BUCKET).remove([storagePath])
    throw metadataError
  }
}

export async function signedSecretaryFormUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(SECRETARY_FORMS_BUCKET).createSignedUrl(path, 120)
  if (error || !data?.signedUrl) throw error || new Error('تعذر فتح الملف')
  return data.signedUrl
}

export async function downloadSecretaryForm(form: SecretaryForm) {
  const { data, error } = await supabase.storage.from(SECRETARY_FORMS_BUCKET).download(form.storage_path)
  if (error || !data) throw error || new Error('تعذر تحميل الملف')
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = form.file_name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 20_000)
}
