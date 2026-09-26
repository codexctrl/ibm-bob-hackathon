import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_HOME = {
  farmer: '/dashboard',
  operator: '/operator',
  officer: '/officer',
  admin: '/admin'
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="border-b border-[#E4DCC8] bg-parchment">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-4">
        <Link to={user ? ROLE_HOME[user.role] : '/'} className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold text-field">CropFlow</span>
          <span className="hidden sm:inline text-xs text-[#6B6552] tracking-wide">arrival → payment</span>
        </Link>

        {user && (
          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-sm text-[#55503F]">
              {user.name} <span className="text-[#8A8468]">· {user.role}</span>
            </span>
            <button onClick={handleLogout} className="btn-secondary text-sm py-2 px-4">
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
