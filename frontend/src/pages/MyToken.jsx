import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ProgressTracker from '../components/ProgressTracker';

const REFRESH_MS = 15000;

export default function MyToken() {
  const { id } = useParams();
  const [token, setToken] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get(`/tokens/${id}`).then(setToken).catch((err) => setError(err.message));
    api.get(`/queue/token/${id}`).then(setQueueStatus).catch(() => {});
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  if (error) return (
    <div className="max-w-2xl mx-auto px-5 py-10 space-y-3">
      <p className="text-rust">{error}</p>
      <button onClick={load} className="btn-secondary text-sm py-2 px-4">Try again</button>
    </div>
  );
  if (!token) return <div className="max-w-2xl mx-auto px-5 py-10 text-[#55503F]">Loading token…</div>;

  const rejected = token.status === 'CANCELLED';

  return (
    <div className="max-w-2xl mx-auto px-5 py-10 space-y-6">
      <div>
        <p className="text-sm text-harvest font-medium tracking-wide">Token</p>
        <h1 className="text-3xl font-semibold font-display">{token.token_number}</h1>
        <p className="text-[#55503F]">{token.centre_name}</p>
      </div>

      <section className="field-card p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold">Journey progress</p>
          <StatusBadge status={token.status} />
        </div>
        <ProgressTracker status={token.status} rejected={rejected} />
      </section>

      {queueStatus && (token.status === 'WAITING' || token.status === 'CALLED') && (
        <section className="field-card p-6">
          <p className="font-semibold mb-3">Live queue</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[#8A8468]">Farmers ahead of you</p>
              <p className="text-2xl font-display font-semibold">{queueStatus.farmersAhead}</p>
            </div>
            <div>
              <p className="text-[#8A8468]">Estimated wait</p>
              <p className="text-2xl font-display font-semibold">{queueStatus.estimatedWaitMinutes} min</p>
            </div>
          </div>
          <p className="text-xs text-[#8A8468] mt-3">Based on: {queueStatus.explanation}</p>
        </section>
      )}

      <section className="field-card p-6 grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[#8A8468] text-sm">Crop</p>
          <p className="font-medium">{token.crop_type} · {token.quantity_bags} bags</p>
        </div>
        <div>
          <p className="text-[#8A8468] text-sm">Slot</p>
          <p className="font-medium">
            {token.slot_date?.slice(0, 10)}, {token.start_time}–{token.end_time}
          </p>
        </div>
      </section>
    </div>
  );
}
