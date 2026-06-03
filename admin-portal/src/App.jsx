import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { seedTestData } from './utils/estimateStore';

import PortalSelector from './pages/PortalSelector';
import EmployeeLogin from './pages/EmployeeLogin';
import VendorLogin from './pages/VendorLogin';

import EmployeeLayout from './components/EmployeeLayout';
import VendorLayout from './components/VendorLayout';
import FPLayout from './components/FPLayout';

import Dashboard from './pages/Dashboard';
import CustomerSubmissions from './pages/CustomerSubmissions';
import CreateCustomer from './pages/CreateCustomer';

import WorkOrders from './pages/WorkOrders';
import EmployeeWorkOrders from './pages/EmployeeWorkOrders';
import Categories from './pages/Categories';

import VendorDashboard from './pages/VendorDashboard';
import VendorDetails from './pages/VendorDetails';
import AddVendor from './pages/AddVendor';
import AssignedVendors from './pages/AssignedVendors';

import FPLogin from './pages/FPLogin';
import FPDashboard from './pages/FPDashboard';
import FPProperties from './pages/FPProperties';
import FPWorkOrders from './pages/FPWorkOrders';
import FPVendors from './pages/FPVendors';
import FPAddVendor from './pages/FPAddVendor';
import FPEmployees from './pages/FPEmployees';
import FPAddEmployee from './pages/FPAddEmployee';
import FPEditEmployee from './pages/FPEditEmployee';
import FPEmployeeZones from './pages/FPEmployeeZones';
import FPEstimates from './pages/FPEstimates';
import FPCustomers from './pages/FPCustomers';

import ManagerLogin from './pages/ManagerLogin';
import ManagerLayout from './components/ManagerLayout';
import ManagerDashboard from './pages/ManagerDashboard';
import ManagerProperties from './pages/ManagerProperties';
import ManagerWorkOrders from './pages/ManagerWorkOrders';
import ManagerCustomers from './pages/ManagerCustomers';
import ManagerVendors from './pages/ManagerVendors';
import ManagerAddVendor from './pages/ManagerAddVendor';
import ManagerEmployees from './pages/ManagerEmployees';
import ManagerEmployeeZones from './pages/ManagerEmployeeZones';
import ManagerEstimates from './pages/ManagerEstimates';

import CoordinatorLogin from './pages/CoordinatorLogin';
import CoordinatorLayout from './components/CoordinatorLayout';
import CoordinatorDashboard from './pages/CoordinatorDashboard';
import CoordinatorProperties from './pages/CoordinatorProperties';
import CoordinatorWorkOrders from './pages/CoordinatorWorkOrders';
import CoordinatorCustomers from './pages/CoordinatorCustomers';
import CoordinatorVendors from './pages/CoordinatorVendors';
import CoordinatorAddVendor from './pages/CoordinatorAddVendor';
import CoordinatorEmployees from './pages/CoordinatorEmployees';
import CoordinatorEstimates from './pages/CoordinatorEstimates';

import SupervisorLogin from './pages/SupervisorLogin';
import SupervisorLayout from './components/SupervisorLayout';
import SupervisorDashboard from './pages/SupervisorDashboard';
import SupervisorProperties from './pages/SupervisorProperties';
import SupervisorWorkOrders from './pages/SupervisorWorkOrders';
import SupervisorCustomers from './pages/SupervisorCustomers';
import SupervisorVendors from './pages/SupervisorVendors';
import SupervisorAddVendor from './pages/SupervisorAddVendor';
import SupervisorEstimates from './pages/SupervisorEstimates';

import ExecutiveLogin from './pages/ExecutiveLogin';
import ExecutiveLayout from './components/ExecutiveLayout';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import ExecutiveProperties from './pages/ExecutiveProperties';
import ExecutiveWorkOrders from './pages/ExecutiveWorkOrders';
import ExecutiveCustomers from './pages/ExecutiveCustomers';
import ExecutiveVendors from './pages/ExecutiveVendors';
import ExecutiveAddVendor from './pages/ExecutiveAddVendor';
import ExecutiveEstimates from './pages/ExecutiveEstimates';

import AddEmployee from './pages/AddEmployee';
import EmployeeDetails from './pages/EmployeeDetails';
import EmployeeZoneManagement from './pages/EmployeeZoneManagement';
import Estimates from './pages/Estimates';
import UserManagement from './pages/UserManagement';
import QRManagement from './pages/QRManagement';
import EstimateAction from './pages/EstimateAction';
import ResetPassword from './pages/ResetPassword';

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

