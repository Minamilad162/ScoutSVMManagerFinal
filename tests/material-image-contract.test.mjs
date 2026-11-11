import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const read = (p) => readFileSync(new URL(p, `file://${root}`), 'utf8')
const admin = read('src/pages/MaterialsAdmin.tsx')
const booking = read('src/pages/MaterialsTeamReservations.tsx')
const migration = read('supabase/26_material_images.sql')

test('inventory editor accepts only bounded safe image types and can remove pictures', () => {
  assert.match(admin, /validateMaterialImage/)
  assert.match(admin, /accept="image\/jpeg,image\/png,image\/webp"/)
  assert.match(admin, /removeMaterialPhoto\(materialId, previousPath\)/)
  assert.match(admin, /saveMaterialPhoto\(materialId, mImage, previousPath\)/)
})

test('booking cards render catalog photo and preserve fallback glyph', () => {
  assert.match(booking, /materials119-tool-photo/)
  assert.match(booking, /<MaterialGlyph category=\{cat\} \/>/)
  assert.match(booking, /loadMaterialImageCatalog\(\)/)
})

test('additive migration limits storage file size and write permission', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS image_path/)
  assert.match(migration, /3145728/)
  assert.match(migration, /public\.has_role\('admin'\)/)
  assert.match(migration, /public\.has_role\('responsable_materials'\)/)
  assert.match(migration, /ON storage\.objects/)
})

test('non-migrated database keeps inventory and reservations usable', () => {
  assert.match(read('src/features/materialImages/api.ts'), /isMaterialImageColumnMissing\(error\)/)
  assert.match(admin, /!imagesEnabled/)
})

test('image types and 3 MB limit are enforced before upload', async () => {
  const { validateMaterialImage, materialImagePath } = await import('../src/features/materialImages/rules.ts')
  assert.equal(validateMaterialImage({ type: 'image/jpeg', size: 3145728 }), null)
  assert.equal(validateMaterialImage({ type: 'image/svg+xml', size: 1000 })?.includes('JPG'), true)
  assert.equal(validateMaterialImage({ type: 'image/png', size: 3145729 })?.includes('3'), true)
  assert.equal(validateMaterialImage({ type: 'image/webp', size: 1024 }), null)
  assert.equal(materialImagePath('729e7d24-4270-4ab1-9328-7f0175a05e4b', 'image/png', '679978ed-b102-4415-8c40-873f0c26b078'), '729e7d24-4270-4ab1-9328-7f0175a05e4b/679978ed-b102-4415-8c40-873f0c26b078.png')
})
