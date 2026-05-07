import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { seedTestData } from './utils/estimateStore';

import PortalSelector from './pages/PortalSelector';
import EmployeeLogin from './pages/EmployeeLogin';
import CustomerLogin from './pages/CustomerLogin';
import VendorLogin from './pages/VendorLogin';

import EmployeeLayout from './components/EmployeeLayout';
import CustomerLayout from './components/CustomerLayout';
import VendorLayout from './components/VendorLayout';

import Dashboard from './pages/Dashboard';
import CustomerSubmissions from './pages/CustomerSubmissions';
import CreateCustomer from './pages/CreateCustomer';

import WorkOrders from './pages/WorkOrders';
import EmployeeWorkOrders from './pages/EmployeeWorkOrders';
import Categories from './pages/Categories';

import CustomerDashboard from './pages/CustomerDashboard';
import CustomerWorkOrder from './pages/CustomerWorkOrder';
import CustomerPayment from './pages/CustomerPayment';
import CustomerSchedule from './pages/CustomerSchedule';
import CustomerContact from './pages/CustomerContact';

import VendorDashboard from './pages/VendorDashboard';
import VendorDetails from './pages/VendorDetails';
import AddVendor from './pages/AddVendor';
import AssignedVendors from './pages/AssignedVendors';

import AddEmployee from './pages/AddEmployee';
import EmployeeDetails from './pages/EmployeeDetails';
import EmployeeZoneManagement from './pages/EmployeeZoneManagement';
import Estimates from './pages/Estimates';
import UserManagement from './pages/UserManagement';

function App() {
  const [user, setUser] = useState(null);
  const [portal, setPortal] = useState(null); // 'employee' | 'customer' | 'vendor'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize seed data once on app load (only creates if none exists)
    seedTestData();
    
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
            <Route path="/employee/customer-submissions" element={<CustomerSubmissions />} />
            <Route path="/employee/work-orders" element={<EmployeeWorkOrders admin={user} />} />
            <Route path="/employee/create-customer" element={<CreateCustomer admin={user} />} />
            <Route path="/employee/add-vendor" element={<AddVendor admin={user} />} />
            <Route path="/employee/vendor-details" element={<VendorDetails />} />
            <Route path="/employee/assigned-vendors" element={<AssignedVendors />} />
            <Route path="/employee/add-employee" element={<AddEmployee admin={user} />} />
            <Route path="/employee/employee-details" element={<EmployeeDetails />} />
            <Route path="/employee/employee-zone-management" element={<EmployeeZoneManagement />} />
            <Route path="/employee/user-management" element={<UserManagement />} />
            <Route path="/employee/estimates" element={<Navigate to="/employee/estimates/list" replace />} />
            <Route path="/employee/estimates/create" element={<Estimates admin={user} defaultTab="create" />} />
            <Route path="/employee/estimates/list" element={<Estimates admin={user} defaultTab="list" />} />
            <Route path="/employee/estimates/amc-manager" element={<Estimates admin={user} defaultTab="amc-manager" />} />
            <Route path="/employee/estimates/addons" element={<Estimates admin={user} defaultTab="addons" />} />
            <Route path="/employee/estimates/archived" element={<Estimates admin={user} defaultTab="archived" />} />
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