function App() {
  const [user, setUser] = useState(null);
  const [portal, setPortal] = useState(null); // 'employee' | 'vendor'
  const [loading, setLoading] = useState(true);

  // Check if session is still valid
  const isSessionValid = () => {
    const lastActivity = sessionStorage.getItem('lastActivity');
    if (!lastActivity) return false;
    const elapsed = Date.now() - parseInt(lastActivity, 10);
    return elapsed < SESSION_TIMEOUT;
  };

  // Update last activity timestamp
  const updateActivity = () => {
    sessionStorage.setItem('lastActivity', Date.now().toString());
  };

  useEffect(() => {
    // Initialize seed data once on app load (only creates if none exists)
    seedTestData();
    
    try {
      // Check if session is still valid (not expired)
      const savedUser = sessionStorage.getItem('adminUser');
      const savedPortal = sessionStorage.getItem('activePortal');
      
      if (savedUser && savedPortal && isSessionValid()) {
        setUser(JSON.parse(savedUser));
        setPortal(savedPortal);
        updateActivity(); // Refresh activity on load
      } else {
        // Session expired or invalid - clear everything
        sessionStorage.clear();
      }
    } catch (error) {
      console.error('Error loading saved state:', error);
      sessionStorage.clear();
    }
    setLoading(false);
  }, []);

  // Track user activity to keep session alive
  useEffect(() => {
    if (!user) return;
    
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    let activityTimeout;
    
    const handleActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(updateActivity, 1000); // Debounce updates
    };
    
    activityEvents.forEach(event => window.addEventListener(event, handleActivity));
    
    // Check session validity periodically
    const intervalId = setInterval(() => {
      if (!isSessionValid()) {
        handleLogout();
        alert('Session expired due to inactivity. Please log in again.');
      }
    }, 60000); // Check every minute
    
    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, handleActivity));
      clearInterval(intervalId);
      clearTimeout(activityTimeout);
    };
  }, [user]);

  const handleLogin = (userData) => {
    const portalType = userData.portal || portal;
    setUser(userData);
    setPortal(portalType);
    // Use sessionStorage for session-based auth (expires on browser close)
    sessionStorage.setItem('adminUser', JSON.stringify(userData));
    sessionStorage.setItem('activePortal', portalType);
    sessionStorage.setItem('lastActivity', Date.now().toString()); // Start session timer
    
    // Store token if provided
    if (userData.token) {
      sessionStorage.setItem('pm_auth_token', userData.token);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setPortal(null);
    // Clear sessionStorage
    sessionStorage.removeItem('adminUser');
    sessionStorage.removeItem('activePortal');
    sessionStorage.removeItem('pm_auth_token');
    sessionStorage.removeItem('pm_current_user');
    // Also clear any legacy localStorage items
    localStorage.removeItem('adminUser');
    localStorage.removeItem('activePortal');
    localStorage.removeItem('pm_auth_token');
    localStorage.removeItem('pm_current_user');
    localStorage.removeItem('pm_demo_mode');
    // Redirect to home page
    window.location.href = '/';
  };

  const handleSelectPortal = (portalKey) => {
    setPortal(portalKey);
  };

  const handleBackToPortals = () => {
    setPortal(null);
    setUser(null);
    sessionStorage.removeItem('adminUser');
    sessionStorage.removeItem('activePortal');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Public route: Password Reset page (accessible without login)
  if (window.location.pathname.startsWith('/reset-password/')) {
    return (
      <Router>
        <Routes>
          <Route path="/reset-password/:token" element={<ResetPassword />} />
        </Routes>
      </Router>
    );
  }

  // Public route: Estimate Action page (accessible without login)
  if (window.location.pathname.startsWith('/estimate-action/')) {
    return (
      <Router>
        <Routes>
          <Route path="/estimate-action/:estimateId" element={<EstimateAction />} />
        </Routes>
      </Router>
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
    if (portal === 'vendor') {
      return <VendorLogin onLogin={handleLogin} onBack={handleBackToPortals} />;
    }
    if (portal === 'franchise') {
      return <FPLogin onLogin={handleLogin} onBack={handleBackToPortals} />;
    }
    if (portal === 'manager') {
      return <ManagerLogin onLogin={handleLogin} onBack={handleBackToPortals} />;
    }
    if (portal === 'coordinator') {
      return <CoordinatorLogin onLogin={handleLogin} onBack={handleBackToPortals} />;
    }
    if (portal === 'supervisor') {
      return <SupervisorLogin onLogin={handleLogin} onBack={handleBackToPortals} />;
    }
    if (portal === 'executive') {
      return <ExecutiveLogin onLogin={handleLogin} onBack={handleBackToPortals} />;
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
            <Route path="/employee/assigned-vendors" element={<AssignedVendors user={user} />} />
            <Route path="/employee/add-employee" element={<AddEmployee admin={user} />} />
            <Route path="/employee/employee-details" element={<EmployeeDetails />} />
            <Route path="/employee/employee-zone-management" element={<EmployeeZoneManagement />} />
            <Route path="/employee/user-management" element={<UserManagement />} />
            <Route path="/employee/qr-management" element={<QRManagement />} />
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

  if (portal === 'franchise') {
    return (
      <Router>
        <FPLayout admin={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/fp" element={<FPDashboard user={user} />} />
            <Route path="/fp/properties" element={<FPProperties user={user} />} />
            <Route path="/fp/work-orders" element={<FPWorkOrders user={user} />} />
            <Route path="/fp/customers" element={<FPCustomers user={user} />} />
            <Route path="/fp/customers/add" element={<FPCustomers user={user} defaultTab="add" />} />
            <Route path="/fp/vendors" element={<FPVendors user={user} />} />
            <Route path="/fp/vendors/add" element={<FPAddVendor user={user} />} />
            <Route path="/fp/vendors/assigned" element={<AssignedVendors user={user} />} />
            <Route path="/fp/employees" element={<FPEmployees user={user} />} />
            <Route path="/fp/employees/add" element={<FPAddEmployee user={user} />} />
            <Route path="/fp/employees/edit/:id" element={<FPEditEmployee user={user} />} />
            <Route path="/fp/employees/zones" element={<FPEmployeeZones user={user} />} />
            <Route path="/fp/estimates" element={<FPEstimates user={user} defaultTab="list" />} />
            <Route path="/fp/estimates/create" element={<FPEstimates user={user} defaultTab="create" />} />
            <Route path="/fp/estimates/amc" element={<FPEstimates user={user} defaultTab="amc" />} />
            <Route path="/fp/estimates/addons" element={<FPEstimates user={user} defaultTab="addons" />} />
            <Route path="/fp/estimates/archived" element={<FPEstimates user={user} defaultTab="archived" />} />
            <Route path="/fp/qr-management" element={<QRManagement />} />
            <Route path="*" element={<Navigate to="/fp" replace />} />
          </Routes>
        </FPLayout>
      </Router>
    );
  }

  if (portal === 'manager') {
    return (
      <Router>
        <ManagerLayout admin={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/manager" element={<ManagerDashboard user={user} />} />
            <Route path="/manager/properties" element={<ManagerProperties user={user} />} />
            <Route path="/manager/work-orders" element={<ManagerWorkOrders user={user} />} />
            <Route path="/manager/work-orders/pending" element={<ManagerWorkOrders user={user} />} />
            <Route path="/manager/work-orders/completed" element={<ManagerWorkOrders user={user} />} />
            <Route path="/manager/customers" element={<ManagerCustomers user={user} />} />
            <Route path="/manager/customers/add" element={<ManagerCustomers user={user} defaultTab="add" />} />
            <Route path="/manager/vendors" element={<ManagerVendors user={user} />} />
            <Route path="/manager/vendors/add" element={<ManagerAddVendor user={user} />} />
            <Route path="/manager/vendors/assigned" element={<AssignedVendors user={user} />} />
            <Route path="/manager/employees/zones" element={<ManagerEmployeeZones user={user} viewOnly={true} />} />
            <Route path="/manager/estimates" element={<ManagerEstimates user={user} defaultTab="list" />} />
            <Route path="/manager/estimates/create" element={<ManagerEstimates user={user} defaultTab="create" />} />
            <Route path="/manager/estimates/amc" element={<ManagerEstimates user={user} defaultTab="amc" />} />
            <Route path="/manager/estimates/addons" element={<ManagerEstimates user={user} defaultTab="addons" />} />
            <Route path="/manager/estimates/archived" element={<ManagerEstimates user={user} defaultTab="archived" />} />
            <Route path="*" element={<Navigate to="/manager" replace />} />
          </Routes>
        </ManagerLayout>
      </Router>
    );
  }

  if (portal === 'coordinator') {
    return (
      <Router>
        <CoordinatorLayout admin={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/coordinator" element={<CoordinatorDashboard user={user} />} />
            <Route path="/coordinator/properties" element={<CoordinatorProperties user={user} />} />
            <Route path="/coordinator/work-orders" element={<CoordinatorWorkOrders user={user} />} />
            <Route path="/coordinator/work-orders/pending" element={<CoordinatorWorkOrders user={user} />} />
            <Route path="/coordinator/work-orders/completed" element={<CoordinatorWorkOrders user={user} />} />
            <Route path="/coordinator/work-orders/create" element={<CoordinatorWorkOrders user={user} />} />
            <Route path="/coordinator/customers" element={<CoordinatorCustomers user={user} />} />
            <Route path="/coordinator/customers/add" element={<CoordinatorCustomers user={user} defaultTab="add" />} />
            <Route path="/coordinator/vendors" element={<CoordinatorVendors user={user} />} />
            <Route path="/coordinator/vendors/add" element={<CoordinatorAddVendor user={user} />} />
            <Route path="/coordinator/vendors/assigned" element={<AssignedVendors user={user} />} />
            <Route path="/coordinator/employees/zones" element={<CoordinatorEmployees user={user} />} />
            <Route path="/coordinator/estimates" element={<CoordinatorEstimates user={user} defaultTab="list" />} />
            <Route path="/coordinator/estimates/create" element={<CoordinatorEstimates user={user} defaultTab="create" />} />
            <Route path="/coordinator/estimates/amc" element={<CoordinatorEstimates user={user} defaultTab="amc" />} />
            <Route path="/coordinator/estimates/addons" element={<CoordinatorEstimates user={user} defaultTab="addons" />} />
            <Route path="/coordinator/estimates/archived" element={<CoordinatorEstimates user={user} defaultTab="archived" />} />
            <Route path="*" element={<Navigate to="/coordinator" replace />} />
          </Routes>
        </CoordinatorLayout>
      </Router>
    );
  }

  if (portal === 'supervisor') {
    return (
      <Router>
        <SupervisorLayout admin={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/supervisor" element={<SupervisorDashboard user={user} />} />
            <Route path="/supervisor/properties" element={<SupervisorProperties user={user} />} />
            <Route path="/supervisor/work-orders" element={<SupervisorWorkOrders user={user} />} />
            <Route path="/supervisor/work-orders/pending" element={<SupervisorWorkOrders user={user} />} />
            <Route path="/supervisor/work-orders/completed" element={<SupervisorWorkOrders user={user} />} />
            <Route path="/supervisor/customers" element={<SupervisorCustomers user={user} />} />
            <Route path="/supervisor/customers/add" element={<SupervisorCustomers user={user} defaultTab="add" />} />
            <Route path="/supervisor/vendors" element={<SupervisorVendors user={user} />} />
            <Route path="/supervisor/vendors/add" element={<SupervisorAddVendor user={user} />} />
            <Route path="/supervisor/estimates" element={<SupervisorEstimates user={user} defaultTab="list" />} />
            <Route path="/supervisor/estimates/create" element={<SupervisorEstimates user={user} defaultTab="create" />} />
            <Route path="/supervisor/estimates/amc" element={<SupervisorEstimates user={user} defaultTab="amc" />} />
            <Route path="/supervisor/estimates/addons" element={<SupervisorEstimates user={user} defaultTab="addons" />} />
            <Route path="/supervisor/estimates/archived" element={<SupervisorEstimates user={user} defaultTab="archived" />} />
            <Route path="*" element={<Navigate to="/supervisor" replace />} />
          </Routes>
        </SupervisorLayout>
      </Router>
    );
  }

  if (portal === 'executive') {
    return (
      <Router>
        <ExecutiveLayout admin={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/executive" element={<ExecutiveDashboard user={user} />} />
            <Route path="/executive/properties" element={<ExecutiveProperties user={user} />} />
            <Route path="/executive/work-orders" element={<ExecutiveWorkOrders user={user} />} />
            <Route path="/executive/work-orders/pending" element={<ExecutiveWorkOrders user={user} />} />
            <Route path="/executive/work-orders/completed" element={<ExecutiveWorkOrders user={user} />} />
            <Route path="/executive/customers" element={<ExecutiveCustomers user={user} />} />
            <Route path="/executive/customers/add" element={<ExecutiveCustomers user={user} defaultTab="add" />} />
            <Route path="/executive/vendors" element={<ExecutiveVendors user={user} />} />
            <Route path="/executive/vendors/add" element={<ExecutiveAddVendor user={user} />} />
            <Route path="/executive/vendors/assigned" element={<AssignedVendors user={user} />} />
            <Route path="/executive/employees/zones" element={<ManagerEmployeeZones user={user} viewOnly={true} />} />
            <Route path="/executive/estimates" element={<ExecutiveEstimates user={user} defaultTab="list" />} />
            <Route path="/executive/estimates/create" element={<ExecutiveEstimates user={user} defaultTab="create" />} />
            <Route path="/executive/estimates/archived" element={<ExecutiveEstimates user={user} defaultTab="archived" />} />
            <Route path="*" element={<Navigate to="/executive" replace />} />
          </Routes>
        </ExecutiveLayout>
      </Router>
    );
  }

  return null;
}

export default App;
