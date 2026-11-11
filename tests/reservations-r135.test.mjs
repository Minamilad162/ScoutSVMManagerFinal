import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cairoDay, cairoDatetimeLocal, cairoLocalToISO, cairoRangeISO,
  bookingStatus, validateBookingEdit,
} from '../src/features/reservations/bookingRecords.ts'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const material = (overrides={}) => ({
  id:'m1',kind:'material',teamId:'t1',resourceId:'r1',qty:3,qtyReturned:0,approvedAt:null,
  startsAt:'2026-11-10T09:00:00Z',endsAt:'2026-11-11T09:00:00Z',createdAt:null,...overrides,
})
const land = (overrides={}) => ({...material(), kind:'field',qty:null,...overrides})
const year = {start:'2026-09-01',end:'2027-08-31'}

test('Both admin reservation routes render distinct components and stay admin-only',()=>{
  const app = read('src/App.tsx')
  assert.match(app, /path="AdminReservationsAll" element=\{<RouteAccessGuard adminOnly><ReservationsOverview\s*\/>/)
  assert.match(app, /path="reservation" element=\{<RouteAccessGuard adminOnly><ReservationsDirectManage\s*\/>/)
  assert.ok(!app.includes('AdminReservationsAll" element={<RouteAccessGuard adminOnly><ReservationsAdmin'))
})

test('Viewer renders no management controls; manager exposes editing, cancellation and logical delete',()=>{
  const view=read('src/pages/ReservationsOverview.tsx')
  const manager=read('src/pages/ReservationsDirectManage.tsx')
  const workspace=read('src/pages/ReservationsWorkspace.tsx')
  assert.match(view, /mode="overview"/)
  assert.match(manager, /mode="manage"/)
  assert.match(workspace,/\{manage && <td>/)
  assert.match(workspace,/\{manage && editRow && draft && !isReadOnlyView/)
  assert.match(workspace,/removeBooking\(row, 'cancel'\)/)
  assert.match(workspace,/removeBooking\(row, 'delete'\)/)
  assert.match(workspace,/soft_deleted_at: deletedAt/)
  assert.doesNotMatch(workspace,/\.delete\(\)/)
})

test('Both material and land bookings loaded with identical year/date boundaries',()=>{
  const api=read('src/features/reservations/bookingApi.ts')
  assert.match(api, /loadPages\('material_reservations'/)
  assert.match(api, /loadPages\('field_reservations'/)
  assert.match(api, /\.is\('soft_deleted_at', null\)/)
  assert.match(api, /\.lt\('starts_at', end\)/)
  assert.match(api, /\.gt\('ends_at', start\)/)
  assert.match(api, /material_return_approvals/)
})

test('View contains team + date filters but write controls are manager-only',()=>{
  const workspace=read('src/pages/ReservationsWorkspace.tsx')
  assert.match(workspace, /<label>الفريق<select/)
  assert.match(workspace, /<label>من تاريخ<input/)
  assert.match(workspace, /<label>إلى تاريخ<input/)
  assert.match(workspace, /\{manage && <label>نوع الحجز/)
  assert.match(workspace, /\{manage \? \(/)
  assert.match(workspace, /isReadOnlyView \|\| changing/)
})

test('Cairo local inputs round-trip across DST/non-DST',()=>{
  for (const value of ['2026-11-11T12:30','2027-01-10T09:00','2027-07-16T20:40']) {
    const iso = cairoLocalToISO(value)
    assert.ok(iso,value)
    assert.equal(cairoDatetimeLocal(iso),value)
  }
  assert.equal(cairoDay(new Date('2026-11-11T22:30:00Z')),'2026-11-12')
  const bounds = cairoRangeISO('2026-11-11','2026-11-11')
  assert.ok(new Date(bounds.start) < new Date(bounds.end))
  assert.ok(cairoRangeISO('2027-04-30','2027-04-30'), 'DST switch day must remain visible in the register')
})

test('Material returned/partial/overdue and land completed statuses are distinct',()=>{
  const now=Date.parse('2026-11-15T00:00:00Z')
  assert.equal(bookingStatus(material(),now).id,'overdue')
  assert.equal(bookingStatus(material({qtyReturned:1}),now).id,'partial')
  assert.equal(bookingStatus(material({qtyReturned:3}),now).id,'returned')
  assert.equal(bookingStatus(land(),now).id,'completed')
})

test('Current-year edit date and quantity validation',()=>{
  const row=material()
  const draft={teamId:'t1',resourceId:'r1',qty:3,startsAt:'2026-11-10T11:00',endsAt:'2026-11-11T11:00'}
  assert.equal(validateBookingEdit(row,draft,year),null)
  assert.match(validateBookingEdit(row,{...draft,endsAt:'2025-11-11T11:00'},year),/النهاية|السنة/)
  assert.match(validateBookingEdit(row,{...draft,qty:0},year),/الكمية/)
  assert.match(validateBookingEdit(row,{...draft,endsAt:'2026-11-10T10:00'},year),/بعد/)
})

test('No modifications possible in archived historical mode',()=>{
  const workspace=read('src/pages/ReservationsWorkspace.tsx')
  assert.match(workspace, /if \(!manage \|\| !editRow \|\| !draft \|\| isReadOnlyView/)
  assert.match(workspace, /if \(!manage \|\| isReadOnlyView \|\| changing/)
  assert.match(workspace, /disabled=\{changing \|\| isReadOnlyView\}/)
})
