import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Register from './pages/Register';
import FarmerDashboard from './pages/FarmerDashboard';
import MyCrops from './pages/MyCrops';
import BookSlot from './pages/BookSlot';
import MyToken from './pages/MyToken';
import Payments from './pages/Payments';
import OperatorDashboard from './pages/OperatorDashboard';
import OfficerDashboard from './pages/OfficerDashboard';
import AdminDashboard from './pages/AdminDashboard';

const ROLE_HOME = {
  farmer: '/dashboard',
  operator: '/operator',
  officer: '/officer',
  admin: '/admin'
};

function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div className="min-h-screen bg-parchment">
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={
          <ProtectedRoute roles={['farmer']}><FarmerDashboard /></ProtectedRoute>
        } />
        <Route path="/my-crops" element={
          <ProtectedRoute roles={['farmer']}><MyCrops /></ProtectedRoute>
        } />
        <Route path="/book-slot" element={
          <ProtectedRoute roles={['farmer']}><BookSlot /></ProtectedRoute>
        } />
        <Route path="/token/:id" element={
          <ProtectedRoute roles={['farmer', 'operator', 'officer', 'admin']}><MyToken /></ProtectedRoute>
        } />
        <Route path="/payments" element={
          <ProtectedRoute roles={['farmer']}><Payments /></ProtectedRoute>
        } />

        <Route path="/operator" element={
          <ProtectedRoute roles={['operator', 'admin']}><OperatorDashboard /></ProtectedRoute>
        } />
        <Route path="/officer" element={
          <ProtectedRoute roles={['officer', 'admin']}><OfficerDashboard /></ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
