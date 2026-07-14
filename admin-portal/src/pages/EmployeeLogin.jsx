import { safeStorage } from '../utils/safeStorage';
import { useState, useEffect } from 'react';
import { 
  Eye, EyeOff, AlertCircle, ArrowLeft, Briefcase, User, Lock
} from 'lucide-react';
import { initializeUsers, getPortalTypeFromRole } from '../utils/userStore';
import SetPassword from './SetPassword';
import ForgotPassword from './ForgotPassword';

const EmployeeLogin = ({ onLogin, onBack }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  useEffect(() => {
    initializeUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Authenticate via unified employee login API
      const response = await fetch('/api/employee/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username, password: formData.password })
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const userRole = result.data.user?.role || result.data.role;
        const franchisePartnerId = result.data.user?.franchisePartnerId || result.data.user?.franchise_partner_id;
        
        // DEBUG: Log the login response to see what we're getting
        console.log('[EmployeeLogin] Login response:', {
          role: userRole,
          franchisePartnerId: franchisePartnerId,
          fullUser: result.data.user
        });
        
        // Determine portal based on role (FP employees stay in their role-based portal, not franchise portal)
        const portalType = getPortalTypeFromRole(userRole);
        console.log('[EmployeeLogin] Determined portal:', portalType);
        
        const user = {
          id: result.data.user?.id || result.data.id,
          username: result.data.user?.username || result.data.username,
          firstName: result.data.user?.firstName || result.data.firstName || '',
          lastName: result.data.user?.lastName || result.data.lastName || '',
          name: `${result.data.user?.firstName || result.data.firstName || ''} ${result.data.user?.lastName || result.data.lastName || ''}`.trim(),
          email: result.data.user?.email || result.data.email,
          role: userRole,
          isSuperAdmin: result.data.user?.isSuperAdmin || false,
          status: 'active',
          permissions: result.data.user?.permissions || ['all'],
          franchisePartnerId: franchisePartnerId,
          portal: portalType
        };
        
        // Check if user must change password (first login)
        if (result.data.mustChangePassword) {
          // Store temporary credentials for password change
          setPendingUser({
            ...user,
            tempPassword: formData.password
          });
          setShowSetPassword(true);
        } else {
          // Store token and user data
          if (result.data.token) {
            safeStorage.setItem('pm_auth_token', result.data.token);
          }
          safeStorage.setItem('pm_current_user', JSON.stringify(user));
          onLogin(user);
        }
      } else {
        setError(result.message || 'Invalid credentials');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError('Unable to connect to server. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // Handle password set completion
  const handlePasswordSet = (updatedUser) => {
    setShowSetPassword(false);
    setPendingUser(null);
    onLogin(updatedUser);
  };

  // Show Forgot Password screen
  if (showForgotPassword) {
    return (
      <ForgotPassword 
        onBack={() => setShowForgotPassword(false)}
      />
    );
  }

  // Show Set Password screen if needed
  if (showSetPassword && pendingUser) {
    return (
      <SetPassword 
        user={pendingUser} 
        onPasswordSet={handlePasswordSet}
        onCancel={() => {
          setShowSetPassword(false);
          setPendingUser(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-amber-500/20 via-yellow-400/10 to-transparent rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-amber-600/15 via-orange-400/10 to-transparent rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] bg-gradient-to-br from-yellow-500/10 to-transparent rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(212,175,55,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>
      
      <div className="w-full max-w-md relative z-10">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-amber-400 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Portal Selection</span>
        </button>

        {/* Login Card */}
        <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <img src="/logo.png" alt="XLAND INFRA" className="h-20 w-auto object-contain" />
            </div>
            <h1 className="text-2xl text-amber-400">Employee Portal</h1>
            <p className="text-amber-400/70 text-sm mt-2">Sign in to access your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username / Email Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">Email or Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" strokeWidth={1.5} />
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full pl-11 pr-4 py-3.5 bg-zinc-800/60 border border-zinc-600/50 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 outline-none transition-all"
                  placeholder="Enter your email or username"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-zinc-300">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-amber-400 hover:text-amber-300 font-medium"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" strokeWidth={1.5} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-11 pr-12 py-3.5 bg-zinc-800/60 border border-zinc-600/50 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 outline-none transition-all"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-amber-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.5} /> : <Eye className="w-5 h-5" strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-black font-semibold py-3.5 rounded-xl transition-all duration-300 flex items-center justify-center shadow-lg shadow-amber-600/20 hover:shadow-amber-600/30"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center text-zinc-500 text-xs mt-6">
            Your role will be automatically detected after login
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmployeeLogin;
