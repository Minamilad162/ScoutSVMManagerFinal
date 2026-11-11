/** Image catalog rules shared by inventory editor and reservation cards. */
export const MATERIAL_IMAGES_BUCKET = 'material-images'
export const MATERIAL_IMAGE_MAX_BYTES = 3 * 1024 * 1024
export const MATERIAL_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function validateMaterialImage(file: Pick<File, 'type' | 'size'>): string | null {
  if (!Object.prototype.hasOwnProperty.call(MATERIAL_IMAGE_TYPES, file.type))
    return 'الصورة يجب أن تكون JPG أو PNG أو WebP فقط'
  if (file.size <= 0 || file.size > MATERIAL_IMAGE_MAX_BYTES)
    return 'الحد الأقصى لحجم الصورة 3 ميجابايت'
  return null
}

export function materialImagePath(materialId: string, mime: string, uniqueId: string): string {
  const ext = MATERIAL_IMAGE_TYPES[mime]
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(materialId) || !/^[0-9a-f-]{36}$/i.test(uniqueId) || !ext)
    throw new Error('بيانات صورة الأداة غير صالحة')
  return `${materialId}/${uniqueId}.${ext}`
}

export function isMaterialImageColumnMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  const code = String(error.code || '')
  return (code === '42703' || code === 'PGRST204' || code === 'PGRST200') && /image_path/i.test(String(error.message || ''))
}
