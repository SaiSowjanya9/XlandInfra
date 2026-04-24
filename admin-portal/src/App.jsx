import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import PortalSelector from './pages/PortalSelector';
import EmployeeLogin from './pages/EmployeeLogin';
import CustomerLogin from './pages/CustomerLogin';
import VendorLogin from './pages/VendorLogin';

import EmployeeLayout from './components/EmployeeLayout';
import CustomerLayout from './components/CustomerLayout';
import VendorLayout from './components/VendorLayout';

import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import Onboarding from './pages/ServicePortal';

import WorkOrders from './pages/WorkOrders';
import EmployeeWorkOrders from './pages/EmployeeWorkOrders';
import Categories from './pages/Categories';

import CustomerDashboard from './pages/CustomerDashboard';
import CustomerWorkOrder from './pages/CustomerWorkOrder';
import CustomerPayment from './pages/CustomerPayment';
import CustomerSchedule from './pages/CustomerSchedule';
import CustomerContact from './pages/CustomerContact';

import VendorDashboard from './pages/VendorDashboard';

function App() {
  const [user, setUser] = useState(null);
  const [portal, setPortal] = useState(null); // 'employee' | 'customer' | 'vendor'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('adminUser');
      const savedPortal = localStorage.getItem('activePortal');
      if (savedUser && savedPortal) {
        setUser(JSON.parse(savedUser));
        setPortal(savedPortal);
      }
    } catch (error) {
      console.error('Error loading saved state:', error);
      localStorage.removeItem('adminUser');
      localStorage.removeItem('activePortal');
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    const portalType = userData.portal || portal;
    setUser(userData);
    setPortal(portalType);
    localStorage.setItem('adminUser', JSON.stringify(userData));
    localStorage.setItem('activePortal', portalType);
  };

  const handleLogout = () => {
    setUser(null);
    setPortal(null);
    localStorage.removeItem('adminUser');
    localStorage.removeItem('activePortal');
  };

  const handleSelectPortal = (portalKey) => {
    setPortal(portalKey);
  };

  const handleBackToPortals = () => {
    setPortal(null);
    setUser(null);
    localStorage.removeItem('adminUser');
    localStorage.removeItem('activePortal');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Step 1: No portal selected → show portal selector
  if (!portal) {
    return <PortalSelector onSelectPortal={handleSelectPortal} />;
  }

  // Step 2: Portal selected but not logged in → show that portal's login
  if (!user) {
    if (portal === 'employee') {
      return <EmployeeLogin onLogin={handleLogin} onBack={handleBackToPortals} />;
    }
    if (portal === 'customer') {
      return <CustomerLogin onLogin={handleLogin} onBack={handleBackToPortals} />;
    }
    if (portal === 'vendor') {
      return <VendorLogin onLogin={handleLogin} onBack={handleBackToPortals} />;
    }
  }

  // Step 3: Logged in → show that portal's layout + routes
  if (portal === 'employee') {
    return (
      <Router>
        <EmployeeLayout admin={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/employee" element={<Dashboard />} />
            <Route path="/employee/properties" element={<Properties />} />
            <Route path="/employee/work-orders" element={<EmployeeWorkOrders admin={user} />} />
            <Route path="/employee/onboarding" element={<Onboarding admin={user} />} />
            <Route path="*" element={<Navigate to="/employee" replace />} />
          </Routes>
        </EmployeeLayout>
      </Router>
    );
  }

  if (portal === 'customer') {
    return (
      <Router>
        <CustomerLayout admin={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/customer" element={<CustomerDashboard user={user} />} />
            <Route path="/customer/work-order" element={<CustomerWorkOrder user={user} />} />
            <Route path="/customer/payment" element={<CustomerPayment user={user} />} />
            <Route path="/customer/schedule" element={<CustomerSchedule user={user} />} />
            <Route path="/customer/contact" element={<CustomerContact user={user} />} />
            <Route path="*" element={<Navigate to="/customer" replace />} />
          </Routes>
        </CustomerLayout>
      </Router>
    );
  }

  if (portal === 'vendor') {
    return (
      <Router>
        <VendorLayout admin={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/vendor" element={<VendorDashboard />} />
            <Route path="*" element={<Navigate to="/vendor" replace />} />
          </Routes>
        </VendorLayout>
      </Router>
    );
  }

  return null;
}

export default App;
