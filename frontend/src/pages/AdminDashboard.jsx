import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [centres, setCentres] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/analytics/overview').then(setOverview).catch((err) => setError(err.message));
    api.get('/analytics/centres').then(setCentres).catch(() => {});
  }, []);

  if (error) return <div className="max-w-4xl mx-auto px-5 py-10 text-rust">{error}</div>;
  if (!overview) return <div className="max-w-4xl mx-auto px-5 py-10 text-[#55503F]">Loading analytics…</div>;

  const stats = [
    { label: 'Farmers today', value: overview.farmersToday },
    { label: 'Kg procured today', value: overview.totalKgProcuredToday.toLocaleString('en-IN') },
    { label: 'Avg. wait (min)', value: overview.avgWaitMinutesToday },
    { label: 'Pending payments', value: `${overview.pendingPayments.count} · ₹${overview.pendingPayments.totalAmount.toLocaleString('en-IN')}` }
  ];

  return (
    <div className="max-w-4xl mx-auto px-5 py-10 space-y-8">
      <h1 className="text-3xl font-semibold">Admin analytics</h1>

      <div className="grid sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="field-card p-4">
            <p className="text-2xl font-display font-semibold text-field">{s.value}</p>
            <p className="text-sm text-[#8A8468]">{s.label}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-3">Crop-wise statistics</h2>
        <div className="field-card divide-y divide-[#E4DCC8]">
          {overview.cropStats.map((c) => (
            <div key={c.crop_type} className="p-3 flex items-center justify-between">
              <p className="font-medium">{c.crop_type}</p>
              <p className="text-sm text-[#8A8468]">{c.count} visits · {c.total_bags} bags</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Centre performance (today)</h2>
        <div className="field-card divide-y divide-[#E4DCC8]">
          {centres.map((c) => (
            <div key={c.id} className="p-3 flex items-center justify-between">
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-[#8A8468]">{c.completed_today}/{c.tokens_today} completed</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
