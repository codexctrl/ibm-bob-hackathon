import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_HOME = {
  farmer: '/dashboard',
  operator: '/operator',
  officer: '/officer',
  admin: '/admin'
};

const FARMER_NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/my-crops', label: 'My Crops' },
  { to: '/book-slot', label: 'Book Slot' },
  { to: '/payments', label: 'Payments' }
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="border-b border-[#E4DCC8] bg-parchment">
      <div className="max-w-5xl mx-auto px-5 py-4">
        <div className="flex items-center justify-between">
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

        {user?.role === 'farmer' && (
          <nav className="flex gap-5 mt-2 text-sm overflow-x-auto" aria-label="Farmer navigation">
            {FARMER_NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  isActive
                    ? 'text-field font-semibold border-b-2 border-field pb-1 whitespace-nowrap'
                    : 'text-[#55503F] hover:text-field pb-1 whitespace-nowrap'
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
