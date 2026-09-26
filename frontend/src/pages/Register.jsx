import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({
    name: '', phone: '', username: '', password: '', address: '', language: 'en'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-5 py-16">
      <h1 className="text-3xl font-semibold mb-1">Register</h1>
      <p className="text-[#55503F] mb-8">
        Have a smartphone? Create your own account. No smartphone at home? Visit an
        assisted-access centre instead and an operator will register you.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className="input-field" value={form.name} onChange={update('name')} required />
        </div>
        <div>
          <label className="label" htmlFor="phone">Mobile number</label>
          <input id="phone" className="input-field" value={form.phone} onChange={update('phone')} placeholder="For SMS updates" />
        </div>
        <div>
          <label className="label" htmlFor="address">Address</label>
          <input id="address" className="input-field" value={form.address} onChange={update('address')} />
        </div>
        <div>
          <label className="label" htmlFor="username">Choose a username</label>
          <input id="username" className="input-field" value={form.username} onChange={update('username')} required />
        </div>
        <div>
          <label className="label" htmlFor="password">Choose a password</label>
          <input id="password" type="password" className="input-field" value={form.password} onChange={update('password')} required />
        </div>
        <div>
          <label className="label" htmlFor="language">Preferred language</label>
          <select id="language" className="input-field" value={form.language} onChange={update('language')}>
            <option value="en">English</option>
            <option value="ta">தமிழ் (Tamil)</option>
            <option value="hi">हिन्दी (Hindi)</option>
          </select>
        </div>

        {error && <p className="text-rust text-sm">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-sm text-[#55503F] mt-6">
        Already registered?{' '}
        <Link to="/login" className="text-field font-medium underline">Log in</Link>
      </p>
    </div>
  );
}
