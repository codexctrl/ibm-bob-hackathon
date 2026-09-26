import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';

const NEXT_STATUS = {
  WAITING: 'CALLED',
  CALLED: 'GATE_ENTERED',
  GATE_ENTERED: 'WEIGHING'
};

export default function OfficerDashboard() {
  const [centres, setCentres] = useState([]);
  const [centreId, setCentreId] = useState('');
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Inline forms for the token currently being processed
  const [activeTokenId, setActiveTokenId] = useState(null);
  const [weightForm, setWeightForm] = useState({ netWeightKg: '' });
  const [qualityForm, setQualityForm] = useState({ qualityGrade: '', qualityStatus: 'PASSED' });
  const [approveForm, setApproveForm] = useState({ ratePerBag: '', decision: 'APPROVED' });

  useEffect(() => {
    api.get('/centres').then((data) => {
      setCentres(data);
      if (data[0]) setCentreId(String(data[0].id));
    }).catch((err) => setError(err.message));
  }, []);

  const loadQueue = useCallback(() => {
    if (!centreId) return;
    api.get(`/queue/centre/${centreId}`).then(setQueue).catch((err) => setError(err.message));
  }, [centreId]);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 10000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  async function advanceStatus(token) {
    const next = NEXT_STATUS[token.status];
    if (!next) return;
    setError('');
    try {
      await api.patch(`/tokens/${token.id}/status`, { status: next });
      loadQueue();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitWeighing(tokenId) {
    setError(''); setMessage('');
    try {
      await api.post('/procurement/weighing', { tokenId, netWeightKg: Number(weightForm.netWeightKg) });
      setMessage('Weight recorded.');
      setWeightForm({ netWeightKg: '' });
      loadQueue();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitQuality(tokenId) {
    setError(''); setMessage('');
    try {
      await api.post('/procurement/quality', { tokenId, ...qualityForm });
      setMessage('Quality result recorded.');
      loadQueue();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitApproval(tokenId) {
    setError(''); setMessage('');
    try {
      const proc = await api.post('/procurement/approve', {
        tokenId,
        ratePerBag: Number(approveForm.ratePerBag),
        decision: approveForm.decision
      });
      await api.patch(`/tokens/${tokenId}/status`, { status: 'COMPLETED' });
      setMessage(`Procurement ${approveForm.decision.toLowerCase()}. Amount: ₹${Number(proc.approved_amount).toLocaleString('en-IN')}`);
      setActiveTokenId(null);
      loadQueue();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-10 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-semibold">Procurement queue</h1>
        <select className="input-field w-auto" value={centreId} onChange={(e) => setCentreId(e.target.value)}>
          {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {message && <p className="text-growth text-sm">{message}</p>}
      {error && <p className="text-rust text-sm">{error}</p>}

      <div className="field-card divide-y divide-[#E4DCC8]">
        {queue.length === 0 && <p className="p-4 text-sm text-[#8A8468]">No active tokens for this centre today.</p>}
        {queue.map((t) => (
          <div key={t.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-medium">#{t.queue_position} · {t.token_number} · {t.farmer_name}</p>
                <p className="text-sm text-[#8A8468]">{t.crop_type} — {t.quantity_bags} bags</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={t.status} />
                {NEXT_STATUS[t.status] && (
                  <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => advanceStatus(t)}>
                    Advance to {NEXT_STATUS[t.status].replace('_', ' ')}
                  </button>
                )}
                {t.status === 'WEIGHING' && (
                  <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => setActiveTokenId(t.id)}>
                    Record weight
                  </button>
                )}
                {t.status === 'QUALITY_CHECK' && (
                  <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => setActiveTokenId(t.id)}>
                    Record quality
                  </button>
                )}
                {t.status === 'PROCUREMENT' && (
                  <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => setActiveTokenId(t.id)}>
                    Approve procurement
                  </button>
                )}
              </div>
            </div>

            {activeTokenId === t.id && t.status === 'WEIGHING' && (
              <div className="flex gap-3 items-end bg-[#F1EEE2] p-3 rounded">
                <div>
                  <label className="label">Net weight (kg)</label>
                  <input
                    className="input-field w-40"
                    type="number"
                    value={weightForm.netWeightKg}
                    onChange={(e) => setWeightForm({ netWeightKg: e.target.value })}
                  />
                </div>
                <button className="btn-primary text-sm" onClick={() => submitWeighing(t.id)}>Save</button>
              </div>
            )}

            {activeTokenId === t.id && t.status === 'QUALITY_CHECK' && (
              <div className="flex gap-3 items-end bg-[#F1EEE2] p-3 rounded flex-wrap">
                <div>
                  <label className="label">Grade</label>
                  <input
                    className="input-field w-24"
                    value={qualityForm.qualityGrade}
                    onChange={(e) => setQualityForm((f) => ({ ...f, qualityGrade: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Result</label>
                  <select
                    className="input-field w-32"
                    value={qualityForm.qualityStatus}
                    onChange={(e) => setQualityForm((f) => ({ ...f, qualityStatus: e.target.value }))}
                  >
                    <option value="PASSED">Passed</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>
                <button className="btn-primary text-sm" onClick={() => submitQuality(t.id)}>Save</button>
              </div>
            )}

            {activeTokenId === t.id && t.status === 'PROCUREMENT' && (
              <div className="flex gap-3 items-end bg-[#F1EEE2] p-3 rounded flex-wrap">
                <div>
                  <label className="label">Rate per bag (₹)</label>
                  <input
                    className="input-field w-32"
                    type="number"
                    value={approveForm.ratePerBag}
                    onChange={(e) => setApproveForm((f) => ({ ...f, ratePerBag: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Decision</label>
                  <select
                    className="input-field w-32"
                    value={approveForm.decision}
                    onChange={(e) => setApproveForm((f) => ({ ...f, decision: e.target.value }))}
                  >
                    <option value="APPROVED">Approve</option>
                    <option value="REJECTED">Reject</option>
                  </select>
                </div>
                <button className="btn-primary text-sm" onClick={() => submitApproval(t.id)}>Confirm</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
