import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { scopedReservationTerms, scopedReservationMeetings, preferredReservationMeeting, reservationSelectionBounds } from '../src/features/reservations/bookingPeriod.ts'

const year = { id:'2026', start_date:'2026-09-01', end_date:'2027-08-31' }
const other = { id:'2025', start_date:'2025-09-01', end_date:'2026-08-31' }
const currentTerm = { id:'fall',name:'ترم أول',scout_year_id:'2026',start_date:'2026-09-15',end_date:'2026-12-31' }
const oldTerm = { id:'old',name:'ترم قديم',scout_year_id:'2025',start_date:'2025-09-15',end_date:'2025-12-31' }
const meetings = [{id:'one',meeting_date:'2026-10-01'},{id:'two',meeting_date:'2026-11-11'},{id:'three',meeting_date:'2026-12-05'}]
const source = (p)=>readFileSync(resolve(import.meta.dirname,'..',p),'utf-8')

test('Never allow terms from another Scout Year in admin reservation filters',()=>{
  assert.deepEqual(scopedReservationTerms([oldTerm,currentTerm],year).map((item)=>item.id),['fall'])
  assert.deepEqual(scopedReservationTerms([currentTerm,oldTerm],other).map((item)=>item.id),['old'])
  assert.equal(reservationSelectionBounds(year,oldTerm,'all',[]),null)
})

test('Only meeting dates within the selected term/year can appear',()=>{
  const rows=[{id:'invalid',meeting_date:'2025-11-11'},...meetings,{id:'repeat',meeting_date:'2026-11-11'}, {id:'invalid2',meeting_date:'2027-02-01'}]
  assert.deepEqual(scopedReservationMeetings(rows,{start:'2026-09-15',end:'2026-12-31'}).map(x=>x.meeting_date), meetings.map(x=>x.meeting_date))
})

test('Selected meeting must be a registered day in that term and not an arbitrary date',()=>{
  assert.deepEqual(reservationSelectionBounds(year,currentTerm,'2026-11-11',meetings),{start:'2026-11-11',end:'2026-11-11'})
  assert.equal(reservationSelectionBounds(year,currentTerm,'2026-11-12',meetings),null)
  assert.equal(reservationSelectionBounds(year,currentTerm,'2025-11-11',meetings),null)
  assert.deepEqual(reservationSelectionBounds(year,currentTerm,'all',meetings),{start:'2026-09-15',end:'2026-12-31'})
  assert.equal(reservationSelectionBounds(year,null,'all',meetings),null)
})

test('Defaults to the current or nearest scheduled meeting, then latest past day',()=>{
  assert.equal(preferredReservationMeeting(meetings,'2026-11-11'),'2026-11-11')
  assert.equal(preferredReservationMeeting(meetings,'2026-11-12'),'2026-12-05')
  assert.equal(preferredReservationMeeting(meetings,'2027-01-01'),'2026-12-05')
  assert.equal(preferredReservationMeeting([],'2026-11-11'),'all')
})

test('Both viewer and manager routes use shared term then meeting selectors with no manual date range',()=>{
  const workspace=source('src/pages/ReservationsWorkspace.tsx')
  assert.match(workspace, /\.from\('terms'\)[\s\S]*?\.eq\('scout_year_id', currentScoutYear\.id\)/)
  assert.match(workspace, /\.from\('term_meeting_dates'\)[\s\S]*?\.eq\('term_id', termId\)/)
  assert.match(workspace, /reservationSelectionBounds\(currentScoutYear, selectedTerm, meetingDate, meetingDates\)/)
  assert.match(workspace, /<label>الترم/)
  assert.match(workspace, /<label>الاجتماع المسجّل/)
  assert.doesNotMatch(workspace, /<label>من تاريخ<input|<label>إلى تاريخ<input/)
  assert.match(source('src/pages/ReservationsOverview.tsx'),/mode="overview"/)
  assert.match(source('src/pages/ReservationsDirectManage.tsx'),/mode="manage"/)
})
