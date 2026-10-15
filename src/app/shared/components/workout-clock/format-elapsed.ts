/**
 * Elapsed time counting up: m:ss, from one hour h:mm:ss; partial seconds are dropped. Kept apart
 * from `WorkoutClock` so the app shell (paused workout bar) does not pull the clock into the
 * initial bundle.
 */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}
