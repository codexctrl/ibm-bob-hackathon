import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ProgressTracker from '../components/ProgressTracker';

export default function FarmerDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/farmers/${user.farmerId}`)
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, [user.farmerId]);

  if (error) return <div className="max-w-3xl mx-auto px-5 py-10 text-rust">{error}</div>;
  if (!summary) return <div className="max-w-3xl mx-auto px-5 py-10 text-[#55503F]">Loading your dashboard…</div>;

  const { farmer, crops, latestToken, recentPayments } = summary;

  return (
    <div className="max-w-3xl mx-auto px-5 py-10 space-y-8">
      <div>
        <p className="text-sm text-harvest font-medium tracking-wide">{farmer.farmer_code}</p>
        <h1 className="text-3xl font-semibold">Welcome, {farmer.name}</h1>
        <p className="text-[#55503F]">{farmer.address}</p>
      </div>

      {latestToken ? (
        <section className="field-card p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <p className="text-xs text-[#8A8468] uppercase tracking-wide">Latest token</p>
              <p className="text-xl font-semibold font-display">{latestToken.token_number}</p>
            </div>
            <StatusBadge status={latestToken.status} />
          </div>

          <ProgressTracker status={latestToken.status} />

          <div className="grid sm:grid-cols-2 gap-4 mt-6 text-sm">
            <div>
              <p className="text-[#8A8468]">Centre</p>
              <p className="font-medium">{latestToken.centre_name}</p>
            </div>
            <div>
              <p className="text-[#8A8468]">Slot</p>
              <p className="font-medium">
                {latestToken.slot_date?.slice(0, 10)}, {latestToken.start_time}–{latestToken.end_time}
              </p>
            </div>
          </div>

          <Link to={`/token/${latestToken.id}`} className="btn-secondary inline-block mt-6 text-sm">
            View live queue &amp; progress
          </Link>
        </section>
      ) : (
        <section className="field-card p-6">
          <p className="text-[#55503F] mb-4">You don't have an active token yet.</p>
          <Link to="/book-slot" className="btn-primary inline-block text-sm">Book a procurement slot</Link>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">My crops</h2>
          <Link to="/my-crops" className="text-sm text-field underline font-medium">Manage crops</Link>
        </div>
        <div className="field-card divide-y divide-[#E4DCC8]">
          {crops.length === 0 && <p className="p-4 text-sm text-[#8A8468]">No crops registered yet.</p>}
          {crops.slice(0, 3).map((crop) => (
            <div key={crop.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{crop.crop_type}</p>
                <p className="text-sm text-[#8A8468]">{crop.quantity_bags} bags</p>
              </div>
              <StatusBadge status={crop.status} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Recent payments</h2>
          <Link to="/payments" className="text-sm text-field underline font-medium">View all</Link>
        </div>
        <div className="field-card divide-y divide-[#E4DCC8]">
          {recentPayments.length === 0 && <p className="p-4 text-sm text-[#8A8468]">No payments yet.</p>}
          {recentPayments.slice(0, 3).map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between">
              <p className="font-medium">₹{Number(p.amount).toLocaleString('en-IN')}</p>
              <StatusBadge status={p.status} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
