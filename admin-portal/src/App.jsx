import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

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
import Phase2Documentation from './pages/Phase2Documentation';
import EstimatesDashboard from './pages/EstimatesDashboard';
import WorkOrdersDashboard from './components/WorkOrdersDashboard';
import BillingPlaceholder from './pages/billing/BillingPlaceholder';
import Invoices from './pages/billing/Invoices';
import Payments from './pages/billing/Payments';
import GeneratedInvoices from './pages/billing/GeneratedInvoices';
import { FPProvider } from './contexts/FPContext';

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Auth Context for sharing auth state across routes
import { createContext, useContext } from 'react';
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Protected Route wrapper component
const ProtectedRoute = ({ children, requiredPortal }) => {
  const { user, portal } = useAuth();
  const location = useLocation();
  
  if (!user || portal !== requiredPortal) {
    // Redirect to login while preserving intended destination
    return <Navigate to={`/${requiredPortal}/login`} state={{ from: location }} replace />;
  }
  
  return children;
};

function App() {
  const [user, setUser] = useState(null);
  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(true);

  // Safe storage helper - handles cases where storage is blocked
  const safeGetItem = (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch (e) {
      console.warn('Storage access blocked:', e.message);
      return null;
    }
  };

  const safeSetItem = (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      console.warn('Storage write blocked:', e.message);
    }
  };

  const safeRemoveItem = (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      console.warn('Storage remove blocked:', e.message);
    }
  };

  const safeClear = () => {
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn('Storage clear blocked:', e.message);
    }
  };

  const safeLocalRemove = (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage remove blocked:', e.message);
    }
  };

  // Check if session is still valid
  const isSessionValid = () => {
    const lastActivity = safeGetItem('lastActivity');
    if (!lastActivity) return false;
    const elapsed = Date.now() - parseInt(lastActivity, 10);
    return elapsed < SESSION_TIMEOUT;
  };

  // Update last activity timestamp
  const updateActivity = () => {
    safeSetItem('lastActivity', Date.now().toString());
  };

  useEffect(() => {
    // NOTE: seedTestData() removed - no seed data in production
    
    try {
      // Check if session is still valid (not expired)
      const savedUser = safeGetItem('adminUser');
      const savedPortal = safeGetItem('activePortal');
      
      if (savedUser && savedPortal && isSessionValid()) {
        setUser(JSON.parse(savedUser));
        setPortal(savedPortal);
        updateActivity(); // Refresh activity on load
      } else {
        // Session expired or invalid - clear everything
        safeClear();
      }
    } catch (error) {
      console.error('Error loading saved state:', error);
      safeClear();
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
    safeSetItem('adminUser', JSON.stringify(userData));
    safeSetItem('activePortal', portalType);
    safeSetItem('lastActivity', Date.now().toString()); // Start session timer
    
    // Store token if provided
    if (userData.token) {
      safeSetItem('pm_auth_token', userData.token);
      // Dispatch event to trigger FP list refresh
      window.dispatchEvent(new Event('fp-refresh'));
    }
  };

  const handleLogout = useCallback(() => {
    // Clear all storage
    safeRemoveItem('adminUser');
    safeRemoveItem('activePortal');
    safeRemoveItem('pm_auth_token');
    safeRemoveItem('pm_current_user');
    safeLocalRemove('adminUser');
    safeLocalRemove('activePortal');
    safeLocalRemove('pm_auth_token');
    safeLocalRemove('pm_current_user');
    safeLocalRemove('pm_demo_mode');
    // Redirect IMMEDIATELY to employee login - BEFORE state changes to prevent flash
    window.location.replace('/employee/login');
  }, []);

  const handleSelectPortal = useCallback((portalKey) => {
    setPortal(portalKey);
    safeSetItem('activePortal', portalKey);
  }, []);

  const handleBackToPortals = useCallback(() => {
    setPortal(null);
    setUser(null);
    safeRemoveItem('adminUser');
    safeRemoveItem('activePortal');
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Auth context value
  const authValue = { user, portal, handleLogin, handleLogout, handleBackToPortals };

  // Wrapper component for logout that handles navigation
  const LogoutWrapper = ({ children, portalPath }) => {
    const handleLogoutWithNav = () => {
      handleLogout(); // Already navigates to /employee/login
    };
    return children(handleLogoutWithNav);
  };

  return (
    <AuthContext.Provider value={authValue}>
      <FPProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={
              user && portal ? (
                <Navigate to={`/${portal === 'franchise' ? 'fp' : portal}`} replace />
              ) : (
                <PortalSelector onSelectPortal={(p) => {
                  handleSelectPortal(p);
                }} />
              )
            } />
            
            {/* Password Reset - Public */}
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            
            {/* Estimate Action - Public */}
            <Route path="/estimate-action/:estimateId" element={<EstimateAction />} />
            
            {/* Phase 2 Documentation - Public */}
            <Route path="/phase2-docs" element={<Phase2Documentation />} />
            
            {/* Employee Portal Login - routes to correct portal based on user's role/FP association */}
            <Route path="/employee/login" element={
              user && portal ? (
                <Navigate to={`/${portal === 'franchise' ? 'fp' : portal}`} replace />
              ) : (
                <EmployeeLogin onLogin={(userData) => { handleLogin(userData); handleSelectPortal(userData.portal || 'employee'); }} onBack={() => { handleBackToPortals(); }} />
              )
            } />
            
            {/* Employee Portal Routes */}
            <Route path="/employee" element={
              user && portal === 'employee' ? (
                <EmployeeLayout admin={user} onLogout={() => { handleLogout(); }}>
                  <Dashboard />
                </EmployeeLayout>
              ) : <Navigate to="/employee/login" replace />
            } />
            <Route path="/employee/*" element={
              user && portal === 'employee' ? (
                <EmployeeLayout admin={user} onLogout={() => { handleLogout(); }}>
                  <Routes>
                    <Route path="customer-submissions" element={<CustomerSubmissions />} />
                    <Route path="work-orders/dashboard" element={<WorkOrdersDashboard user={user} portalType="employee" />} />
                    <Route path="work-orders" element={<EmployeeWorkOrders admin={user} />} />
                    <Route path="work-orders/pending" element={<EmployeeWorkOrders admin={user} />} />
                    <Route path="work-orders/assigned" element={<EmployeeWorkOrders admin={user} />} />
                    <Route path="work-orders/in-progress" element={<EmployeeWorkOrders admin={user} />} />
                    <Route path="work-orders/completed" element={<EmployeeWorkOrders admin={user} />} />
                    <Route path="work-orders/closed" element={<EmployeeWorkOrders admin={user} />} />
                    <Route path="work-orders/cancelled" element={<EmployeeWorkOrders admin={user} />} />
                    <Route path="create-customer" element={<CreateCustomer admin={user} />} />
                    <Route path="add-vendor" element={<AddVendor admin={user} />} />
                    <Route path="vendor-details" element={<VendorDetails />} />
                    <Route path="assigned-vendors" element={<AssignedVendors user={user} />} />
                    <Route path="add-employee" element={<AddEmployee admin={user} />} />
                    <Route path="employee-details" element={<EmployeeDetails />} />
                    <Route path="employee-zone-management" element={<EmployeeZoneManagement />} />
                    <Route path="user-management" element={<UserManagement />} />
                    <Route path="qr-management" element={<QRManagement />} />
                    <Route path="estimates" element={<Navigate to="/employee/estimates/list" replace />} />
                    <Route path="estimates/dashboard" element={<EstimatesDashboard user={user} portalType="employee" />} />
                    <Route path="estimates/create" element={<Estimates admin={user} defaultTab="create" />} />
                    <Route path="estimates/list" element={<Estimates admin={user} defaultTab="list" />} />
                    <Route path="estimates/amc-manager" element={<Estimates admin={user} defaultTab="amc-manager" />} />
                    <Route path="estimates/addons" element={<Estimates admin={user} defaultTab="addons" />} />
                    <Route path="estimates/archived" element={<Estimates admin={user} defaultTab="archived" />} />
                    <Route path="billing/dashboard" element={<BillingPlaceholder page="dashboard" portalName="Admin" />} />
                    <Route path="billing/generate-invoices" element={<GeneratedInvoices user={user} portalType="employee" />} />
                    <Route path="billing/invoices" element={<Invoices user={user} portalType="employee" />} />
                    <Route path="billing/payments" element={<Payments user={user} portalType="employee" />} />
                    <Route path="billing/make-payments" element={<BillingPlaceholder page="make-payments" portalName="Admin" />} />
                    <Route path="billing/payment-history" element={<BillingPlaceholder page="payment-history" portalName="Admin" />} />
                    <Route path="billing/archived" element={<Invoices user={user} portalType="employee" defaultTab="archived" />} />
                    <Route path="*" element={<Navigate to="/employee" replace />} />
                  </Routes>
                </EmployeeLayout>
              ) : <Navigate to="/employee/login" replace />
            } />
            
            {/* Vendor Portal Login */}
            <Route path="/vendor/login" element={
              user && portal === 'vendor' ? (
                <Navigate to="/vendor" replace />
              ) : (
                <VendorLogin onLogin={(userData) => { handleLogin(userData); handleSelectPortal('vendor'); }} onBack={() => { handleBackToPortals(); }} />
              )
            } />
            
            {/* Vendor Portal Routes */}
            <Route path="/vendor" element={
              user && portal === 'vendor' ? (
                <VendorLayout admin={user} onLogout={() => { handleLogout(); }}>
                  <VendorDashboard />
                </VendorLayout>
              ) : <Navigate to="/vendor/login" replace />
            } />
            <Route path="/vendor/*" element={
              user && portal === 'vendor' ? (
                <VendorLayout admin={user} onLogout={() => { handleLogout(); }}>
                  <Routes>
                    <Route path="*" element={<Navigate to="/vendor" replace />} />
                  </Routes>
                </VendorLayout>
              ) : <Navigate to="/vendor/login" replace />
            } />
            
            {/* FP Portal Login - Redirect to Employee Login */}
            <Route path="/fp/login" element={<Navigate to="/employee/login" replace />} />
            
            {/* FP Portal Routes */}
            <Route path="/fp" element={
              user && portal === 'franchise' ? (
                <FPLayout admin={user} onLogout={() => { handleLogout(); }}>
                  <FPDashboard user={user} />
                </FPLayout>
              ) : <Navigate to="/employee/login" replace />
            } />
            <Route path="/fp/*" element={
              user && portal === 'franchise' ? (
                <FPLayout admin={user} onLogout={() => { handleLogout(); }}>
                  <Routes>
                    <Route path="properties" element={<FPProperties user={user} />} />
                    <Route path="work-orders/dashboard" element={<WorkOrdersDashboard user={user} portalType="franchise" />} />
                    <Route path="work-orders" element={<FPWorkOrders user={user} />} />
                    <Route path="work-orders/pending" element={<FPWorkOrders user={user} />} />
                    <Route path="work-orders/completed" element={<FPWorkOrders user={user} />} />
                    <Route path="work-orders/assigned" element={<FPWorkOrders user={user} />} />
                    <Route path="work-orders/in-progress" element={<FPWorkOrders user={user} />} />
                    <Route path="work-orders/closed" element={<FPWorkOrders user={user} />} />
                    <Route path="work-orders/cancelled" element={<FPWorkOrders user={user} />} />
                    <Route path="customers" element={<FPCustomers user={user} />} />
                    <Route path="customers/add" element={<FPCustomers user={user} defaultTab="add" />} />
                    <Route path="vendors" element={<FPVendors user={user} />} />
                    <Route path="vendors/add" element={<FPAddVendor user={user} />} />
                    <Route path="vendors/assigned" element={<AssignedVendors user={user} />} />
                    <Route path="employees" element={<FPEmployees user={user} />} />
                    <Route path="employees/add" element={<FPAddEmployee user={user} />} />
                    <Route path="employees/edit/:id" element={<FPEditEmployee user={user} />} />
                    <Route path="employees/zones" element={<FPEmployeeZones user={user} />} />
                    <Route path="estimates" element={<FPEstimates user={user} defaultTab="list" />} />
                    <Route path="estimates/dashboard" element={<EstimatesDashboard user={user} portalType="franchise" />} />
                    <Route path="estimates/create" element={<FPEstimates user={user} defaultTab="create" />} />
                    <Route path="estimates/amc" element={<FPEstimates user={user} defaultTab="amc" />} />
                    <Route path="estimates/addons" element={<FPEstimates user={user} defaultTab="addons" />} />
                    <Route path="estimates/archived" element={<FPEstimates user={user} defaultTab="archived" />} />
                    <Route path="qr-management" element={<QRManagement />} />
                    <Route path="billing/dashboard" element={<BillingPlaceholder page="dashboard" portalName="Franchise Partner" />} />
                    <Route path="billing/generate-invoices" element={<GeneratedInvoices user={user} portalType="fp" />} />
                    <Route path="billing/invoices" element={<Invoices user={user} portalType="fp" />} />
                    <Route path="billing/payments" element={<Payments user={user} portalType="fp" />} />
                    <Route path="billing/make-payments" element={<BillingPlaceholder page="make-payments" portalName="Franchise Partner" />} />
                    <Route path="billing/payment-history" element={<BillingPlaceholder page="payment-history" portalName="Franchise Partner" />} />
                    <Route path="billing/archived" element={<Invoices user={user} portalType="fp" defaultTab="archived" />} />
                    <Route path="*" element={<Navigate to="/fp" replace />} />
                  </Routes>
                </FPLayout>
              ) : <Navigate to="/employee/login" replace />
            } />
            
            {/* Manager Portal Login - Redirect to Employee Login */}
            <Route path="/manager/login" element={<Navigate to="/employee/login" replace />} />
            
            {/* Manager Portal Routes */}
            <Route path="/manager" element={
              user && portal === 'manager' ? (
                <ManagerLayout admin={user} onLogout={() => { handleLogout(); }}>
                  <ManagerDashboard user={user} />
                </ManagerLayout>
              ) : <Navigate to="/employee/login" replace />
            } />
            <Route path="/manager/*" element={
              user && portal === 'manager' ? (
                <ManagerLayout admin={user} onLogout={() => { handleLogout(); }}>
                  <Routes>
                    <Route path="properties" element={<ManagerProperties user={user} />} />
                    <Route path="work-orders/dashboard" element={<WorkOrdersDashboard user={user} portalType="manager" />} />
                    <Route path="work-orders" element={<ManagerWorkOrders user={user} />} />
                    <Route path="work-orders/pending" element={<ManagerWorkOrders user={user} />} />
                    <Route path="work-orders/completed" element={<ManagerWorkOrders user={user} />} />
                    <Route path="work-orders/assigned" element={<ManagerWorkOrders user={user} />} />
                    <Route path="work-orders/in-progress" element={<ManagerWorkOrders user={user} />} />
                    <Route path="work-orders/closed" element={<ManagerWorkOrders user={user} />} />
                    <Route path="work-orders/cancelled" element={<ManagerWorkOrders user={user} />} />
                    <Route path="customers" element={<ManagerCustomers user={user} />} />
                    <Route path="customers/add" element={<ManagerCustomers user={user} defaultTab="add" />} />
                    <Route path="vendors" element={<ManagerVendors user={user} />} />
                    <Route path="vendors/add" element={<ManagerAddVendor user={user} />} />
                    <Route path="vendors/assigned" element={<AssignedVendors user={user} />} />
                    <Route path="employees/zones" element={<ManagerEmployeeZones user={user} />} />
                    <Route path="estimates" element={<ManagerEstimates user={user} defaultTab="list" />} />
                    <Route path="estimates/dashboard" element={<EstimatesDashboard user={user} portalType="manager" />} />
                    <Route path="estimates/create" element={<ManagerEstimates user={user} defaultTab="create" />} />
                    <Route path="estimates/amc" element={<ManagerEstimates user={user} defaultTab="amc" />} />
                    <Route path="estimates/addons" element={<ManagerEstimates user={user} defaultTab="addons" />} />
                    <Route path="estimates/archived" element={<ManagerEstimates user={user} defaultTab="archived" />} />
                    <Route path="billing/dashboard" element={<BillingPlaceholder page="dashboard" portalName="Manager" />} />
                    <Route path="billing/generate-invoices" element={<GeneratedInvoices user={user} portalType="manager" />} />
                    <Route path="billing/invoices" element={<Invoices user={user} portalType="manager" />} />
                    <Route path="billing/payments" element={<Payments user={user} portalType="manager" />} />
                    <Route path="billing/make-payments" element={<BillingPlaceholder page="make-payments" portalName="Manager" />} />
                    <Route path="billing/payment-history" element={<BillingPlaceholder page="payment-history" portalName="Manager" />} />
                    <Route path="billing/archived" element={<Invoices user={user} portalType="manager" defaultTab="archived" />} />
                    <Route path="*" element={<Navigate to="/manager" replace />} />
                  </Routes>
                </ManagerLayout>
              ) : <Navigate to="/employee/login" replace />
            } />
            
            {/* Coordinator Portal Login - Redirect to Employee Login */}
            <Route path="/coordinator/login" element={<Navigate to="/employee/login" replace />} />
            
            {/* Coordinator Portal Routes */}
            <Route path="/coordinator" element={
              user && portal === 'coordinator' ? (
                <CoordinatorLayout admin={user} onLogout={() => { handleLogout(); }}>
                  <CoordinatorDashboard user={user} />
                </CoordinatorLayout>
              ) : <Navigate to="/employee/login" replace />
            } />
            <Route path="/coordinator/*" element={
              user && portal === 'coordinator' ? (
                <CoordinatorLayout admin={user} onLogout={() => { handleLogout(); }}>
                  <Routes>
                    <Route path="properties" element={<CoordinatorProperties user={user} />} />
                    <Route path="work-orders" element={<CoordinatorWorkOrders user={user} />} />
                    <Route path="work-orders/pending" element={<CoordinatorWorkOrders user={user} />} />
                    <Route path="work-orders/completed" element={<CoordinatorWorkOrders user={user} />} />
                    <Route path="work-orders/create" element={<CoordinatorWorkOrders user={user} />} />
                    <Route path="customers" element={<CoordinatorCustomers user={user} />} />
                    <Route path="customers/add" element={<CoordinatorCustomers user={user} defaultTab="add" />} />
                    <Route path="vendors" element={<CoordinatorVendors user={user} />} />
                    <Route path="vendors/add" element={<CoordinatorAddVendor user={user} />} />
                    <Route path="vendors/assigned" element={<AssignedVendors user={user} />} />
                    <Route path="employees/zones" element={<CoordinatorEmployees user={user} />} />
                    <Route path="estimates" element={<CoordinatorEstimates user={user} defaultTab="list" />} />
                    <Route path="estimates/dashboard" element={<EstimatesDashboard user={user} portalType="coordinator" />} />
                    <Route path="estimates/create" element={<CoordinatorEstimates user={user} defaultTab="create" />} />
                    <Route path="estimates/amc" element={<CoordinatorEstimates user={user} defaultTab="amc" />} />
                    <Route path="estimates/addons" element={<CoordinatorEstimates user={user} defaultTab="addons" />} />
                    <Route path="estimates/archived" element={<CoordinatorEstimates user={user} defaultTab="archived" />} />
                    <Route path="billing/generate-invoices" element={<GeneratedInvoices user={user} portalType="coordinator" />} />
                    <Route path="billing/invoices" element={<Invoices user={user} portalType="coordinator" />} />
                    <Route path="billing/payments" element={<Payments user={user} portalType="coordinator" />} />
                    <Route path="*" element={<Navigate to="/coordinator" replace />} />
                  </Routes>
                </CoordinatorLayout>
              ) : <Navigate to="/employee/login" replace />
            } />
            
            {/* Supervisor Portal Login - Redirect to Employee Login */}
            <Route path="/supervisor/login" element={<Navigate to="/employee/login" replace />} />
            
            {/* Supervisor Portal Routes */}
            <Route path="/supervisor" element={
              user && portal === 'supervisor' ? (
                <SupervisorLayout admin={user} onLogout={() => { handleLogout(); }}>
                  <SupervisorDashboard user={user} />
                </SupervisorLayout>
              ) : <Navigate to="/employee/login" replace />
            } />
            <Route path="/supervisor/*" element={
              user && portal === 'supervisor' ? (
                <SupervisorLayout admin={user} onLogout={() => { handleLogout(); }}>
                  <Routes>
                    <Route path="properties" element={<SupervisorProperties user={user} />} />
                    <Route path="work-orders" element={<SupervisorWorkOrders user={user} />} />
                    <Route path="work-orders/pending" element={<SupervisorWorkOrders user={user} />} />
                    <Route path="work-orders/completed" element={<SupervisorWorkOrders user={user} />} />
                    <Route path="customers" element={<SupervisorCustomers user={user} />} />
                    <Route path="customers/add" element={<SupervisorCustomers user={user} defaultTab="add" />} />
                    <Route path="vendors" element={<SupervisorVendors user={user} />} />
                    <Route path="vendors/add" element={<SupervisorAddVendor user={user} />} />
                    <Route path="vendors/assigned" element={<AssignedVendors user={user} />} />
                    <Route path="estimates" element={<SupervisorEstimates user={user} defaultTab="list" />} />
                    <Route path="estimates/dashboard" element={<EstimatesDashboard user={user} portalType="supervisor" />} />
                    <Route path="estimates/create" element={<SupervisorEstimates user={user} defaultTab="create" />} />
                    <Route path="estimates/amc" element={<SupervisorEstimates user={user} defaultTab="amc" />} />
                    <Route path="estimates/addons" element={<SupervisorEstimates user={user} defaultTab="addons" />} />
                    <Route path="estimates/archived" element={<SupervisorEstimates user={user} defaultTab="archived" />} />
                    <Route path="billing/dashboard" element={<BillingPlaceholder page="dashboard" portalName="Supervisor" />} />
                    <Route path="billing/generate-invoices" element={<GeneratedInvoices user={user} portalType="supervisor" />} />
                    <Route path="billing/invoices" element={<Invoices user={user} portalType="supervisor" />} />
                    <Route path="billing/payments" element={<Payments user={user} portalType="supervisor" />} />
                    <Route path="billing/make-payments" element={<BillingPlaceholder page="make-payments" portalName="Supervisor" />} />
                    <Route path="billing/payment-history" element={<BillingPlaceholder page="payment-history" portalName="Supervisor" />} />
                    <Route path="billing/archived" element={<Invoices user={user} portalType="supervisor" defaultTab="archived" />} />
                    <Route path="*" element={<Navigate to="/supervisor" replace />} />
                  </Routes>
                </SupervisorLayout>
              ) : <Navigate to="/employee/login" replace />
            } />
            
            {/* Executive Portal Login - Redirect to Employee Login */}
            <Route path="/executive/login" element={<Navigate to="/employee/login" replace />} />
            
            {/* Executive Portal Routes */}
            <Route path="/executive" element={
              user && portal === 'executive' ? (
                <ExecutiveLayout admin={user} onLogout={() => { handleLogout(); }}>
                  <ExecutiveDashboard user={user} />
                </ExecutiveLayout>
              ) : <Navigate to="/employee/login" replace />
            } />
            <Route path="/executive/*" element={
              user && portal === 'executive' ? (
                <ExecutiveLayout admin={user} onLogout={() => { handleLogout(); }}>
                  <Routes>
                    <Route path="properties" element={<ExecutiveProperties user={user} />} />
                    <Route path="work-orders" element={<ExecutiveWorkOrders user={user} />} />
                    <Route path="work-orders/pending" element={<ExecutiveWorkOrders user={user} />} />
                    <Route path="work-orders/completed" element={<ExecutiveWorkOrders user={user} />} />
                    <Route path="customers" element={<ExecutiveCustomers user={user} />} />
                    <Route path="customers/add" element={<ExecutiveCustomers user={user} defaultTab="add" />} />
                    <Route path="vendors" element={<ExecutiveVendors user={user} />} />
                    <Route path="vendors/add" element={<ExecutiveAddVendor user={user} />} />
                    <Route path="vendors/assigned" element={<AssignedVendors user={user} />} />
                    <Route path="employees/zones" element={<ManagerEmployeeZones user={user} viewOnly={true} />} />
                    <Route path="estimates" element={<ExecutiveEstimates user={user} defaultTab="list" />} />
                    <Route path="estimates/dashboard" element={<EstimatesDashboard user={user} portalType="executive" />} />
                    <Route path="estimates/create" element={<ExecutiveEstimates user={user} defaultTab="create" />} />
                    <Route path="estimates/amc" element={<ExecutiveEstimates user={user} defaultTab="amc" />} />
                    <Route path="estimates/addons" element={<ExecutiveEstimates user={user} defaultTab="addons" />} />
                    <Route path="estimates/archived" element={<ExecutiveEstimates user={user} defaultTab="archived" />} />
                    <Route path="billing/generate-invoices" element={<GeneratedInvoices user={user} portalType="executive" />} />
                    <Route path="billing/invoices" element={<Invoices user={user} portalType="executive" />} />
                    <Route path="billing/payments" element={<Payments user={user} portalType="executive" />} />
                    <Route path="*" element={<Navigate to="/executive" replace />} />
                  </Routes>
                </ExecutiveLayout>
              ) : <Navigate to="/employee/login" replace />
            } />
            
            {/* Fallback - redirect to portal selector */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </FPProvider>
    </AuthContext.Provider>
  );
}

export default App;
