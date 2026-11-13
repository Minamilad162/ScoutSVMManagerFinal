import test from 'node:test'
import assert from 'node:assert/strict'
import { scopedFieldMeetingDays, preferredFieldMeeting, canBookFieldForTeam, fieldBookingUnavailableReason } from '../src/features/reservations/fieldTeamBooking.ts'

const bounds = { start: '2026-11-01', end: '2026-12-17' }
const days = [
  {id:'a',meeting_date:'2026-11-05'}, {id:'b',meeting_date:'2026-11-19'},
  {id:'c',meeting_date:'2026-10-22'}, {id:'d',meeting_date:'2026-11-19'},
]
test('dates remain within the selected term and Scout Year, sorted and unique',()=> {
  assert.deepEqual(scopedFieldMeetingDays(days,bounds).map(d=>d.meeting_date),['2026-11-05','2026-11-19'])
  assert.deepEqual(scopedFieldMeetingDays(days,null),[])
})
test('defaults to upcoming meeting, not the first expired meeting in term',()=>{
  assert.equal(preferredFieldMeeting(scopedFieldMeetingDays(days,bounds),'2026-11-14'),'2026-11-19')
})
test('past meetings remain selectable for reading but are not bookable',()=>{
  assert.equal(preferredFieldMeeting(scopedFieldMeetingDays(days,bounds),'2027-01-01'),'2026-11-19')
  assert.match(fieldBookingUnavailableReason({canBook:true,readOnly:false,hasTeam:true,hasTerm:true,hasZone:true,selectedDate:'2026-11-05',registeredDates:days,today:'2026-11-14'}),/انتهى/)
})
test('team leader can book only own registered team',()=>{
  const roles=[{role_slug:'chef_de_legion',team_id:'team-a'}]
  assert.equal(canBookFieldForTeam(roles,'team-a','team-a',false),true)
  assert.equal(canBookFieldForTeam(roles,'team-b','team-a',false),false)
})
test('global materials manager may book own team but not arbitrary teams',()=>{
  const roles=[{role_slug:'responsable_materials',team_id:null}]
  assert.equal(canBookFieldForTeam(roles,'team-a','team-a',false),true)
  assert.equal(canBookFieldForTeam(roles,'team-b','team-a',false),false)
})
test('admin may book any team except historical read-only',()=>{
  const roles=[{role_slug:'admin',team_id:null}]
  assert.equal(canBookFieldForTeam(roles,'team-b','',false),true)
  assert.equal(canBookFieldForTeam(roles,'team-b','',true),false)
})
test('unrelated team roles do not grant booking permission',()=>{
  assert.equal(canBookFieldForTeam([{role_slug:'responsable_secretary',team_id:'team-a'}],'team-a','team-a',false),false)
  assert.equal(canBookFieldForTeam([],'team-a','team-a',false),false)
})
test('missing zones/meetings produce actionable errors',()=>{
  const base={canBook:true,readOnly:false,hasTeam:true,hasTerm:true,hasZone:true,selectedDate:'',registeredDates:[],today:'2026-11-14'}
  assert.match(fieldBookingUnavailableReason({...base,hasZone:false}),/قطاعات/)
  assert.match(fieldBookingUnavailableReason(base),/اجتماعات/)
})
