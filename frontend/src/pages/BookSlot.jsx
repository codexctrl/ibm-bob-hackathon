import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function BookSlot() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [centres, setCentres] = useState([]);
  const [loadingCentres, setLoadingCentres] = useState(true);
  const [selectedCentre, setSelectedCentre] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [crops, setCrops] = useState([]);
  const [loadingCrops, setLoadingCrops] = useState(true);
  const [selectedCropId, setSelectedCropId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/centres')
      .then(setCentres)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingCentres(false));
    api.get(`/crops/farmer/${user.farmerId}`)
      .then(setCrops)
      .catch(() => {})
      .finally(() => setLoadingCrops(false));
  }, [user.farmerId]);

  function selectCentre(centre) {
    setSelectedCentre(centre);
    setSlots([]);
    setError('');
    setLoadingSlots(true);
    api.get(`/slots/centre/${centre.id}`)
      .then(setSlots)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingSlots(false));
  }

  async function bookAndIssueToken(slot) {
    if (!selectedCropId) {
      setError('Choose which crop this visit is for first.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/slots/book', { slotId: slot.id });
      const token = await api.post('/tokens', { cropId: selectedCropId, slotId: slot.id });
      navigate(`/token/${token.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10 space-y-6">
      <h1 className="text-3xl font-semibold">Book a procurement slot</h1>

      {!loadingCrops && crops.length === 0 && (
        <p className="text-sm text-rust">
          You need to register a crop before booking a slot. Go to{' '}
          <a href="/my-crops" className="underline font-medium">My Crops</a> first.
        </p>
      )}

      {crops.length > 0 && (
        <div>
          <label className="label" htmlFor="crop">Which crop is this visit for?</label>
          <select
            id="crop"
            className="input-field"
            value={selectedCropId}
            onChange={(e) => setSelectedCropId(e.target.value)}
          >
            <option value="">Select a crop…</option>
            {crops.map((c) => (
              <option key={c.id} value={c.id}>{c.crop_type} — {c.quantity_bags} bags</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-lg mb-3">1. Choose a centre</h2>
        {loadingCentres && <p className="text-sm text-[#8A8468]">Loading centres…</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          {centres.map((centre) => (
            <button
              key={centre.id}
              onClick={() => selectCentre(centre)}
              className={`field-card p-4 text-left ${selectedCentre?.id === centre.id ? 'border-field border-2' : ''}`}
            >
              <p className="font-medium">{centre.name}</p>
              <p className="text-sm text-[#8A8468]">{centre.address}</p>
            </button>
          ))}
        </div>
      </div>

      {selectedCentre && (
        <div>
          <h2 className="font-semibold text-lg mb-3">2. Choose an available slot</h2>
          <div className="field-card divide-y divide-[#E4DCC8]">
            {loadingSlots && <p className="p-4 text-sm text-[#8A8468]">Loading slots…</p>}
            {!loadingSlots && slots.length === 0 && <p className="p-4 text-sm text-[#8A8468]">No upcoming slots.</p>}
            {slots.map((slot) => {
              const full = slot.status === 'FULL' || slot.booked_count >= slot.capacity;
              return (
                <div key={slot.id} className="p-4 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-medium">
                      {slot.slot_date.slice(0, 10)}, {slot.start_time}–{slot.end_time}
                    </p>
                    <p className="text-sm text-[#8A8468]">
                      {slot.booked_count}/{slot.capacity} booked
                    </p>
                  </div>
                  <button
                    className="btn-primary text-sm py-2 px-4"
                    disabled={full || submitting}
                    onClick={() => bookAndIssueToken(slot)}
                  >
                    {full ? 'Full' : submitting ? 'Booking…' : 'Book this slot'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-rust text-sm">{error}</p>}
    </div>
  );
}
