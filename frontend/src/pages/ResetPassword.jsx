import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, AlertCircle, CheckCircle, Lock, Key } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import SEO from '../components/SEO';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [userData, setUserData] = useState(null);
  
  const [formData, setFormData] = useState({
    tempPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    temp: false,
    new: false,
    confirm: false
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const response = await fetch(`/api/customers/verify-reset-token/${token}`);
      const result = await response.json();

      if (result.success) {
        setTokenValid(true);
        setUserData(result.data);
      } else {
        setTokenValid(false);
        setTokenError(result.message || 'Invalid reset link');
      }
    } catch (err) {
      setTokenValid(false);
      setTokenError('Unable to verify reset link. Please try again.');
    } finally {
      setValidating(false);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/customers/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          tempPassword: formData.tempPassword,
          newPassword: formData.newPassword
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.message || 'Failed to reset password');
      }
    } catch (err) {
      setError('Unable to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-dark-300">Validating reset link...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
        <SEO title="Invalid Reset Link - XLAND INFRA" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold-600/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold-600/10 rounded-full blur-3xl"></div>
        </div>

        <div className="bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gold-600/20 relative z-10">
          <div className="px-6 py-8 text-center border-b border-gold-600/20">
            <div className="flex justify-center mb-4">
              <BrandLogo size="lg" />
            </div>
          </div>

          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Invalid Reset Link</h2>
            <p className="text-dark-300 mb-6">{tokenError}</p>
            <Link
              to="/forgot-password"
              className="inline-block px-6 py-3 rounded-lg font-semibold bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-dark-900 transition-all duration-200"
            >
              Request New Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
        <SEO title="Password Reset Successful - XLAND INFRA" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold-600/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold-600/10 rounded-full blur-3xl"></div>
        </div>

        <div className="bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gold-600/20 relative z-10">
          <div className="px-6 py-8 text-center border-b border-gold-600/20">
            <div className="flex justify-center mb-4">
              <BrandLogo size="lg" />
            </div>
          </div>

          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Password Reset Successful!</h2>
            <p className="text-dark-300 mb-6">
              Your password has been successfully reset. You can now login with your new password.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="inline-block px-6 py-3 rounded-lg font-semibold bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-dark-900 transition-all duration-200"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
      <SEO 
        title="Reset Password - HomeHub Customer Portal"
        description="Set your new password for XLAND INFRA HomeHub customer portal."
      />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold-600/10 rounded-full blur-3xl"></div>
      </div>

      <Link to="/login" className="absolute top-6 left-6 flex items-center space-x-2 text-gold-400 hover:text-gold-300 transition-colors z-10">
        <ArrowLeft className="w-5 h-5" />
        <span className="font-medium">Back to Login</span>
      </Link>

      <div className="bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gold-600/20 relative z-10 mt-16 md:mt-0">
        <div className="px-6 py-8 text-center border-b border-gold-600/20">
          <div className="flex justify-center mb-4">
            <BrandLogo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-white">Reset Password</h1>
          {userData && (
            <p className="text-dark-300 mt-2">
              Hello, <span className="text-gold-400">{userData.firstName}</span>
            </p>
          )}
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">
                Temporary Password
                <span className="text-dark-400 font-normal ml-1">(from email)</span>
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type={showPasswords.temp ? 'text' : 'password'}
                  value={formData.tempPassword}
                  onChange={(e) => setFormData({ ...formData, tempPassword: e.target.value })}
                  className="input-field pl-10 pr-10"
                  placeholder="Enter temporary password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, temp: !showPasswords.temp })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-gold-400 transition-colors"
                >
                  {showPasswords.temp ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  className="input-field pl-10 pr-10"
                  placeholder="Enter new password (min. 8 characters)"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-gold-400 transition-colors"
                >
                  {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="input-field pl-10 pr-10"
                  placeholder="Confirm new password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-gold-400 transition-colors"
                >
                  {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center space-x-2 text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-dark-900 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-dark-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
