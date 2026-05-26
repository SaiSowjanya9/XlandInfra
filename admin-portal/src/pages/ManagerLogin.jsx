import { useState } from 'react';
import { Building2, ArrowLeft, Eye, EyeOff, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import SetPassword from './SetPassword';
import ForgotPassword from './ForgotPassword';

const ManagerLogin = ({ onLogin, onBack }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/manager/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        const userData = result.data;
        
        // Check if user must change password (first login)
        if (userData.mustChangePassword) {
          setPendingUser({
            ...userData.user,
            name: `${userData.user.firstName || ''} ${userData.user.lastName || ''}`.trim(),
            email: userData.user.email,
            portal: 'manager'
          });
          setShowSetPassword(true);
        } else {
          // Store token and user info
          sessionStorage.setItem('pm_auth_token', userData.token);
          sessionStorage.setItem('pm_current_user', JSON.stringify({
            ...userData.user,
            portal: 'manager'
          }));

          // Call onLogin with user data
          onLogin({
            ...userData.user,
            portal: 'manager'
          });
        }
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle password set completion
  const handlePasswordSet = (updatedUser) => {
    setShowSetPassword(false);
    setPendingUser(null);
    onLogin({ ...updatedUser, portal: 'manager' });
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 flex flex-col relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-blue-500/20 via-indigo-400/10 to-transparent rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-600/15 via-blue-400/10 to-transparent rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Header */}
      <header className="w-full py-5 px-6 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Portal Selection</span>
          </button>
          <img
            src="/logo.png"
            alt="XLand Infra Logo"
            className="h-12 w-auto object-contain"
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-8 shadow-2xl">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/30 mb-4">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Manager Portal</h1>
              <p className="text-blue-200/70 mt-2">Sign in to manage your operations</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-200">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-blue-100 mb-2">
                  Username or Email
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter your username or email"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-blue-100">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-blue-300 hover:text-blue-200 font-medium"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Help Text */}
            <div className="mt-6 text-center">
              <p className="text-sm text-blue-200/50">
                Need access? Contact your system administrator.
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <p className="text-white font-semibold text-lg">7</p>
              <p className="text-blue-200/60 text-xs mt-1">Modules</p>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <p className="text-white font-semibold text-lg">100%</p>
              <p className="text-blue-200/60 text-xs mt-1">Secure</p>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <p className="text-white font-semibold text-lg">24/7</p>
              <p className="text-blue-200/60 text-xs mt-1">Access</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center relative z-10 border-t border-white/10">
        <p className="text-blue-200/40 text-sm">&copy; 2026 XLand Infra. Manager Portal.</p>
      </footer>
    </div>
  );
};

export default ManagerLogin;
