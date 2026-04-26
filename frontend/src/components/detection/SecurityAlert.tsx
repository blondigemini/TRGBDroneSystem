// components/detection/SecurityAlert.tsx
// Renders a tamper-detection banner when frame verification fails.

interface TamperEvent {
  code: string;
  detail: string;
}

export interface SecurityAssessment {
  status: 'OK' | 'UNSIGNED' | 'HASH_MISMATCH' | 'SIGNATURE_INVALID' | 'CHAIN_BROKEN';
  frame_hash: string;
  tamper_event: TamperEvent | null;
}

const TAMPER_STATUSES = new Set(['HASH_MISMATCH', 'SIGNATURE_INVALID', 'CHAIN_BROKEN']);

/**
 * If the security status is a tamper event, renders a red warning banner.
 * For "OK" or "UNSIGNED" status, renders nothing.
 *
 * Usage:
 *   <SecurityAlert security={data.security} />
 *   <div className={isTampered ? 'opacity-40 pointer-events-none' : ''}>
 *     ...result card...
 *   </div>
 */
export function SecurityAlert({ security }: { security?: SecurityAssessment | null }) {
  if (!security || !TAMPER_STATUSES.has(security.status)) {
    return null;
  }

  return (
    <div className="rounded-lg border border-red-500/60 bg-red-950/60 p-4 flex items-start gap-3">
      {/* Warning icon */}
      <svg
        className="mt-0.5 h-5 w-5 shrink-0 text-red-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-red-300">
          Security Alert — Tamper Detected
        </span>
        {security.tamper_event?.detail && (
          <span className="text-xs text-red-400/90 leading-relaxed">
            {security.tamper_event.detail}
          </span>
        )}
        <span className="text-xs text-red-500/70 font-mono mt-1">
          Frame hash: {security.frame_hash.slice(0, 16)}...
        </span>
      </div>
    </div>
  );
}

/** Returns true when the security status represents a tamper event. */
export function isTamperEvent(security?: SecurityAssessment | null): boolean {
  return !!security && TAMPER_STATUSES.has(security.status);
}
