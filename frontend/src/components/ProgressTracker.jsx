const STAGES = [
  { key: 'WAITING', label: 'Arrival' },
  { key: 'GATE_ENTERED', label: 'Gate' },
  { key: 'WEIGHING', label: 'Weighing' },
  { key: 'QUALITY_CHECK', label: 'Quality' },
  { key: 'PROCUREMENT', label: 'Procurement' },
  { key: 'COMPLETED', label: 'Payment' }
];

/**
 * Renders the crop's journey as beads on a stem line - CropFlow's
 * one signature visual element, reused everywhere a token's stage
 * needs to be shown (farmer app, officer dashboard, operator portal).
 */
export default function ProgressTracker({ status, rejected = false }) {
  const currentIndex = STAGES.findIndex((s) => s.key === status);
  const effectiveIndex = status === 'CANCELLED' ? -1 : currentIndex;

  return (
    <div className="rail" role="list" aria-label="Crop procurement progress">
      {STAGES.map((stage, i) => {
        const isDone = i < effectiveIndex || (i === effectiveIndex && status === 'COMPLETED' && !rejected);
        const isActive = i === effectiveIndex && status !== 'COMPLETED';
        const isRejectedHere = rejected && i === effectiveIndex;

        let beadClass = 'rail-bead';
        if (isRejectedHere) beadClass += ' rejected';
        else if (isDone) beadClass += ' done';
        else if (isActive) beadClass += ' active';

        const lineFilled = i < effectiveIndex;

        return (
          <div className="rail-segment" key={stage.key} role="listitem">
            {i !== 0 && <div className={`rail-line ${lineFilled ? 'filled' : ''}`} />}
            <div className="flex flex-col items-center gap-1 px-1">
              <div className={beadClass} title={stage.label} />
              <span className="text-[11px] text-[#55503F] whitespace-nowrap">{stage.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
