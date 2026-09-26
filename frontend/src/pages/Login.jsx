import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_HOME = {
  farmer: '/dashboard',
  operator: '/operator',
  officer: '/officer',
  admin: '/admin'
};

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(username, password);
      navigate(ROLE_HOME[user.role] || '/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-5 py-16">
      <h1 className="text-3xl font-semibold mb-1">Welcome back</h1>
      <p className="text-[#55503F] mb-8">Log in to track your crop, from arrival to payment.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input
            id="username"
            className="input-field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="text-rust text-sm">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="text-sm text-[#55503F] mt-6">
        New farmer?{' '}
        <Link to="/register" className="text-field font-medium underline">
          Register here
        </Link>
      </p>

      <div className="field-divider mt-8 pt-4 text-xs text-[#8A8468]">
        Demo logins (password: password123): admin · officer1 · operator1 · ravi · lakshmi · muthu
      </div>
    </div>
  );
}
