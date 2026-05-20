import { useState } from 'react';
import { 
  Eye, EyeOff, AlertCircle, CheckCircle2, Lock, Shield, ArrowRight, Loader2
} from 'lucide-react';

const SetPassword = ({ user, onPasswordSet, onCancel }) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '' });

  const checkPasswordStrength = (password) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const levels = [
      { score: 0, label: '', color: '' },
      { score: 1, label: 'Very Weak', color: 'bg-red-500' },
      { score: 2, label: 'Weak', color: 'bg-orange-500' },
      { score: 3, label: 'Fair', color: 'bg-yellow-500' },
      { score: 4, label: 'Good', color: 'bg-lime-500' },
      { score: 5, label: 'Strong', color: 'bg-green-500' },
      { score: 6, label: 'Very Strong', color: 'bg-emerald-500' }
    ];

    return levels[Math.min(score, 6)];
  };

  const handleNewPasswordChange = (value) => {
    setFormData(prev => ({ ...prev, newPassword: value }));
    setPasswordStrength(checkPasswordStrength(value));
  };

  const validateForm = () => {
    if (!formData.currentPassword) {
      setError('Please enter your temporary password');
      return false;
    }
    if (!formData.newPassword) {
      setError('Please enter a new password');
      return false;
    }
    if (formData.newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return false;
    }
    if (formData.newPassword === formData.currentPassword) {
      setError('New password must be different from your temporary password');
      return false;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setLoading(true);

    try {
      // Use correct endpoint based on portal type
      const staffPortals = ['admin', 'manager', 'coordinator', 'supervisor', 'executive'];
      const endpoint = staffPortals.includes(user.portal) 
        ? '/api/staff/set-password' 
        : '/api/employee/set-password';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.email || user.username,
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        })
      });

      const result = await response.json();

      if (result.success) {
        // Store new token and user data
        if (result.data?.token) {
          sessionStorage.setItem('pm_auth_token', result.data.token);
        }
        if (result.data?.user) {
          const updatedUser = {
            ...result.data.user,
            name: `${result.data.user.firstName || ''} ${result.data.user.lastName || ''}`.trim(),
            portal: user.portal || 'employee'
          };
          sessionStorage.setItem('pm_current_user', JSON.stringify(updatedUser));
          onPasswordSet(updatedUser);
        } else {
          onPasswordSet(user);
        }
      } else {
        setError(result.message || 'Failed to update password. Please try again.');
      }
    } catch (err) {
      console.error('Password update error:', err);
      setError('Unable to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
        {/* Header Card */}
        <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-500/30">
              <Shield className="w-8 h-8 text-black" />
            </div>
            <h1 className="text-2xl font-semibold text-white">Set Your Password</h1>
            <p className="text-zinc-400 text-sm mt-2">
              Welcome! Please create a secure password to activate your account.
            </p>
          </div>

          {/* User Info */}
          <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                <span className="text-amber-400 font-semibold">
                  {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <p className="text-white font-medium">{user?.name || 'New Employee'}</p>
                <p className="text-zinc-500 text-sm">{user?.email}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Current/Temporary Password */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">Temporary Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" strokeWidth={1.5} />
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  className="w-full pl-11 pr-12 py-3.5 bg-zinc-800/60 border border-zinc-600/50 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 outline-none transition-all"
                  placeholder="Enter temporary password from email"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(s => ({ ...s, current: !s.current }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-amber-400 transition-colors"
                >
                  {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" strokeWidth={1.5} />
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={(e) => handleNewPasswordChange(e.target.value)}
                  className="w-full pl-11 pr-12 py-3.5 bg-zinc-800/60 border border-zinc-600/50 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 outline-none transition-all"
                  placeholder="Create a secure password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(s => ({ ...s, new: !s.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-amber-400 transition-colors"
                >
                  {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {formData.newPassword && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5, 6].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          level <= passwordStrength.score ? passwordStrength.color : 'bg-zinc-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-zinc-400">
                    Password strength: <span className={passwordStrength.score >= 4 ? 'text-green-400' : passwordStrength.score >= 3 ? 'text-yellow-400' : 'text-red-400'}>{passwordStrength.label}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" strokeWidth={1.5} />
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={`w-full pl-11 pr-12 py-3.5 bg-zinc-800/60 border rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/30 outline-none transition-all ${
                    formData.confirmPassword && formData.confirmPassword === formData.newPassword
                      ? 'border-green-500/50 focus:border-green-500/50'
                      : formData.confirmPassword
                      ? 'border-red-500/50 focus:border-red-500/50'
                      : 'border-zinc-600/50 focus:border-amber-500/50'
                  }`}
                  placeholder="Re-enter your new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(s => ({ ...s, confirm: !s.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-amber-400 transition-colors"
                >
                  {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {formData.confirmPassword && formData.confirmPassword === formData.newPassword && (
                <p className="flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle2 className="w-3 h-3" /> Passwords match
                </p>
              )}
            </div>

            {/* Password Requirements */}
            <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4">
              <p className="text-xs font-medium text-zinc-400 mb-2">Password Requirements:</p>
              <ul className="text-xs text-zinc-500 space-y-1">
                <li className={`flex items-center gap-2 ${formData.newPassword.length >= 8 ? 'text-green-400' : ''}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${formData.newPassword.length >= 8 ? 'bg-green-400' : 'bg-zinc-600'}`}></span>
                  At least 8 characters
                </li>
                <li className={`flex items-center gap-2 ${/[A-Z]/.test(formData.newPassword) && /[a-z]/.test(formData.newPassword) ? 'text-green-400' : ''}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${/[A-Z]/.test(formData.newPassword) && /[a-z]/.test(formData.newPassword) ? 'bg-green-400' : 'bg-zinc-600'}`}></span>
                  Mix of uppercase and lowercase letters
                </li>
                <li className={`flex items-center gap-2 ${/[0-9]/.test(formData.newPassword) ? 'text-green-400' : ''}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${/[0-9]/.test(formData.newPassword) ? 'bg-green-400' : 'bg-zinc-600'}`}></span>
                  At least one number
                </li>
                <li className={`flex items-center gap-2 ${/[^A-Za-z0-9]/.test(formData.newPassword) ? 'text-green-400' : ''}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${/[^A-Za-z0-9]/.test(formData.newPassword) ? 'bg-green-400' : 'bg-zinc-600'}`}></span>
                  Special character (recommended)
                </li>
              </ul>
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
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold py-3.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Activating Account...</span>
                </>
              ) : (
                <>
                  <span>Activate Account</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center text-zinc-500 text-xs mt-6">
            Your password will be securely encrypted
          </p>
        </div>
      </div>
    </div>
  );
};

export default SetPassword;
