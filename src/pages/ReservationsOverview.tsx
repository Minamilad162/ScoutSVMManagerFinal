import ReservationsWorkspace from './ReservationsWorkspace'

/** Admin bookings register — no edit, cancel, delete, or creation controls. */
export default function ReservationsOverview() {
  return <ReservationsWorkspace mode="overview" />
}
