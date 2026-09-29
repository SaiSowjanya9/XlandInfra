import { useState, useEffect, useCallback } from 'react';
import { safeStorage, getAuthToken } from '../utils/safeStorage';
import useChartTooltip from '../components/common/ChartTooltip';
import {
  QrCode, Download, Copy, Edit3, Plus,
  BarChart3, Users, Smartphone, Monitor, Tablet,
  RefreshCw, Eye, EyeOff, Calendar, Clock, MapPin,
  TrendingUp, X, Check, AlertCircle, Repeat
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Every QR endpoint is behind `authenticate` + `adminOnly` (the security audit, commit 11da8865),
 * and this page was still calling them with no Authorization header: all three answered
 * "Access denied. No token provided." and every card fell back to 0. The page reported an empty QR
 * system as though it were a quiet one.
 */
const qrFetch = (path, options = {}) => {
  const token = getAuthToken();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
};

const QRManagement = () => {
  // Check if user is Operations Manager (view-only access)
  const currentUser = JSON.parse(safeStorage.getItem('pm_current_user') || '{}');
  const isOpsManager = currentUser?.role === 'operations_manager';
  
  const [qrCodes, setQrCodes] = useState([]);
  const [selectedQR, setSelectedQR] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingQR, setEditingQR] = useState(null);
  const [period, setPeriod] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState(null);

  // Base URL for QR redirects
  const QR_BASE_URL = window.location.hostname === 'localhost' 
    ? `http://localhost:5000/api/qr/r`
    : `https://admin.xlandinfra.com/api/qr/r`;

  const fetchQRCodes = useCallback(async () => {
    try {
      const response = await qrFetch('/api/qr/codes');
      const result = await response.json();
      if (result.success) {
        setQrCodes(result.data);
        setLoadError(null);
        setSelectedQR(current => current || result.data[0] || null);
      } else {
        // Say which figures are missing rather than leaving a page of confident zeros
        setLoadError(result.message || 'Could not load QR codes');
      }
    } catch (error) {
      console.error('Error fetching QR codes:', error);
      setLoadError(error.message || 'Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOverview = useCallback(async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      const response = await qrFetch('/api/qr/analytics/overview');
      const result = await response.json();
      if (result.success) {
        setOverview(result.data);
        setLoadError(null);
      } else {
        setOverview(null);
        setLoadError(result.message || 'Could not load scan totals');
      }
    } catch (error) {
      console.error('Error fetching overview:', error);
      setOverview(null);
      setLoadError(error.message || 'Could not reach the server');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async (qrId, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await qrFetch(`/api/qr/analytics/${qrId}?period=${period}`);
      const result = await response.json();
      if (result.success) {
        setAnalytics(result.data);
        setLoadError(null);
      } else {
        setAnalytics(null);
        setLoadError(result.message || 'Could not load analytics');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalytics(null);
      setLoadError(error.message || 'Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchQRCodes();
    fetchOverview();
  }, [fetchQRCodes, fetchOverview]);

  useEffect(() => {
    if (selectedQR) fetchAnalytics(selectedQR.id);
  }, [selectedQR, fetchAnalytics]);

  // Auto-refresh every 10 seconds, and only what is on screen: the analytics tab is the only place
  // a single code's figures are shown, so there is nothing to keep fresh while it is closed.
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedQR && activeTab === 'analytics') fetchAnalytics(selectedQR.id, true);
      if (activeTab !== 'analytics') fetchOverview(true);
      fetchQRCodes();
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedQR, activeTab, fetchAnalytics, fetchOverview, fetchQRCodes]);

  const handleCreateQR = async (formData) => {
    try {
      const response = await qrFetch('/api/qr/codes', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      if (result.success) {
        showNotification('QR code created successfully', 'success');
        fetchQRCodes();
        fetchOverview(true);
        setShowCreateModal(false);
      } else {
        showNotification(result.message || 'Failed to create QR code', 'error');
      }
    } catch (error) {
      showNotification('Error creating QR code', 'error');
    }
  };

  const handleUpdateQR = async (id, formData) => {
    try {
      const response = await qrFetch(`/api/qr/codes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      if (result.success) {
        showNotification('QR code updated successfully', 'success');
        fetchQRCodes();
        fetchOverview(true);
        setShowEditModal(false);
        if (selectedQR?.id === id) {
          setSelectedQR(result.data);
        }
      } else {
        showNotification(result.message || 'Failed to update QR code', 'error');
      }
    } catch (error) {
      showNotification('Error updating QR code', 'error');
    }
  };

  const handleToggleActive = async (qr) => {
    await handleUpdateQR(qr.id, { is_active: !qr.is_active });
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showNotification('Copied to clipboard', 'success');
  };

  const downloadQR = async (qr, format = 'svg') => {
    // Generate QR code SVG/PNG
    const qrUrl = `${QR_BASE_URL}/${qr.slug}`;
    const qrSize = 400;
    const errorLevel = qr.error_correction || 'H';
    
    // For actual download, we'd use a QR library - for now, open generator
    const generatorUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(qrUrl)}&ecc=${errorLevel}&format=${format}`;
    
    const link = document.createElement('a');
    link.href = generatorUrl;
    link.download = `xland-qr-${qr.slug}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`QR code downloaded as ${format.toUpperCase()}`, 'success');
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && !qrCodes.length) {
    return (
      <div className="min-h-screen bg-warm-page flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Loading QR Management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-page text-gray-800">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-slide-in text-white ${
          notification.type === 'success' ? 'bg-emerald-500' :
          notification.type === 'error' ? 'bg-red-500' : 'bg-indigo-500'
        }`}>
          {notification.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-md">
                <QrCode className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  QR Management System
                </h1>
                <p className="text-gray-500 text-sm">XLAND INFRA Dynamic QR Ecosystem</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { fetchOverview(); fetchQRCodes(); if (selectedQR) fetchAnalytics(selectedQR.id); }}
                className={`p-2.5 rounded-xl bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-all ${refreshing ? 'animate-spin' : ''}`}
              >
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
              {!isOpsManager && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 rounded-xl text-white font-medium hover:bg-indigo-700 transition-all shadow-md"
                >
                  Create QR
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-4">
            {['overview', 'analytics', 'management'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Whatever could not be loaded is named. A page of zeros is indistinguishable from a QR
            system nobody has scanned, and that is exactly how a 401 went unnoticed. */}
        {loadError && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm">
              <p className="font-medium text-amber-900">Scan figures could not be loaded, so none are shown below.</p>
              <p className="mt-0.5 text-amber-800">{loadError}</p>
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid. Each card says what it counts: a label that does not match its query is
                how "Verified Scans / Mobile only" came to include tablets, and how a count of first
                scans came to be shown as a count of people. */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                icon={QrCode}
                label="QR Codes"
                value={overview ? overview.totals.total_qr_codes : '--'}
                subtext={overview ? `${overview.totals.active_qr_codes} active` : 'Not loaded'}
                color="indigo"
              />
              <StatCard
                icon={BarChart3}
                label="Total Scans"
                value={overview ? formatNumber(overview.totals.total_scans) : '--'}
                subtext="All time"
                color="blue"
              />
              <StatCard
                icon={Smartphone}
                label="Phone & Tablet"
                value={overview ? formatNumber(overview.totals.handheld_scans) : '--'}
                subtext="Of those scans"
                color="emerald"
              />
              <StatCard
                icon={Users}
                label="Visitors"
                value={overview ? formatNumber(overview.totals.unique_visitors) : '--'}
                subtext="Distinct devices"
                color="purple"
              />
              <StatCard
                icon={Repeat}
                label="Came Back"
                value={overview ? formatNumber(overview.totals.repeat_visitors) : '--'}
                subtext="Scanned more than once"
                color="rose"
              />
            </div>

            {/* Today's Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
                  <Calendar className="w-5 h-5 text-indigo-500" />
                  Today's Activity
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                    <p className="text-3xl font-bold text-indigo-600">{overview ? overview.totals.scans_today : '--'}</p>
                    <p className="text-gray-500 text-sm mt-1">Scans</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    {/* Devices whose first ever scan was today, counted from the scans themselves */}
                    <p className="text-3xl font-bold text-emerald-600">{overview ? overview.totals.new_visitors_today : '--'}</p>
                    <p className="text-gray-500 text-sm mt-1">First-time visitors</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                    <p className="text-3xl font-bold text-amber-600">{overview ? overview.totals.scans_last_5_min : '--'}</p>
                    {/* Not "active users": nothing reports back after the redirect, so the only
                        honest live figure is how recently a scan arrived. */}
                    <p className="text-gray-500 text-sm mt-1">Scans in last 5 min</p>
                  </div>
                </div>
                {overview?.totals?.last_scan_at && (
                  <p className="mt-4 text-xs text-gray-400">
                    Last scan {formatDate(overview.totals.last_scan_at)} at {formatTime(overview.totals.last_scan_at)}
                  </p>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                  Per QR Performance
                </h3>
                <div className="space-y-3 max-h-40 overflow-y-auto custom-scrollbar">
                  {overview?.per_qr?.map((qr) => (
                    <div key={qr.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all cursor-pointer border border-gray-100"
                      onClick={() => { setSelectedQR(qr); setActiveTab('analytics'); }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                          <QrCode className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-800">{qr.label}</p>
                          <p className="text-gray-400 text-xs">/{qr.slug}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-indigo-600">{formatNumber(qr.total_scans)} scans</p>
                        <p className="text-gray-400 text-xs">{formatNumber(qr.unique_visitors)} visitors</p>
                      </div>
                    </div>
                  ))}
                  {!overview?.per_qr?.length && (
                    <p className="py-6 text-center text-sm text-gray-400">No QR codes yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* QR Cards */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Your QR Codes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {qrCodes.map((qr) => (
                  <QRCard
                    key={qr.id}
                    qr={qr}
                    baseUrl={QR_BASE_URL}
                    onSelect={() => { setSelectedQR(qr); setActiveTab('analytics'); }}
                    onEdit={() => { setEditingQR(qr); setShowEditModal(true); }}
                    onToggle={() => handleToggleActive(qr)}
                    onCopy={copyToClipboard}
                    onDownload={downloadQR}
                    isOpsManager={isOpsManager}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* QR Selector & Period Filter */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-3">
                <select
                  value={selectedQR?.id || ''}
                  onChange={(e) => {
                    const qr = qrCodes.find(q => q.id === parseInt(e.target.value));
                    setSelectedQR(qr);
                  }}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:border-indigo-400 shadow-sm"
                >
                  {qrCodes.map((qr) => (
                    <option key={qr.id} value={qr.id}>{qr.label}</option>
                  ))}
                </select>
                {selectedQR && (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    selectedQR.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {selectedQR.is_active ? 'Active' : 'Inactive'}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {['24h', '7d', '30d', '90d'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      period === p
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {analytics && (
              <>
                {/* Key Metrics. Four cards, four columns: a five-column grid holding four cards left
                    a gap that read as a card still loading. */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    icon={BarChart3}
                    label="Scans"
                    value={formatNumber(analytics.stats.total_scans)}
                    subtext={`Last ${period}`}
                    color="indigo"
                  />
                  <StatCard
                    icon={Users}
                    label="Visitors"
                    value={formatNumber(analytics.stats.unique_visitors)}
                    subtext="Distinct devices"
                    color="blue"
                  />
                  <StatCard
                    icon={Smartphone}
                    label="Phone & Tablet"
                    value={formatNumber(analytics.stats.handheld_scans)}
                    subtext="Of those scans"
                    color="emerald"
                  />
                  <StatCard
                    icon={Repeat}
                    label="Came Back"
                    value={formatNumber(analytics.stats.repeat_visitors)}
                    subtext="Scanned more than once"
                    color="purple"
                  />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Trend */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-semibold mb-1 flex items-center gap-2 text-gray-800">
                      <TrendingUp className="w-5 h-5 text-indigo-500" />
                      Scan Trend
                    </h3>
                    <p className="mb-4 text-xs text-gray-400">
                      {analytics.period?.granularity === 'hour' ? 'By hour, last 24 hours' : `By day, last ${period}`}
                      {' · '}{formatNumber(analytics.stats.total_scans)} scans in the period
                    </p>
                    <ScanTrendChart series={analytics.trend || []} granularity={analytics.period?.granularity} />
                  </div>

                  {/* Device Breakdown */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
                      <Smartphone className="w-5 h-5 text-indigo-500" />
                      Device Distribution
                    </h3>
                    <DeviceChart devices={analytics.devices || []} />
                  </div>
                </div>

                {/* Locations & Browser */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Where the scans came from. To the city: a country column reads "India" on every
                      row for a business that works in one country. */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
                      <MapPin className="w-5 h-5 text-indigo-500" />
                      Top Locations
                    </h3>
                    <div className="space-y-3">
                      {(analytics.locations || []).slice(0, 5).map((place, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="text-lg">{getCountryFlag(place.country_code)}</span>
                            <span className="min-w-0 font-medium text-gray-800">{formatPlace(place)}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-indigo-600 font-semibold">{place.count}</span>
                            <span className="text-gray-400 text-sm">scans</span>
                          </div>
                        </div>
                      ))}
                      {!analytics.locations?.length && (
                        <p className="text-gray-400 text-center py-8">No location data yet</p>
                      )}
                    </div>
                  </div>

                  {/* Browser & OS */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
                      <Monitor className="w-5 h-5 text-indigo-500" />
                      Browsers & OS
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-500 text-sm mb-2">Browsers</p>
                        <div className="space-y-2">
                          {(analytics.browsers || []).slice(0, 4).map((b, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{b.browser_name || 'Unknown'}</span>
                              <span className="text-indigo-600 font-medium">{b.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm mb-2">Operating Systems</p>
                        <div className="space-y-2">
                          {(analytics.operating_systems || []).slice(0, 4).map((os, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{os.os_name || 'Unknown'}</span>
                              <span className="text-indigo-600 font-medium">{os.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Scans. Within the selected period, like everything above it: this list used
                    to ignore the period, so "24h" could show a card reading 0 scans above ten of them. */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold mb-1 flex items-center gap-2 text-gray-800">
                    <Clock className="w-5 h-5 text-indigo-500" />
                    Recent Scans
                  </h3>
                  <p className="mb-4 text-xs text-gray-400">
                    The latest {Math.min(analytics.recent_scans?.length || 0, 10)} of {formatNumber(analytics.stats.total_scans)} scans in the last {period}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-gray-500 text-sm border-b border-gray-200">
                          <th className="pb-3 font-medium">Time</th>
                          <th className="pb-3 font-medium">Device</th>
                          <th className="pb-3 font-medium">Browser</th>
                          <th className="pb-3 font-medium">OS</th>
                          <th className="pb-3 font-medium">Location</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {(analytics.recent_scans || []).slice(0, 10).map((scan, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 text-gray-700">
                              {formatDate(scan.scanned_at)} {formatTime(scan.scanned_at)}
                            </td>
                            <td className="py-3">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                scan.device_type === 'mobile' ? 'bg-blue-100 text-blue-700' :
                                scan.device_type === 'tablet' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {scan.device_type || 'Unknown'}
                              </span>
                            </td>
                            <td className="py-3 text-gray-700">{scan.browser_name || 'Unknown'}</td>
                            <td className="py-3 text-gray-700">{scan.os_name || 'Unknown'}</td>
                            <td className="py-3 text-gray-700">{formatPlace(scan)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(!analytics.recent_scans || analytics.recent_scans.length === 0) && (
                      <p className="text-gray-400 text-center py-8">No scans in the last {period}</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Management Tab */}
        {activeTab === 'management' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">QR Code Management</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-xl text-white font-medium hover:bg-indigo-700 transition-all shadow-md"
              >
                <Plus className="w-4 h-4" />
                Create New QR
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-500 text-sm bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 font-medium">QR Code</th>
                    <th className="px-6 py-4 font-medium">Redirect URL</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Scans</th>
                    <th className="px-6 py-4 font-medium">Visitors</th>
                    <th className="px-6 py-4 font-medium">Last scan</th>
                    <th className="px-6 py-4 font-medium">Created</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {qrCodes.map((qr) => (
                    <tr key={qr.id} className="border-t border-gray-100 hover:bg-gray-50 transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <QrCode className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{qr.label}</p>
                            <p className="text-gray-400 text-sm">/{qr.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 text-sm truncate max-w-xs">{qr.current_url}</span>
                          <button
                            onClick={() => copyToClipboard(qr.current_url)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Copy className="w-3 h-3 text-gray-400" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(qr)}
                          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                            qr.is_active
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {qr.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {qr.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-indigo-600 font-semibold">{formatNumber(qr.total_scans)}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{formatNumber(qr.unique_visitors)}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">
                        {qr.last_scan_at ? `${formatDate(qr.last_scan_at)} ${formatTime(qr.last_scan_at)}` : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm">
                        {formatDate(qr.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEditingQR(qr); setShowEditModal(true); }}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => downloadQR(qr, 'png')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                            title="Download PNG"
                          >
                            <Download className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => { setSelectedQR(qr); setActiveTab('analytics'); }}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                            title="View Analytics"
                          >
                            <BarChart3 className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <QRModal
          title="Create New QR Code"
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateQR}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && editingQR && (
        <QRModal
          title="Edit QR Code"
          qr={editingQR}
          onClose={() => { setShowEditModal(false); setEditingQR(null); }}
          onSubmit={(data) => handleUpdateQR(editingQR.id, data)}
        />
      )}

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
      `}</style>
    </div>
  );
};

// Sub-components

const StatCard = ({ icon: Icon, label, value, subtext, color = 'indigo' }) => {
  const colors = {
    amber: 'bg-amber-50 border-amber-200 text-amber-600',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-600',
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    rose: 'bg-rose-50 border-rose-200 text-rose-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
  };

  const iconColors = {
    amber: 'bg-amber-100 text-amber-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    blue: 'bg-blue-100 text-blue-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    rose: 'bg-rose-100 text-rose-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className={`${colors[color]} border rounded-2xl p-5 relative overflow-hidden shadow-sm`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-xl ${iconColors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
      <p className="text-sm mt-1">{label}</p>
      <p className="text-gray-400 text-xs mt-0.5">{subtext}</p>
    </div>
  );
};

const QRCard = ({ qr, baseUrl, onSelect, onEdit, onToggle, onCopy, onDownload, isOpsManager }) => {
  const qrUrl = `${baseUrl}/${qr.slug}`;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition-all group shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <QrCode className="w-7 h-7 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{qr.label}</h3>
            <p className="text-gray-400 text-sm">/{qr.slug}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          qr.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
        }`}>
          {qr.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-100">
        <p className="text-gray-400 text-xs mb-1">Redirect URL</p>
        <p className="text-sm text-gray-700 truncate">{qr.current_url}</p>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <span>{(qr.total_scans || 0).toLocaleString('en-IN')} scans</span>
        <span>{(qr.unique_visitors || 0).toLocaleString('en-IN')} visitors</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSelect}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-all text-sm font-medium"
        >
          <BarChart3 className="w-4 h-4" />
          Analytics
        </button>
        <button
          onClick={() => onCopy(qrUrl)}
          className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
          title="Copy URL"
        >
          <Copy className="w-4 h-4 text-gray-500" />
        </button>
        <button
          onClick={() => onDownload(qr, 'png')}
          className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
          title="Download"
        >
          <Download className="w-4 h-4 text-gray-500" />
        </button>
        {!isOpsManager && (
          <button
            onClick={onEdit}
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
            title="Edit"
          >
            <Edit3 className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>
    </div>
  );
};

const QRModal = ({ title, qr, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    label: qr?.label || '',
    slug: qr?.slug || '',
    current_url: qr?.current_url || '',
    description: qr?.description || '',
    qr_type: qr?.qr_type || 'custom',
    change_reason: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(formData);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Label</label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:bg-white"
              placeholder="e.g., XLAND INFRA Website"
              required
            />
          </div>

          {!qr && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Slug</label>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">qr.xlandinfra.com/</span>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:bg-white"
                  placeholder="main"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Redirect URL</label>
            <input
              type="url"
              value={formData.current_url}
              onChange={(e) => setFormData({ ...formData, current_url: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:bg-white"
              placeholder="https://www.xlandinfra.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:bg-white resize-none"
              placeholder="Brief description of this QR code's purpose..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select
              value={formData.qr_type}
              onChange={(e) => setFormData({ ...formData, qr_type: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:border-indigo-400"
            >
              <option value="website">Website</option>
              <option value="admin">Admin Portal</option>
              <option value="campaign">Campaign</option>
              <option value="event">Event</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {qr && formData.current_url !== qr.current_url && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason for URL Change</label>
              <input
                type="text"
                value={formData.change_reason}
                onChange={(e) => setFormData({ ...formData, change_reason: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:bg-white"
                placeholder="e.g., Updated landing page"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-indigo-600 rounded-xl text-white font-medium hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : (qr ? 'Update QR' : 'Create QR')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * The scan trend.
 *
 * Every bucket in the period is drawn, including the empty ones -- the server fills them -- so the
 * gap between two scans is visible as the gap it is. A bucket with no scans is **no bar at all**:
 * the old chart floored every bar at 5% of the plot, which drew a zero as a stub the same size as a
 * real 1-scan day. The column carries the hover so an empty bucket still answers when pointed at,
 * and the plot scrolls sideways rather than squeezing 90 days into a card (see the chart rules in
 * AGENTS.md).
 */
const ScanTrendChart = ({ series, granularity = 'day' }) => {
  const chart = useChartTooltip();
  if (!series || series.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-400">No data available</div>;
  }

  const maxScans = Math.max(...series.map(d => d.scans), 1);
  // Labels only where they can be read; the hover answers for the rest
  const showLabels = series.length <= 10;
  const label = (at) => granularity === 'hour'
    ? new Date(at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : new Date(at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

  return (
    <div className="overflow-x-auto">
      <div className="flex h-48 items-stretch gap-1" style={{ minWidth: `${series.length * 24}px` }}>
        {series.map((item) => (
          <div
            key={item.bucket}
            className="flex flex-1 cursor-pointer flex-col justify-end gap-1"
            style={{ minWidth: '20px' }}
            {...chart.hover({
              title: granularity === 'hour'
                ? new Date(item.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : new Date(item.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
              rows: [
                { label: 'Scans', value: item.scans.toLocaleString('en-IN'), color: '#6366F1' },
                { label: 'Visitors', value: item.visitors.toLocaleString('en-IN'), color: '#A5B4FC' }
              ]
            })}
          >
            <div className="flex flex-1 items-end">
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 to-indigo-400 transition-all hover:from-indigo-400 hover:to-indigo-300"
                style={{ height: item.scans === 0 ? 0 : `${Math.max((item.scans / maxScans) * 100, 2)}%` }}
              />
            </div>
            <span className="h-4 w-full truncate text-center text-[10px] text-gray-500">
              {showLabels ? label(item.at) : ''}
            </span>
          </div>
        ))}
      </div>
      {chart.node}
    </div>
  );
};

const DeviceChart = ({ devices }) => {
  const total = devices.reduce((sum, d) => sum + (d.count || 0), 0) || 1;
  
  const deviceIcons = {
    mobile: Smartphone,
    tablet: Tablet,
    desktop: Monitor
  };

  const deviceColors = {
    mobile: 'bg-blue-500',
    tablet: 'bg-purple-500',
    desktop: 'bg-emerald-500',
    unknown: 'bg-gray-400'
  };

  const deviceBgColors = {
    mobile: 'bg-blue-100',
    tablet: 'bg-purple-100',
    desktop: 'bg-emerald-100',
    unknown: 'bg-gray-100'
  };

  const deviceTextColors = {
    mobile: 'text-blue-600',
    tablet: 'text-purple-600',
    desktop: 'text-emerald-600',
    unknown: 'text-gray-600'
  };

  return (
    <div className="space-y-4">
      {devices.map((device, idx) => {
        const Icon = deviceIcons[device.device_type] || Monitor;
        const percentage = ((device.count / total) * 100).toFixed(1);
        
        return (
          <div key={idx} className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${deviceBgColors[device.device_type] || deviceBgColors.unknown}`}>
              <Icon className={`w-5 h-5 ${deviceTextColors[device.device_type] || deviceTextColors.unknown}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium capitalize text-gray-700">{device.device_type || 'Unknown'}</span>
                <span className="text-sm text-gray-500">{percentage}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${deviceColors[device.device_type] || deviceColors.unknown} rounded-full transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
            <span className="text-indigo-600 font-semibold min-w-[3rem] text-right">{device.count}</span>
          </div>
        );
      })}
      {devices.length === 0 && (
        <p className="text-gray-400 text-center py-8">No device data yet</p>
      )}
    </div>
  );
};

/**
 * Where a scan came from, as much of it as is known: "Hyderabad, Telangana", or the country alone
 * when the lookup only got that far, or "Unknown". An unlocated scan is stored as NULL rather than
 * as the string "Unknown", so a placeholder is never mistaken for a place.
 */
const formatPlace = (place) => {
  const parts = [place?.city, place?.state].filter(part => part && part !== 'Unknown');
  if (parts.length) return parts.join(', ');
  return place?.country && place.country !== 'Unknown' ? place.country : 'Unknown';
};

const getCountryFlag = (countryCode) => {
  if (!countryCode || countryCode === 'XX') return '🌍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export default QRManagement;
