import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import CustomerHome from './pages/CustomerHome';
import Dashboard from './pages/Dashboard';
import WorkOrder from './pages/WorkOrder';
import Schedule from './pages/Schedule';
import Payment from './pages/Payment';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Register from './pages/Register';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('portalUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('portalUser', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('portalUser');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Landing page as the entry point */}
        <Route path="/" element={<CustomerHome />} />
        <Route path="/landing" element={<LandingPage />} />
        
        {/* Customer Portal Routes */}
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />
        } />
        <Route path="/register" element={
          user ? <Navigate to="/dashboard" replace /> : <Register />
        } />
        <Route path="/dashboard/*" element={
          user ? (
            <Layout user={user} onLogout={handleLogout}>
              <Routes>
                <Route path="/" element={<Dashboard user={user} />} />
                <Route path="/work-order" element={<WorkOrder user={user} />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/payment" element={<Payment />} />
                <Route path="/contact" element={<Contact />} />
              </Routes>
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        } />
        
        {/* Vendor Portal Routes (Coming Soon) */}
        <Route path="/vendor-login" element={
          <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-4">Vendor Portal</h1>
              <p className="text-slate-400 mb-6">Coming Soon</p>
              <a href="/" className="text-amber-400 hover:text-amber-300">← Back to Home</a>
            </div>
          </div>
        } />
        
        {/* Admin Portal Routes (Coming Soon) */}
        <Route path="/admin-login" element={
          <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-4">Company Admin Portal</h1>
              <p className="text-slate-400 mb-6">Coming Soon</p>
              <a href="/" className="text-amber-400 hover:text-amber-300">← Back to Home</a>
            </div>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;
