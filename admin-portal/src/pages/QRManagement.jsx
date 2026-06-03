import { useState, useEffect, useRef, useCallback } from 'react';
import {
  QrCode, Download, Copy, ExternalLink, Edit3, Trash2, Plus,
  BarChart3, Users, Activity, Globe, Smartphone, Monitor, Tablet,
  RefreshCw, Eye, EyeOff, Link2, Calendar, Clock, MapPin,
  TrendingUp, ArrowUpRight, ArrowDownRight, ChevronDown, X,
  Check, AlertCircle, Filter, Search, Settings, Share2
} from 'lucide-react';

const QRManagement = () => {
  const [qrCodes, setQrCodes] = useState([]);
  const [selectedQR, setSelectedQR] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchQRCodes();
    fetchOverview();
  }, []);

  useEffect(() => {
    if (selectedQR) {
      fetchAnalytics(selectedQR.id);
    }
  }, [selectedQR, period]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedQR) {
        fetchAnalytics(selectedQR.id, true);
      }
      fetchOverview(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedQR]);

  const fetchQRCodes = async () => {
    try {
      const response = await fetch('/api/qr/codes');
      const result = await response.json();
      if (result.success) {
        setQrCodes(result.data);
        if (!selectedQR && result.data.length > 0) {
          setSelectedQR(result.data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching QR codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOverview = async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      const response = await fetch('/api/qr/analytics/overview');
      const result = await response.json();
      if (result.success) {
        setOverview(result.data);
      }
    } catch (error) {
      console.error('Error fetching overview:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchAnalytics = async (qrId, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await fetch(`/api/qr/analytics/${qrId}?period=${period}`);
      const result = await response.json();
      if (result.success) {
        setAnalytics(result.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQR = async (formData) => {
    try {
      const response = await fetch('/api/qr/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      if (result.success) {
        showNotification('QR code created successfully', 'success');
        fetchQRCodes();
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
      const response = await fetch(`/api/qr/codes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      if (result.success) {
        showNotification('QR code updated successfully', 'success');
        fetchQRCodes();
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-amber-500/70 text-sm">Loading QR Management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in ${
          notification.type === 'success' ? 'bg-emerald-500/90' :
          notification.type === 'error' ? 'bg-red-500/90' : 'bg-amber-500/90'
        }`}>
          {notification.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-amber-500/20 bg-black/40 backdrop-blur-xl sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg shadow-amber-500/20">
                <QrCode className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                  QR Management System
                </h1>
                <p className="text-gray-400 text-sm">XLAND INFRA Dynamic QR Ecosystem</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchOverview()}
                className={`p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all ${refreshing ? 'animate-spin' : ''}`}
              >
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg text-black font-medium hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                Create QR
              </button>
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
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={QrCode}
                label="Total QR Codes"
                value={overview?.totals?.total_qr_codes || qrCodes.length}
                subtext="Active codes"
                color="amber"
              />
              <StatCard
                icon={BarChart3}
                label="Total Scans"
                value={formatNumber(overview?.totals?.total_scans || 0)}
                subtext="All time"
                color="blue"
              />
              <StatCard
                icon={Users}
                label="Unique Users"
                value={formatNumber(overview?.totals?.unique_users || 0)}
                subtext="Distinct visitors"
                color="emerald"
              />
              <StatCard
                icon={Activity}
                label="Active Now"
                value={overview?.totals?.active_now || 0}
                subtext="Real-time"
                color="rose"
                pulse
              />
            </div>

            {/* Today's Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  Today's Activity
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/30 rounded-xl p-4">
                    <p className="text-3xl font-bold text-amber-500">{overview?.totals?.scans_today || 0}</p>
                    <p className="text-gray-400 text-sm mt-1">Scans Today</p>
                  </div>
                  <div className="bg-black/30 rounded-xl p-4">
                    <p className="text-3xl font-bold text-emerald-500">{overview?.totals?.unique_today || 0}</p>
                    <p className="text-gray-400 text-sm mt-1">New Users</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                  Per QR Performance
                </h3>
                <div className="space-y-3 max-h-40 overflow-y-auto custom-scrollbar">
                  {overview?.per_qr?.map((qr) => (
                    <div key={qr.id} className="flex items-center justify-between p-3 bg-black/30 rounded-xl hover:bg-black/40 transition-all cursor-pointer"
                      onClick={() => { setSelectedQR(qr); setActiveTab('analytics'); }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                          <QrCode className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{qr.label}</p>
                          <p className="text-gray-500 text-xs">/{qr.slug}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-amber-500">{formatNumber(qr.total_scans)}</p>
                        <p className="text-gray-500 text-xs">{qr.active_now || 0} active</p>
                      </div>
                    </div>
                  ))}
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
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-amber-500/50"
                >
                  {qrCodes.map((qr) => (
                    <option key={qr.id} value={qr.id} className="bg-gray-900">{qr.label}</option>
                  ))}
                </select>
                {selectedQR && (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    selectedQR.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
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
                        ? 'bg-amber-500 text-black font-medium'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {analytics && (
              <>
                {/* Key Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    icon={BarChart3}
                    label="Total Scans"
                    value={formatNumber(analytics.stats?.total_scans || 0)}
                    subtext={`Last ${period}`}
                    color="amber"
                  />
                  <StatCard
                    icon={Users}
                    label="Unique Users"
                    value={formatNumber(analytics.stats?.unique_users || 0)}
                    subtext="Distinct visitors"
                    color="blue"
                  />
                  <StatCard
                    icon={Activity}
                    label="Active Now"
                    value={analytics.active_now || 0}
                    subtext="Real-time"
                    color="emerald"
                    pulse
                  />
                  <StatCard
                    icon={Clock}
                    label="Repeat Users"
                    value={formatNumber(analytics.stats?.repeat_users || 0)}
                    subtext="Return visitors"
                    color="purple"
                  />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Daily Trend */}
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-amber-500" />
                      Scan Trends
                    </h3>
                    <div className="h-48">
                      <SimpleTrendChart data={analytics.daily || []} />
                    </div>
                  </div>

                  {/* Device Breakdown */}
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Smartphone className="w-5 h-5 text-amber-500" />
                      Device Distribution
                    </h3>
                    <DeviceChart devices={analytics.devices || []} />
                  </div>
                </div>

                {/* Geography & Browser */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Geography */}
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Globe className="w-5 h-5 text-amber-500" />
                      Top Locations
                    </h3>
                    <div className="space-y-3">
                      {(analytics.geography || []).slice(0, 5).map((geo, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-black/30 rounded-xl">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{getCountryFlag(geo.country_code)}</span>
                            <span className="font-medium">{geo.country || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-amber-500 font-semibold">{geo.count}</span>
                            <span className="text-gray-500 text-sm">scans</span>
                          </div>
                        </div>
                      ))}
                      {(!analytics.geography || analytics.geography.length === 0) && (
                        <p className="text-gray-500 text-center py-8">No location data yet</p>
                      )}
                    </div>
                  </div>

                  {/* Browser & OS */}
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Monitor className="w-5 h-5 text-amber-500" />
                      Browsers & OS
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-400 text-sm mb-2">Browsers</p>
                        <div className="space-y-2">
                          {(analytics.browsers || []).slice(0, 4).map((b, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-gray-300">{b.browser_name || 'Unknown'}</span>
                              <span className="text-amber-500 font-medium">{b.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm mb-2">Operating Systems</p>
                        <div className="space-y-2">
                          {(analytics.operating_systems || []).slice(0, 4).map((os, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-gray-300">{os.os_name || 'Unknown'}</span>
                              <span className="text-amber-500 font-medium">{os.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Scans */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Recent Scans
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-gray-400 text-sm border-b border-white/10">
                          <th className="pb-3 font-medium">Time</th>
                          <th className="pb-3 font-medium">Device</th>
                          <th className="pb-3 font-medium">Browser</th>
                          <th className="pb-3 font-medium">OS</th>
                          <th className="pb-3 font-medium">Location</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {(analytics.recent_scans || []).slice(0, 10).map((scan, idx) => (
                          <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-3 text-gray-300">
                              {formatDate(scan.scanned_at)} {formatTime(scan.scanned_at)}
                            </td>
                            <td className="py-3">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                scan.device_type === 'mobile' ? 'bg-blue-500/20 text-blue-400' :
                                scan.device_type === 'tablet' ? 'bg-purple-500/20 text-purple-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {scan.device_type || 'Unknown'}
                              </span>
                            </td>
                            <td className="py-3 text-gray-300">{scan.browser_name || 'Unknown'}</td>
                            <td className="py-3 text-gray-300">{scan.os_name || 'Unknown'}</td>
                            <td className="py-3 text-gray-300">
                              {scan.city && scan.country ? `${scan.city}, ${scan.country}` : 'Unknown'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(!analytics.recent_scans || analytics.recent_scans.length === 0) && (
                      <p className="text-gray-500 text-center py-8">No scan data yet</p>
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
              <h2 className="text-lg font-semibold">QR Code Management</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg text-black font-medium hover:from-amber-400 hover:to-amber-500 transition-all"
              >
                <Plus className="w-4 h-4" />
                Create New QR
              </button>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 text-sm bg-black/30">
                    <th className="px-6 py-4 font-medium">QR Code</th>
                    <th className="px-6 py-4 font-medium">Redirect URL</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Total Scans</th>
                    <th className="px-6 py-4 font-medium">Created</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {qrCodes.map((qr) => (
                    <tr key={qr.id} className="border-t border-white/5 hover:bg-white/5 transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                            <QrCode className="w-6 h-6 text-black" />
                          </div>
                          <div>
                            <p className="font-medium">{qr.label}</p>
                            <p className="text-gray-500 text-sm">/{qr.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-300 text-sm truncate max-w-xs">{qr.current_url}</span>
                          <button
                            onClick={() => copyToClipboard(qr.current_url)}
                            className="p-1 hover:bg-white/10 rounded"
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
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          }`}
                        >
                          {qr.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {qr.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-amber-500 font-semibold">{formatNumber(qr.total_scans || 0)}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {formatDate(qr.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEditingQR(qr); setShowEditModal(true); }}
                            className="p-2 hover:bg-white/10 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => downloadQR(qr, 'png')}
                            className="p-2 hover:bg-white/10 rounded-lg transition-all"
                            title="Download PNG"
                          >
                            <Download className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => { setSelectedQR(qr); setActiveTab('analytics'); }}
                            className="p-2 hover:bg-white/10 rounded-lg transition-all"
                            title="View Analytics"
                          >
                            <BarChart3 className="w-4 h-4 text-gray-400" />
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>
    </div>
  );
};

// Sub-components

const StatCard = ({ icon: Icon, label, value, subtext, color = 'amber', pulse = false }) => {
  const colors = {
    amber: 'from-amber-500/20 to-amber-600/20 border-amber-500/30 text-amber-500',
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-500',
    emerald: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 text-emerald-500',
    rose: 'from-rose-500/20 to-rose-600/20 border-rose-500/30 text-rose-500',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-500',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} backdrop-blur-xl border rounded-2xl p-5 relative overflow-hidden`}>
      {pulse && (
        <div className="absolute top-3 right-3 w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
      )}
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-xl bg-white/10`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-sm mt-1">{label}</p>
      <p className="text-gray-500 text-xs mt-0.5">{subtext}</p>
    </div>
  );
};

const QRCard = ({ qr, baseUrl, onSelect, onEdit, onToggle, onCopy, onDownload }) => {
  const qrUrl = `${baseUrl}/${qr.slug}`;

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-amber-500/30 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
            <QrCode className="w-7 h-7 text-black" />
          </div>
          <div>
            <h3 className="font-semibold">{qr.label}</h3>
            <p className="text-gray-500 text-sm">/{qr.slug}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          qr.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {qr.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="bg-black/30 rounded-xl p-3 mb-4">
        <p className="text-gray-400 text-xs mb-1">Redirect URL</p>
        <p className="text-sm text-gray-200 truncate">{qr.current_url}</p>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
        <span>{qr.total_scans || 0} scans</span>
        <span>{qr.active_users || 0} active now</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSelect}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500/20 transition-all text-sm font-medium"
        >
          <BarChart3 className="w-4 h-4" />
          Analytics
        </button>
        <button
          onClick={() => onCopy(qrUrl)}
          className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
          title="Copy URL"
        >
          <Copy className="w-4 h-4 text-gray-400" />
        </button>
        <button
          onClick={() => onDownload(qr, 'png')}
          className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
          title="Download"
        >
          <Download className="w-4 h-4 text-gray-400" />
        </button>
        <button
          onClick={onEdit}
          className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
          title="Edit"
        >
          <Edit3 className="w-4 h-4 text-gray-400" />
        </button>
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-all">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Label</label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              placeholder="e.g., XLAND INFRA Website"
              required
            />
          </div>

          {!qr && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Slug</label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">qr.xlandinfra.com/</span>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                  placeholder="main"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Redirect URL</label>
            <input
              type="url"
              value={formData.current_url}
              onChange={(e) => setFormData({ ...formData, current_url: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              placeholder="https://www.xlandinfra.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none"
              placeholder="Brief description of this QR code's purpose..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
            <select
              value={formData.qr_type}
              onChange={(e) => setFormData({ ...formData, qr_type: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="website" className="bg-gray-900">Website</option>
              <option value="admin" className="bg-gray-900">Admin Portal</option>
              <option value="campaign" className="bg-gray-900">Campaign</option>
              <option value="event" className="bg-gray-900">Event</option>
              <option value="custom" className="bg-gray-900">Custom</option>
            </select>
          </div>

          {qr && formData.current_url !== qr.current_url && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Reason for URL Change</label>
              <input
                type="text"
                value={formData.change_reason}
                onChange={(e) => setFormData({ ...formData, change_reason: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                placeholder="e.g., Updated landing page"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-medium hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl text-black font-medium hover:from-amber-400 hover:to-amber-500 transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : (qr ? 'Update QR' : 'Create QR')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SimpleTrendChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        No data available
      </div>
    );
  }

  const maxScans = Math.max(...data.map(d => d.scans || 0), 1);
  const barWidth = 100 / data.length;

  return (
    <div className="h-full flex items-end gap-1">
      {data.map((item, idx) => (
        <div
          key={idx}
          className="flex-1 flex flex-col items-center gap-1"
        >
          <div
            className="w-full bg-gradient-to-t from-amber-500 to-amber-400 rounded-t-lg transition-all hover:from-amber-400 hover:to-amber-300"
            style={{ height: `${Math.max((item.scans / maxScans) * 100, 5)}%` }}
            title={`${item.scans} scans`}
          ></div>
          <span className="text-[10px] text-gray-500 truncate w-full text-center">
            {new Date(item.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      ))}
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
    unknown: 'bg-gray-500'
  };

  return (
    <div className="space-y-4">
      {devices.map((device, idx) => {
        const Icon = deviceIcons[device.device_type] || Monitor;
        const percentage = ((device.count / total) * 100).toFixed(1);
        
        return (
          <div key={idx} className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${deviceColors[device.device_type]}/20`}>
              <Icon className={`w-5 h-5 ${deviceColors[device.device_type]?.replace('bg-', 'text-')}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium capitalize">{device.device_type || 'Unknown'}</span>
                <span className="text-sm text-gray-400">{percentage}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full ${deviceColors[device.device_type]} rounded-full transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
            <span className="text-amber-500 font-semibold min-w-[3rem] text-right">{device.count}</span>
          </div>
        );
      })}
      {devices.length === 0 && (
        <p className="text-gray-500 text-center py-8">No device data yet</p>
      )}
    </div>
  );
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
