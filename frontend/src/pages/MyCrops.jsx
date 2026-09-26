import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function MyCrops() {
  const { user } = useAuth();
  const [crops, setCrops] = useState([]);
  const [form, setForm] = useState({ cropType: '', quantityBags: '', harvestDate: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function loadCrops() {
    api.get(`/crops/farmer/${user.farmerId}`).then(setCrops).catch((err) => setError(err.message));
  }

  useEffect(loadCrops, [user.farmerId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/crops', {
        cropType: form.cropType,
        quantityBags: Number(form.quantityBags),
        harvestDate: form.harvestDate || null
      });
      setForm({ cropType: '', quantityBags: '', harvestDate: '' });
      loadCrops();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10 space-y-8">
      <h1 className="text-3xl font-semibold">My crops</h1>

      <form onSubmit={handleSubmit} className="field-card p-5 space-y-4">
        <h2 className="font-semibold text-lg">Register a new crop</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="cropType">Crop</label>
            <input
              id="cropType"
              className="input-field"
              value={form.cropType}
              onChange={(e) => setForm((f) => ({ ...f, cropType: e.target.value }))}
              placeholder="e.g. Paddy"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="quantityBags">Quantity (bags)</label>
            <input
              id="quantityBags"
              type="number"
              min="1"
              className="input-field"
              value={form.quantityBags}
              onChange={(e) => setForm((f) => ({ ...f, quantityBags: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="harvestDate">Harvest date</label>
            <input
              id="harvestDate"
              type="date"
              className="input-field"
              value={form.harvestDate}
              onChange={(e) => setForm((f) => ({ ...f, harvestDate: e.target.value }))}
            />
          </div>
        </div>
        {error && <p className="text-rust text-sm">{error}</p>}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Add crop'}
        </button>
      </form>

      <div className="field-card divide-y divide-[#E4DCC8]">
        {crops.length === 0 && <p className="p-4 text-sm text-[#8A8468]">No crops registered yet.</p>}
        {crops.map((crop) => (
          <div key={crop.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{crop.crop_type}</p>
              <p className="text-sm text-[#8A8468]">
                {crop.quantity_bags} bags
                {crop.harvest_date ? ` · harvested ${crop.harvest_date.slice(0, 10)}` : ''}
              </p>
            </div>
            <StatusBadge status={crop.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
