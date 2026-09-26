import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function Payments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/payments/farmer/${user.farmerId}`).then(setPayments).catch((err) => setError(err.message));
  }, [user.farmerId]);

  return (
    <div className="max-w-2xl mx-auto px-5 py-10 space-y-6">
      <h1 className="text-3xl font-semibold">Payments</h1>
      {error && <p className="text-rust text-sm">{error}</p>}

      <div className="field-card divide-y divide-[#E4DCC8]">
        {payments.length === 0 && <p className="p-4 text-sm text-[#8A8468]">No payments yet.</p>}
        {payments.map((p) => (
          <div key={p.id} className="p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-medium">₹{Number(p.amount).toLocaleString('en-IN')}</p>
              <p className="text-sm text-[#8A8468]">
                Token {p.token_number} · {p.net_weight_kg ? `${p.net_weight_kg} kg` : ''} {p.quality_grade ? `· Grade ${p.quality_grade}` : ''}
              </p>
              {p.transaction_reference && (
                <p className="text-xs text-[#8A8468]">Ref: {p.transaction_reference}</p>
              )}
            </div>
            <StatusBadge status={p.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
