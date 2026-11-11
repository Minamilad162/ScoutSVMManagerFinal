import { supabase } from '../../lib/supabase'
import { MATERIAL_IMAGES_BUCKET, isMaterialImageColumnMissing, materialImagePath, validateMaterialImage } from './rules'

export type MaterialImageCatalog = { paths: Map<string, string | null>; enabled: boolean }

// Images are public catalogue photos, not private member data. Keep writes role-protected.
export function materialPhotoUrl(path: string | null | undefined): string | null {
  if (!path || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(path)) return null
  return supabase.storage.from(MATERIAL_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl || null
}

export async function loadMaterialImageCatalog(): Promise<MaterialImageCatalog> {
  const { data, error } = await supabase.from('materials').select('id,image_path')
  // Older databases lack migration 26. Core inventory and bookings must remain usable.
  if (isMaterialImageColumnMissing(error)) return { paths: new Map(), enabled: false }
  if (error) throw error
  return {
    enabled: true,
    paths: new Map(((data || []) as Array<{ id: string; image_path: string | null }>).map(row => [row.id, row.image_path || null])),
  }
}

/** Upload an immutable image object. The caller then saves the image path and the
 * material fields in ONE materials insert/update. Never mutate the material first:
 * when Storage rejects an upload the existing material must remain unchanged. */
export async function uploadMaterialPhoto(materialId: string, image: File): Promise<string> {
  const invalid = validateMaterialImage(image)
  if (invalid) throw new Error(invalid)
  const path = materialImagePath(materialId, image.type, crypto.randomUUID())
  const { error } = await supabase.storage.from(MATERIAL_IMAGES_BUCKET).upload(path, image, {
    contentType: image.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  return path
}

/** Deletes are best-effort: failing to remove an old image must not undo a
 * successfully saved material. Never remove the image before the DB write. */
export async function deleteMaterialPhoto(path: string | null): Promise<void> {
  if (!path) return
  const { error } = await supabase.storage.from(MATERIAL_IMAGES_BUCKET).remove([path])
  if (error) console.warn('Material photo could not be cleaned up', error.message)
}

/** Return actionable errors without exposing internal storage details in the UI. */
export function materialPhotoUploadError(error: unknown): string {
  const record = error as { message?: string; statusCode?: string | number; status?: number } | null
  const message = String(record?.message || '')
  const code = String(record?.statusCode || record?.status || '')
  if (/row.level.security|permission denied|unauthorized|403|access denied/i.test(message) || code === '403') {
    return 'رفع الصورة مرفوض بسبب صلاحيات Supabase Storage. يلزم تطبيق إصلاح سياسة صور الأدوات (Migration 27) ثم إعادة المحاولة.'
  }
  if (/bucket.*not found|bucket not found/i.test(message)) return 'مساحة material-images غير موجودة في Supabase. تحقق من Migration 26.'
  if (/payload too large|file size|413/i.test(message) || code === '413') return 'الصورة أكبر من الحد المسموح (3 ميجابايت).'
  return message ? `تعذر رفع صورة الأداة: ${message}` : 'تعذر رفع الصورة. حاول مرة أخرى.'
}
