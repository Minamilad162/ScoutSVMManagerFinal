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

/** Upload a new immutable object then update the material; on failure, clean up the new object. */
export async function saveMaterialPhoto(materialId: string, image: File, oldPath: string | null) {
  const invalid = validateMaterialImage(image)
  if (invalid) throw new Error(invalid)
  const path = materialImagePath(materialId, image.type, crypto.randomUUID())
  const storage = supabase.storage.from(MATERIAL_IMAGES_BUCKET)
  const { error: uploadError } = await storage.upload(path, image, {
    contentType: image.type, cacheControl: '3600', upsert: false,
  })
  if (uploadError) throw uploadError
  const { error: updateError } = await supabase.from('materials').update({ image_path: path }).eq('id', materialId)
  if (updateError) {
    await storage.remove([path])
    throw updateError
  }
  if (oldPath && oldPath !== path) {
    const { error: removalError } = await storage.remove([oldPath])
    if (removalError) console.warn('Old material photo could not be removed', removalError.message)
  }
  return path
}

export async function removeMaterialPhoto(materialId: string, oldPath: string | null) {
  const { error } = await supabase.from('materials').update({ image_path: null }).eq('id', materialId)
  if (error) throw error
  if (oldPath) {
    const { error: removalError } = await supabase.storage.from(MATERIAL_IMAGES_BUCKET).remove([oldPath])
    if (removalError) console.warn('Old material photo could not be removed', removalError.message)
  }
}
