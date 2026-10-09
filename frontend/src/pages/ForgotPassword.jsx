import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import SEO from '../components/SEO';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [notActivated, setNotActivated] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotActivated(false);
    setLoading(true);

    try {
      const response = await fetch('/api/customers/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
      } else if (result.notActivated) {
        setNotActivated(true);
        setError(result.message);
      } else {
        setError(result.message || 'Unable to process request');
      }
    } catch (err) {
      setError('Unable to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
        <SEO 
          title="Check Your Email - XLAND INFRA"
          description="Password reset instructions have been sent to your email."
        />
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
            <h2 className="text-xl font-bold text-white mb-2">Check Your Email</h2>
            <p className="text-dark-300 mb-6">
              If an account exists with <span className="text-gold-400">{email}</span>, you will receive password reset instructions shortly.
            </p>
            <p className="text-dark-400 text-sm mb-6">
              The reset link will expire in <span className="text-gold-400 font-semibold">48 hours</span>.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center space-x-2 text-gold-400 hover:text-gold-300 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Login</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
      <SEO 
        title="Forgot Password - HomeHub Customer Portal"
        description="Reset your XLAND INFRA HomeHub customer portal password."
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
          <h1 className="text-2xl font-bold text-white">Forgot Password?</h1>
          <p className="text-dark-300 mt-2">Enter your email to reset your password</p>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field !pl-11"
                  placeholder="Enter your email address"
                  required
                />
              </div>
            </div>

            {notActivated && (
              <div className="p-3 bg-amber-900/30 border border-amber-500/50 rounded-lg">
                <div className="flex items-start space-x-2 text-amber-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium mb-1">Account Not Activated</p>
                    <p className="text-amber-400/80">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {error && !notActivated && (
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
                'Send Reset Link'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-dark-400 text-sm">
              Remember your password?{' '}
              <Link to="/login" className="text-gold-400 hover:text-gold-300 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
