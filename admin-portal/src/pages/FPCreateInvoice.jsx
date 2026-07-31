import { useState, useEffect } from 'react';
import {
  FileText,
  Save,
  X,
  Plus,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ArrowLeft,
  Building2,
  User,
  Calendar,
  IndianRupee,
  ClipboardList,
  ArrowRight,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

const INVOICE_TYPES = {
  general: {
    id: 'general',
    title: 'General Invoice',
    description: 'For custom services & requirements',
    icon: FileText,
    color: 'bg-blue-100 text-blue-700 border-blue-200'
  },
  work_order: {
    id: 'work_order',
    title: 'Work Order Invoice',
    description: 'Link to completed work order',
    icon: ClipboardList,
    color: 'bg-purple-100 text-purple-700 border-purple-200'
  }
};

const FPCreateInvoice = ({ user }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedWorkOrderId = searchParams.get('workOrderId');
  
  // Step management
  const [step, setStep] = useState(preselectedWorkOrderId ? 2 : 1);
  const [invoiceType, setInvoiceType] = useState(preselectedWorkOrderId ? 'work_order' : null);
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [properties, setProperties] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPropertySearch, setShowPropertySearch] = useState(false);
  const [showWorkOrderSearch, setShowWorkOrderSearch] = useState(false);
  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    discountPercentage: 0,
    taxPercentage: 18,
    notes: '',
    termsAndConditions: 'Payment is due within 15 days of invoice date.\nLate payments may incur additional charges.'
  });

  const [lineItems, setLineItems] = useState([
    { description: '', quantity: 1, rate: 0 }
  ]);

  const token = getAuthToken();

  // Fetch properties
  const fetchProperties = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/fp/properties`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setProperties(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching properties:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch completed work orders
  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/fp/work-orders?status=Completed`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        // Filter work orders that don't have invoices yet (optional)
        setWorkOrders(result.data || []);
        
        // If preselected work order, find and select it
        if (preselectedWorkOrderId) {
          const preselected = result.data?.find(wo => wo.id === parseInt(preselectedWorkOrderId));
          if (preselected) {
            handleSelectWorkOrder(preselected);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching work orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 2) {
      if (invoiceType === 'general') {
        fetchProperties();
      } else if (invoiceType === 'work_order') {
        fetchWorkOrders();
      }
    }
  }, [step, invoiceType]);

  const handleSelectInvoiceType = (type) => {
    setInvoiceType(type);
  };

  const handleContinue = () => {
    if (invoiceType) {
      setStep(2);
    }
  };

  const handleSelectProperty = (property) => {
    setSelectedProperty(property);
    setFormData(prev => ({
      ...prev,
      customerName: property.customer_name || property.client_name || property.contact_person || '',
      customerEmail: property.customer_email || property.email || '',
      customerPhone: property.customer_phone || property.phone || property.contact_number || ''
    }));
    setShowPropertySearch(false);
  };

  const handleSelectWorkOrder = (workOrder) => {
    setSelectedWorkOrder(workOrder);
    setFormData(prev => ({
      ...prev,
      customerName: workOrder.customer_name || workOrder.property_name || '',
      customerEmail: workOrder.customer_email || '',
      customerPhone: workOrder.customer_phone || workOrder.contact_number || ''
    }));
    
    // Auto-populate line items from work order
    const woLineItems = [];
    if (workOrder.services && Array.isArray(workOrder.services)) {
      workOrder.services.forEach(service => {
        woLineItems.push({
          description: service.name || service.service_name || 'Service',
          quantity: service.quantity || 1,
          rate: service.rate || service.amount || 0
        });
      });
    }
    
    if (woLineItems.length === 0) {
      woLineItems.push({
        description: `Work Order: ${workOrder.wo_id || workOrder.id} - ${workOrder.category || 'Services'}`,
        quantity: 1,
        rate: workOrder.total_amount || workOrder.amount || 0
      });
    }
    
    setLineItems(woLineItems);
    setShowWorkOrderSearch(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLineItemChange = (index, field, value) => {
    setLineItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, { description: '', quantity: 1, rate: 0 }]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const discountAmount = subtotal * (parseFloat(formData.discountPercentage) || 0) / 100;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (parseFloat(formData.taxPercentage) || 0) / 100;
  const totalAmount = taxableAmount + taxAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customerName) {
      showToast('Customer name is required', 'error');
      return;
    }

    if (!formData.invoiceDate || !formData.dueDate) {
      showToast('Invoice date and due date are required', 'error');
      return;
    }

    const validLineItems = lineItems.filter(item => item.description && item.rate > 0);
    if (validLineItems.length === 0) {
      showToast('At least one line item is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const submitData = {
        invoiceType,
        propertyId: selectedProperty?.id,
        workOrderId: selectedWorkOrder?.id,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
        invoiceDate: formData.invoiceDate,
        dueDate: formData.dueDate,
        lineItems: validLineItems.map(item => ({
          description: item.description,
          quantity: parseFloat(item.quantity) || 1,
          rate: parseFloat(item.rate) || 0,
          amount: (parseFloat(item.quantity) || 1) * (parseFloat(item.rate) || 0)
        })),
        subtotal,
        discountPercentage: parseFloat(formData.discountPercentage) || 0,
        taxPercentage: parseFloat(formData.taxPercentage) || 18,
        notes: formData.notes,
        termsAndConditions: formData.termsAndConditions
      };

      const response = await fetch(`${API_BASE}/api/payments/invoices`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });

      const result = await response.json();

      if (result.success) {
        showToast('Invoice created successfully!');
        setTimeout(() => {
          navigate('/fp/payments/invoices');
        }, 1500);
      } else {
        showToast(result.message || 'Failed to create invoice', 'error');
      }
    } catch (err) {
      console.error('Error creating invoice:', err);
      showToast('Failed to create invoice', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const filteredProperties = properties.filter(prop => {
    const q = searchTerm.toLowerCase();
    return (
      prop.name?.toLowerCase().includes(q) ||
      prop.property_id?.toLowerCase().includes(q) ||
      prop.customer_name?.toLowerCase().includes(q) ||
      prop.client_name?.toLowerCase().includes(q)
    );
  });

  const filteredWorkOrders = workOrders.filter(wo => {
    const q = searchTerm.toLowerCase();
    return (
      wo.wo_id?.toLowerCase().includes(q) ||
      wo.property_name?.toLowerCase().includes(q) ||
      wo.customer_name?.toLowerCase().includes(q) ||
      wo.category?.toLowerCase().includes(q)
    );
  });

  const canEdit = ['admin', 'operations_manager', 'franchise_partner', 'manager'].includes(user?.role);

  if (!canEdit) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
        <p className="text-yellow-700">You do not have permission to create invoices.</p>
        <button
          onClick={() => navigate('/fp/payments/invoices')}
          className="mt-4 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => step === 1 ? navigate('/fp/payments/invoices') : setStep(1)}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Invoice</h1>
          <p className="text-gray-500 mt-1">
            {step === 1 ? 'Select invoice type' : `Creating ${INVOICE_TYPES[invoiceType]?.title}`}
          </p>
        </div>
      </div>

      {/* Step 1: Select Invoice Type */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Select Invoice Type</h2>
          <p className="text-gray-500 mb-6">Choose the type of invoice you want to create</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {Object.values(INVOICE_TYPES).map(type => {
              const Icon = type.icon;
              const isSelected = invoiceType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => handleSelectInvoiceType(type.id)}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isSelected ? 'bg-amber-100' : 'bg-gray-100'
                    }`}>
                      <Icon className={`w-6 h-6 ${isSelected ? 'text-amber-600' : 'text-gray-500'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold ${isSelected ? 'text-amber-900' : 'text-gray-900'}`}>
                          {type.title}
                        </h3>
                        {isSelected && (
                          <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${isSelected ? 'text-amber-700' : 'text-gray-500'}`}>
                        {type.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-4">
            <button
              onClick={() => navigate('/fp/payments/invoices')}
              className="px-6 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleContinue}
              disabled={!invoiceType}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Invoice Form */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Work Order Selection (for Work Order Invoice) */}
          {invoiceType === 'work_order' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-purple-600" />
                Select Work Order
              </h3>

              {selectedWorkOrder ? (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{selectedWorkOrder.wo_id}</p>
                      <p className="text-sm text-gray-600">{selectedWorkOrder.property_name}</p>
                      <p className="text-sm text-gray-500">{selectedWorkOrder.category}</p>
                      <p className="text-sm font-medium text-purple-600 mt-1">
                        Amount: {formatCurrency(selectedWorkOrder.total_amount || selectedWorkOrder.amount)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWorkOrder(null);
                        setLineItems([{ description: '', quantity: 1, rate: 0 }]);
                      }}
                      className="p-1 hover:bg-purple-100 rounded-lg"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div
                    onClick={() => setShowWorkOrderSearch(true)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl cursor-pointer hover:border-purple-300 transition-colors flex items-center gap-2"
                  >
                    <Search className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-400">Search completed work orders...</span>
                  </div>

                  {showWorkOrderSearch && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-80 overflow-hidden">
                      <div className="p-3 border-b border-gray-100">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search by WO ID, property, category..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {loading ? (
                          <div className="p-4 text-center text-gray-500">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                            Loading work orders...
                          </div>
                        ) : filteredWorkOrders.length > 0 ? (
                          filteredWorkOrders.slice(0, 20).map(wo => (
                            <div
                              key={wo.id}
                              onClick={() => handleSelectWorkOrder(wo)}
                              className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-900">{wo.wo_id}</p>
                                  <p className="text-sm text-gray-500">{wo.property_name} - {wo.category}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-medium text-green-600">{formatCurrency(wo.total_amount || wo.amount)}</p>
                                  <p className="text-xs text-gray-400">{formatDate(wo.completed_at || wo.updated_at)}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            No completed work orders found
                          </div>
                        )}
                      </div>
                      <div className="p-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setShowWorkOrderSearch(false)}
                          className="w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Property Selection (for General Invoice) */}
          {invoiceType === 'general' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-600" />
                Property (Optional)
              </h3>

              {selectedProperty ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{selectedProperty.name}</p>
                      <p className="text-sm text-gray-600">{selectedProperty.property_id}</p>
                      {selectedProperty.address && (
                        <p className="text-sm text-gray-500 mt-1">{selectedProperty.address}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProperty(null)}
                      className="p-1 hover:bg-amber-100 rounded-lg"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div
                    onClick={() => setShowPropertySearch(true)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl cursor-pointer hover:border-amber-300 transition-colors flex items-center gap-2"
                  >
                    <Search className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-400">Search and select a property (optional)...</span>
                  </div>

                  {showPropertySearch && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-80 overflow-hidden">
                      <div className="p-3 border-b border-gray-100">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search properties..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {loading ? (
                          <div className="p-4 text-center text-gray-500">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                            Loading properties...
                          </div>
                        ) : filteredProperties.length > 0 ? (
                          filteredProperties.slice(0, 20).map(property => (
                            <div
                              key={property.id}
                              onClick={() => handleSelectProperty(property)}
                              className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                            >
                              <p className="font-medium text-gray-900">{property.name}</p>
                              <p className="text-sm text-gray-500">{property.property_id}</p>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            No properties found
                          </div>
                        )}
                      </div>
                      <div className="p-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setShowPropertySearch(false)}
                          className="w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Customer Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-amber-600" />
              Customer Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  placeholder="Enter customer name"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="customerEmail"
                  value={formData.customerEmail}
                  onChange={handleInputChange}
                  placeholder="customer@example.com"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="customerPhone"
                  value={formData.customerPhone}
                  onChange={handleInputChange}
                  placeholder="+91 XXXXXXXXXX"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-600" />
              Invoice Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="invoiceDate"
                  value={formData.invoiceDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleInputChange}
                  min={formData.invoiceDate}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                  required
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                Line Items
              </h3>
              <button
                type="button"
                onClick={addLineItem}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="space-y-3">
              {/* Header */}
              <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-gray-500 uppercase px-2">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Rate</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>

              {/* Items */}
              {lineItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-6">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                      placeholder="Item description"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                      min="1"
                      step="1"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) => handleLineItemChange(index, 'rate', e.target.value)}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 text-right"
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <span className="font-medium text-gray-900">
                      {formatCurrency(item.quantity * item.rate)}
                    </span>
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="p-1 hover:bg-red-100 rounded-lg text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="max-w-xs ml-auto space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-600">Discount</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name="discountPercentage"
                      value={formData.discountPercentage}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-right text-sm"
                    />
                    <span className="text-gray-500">%</span>
                    <span className="font-medium text-red-600">-{formatCurrency(discountAmount)}</span>
                  </div>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-600">GST</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name="taxPercentage"
                      value={formData.taxPercentage}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-right text-sm"
                    />
                    <span className="text-gray-500">%</span>
                    <span className="font-medium text-gray-900">{formatCurrency(taxAmount)}</span>
                  </div>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-xl text-gray-900">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Add any notes for the customer..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Terms & Conditions
                </label>
                <textarea
                  name="termsAndConditions"
                  value={formData.termsAndConditions}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-6 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting || (invoiceType === 'work_order' && !selectedWorkOrder)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Creating Invoice...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Create Invoice
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default FPCreateInvoice;
