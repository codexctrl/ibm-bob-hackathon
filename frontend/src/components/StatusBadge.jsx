const STATUS_STYLES = {
  WAITING: 'bg-[#F1E6C4] text-[#7A5C10]',
  CALLED: 'bg-[#F1E6C4] text-[#7A5C10]',
  GATE_ENTERED: 'bg-[#DCE8EF] text-[#274A5E]',
  WEIGHING: 'bg-[#DCE8EF] text-[#274A5E]',
  QUALITY_CHECK: 'bg-[#DCE8EF] text-[#274A5E]',
  PROCUREMENT: 'bg-[#DCE8EF] text-[#274A5E]',
  COMPLETED: 'bg-[#DCEEDF] text-[#1D5A2E]',
  CANCELLED: 'bg-[#F3DCD7] text-[#7A2A1B]',
  PENDING: 'bg-[#F1E6C4] text-[#7A5C10]',
  PROCESSED: 'bg-[#DCEEDF] text-[#1D5A2E]',
  FAILED: 'bg-[#F3DCD7] text-[#7A2A1B]',
  APPROVED: 'bg-[#DCEEDF] text-[#1D5A2E]',
  REJECTED: 'bg-[#F3DCD7] text-[#7A2A1B]',
  PASSED: 'bg-[#DCEEDF] text-[#1D5A2E]',
  OPEN: 'bg-[#DCEEDF] text-[#1D5A2E]',
  FULL: 'bg-[#F3DCD7] text-[#7A2A1B]',
  REGISTERED: 'bg-[#EAE6D8] text-[#55503F]',
  ARRIVED: 'bg-[#F1E6C4] text-[#7A5C10]',
  WEIGHED: 'bg-[#DCE8EF] text-[#274A5E]',
  QUALITY_CHECKED: 'bg-[#DCE8EF] text-[#274A5E]',
  PROCURED: 'bg-[#DCEEDF] text-[#1D5A2E]'
};

export default function StatusBadge({ status }) {
  const classes = STATUS_STYLES[status] || 'bg-[#EAE6D8] text-[#55503F]';
  const label = String(status || '').replace(/_/g, ' ');
  return (
    <span className={`inline-block px-2.5 py-1 rounded text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
