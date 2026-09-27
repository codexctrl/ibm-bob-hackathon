import { useState } from 'react';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function OperatorDashboard() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [farmerDetail, setFarmerDetail] = useState(null);
  const [newFarmer, setNewFarmer] = useState({ name: '', phone: '', address: '', language: 'en' });
  const [centres, setCentres] = useState([]);
  const [slots, setSlots] = useState([]);
  const [crops, setCrops] = useState([]);
  const [selectedCropId, setSelectedCropId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function loadCentresOnce() {
    if (centres.length === 0) api.get('/centres').then(setCentres).catch(() => {});
  }

  async function handleSearch(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await api.get(`/farmers/search?q=${encodeURIComponent(query)}`);
      setResults(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function openFarmer(farmer) {
    setSelectedFarmer(farmer);
    setError('');
    loadCentresOnce();
    try {
      const [detail, cropList] = await Promise.all([
        api.get(`/farmers/${farmer.id}`),
        api.get(`/crops/farmer/${farmer.id}`)
      ]);
      setFarmerDetail(detail);
      setCrops(cropList);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAssistedRegister(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const data = await api.post('/auth/assisted-register', newFarmer);
      setMessage(`Registered ${data.farmer.farmer_code} for ${data.user.name}.`);
      setNewFarmer({ name: '', phone: '', address: '', language: 'en' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function selectCentre(centre) {
    setError('');
    try {
      const slotList = await api.get(`/slots/centre/${centre.id}`);
      setSlots(slotList);
    } catch (err) {
      setError(err.message);
    }
  }

  async function bookForFarmer(slot) {
  if (!selectedCropId) {
    setError('Choose which crop this visit is for.');
    return;
  }

  setError('');
  setMessage('');

  try {
    const token = await api.post('/slots/book', {
      slotId: slot.id,
      farmerId: Number(selectedFarmer.id),
      cropId: Number(selectedCropId)
    });

    setMessage(
      `Token ${token.token_number} issued. Print this slip for the farmer.`
    );
  } catch (err) {
    setError(err.message);
  }
}

  return (
    <div className="max-w-3xl mx-auto px-5 py-10 space-y-8">
      <h1 className="text-3xl font-semibold">Assisted-access portal</h1>
      <p className="text-[#55503F]">
        For farmers without a smartphone. Search an existing Farmer ID, or register a new farmer below.
      </p>

      <section className="field-card p-5 space-y-4">
        <h2 className="font-semibold text-lg">Search a farmer</h2>
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            className="input-field"
            placeholder="Farmer ID, name or phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn-primary text-sm" type="submit">Search</button>
        </form>
        {results.length > 0 && (
          <div className="divide-y divide-[#E4DCC8] border border-[#E4DCC8] rounded">
            {results.map((f) => (
              <button
                key={f.id}
                onClick={() => openFarmer(f)}
                className="w-full text-left p-3 hover:bg-[#F1EEE2]"
              >
                <p className="font-medium">{f.name} · {f.farmer_code}</p>
                <p className="text-sm text-[#8A8468]">{f.phone}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedFarmer && farmerDetail && (
        <section className="field-card p-5 space-y-4">
          <h2 className="font-semibold text-lg">
            {farmerDetail.farmer.name} · {farmerDetail.farmer.farmer_code}
          </h2>

          {farmerDetail.latestToken && (
            <div className="text-sm text-[#55503F]">
              Latest token: {farmerDetail.latestToken.token_number} — <StatusBadge status={farmerDetail.latestToken.status} />
            </div>
          )}

          <div>
            <label className="label" htmlFor="crop">Book slot for crop</label>
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

          <div className="grid sm:grid-cols-2 gap-3">
            {centres.map((centre) => (
              <button key={centre.id} onClick={() => selectCentre(centre)} className="field-card p-3 text-left">
                <p className="font-medium">{centre.name}</p>
              </button>
            ))}
          </div>

          {slots.length > 0 && (
            <div className="field-card divide-y divide-[#E4DCC8]">
              {slots.map((slot) => (
                <div key={slot.id} className="p-3 flex items-center justify-between">
                  <p className="text-sm">{slot.slot_date.slice(0, 10)}, {slot.start_time}–{slot.end_time}</p>
                  <button className="btn-primary text-sm py-1.5 px-3" onClick={() => bookForFarmer(slot)}>
                    Issue token
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="field-card p-5 space-y-4">
        <h2 className="font-semibold text-lg">Register a new farmer</h2>
        <form onSubmit={handleAssistedRegister} className="space-y-3">
          <input
            className="input-field" placeholder="Full name" required
            value={newFarmer.name} onChange={(e) => setNewFarmer((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="input-field" placeholder="Mobile number (optional)"
            value={newFarmer.phone} onChange={(e) => setNewFarmer((f) => ({ ...f, phone: e.target.value }))}
          />
          <input
            className="input-field" placeholder="Address"
            value={newFarmer.address} onChange={(e) => setNewFarmer((f) => ({ ...f, address: e.target.value }))}
          />
          <button className="btn-primary text-sm" type="submit">Register farmer</button>
        </form>
      </section>

      {message && <p className="text-growth text-sm">{message}</p>}
      {error && <p className="text-rust text-sm">{error}</p>}
    </div>
  );
}
