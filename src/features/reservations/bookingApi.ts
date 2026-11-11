import { supabase } from '../../lib/supabase'
import type { BookingRecord, NamedItem } from './bookingRecords'
import { cairoRangeISO } from './bookingRecords'

export type BookingSnapshot = { rows: BookingRecord[]; teams: NamedItem[]; materials: NamedItem[]; zones: NamedItem[]; approvalsAvailable: boolean }

async function loadPages(table: 'material_reservations' | 'field_reservations', fields: string, start: string, end: string): Promise<any[]> {
  const all: any[] = []
  for (let offset = 0; offset < 20000; offset += 500) {
    const { data, error } = await supabase.from(table)
      .select(fields)
      .is('soft_deleted_at', null)
      .lt('starts_at', end)
      .gt('ends_at', start)
      .order('starts_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + 499)
    if (error) throw error
    const chunk = (data || []) as any[]
    all.push(...chunk)
    if (chunk.length < 500) break
  }
  return all
}

export async function loadBookingSnapshot(startDate: string, endDate: string): Promise<BookingSnapshot> {
  const range = cairoRangeISO(startDate, endDate)
  if (!range || startDate > endDate) return { rows: [], teams: [], materials: [], zones: [], approvalsAvailable: true }
  const [materialRows, fieldRows, teamsReply, materialsReply, zonesReply] = await Promise.all([
    loadPages('material_reservations', 'id,team_id,material_id,qty,starts_at,ends_at,created_at', range.start, range.end),
    loadPages('field_reservations', 'id,team_id,field_zone_id,starts_at,ends_at,created_at', range.start, range.end),
    supabase.from('teams').select('id,name').order('name'),
    supabase.from('materials').select('id,name').order('name'),
    supabase.from('field_zones').select('id,name').order('name'),
  ])
  if (teamsReply.error) throw teamsReply.error
  if (materialsReply.error) throw materialsReply.error
  if (zonesReply.error) throw zonesReply.error

  const approvals = new Map<string, { quantity: number; approvedAt: string | null }>()
  let approvalsAvailable = true
  const ids = materialRows.map((row) => row.id as string)
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await supabase.from('material_return_approvals')
      .select('reservation_id,qty_returned,approved_at')
      .in('reservation_id', ids.slice(offset, offset + 100))
      .is('soft_deleted_at', null)
    if (error) { approvalsAvailable = false; break }
    for (const row of (data || []) as any[]) {
      const existing = approvals.get(row.reservation_id) || { quantity: 0, approvedAt: null }
      approvals.set(row.reservation_id, {
        quantity: existing.quantity + Math.max(0, Number(row.qty_returned) || 0),
        approvedAt: row.approved_at && (!existing.approvedAt || row.approved_at > existing.approvedAt) ? row.approved_at : existing.approvedAt,
      })
    }
  }

  const rows: BookingRecord[] = [
    ...materialRows.map((row) => ({
      id: row.id, kind: 'material' as const, teamId: row.team_id, resourceId: row.material_id,
      qty: Number(row.qty), startsAt: row.starts_at, endsAt: row.ends_at, createdAt: row.created_at,
      qtyReturned: approvals.get(row.id)?.quantity || 0, approvedAt: approvals.get(row.id)?.approvedAt || null,
    })),
    ...fieldRows.map((row) => ({
      id: row.id, kind: 'field' as const, teamId: row.team_id, resourceId: row.field_zone_id,
      qty: null, startsAt: row.starts_at, endsAt: row.ends_at, createdAt: row.created_at,
      qtyReturned: 0, approvedAt: null,
    })),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))

  return {
    rows,
    teams: (teamsReply.data || []) as NamedItem[],
    materials: (materialsReply.data || []) as NamedItem[],
    zones: (zonesReply.data || []) as NamedItem[],
    approvalsAvailable,
  }
}
