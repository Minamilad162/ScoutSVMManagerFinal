import { useScoutYear } from '../components/ScoutYearProvider'

/**
 * Backward-compatible hook. It now reads from the central Scout Year context so
 * Super Admin historical-year selection is reflected consistently across pages.
 */
export function useCurrentScoutYear() {
  const { currentScoutYear, loading, error, reload } = useScoutYear()
  return {
    currentScoutYear,
    loading,
    error,
    refresh: reload,
  }
}
