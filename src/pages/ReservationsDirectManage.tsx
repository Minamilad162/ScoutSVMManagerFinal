import ReservationsWorkspace from './ReservationsWorkspace'

/** Explicitly privileged admin management route, separate from the read-only register. */
export default function ReservationsDirectManage() {
  return <ReservationsWorkspace mode="manage" />
}
