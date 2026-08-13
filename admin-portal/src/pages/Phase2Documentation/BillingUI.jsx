import React from 'react';
import { FileText, CreditCard, Link2, History, LayoutDashboard, Plus, FileCheck } from 'lucide-react';

const SectionTitle = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
      <Icon className="w-5 h-5 text-blue-600" />
    </div>
    <h2 className="text-xl font-bold text-gray-900">{title}</h2>
  </div>
);

const StatusBadge = ({ status, color }) => (
  <span className={`px-3 py-1 rounded-full text-xs font-medium ${color}`}>
    {status}
  </span>
);

const BillingUI = () => {
  return (
    <div className="space-y-10">
      {/* Module Overview */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={CreditCard} title="Billing & Payments Overview" />
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mt-4">
          <h3 className="font-semibold text-gray-900 mb-3">Sidebar Navigation Structure</h3>
          <div className="font-mono text-sm bg-white rounded-lg p-4 border">
            <pre className="text-gray-700">
{`Billing & Payments
│
├── Generated Invoices
├── Invoices – All invoices listed here
├── Payments – View all payments
├── Payment Link – Auto-send payment links
├── Payment History – Transaction records
└── Dashboard – Payments Overview Widget
│
├── Create Invoice (For Other Requirements)
│
└── Work Order Invoice (WO Submissions Only)`}
            </pre>
          </div>
        </div>
      </section>

      {/* Generate Invoice Screen */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={FileText} title="Generate Invoice Screen" />
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Invoice Form Fields</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Property Selection</span>
                <span className="text-gray-400">Dropdown</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Customer Details</span>
                <span className="text-gray-400">Auto-filled</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Invoice Date</span>
                <span className="text-gray-400">Date Picker</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Due Date</span>
                <span className="text-gray-400">Date Picker</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Line Items</span>
                <span className="text-gray-400">Dynamic Table</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-400">Auto-calc</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Discount (%)</span>
                <span className="text-gray-400">Input</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">GST (18%)</span>
                <span className="text-gray-400">Auto-calc</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600 font-semibold">Total Amount</span>
                <span className="text-gray-400">Auto-calc</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">UI Mockup</h4>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="bg-white rounded-lg shadow p-4 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <span className="font-bold text-lg">Generate Invoice</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">New</span>
                </div>
                <div className="space-y-2">
                  <div className="h-8 bg-gray-100 rounded flex items-center px-3 text-xs text-gray-500">
                    Select Property...
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-8 bg-gray-100 rounded flex items-center px-3 text-xs text-gray-500">
                      Invoice Date
                    </div>
                    <div className="h-8 bg-gray-100 rounded flex items-center px-3 text-xs text-gray-500">
                      Due Date
                    </div>
                  </div>
                </div>
                <div className="border rounded">
                  <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 grid grid-cols-4 gap-2">
                    <span>Item</span>
                    <span>Qty</span>
                    <span>Rate</span>
                    <span>Amount</span>
                  </div>
                  <div className="px-3 py-2 text-xs text-gray-400 grid grid-cols-4 gap-2 border-t">
                    <span>Add line item...</span>
                    <span>-</span>
                    <span>-</span>
                    <span>₹0.00</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="text-right space-y-1">
                    <p className="text-xs text-gray-500">Subtotal: ₹0.00</p>
                    <p className="text-xs text-gray-500">GST (18%): ₹0.00</p>
                    <p className="text-sm font-bold">Total: ₹0.00</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2 border-t">
                  <button className="px-3 py-1.5 text-xs border rounded text-gray-600">Cancel</button>
                  <button className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded">Generate</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Invoices List */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={FileCheck} title="Invoices List Screen" />
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Table Columns</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Invoice ID</span><span className="text-gray-400">Link</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Property</span><span className="text-gray-400">Text</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Customer</span><span className="text-gray-400">Text</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Invoice Date</span><span className="text-gray-400">Date</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Due Date</span><span className="text-gray-400">Date</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Amount</span><span className="text-gray-400">Currency</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Status</span><span className="text-gray-400">Badge</span></div>
              <div className="flex justify-between py-2"><span className="text-gray-600">Actions</span><span className="text-gray-400">Buttons</span></div>
            </div>
            <div className="mt-4">
              <h4 className="font-semibold text-gray-800 mb-3">Status Badges</h4>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status="Draft" color="bg-gray-100 text-gray-700" />
                <StatusBadge status="Sent" color="bg-blue-100 text-blue-700" />
                <StatusBadge status="Paid" color="bg-green-100 text-green-700" />
                <StatusBadge status="Partially Paid" color="bg-yellow-100 text-yellow-700" />
                <StatusBadge status="Overdue" color="bg-red-100 text-red-700" />
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">UI Mockup</h4>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="bg-white rounded-lg shadow p-4 space-y-3">
                <div className="flex justify-between items-center border-b pb-3">
                  <span className="font-bold text-lg">Invoices</span>
                  <div className="flex gap-2">
                    <div className="h-7 w-32 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">🔍 Search...</div>
                    <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded">+ New Invoice</button>
                  </div>
                </div>
                <div className="border rounded text-xs">
                  <div className="bg-gray-50 px-2 py-2 grid grid-cols-7 gap-1 font-semibold text-gray-600 border-b">
                    <span>ID</span><span>Property</span><span>Customer</span><span>Date</span><span>Amount</span><span>Status</span><span>Action</span>
                  </div>
                  <div className="px-2 py-2 grid grid-cols-7 gap-1 text-gray-700 border-b">
                    <span className="text-blue-600">INV-001</span><span>Palm Grove</span><span>John D.</span><span>Jul 10</span><span>₹50,000</span>
                    <span className="bg-green-100 text-green-700 px-1 rounded text-center">Paid</span>
                    <span className="text-blue-500">View</span>
                  </div>
                  <div className="px-2 py-2 grid grid-cols-7 gap-1 text-gray-700 border-b">
                    <span className="text-blue-600">INV-002</span><span>Sky Tower</span><span>Sarah M.</span><span>Jul 8</span><span>₹75,000</span>
                    <span className="bg-yellow-100 text-yellow-700 px-1 rounded text-center">Partial</span>
                    <span className="text-blue-500">View</span>
                  </div>
                  <div className="px-2 py-2 grid grid-cols-7 gap-1 text-gray-700">
                    <span className="text-blue-600">INV-003</span><span>Green Park</span><span>Mike R.</span><span>Jul 5</span><span>₹25,000</span>
                    <span className="bg-red-100 text-red-700 px-1 rounded text-center">Overdue</span>
                    <span className="text-blue-500">View</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500 pt-2">
                  <span>Showing 1-3 of 45 invoices</span>
                  <div className="flex gap-1">
                    <button className="px-2 py-1 border rounded">←</button>
                    <button className="px-2 py-1 border rounded bg-blue-600 text-white">1</button>
                    <button className="px-2 py-1 border rounded">2</button>
                    <button className="px-2 py-1 border rounded">→</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Payments Screen */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={CreditCard} title="Payments Screen" />
        <p className="text-gray-600 mb-4">Main payment management screen showing all invoices and their payment status.</p>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Table Columns</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Property ID</span><span className="text-gray-400">Associated property</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Invoice ID</span><span className="text-gray-400">Linked invoice</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Total Amount</span><span className="text-gray-400">Full amount</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Paid Amount</span><span className="text-gray-400">Received so far</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Balance Due</span><span className="text-gray-400">Auto-calculated</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Payment Method</span><span className="text-gray-400">Cash/Bank/UPI</span></div>
              <div className="flex justify-between py-2"><span className="text-gray-600">Status</span><span className="text-gray-400">Badge</span></div>
            </div>
            <div className="mt-4 bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">Record Payment Action</h4>
              <p className="text-sm text-blue-700">FP or Manager can record: <strong>Cash</strong>, <strong>Bank Transfer</strong>, <strong>UPI</strong></p>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">UI Mockup</h4>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="bg-white rounded-lg shadow p-4 space-y-3">
                <div className="flex justify-between items-center border-b pb-3">
                  <span className="font-bold text-lg">Payments</span>
                  <button className="px-3 py-1 text-xs bg-green-600 text-white rounded">+ Record Payment</button>
                </div>
                <div className="border rounded text-xs">
                  <div className="bg-gray-50 px-2 py-2 grid grid-cols-6 gap-1 font-semibold text-gray-600 border-b">
                    <span>Property</span><span>Invoice</span><span>Total</span><span>Paid</span><span>Balance</span><span>Status</span>
                  </div>
                  <div className="px-2 py-2 grid grid-cols-6 gap-1 text-gray-700 border-b">
                    <span>Palm Grove</span><span className="text-blue-600">INV-001</span><span>₹50,000</span><span className="text-green-600">₹50,000</span><span>₹0</span>
                    <span className="bg-green-100 text-green-700 px-1 rounded text-center">Paid</span>
                  </div>
                  <div className="px-2 py-2 grid grid-cols-6 gap-1 text-gray-700 border-b">
                    <span>Sky Tower</span><span className="text-blue-600">INV-002</span><span>₹75,000</span><span className="text-green-600">₹40,000</span><span className="text-red-600">₹35,000</span>
                    <span className="bg-yellow-100 text-yellow-700 px-1 rounded text-center">Partial</span>
                  </div>
                  <div className="px-2 py-2 grid grid-cols-6 gap-1 text-gray-700">
                    <span>Green Park</span><span className="text-blue-600">INV-003</span><span>₹25,000</span><span className="text-green-600">₹0</span><span className="text-red-600">₹25,000</span>
                    <span className="bg-red-100 text-red-700 px-1 rounded text-center">Pending</span>
                  </div>
                </div>
                {/* Record Payment Modal Preview */}
                <div className="border-t pt-3 mt-2">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Record Payment Modal:</p>
                  <div className="bg-gray-100 rounded p-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-6 bg-white rounded flex items-center px-2 text-xs text-gray-400">Amount: ₹</div>
                      <select className="h-6 bg-white rounded px-2 text-xs text-gray-500 border-0">
                        <option>Cash</option>
                        <option>Bank Transfer</option>
                        <option>UPI</option>
                      </select>
                    </div>
                    <div className="h-6 bg-white rounded flex items-center px-2 text-xs text-gray-400">Reference Number</div>
                    <button className="w-full px-2 py-1 text-xs bg-green-600 text-white rounded">Save Payment</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Links - Complete Workflow */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={Link2} title="Payment Links - Complete Workflow" />
        
        {/* Flow Section */}
        <div className="mb-8">
          <h4 className="font-semibold text-gray-800 mb-4">End-to-End Payment Link Flow</h4>
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-green-50 rounded-xl p-6 border border-blue-100">
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold shadow-lg">1</div>
                <p className="text-xs text-gray-700 mt-2 text-center font-medium">Invoice Created</p>
                <p className="text-[10px] text-gray-500 text-center">INV-001</p>
              </div>
              <div className="flex-1 h-1 bg-gradient-to-r from-blue-400 to-blue-300 mx-2 rounded"></div>
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold shadow-lg">2</div>
                <p className="text-xs text-gray-700 mt-2 text-center font-medium">Generate Link</p>
                <p className="text-[10px] text-gray-500 text-center">Click Button</p>
              </div>
              <div className="flex-1 h-1 bg-gradient-to-r from-blue-300 to-amber-300 mx-2 rounded"></div>
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-amber-500 text-white rounded-full flex items-center justify-center text-xl font-bold shadow-lg">3</div>
                <p className="text-xs text-gray-700 mt-2 text-center font-medium">Send to Customer</p>
                <p className="text-[10px] text-gray-500 text-center">Email/SMS</p>
              </div>
              <div className="flex-1 h-1 bg-gradient-to-r from-amber-300 to-indigo-300 mx-2 rounded"></div>
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xl font-bold shadow-lg">4</div>
                <p className="text-xs text-gray-700 mt-2 text-center font-medium">Customer Opens</p>
                <p className="text-[10px] text-gray-500 text-center">rzp.io/link</p>
              </div>
              <div className="flex-1 h-1 bg-gradient-to-r from-indigo-300 to-green-400 mx-2 rounded"></div>
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-green-600 text-white rounded-full flex items-center justify-center text-xl font-bold shadow-lg">✓</div>
                <p className="text-xs text-gray-700 mt-2 text-center font-medium">Payment Done</p>
                <p className="text-[10px] text-gray-500 text-center">Auto-Updated</p>
              </div>
            </div>
          </div>
        </div>

        {/* SCREEN 1: Payment Links List Page */}
        <div className="mb-8">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
            Payment Links List Page
          </h4>
          <div className="border-2 border-blue-200 rounded-xl overflow-hidden shadow-sm">
            {/* Browser Chrome */}
            <div className="bg-gray-100 px-4 py-2 flex items-center gap-2 border-b">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="flex-1 bg-white rounded px-3 py-1 text-xs text-gray-500 ml-4">
                admin.xlandinfra.com/billing/payment-links
              </div>
            </div>
            {/* Page Content */}
            <div className="bg-gray-50 p-4">
              <div className="bg-white rounded-lg shadow-sm border p-4">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Payment Links</h2>
                    <p className="text-xs text-gray-500">Track and manage online payment links for invoices</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-2 text-xs bg-blue-600 text-white rounded-lg flex items-center gap-1.5 font-medium">
                      <span>+</span> Generate Payment Link
                    </button>
                    <button className="px-3 py-2 text-xs border border-gray-200 rounded-lg flex items-center gap-1.5">
                      ↻ Refresh
                    </button>
                    <button className="px-3 py-2 text-xs border border-gray-200 rounded-lg flex items-center gap-1.5">
                      ↓ Export
                    </button>
                  </div>
                </div>
                
                {/* Stats Cards */}
                <div className="grid grid-cols-5 gap-3 mb-4">
                  <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium">Total Links</p>
                        <p className="text-xl font-bold text-gray-900">12</p>
                      </div>
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                        <span className="text-blue-600">🔗</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium">Created</p>
                        <p className="text-xl font-bold text-gray-900">3</p>
                      </div>
                      <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                        <span className="text-gray-600">⏱</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium">Sent</p>
                        <p className="text-xl font-bold text-amber-600">4</p>
                      </div>
                      <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                        <span className="text-amber-600">✉</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium">Paid</p>
                        <p className="text-xl font-bold text-green-600">3</p>
                      </div>
                      <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                        <span className="text-green-600">✓</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium">Expired</p>
                        <p className="text-xl font-bold text-red-600">2</p>
                      </div>
                      <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                        <span className="text-red-600">✕</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs & Search */}
                <div className="flex items-center justify-between mb-3 pb-3 border-b">
                  <div className="flex gap-1">
                    <button className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg font-medium">All Links <span className="bg-blue-100 px-1.5 rounded ml-1">12</span></button>
                    <button className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-lg">Created <span className="bg-gray-100 px-1.5 rounded ml-1">3</span></button>
                    <button className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-lg">Sent <span className="bg-gray-100 px-1.5 rounded ml-1">4</span></button>
                    <button className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-lg">Paid <span className="bg-gray-100 px-1.5 rounded ml-1">3</span></button>
                    <button className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-lg">Expired <span className="bg-gray-100 px-1.5 rounded ml-1">2</span></button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                    <input type="text" placeholder="Search by invoice or customer..." className="pl-8 pr-4 py-1.5 border border-gray-200 rounded-lg text-xs w-56" />
                  </div>
                </div>

                {/* Table */}
                <div className="border rounded-lg overflow-hidden text-xs">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase text-[10px]">Invoice</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase text-[10px]">Customer</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase text-[10px]">Amount</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase text-[10px]">Status</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase text-[10px]">Created</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase text-[10px]">Expires</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase text-[10px]">Payment Link</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-500 uppercase text-[10px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      <tr className="hover:bg-gray-50">
                        <td className="px-3 py-2.5">
                          <span className="text-blue-600 font-medium">INV-001</span>
                          <br/><span className="text-[10px] text-gray-400">EST-PG-001</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-gray-900">John Doe</span>
                          <br/><span className="text-[10px] text-gray-500">john@email.com</span>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-gray-900">₹50,000</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-medium">
                            ✓ Paid
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">10/08/2026</td>
                        <td className="px-3 py-2.5 text-gray-600">17/08/2026</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <input type="text" value="rzp.io/i/abc123" readOnly className="w-20 px-1.5 py-0.5 bg-gray-50 border rounded text-[10px]" />
                            <button className="p-1 text-gray-400 hover:text-blue-600">📋</button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-gray-400">-</span>
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="px-3 py-2.5">
                          <span className="text-blue-600 font-medium">INV-002</span>
                          <br/><span className="text-[10px] text-gray-400">EST-ST-002</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-gray-900">Sarah Miller</span>
                          <br/><span className="text-[10px] text-gray-500">sarah@email.com</span>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-gray-900">₹75,000</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-medium">
                            ✉ Sent
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">08/08/2026</td>
                        <td className="px-3 py-2.5 text-gray-600">15/08/2026</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <input type="text" value="rzp.io/i/def456" readOnly className="w-20 px-1.5 py-0.5 bg-gray-50 border rounded text-[10px]" />
                            <button className="p-1 text-blue-600">📋</button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button className="p-1 text-gray-400 hover:text-blue-600" title="Open Link">↗</button>
                            <button className="p-1 text-gray-400 hover:text-green-600" title="Send Email">✉</button>
                            <button className="p-1 text-gray-400 hover:text-gray-600" title="View">👁</button>
                          </div>
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50">
                        <td className="px-3 py-2.5">
                          <span className="text-blue-600 font-medium">INV-003</span>
                          <br/><span className="text-[10px] text-gray-400">EST-GP-003</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-gray-900">Mike Roberts</span>
                          <br/><span className="text-[10px] text-gray-500">mike@email.com</span>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-gray-900">₹25,000</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-medium">
                            ⏱ Expired
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">20/07/2026</td>
                        <td className="px-3 py-2.5 text-red-500">27/07/2026</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <input type="text" value="rzp.io/i/ghi789" readOnly className="w-20 px-1.5 py-0.5 bg-gray-50 border rounded text-[10px]" />
                            <button className="p-1 text-gray-400">📋</button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button className="p-1 text-blue-600" title="Regenerate">🔄</button>
                            <button className="p-1 text-gray-400 hover:text-gray-600" title="View">👁</button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-gray-500">
                  <span>Showing 1 to 3 of 12 links</span>
                  <div className="flex gap-1">
                    <button className="px-2 py-1 border rounded">←</button>
                    <button className="px-2 py-1 border rounded bg-blue-600 text-white">1</button>
                    <button className="px-2 py-1 border rounded">2</button>
                    <button className="px-2 py-1 border rounded">→</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SCREEN 2: Generate Payment Link Modal */}
        <div className="mb-8">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
            Generate Payment Link Modal
          </h4>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Step 1: Search Invoice */}
            <div className="border-2 border-blue-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-white">🔗</span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Generate Payment Link</h3>
                    <p className="text-[10px] text-blue-100">Create a payment link for an invoice</p>
                  </div>
                </div>
                <button className="text-white/80 hover:text-white">✕</button>
              </div>
              <div className="bg-white p-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">Search Invoice</label>
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input type="text" placeholder="Enter Invoice ID (e.g., INV-001)" className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <button className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">Search</button>
                </div>
                <p className="text-xs text-gray-500 text-center">Enter the invoice ID and click search to find the invoice</p>
              </div>
            </div>

            {/* Step 2: Invoice Found */}
            <div className="border-2 border-blue-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-white">🔗</span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Generate Payment Link</h3>
                    <p className="text-[10px] text-blue-100">Invoice Found - Review Details</p>
                  </div>
                </div>
                <button className="text-white/80 hover:text-white">✕</button>
              </div>
              <div className="bg-white p-4 space-y-4">
                {/* Invoice Details Card */}
                <div className="bg-gray-50 rounded-lg p-3 border">
                  <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">📄 Invoice Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-gray-500">Invoice ID</p>
                      <p className="text-sm font-bold text-blue-600">INV-001</p>
                      <p className="text-[10px] text-gray-500 mt-2">Invoice Date</p>
                      <p className="text-xs font-medium">10/08/2026</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Total Amount</p>
                      <p className="text-lg font-bold text-green-600">₹50,000</p>
                      <p className="text-[10px] text-gray-500 mt-1">Balance Due</p>
                      <p className="text-sm font-semibold text-orange-600">₹50,000</p>
                    </div>
                  </div>
                </div>
                {/* Customer & Property */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <h4 className="text-[10px] font-semibold text-blue-800 uppercase mb-1">👤 Customer</h4>
                    <p className="text-xs font-medium text-gray-900">John Doe</p>
                    <p className="text-[10px] text-gray-600">john@email.com</p>
                    <p className="text-[10px] text-gray-600">+91 98765 43210</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                    <h4 className="text-[10px] font-semibold text-green-800 uppercase mb-1">🏢 Property</h4>
                    <p className="text-xs font-medium text-gray-900">Palm Grove Apartments</p>
                    <p className="text-[10px] text-gray-600">ID: PG-001</p>
                    <p className="text-[10px] text-gray-600">Est: EST-PG-001</p>
                  </div>
                </div>
                {/* Generate Button */}
                <button className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
                  Generate Payment Link
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SCREEN 3: Link Generated Success */}
        <div className="mb-8">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
            Payment Link Generated Successfully
          </h4>
          <div className="max-w-md mx-auto border-2 border-green-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-white">🔗</span>
                <h3 className="text-sm font-semibold text-white">Payment Link Generated</h3>
              </div>
              <button className="text-white/80 hover:text-white">✕</button>
            </div>
            <div className="bg-white p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl text-green-600">✓</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Payment Link Generated!</h3>
              <p className="text-sm text-gray-500 mt-1">The payment link has been created successfully</p>
              
              <div className="mt-6 bg-gray-50 rounded-lg p-4 border">
                <label className="block text-xs font-medium text-gray-700 mb-2 text-left">Payment Link</label>
                <div className="flex items-center gap-2">
                  <input type="text" value="https://rzp.io/i/abc123xyz" readOnly className="flex-1 px-3 py-2 bg-white border rounded-lg text-sm" />
                  <button className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">📋 Copy</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="text-left">
                  <p className="text-[10px] text-gray-500">Amount</p>
                  <p className="text-sm font-bold text-gray-900">₹50,000</p>
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-gray-500">Expires On</p>
                  <p className="text-sm font-medium text-gray-900">17/08/2026</p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold">
                  ✉ Send to Customer
                </button>
                <button className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SCREEN 4: Customer Payment Page */}
        <div className="mb-8">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">4</span>
            Customer Payment Page (Razorpay Hosted)
          </h4>
          <div className="max-w-sm mx-auto">
            {/* Mobile Phone Frame */}
            <div className="border-8 border-gray-800 rounded-3xl overflow-hidden shadow-2xl bg-white">
              {/* Phone Status Bar */}
              <div className="bg-gray-800 px-4 py-1 flex justify-between items-center">
                <span className="text-white text-[10px]">9:41</span>
                <div className="flex items-center gap-1">
                  <span className="text-white text-[10px]">📶</span>
                  <span className="text-white text-[10px]">🔋</span>
                </div>
              </div>
              {/* Browser Bar */}
              <div className="bg-gray-100 px-3 py-2 flex items-center gap-2 border-b">
                <span className="text-green-600">🔒</span>
                <span className="text-xs text-gray-600 flex-1">rzp.io/i/abc123xyz</span>
              </div>
              {/* Payment Page Content */}
              <div className="bg-gradient-to-b from-blue-50 to-white p-6">
                {/* Logo */}
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <span className="text-white text-2xl font-bold">X</span>
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">XLAND INFRA PVT LTD</h2>
                </div>

                {/* Amount */}
                <div className="text-center mb-6">
                  <p className="text-sm text-gray-500">Amount Due</p>
                  <p className="text-4xl font-bold text-gray-900">₹50,000</p>
                </div>

                {/* Invoice Details */}
                <div className="bg-white rounded-lg p-4 border mb-6">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-gray-500">Invoice</span>
                    <span className="text-xs font-medium text-gray-900">INV-001</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Property</span>
                    <span className="text-xs font-medium text-gray-900">Palm Grove Apartments</span>
                  </div>
                </div>

                {/* Payment Options */}
                <div className="space-y-3 mb-6">
                  <button className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold text-sm shadow-lg hover:bg-green-700">
                    Pay ₹50,000
                  </button>
                </div>

                {/* Payment Methods */}
                <div className="flex justify-center gap-2 flex-wrap">
                  <span className="px-3 py-1.5 bg-white border rounded-full text-[10px] text-gray-600">UPI</span>
                  <span className="px-3 py-1.5 bg-white border rounded-full text-[10px] text-gray-600">Cards</span>
                  <span className="px-3 py-1.5 bg-white border rounded-full text-[10px] text-gray-600">Net Banking</span>
                  <span className="px-3 py-1.5 bg-white border rounded-full text-[10px] text-gray-600">Wallet</span>
                </div>

                {/* Powered by */}
                <div className="text-center mt-6">
                  <p className="text-[10px] text-gray-400">Secured by</p>
                  <p className="text-xs font-semibold text-gray-600">Razorpay</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SCREEN 5: Payment Success - Auto Status Update */}
        <div className="mb-6">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">5</span>
            After Payment - Automatic Status Updates
          </h4>
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-2xl text-green-600">✓</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-800">Payment Received via Razorpay Webhook</h3>
                <p className="text-sm text-green-700 mt-1">The following updates happen automatically:</p>
                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase mb-3">Payment Link Status</h4>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs line-through">Sent</span>
                      <span>→</span>
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">Paid</span>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase mb-3">Invoice Status</h4>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs line-through">Sent</span>
                      <span>→</span>
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">Paid</span>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase mb-3">Payment Record</h4>
                    <p className="text-xs text-gray-600">New payment entry created in Payment History</p>
                    <p className="text-xs text-gray-500 mt-1">Method: Razorpay Online | Ref: pay_xxx</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase mb-3">Work Order (if linked)</h4>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs line-through">Completed</span>
                      <span>→</span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">Closed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="bg-gray-50 rounded-lg p-4 border">
          <h4 className="font-semibold text-gray-800 mb-3">Payment Link Status Reference</h4>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">🔗 Created</span>
              <span className="text-xs text-gray-500">Link generated, not sent</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">✉ Sent</span>
              <span className="text-xs text-gray-500">Link emailed to customer</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">✓ Paid</span>
              <span className="text-xs text-gray-500">Payment received</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">⏱ Expired</span>
              <span className="text-xs text-gray-500">Link expired (7 days)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">✕ Cancelled</span>
              <span className="text-xs text-gray-500">Link cancelled manually</span>
            </div>
          </div>
        </div>
      </section>

      {/* Payment History */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={History} title="Payment History Screen" />
        <p className="text-gray-600 mb-4">Transaction record showing all payment activities. One invoice may have multiple payment entries.</p>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Table Columns</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Payment ID</span><span className="text-gray-400">PAY-001, PAY-002...</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Invoice ID</span><span className="text-gray-400">Linked invoice</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Date</span><span className="text-gray-400">Payment date</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Method</span><span className="text-gray-400">Cash/Bank/UPI/Online</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Amount</span><span className="text-gray-400">Payment amount</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Reference Number</span><span className="text-gray-400">Transaction ref</span></div>
              <div className="flex justify-between py-2"><span className="text-gray-600">Received By</span><span className="text-gray-400">Employee name</span></div>
            </div>
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-800 mb-2">Example</h4>
              <p className="text-sm text-yellow-700">One ₹50,000 invoice may have:</p>
              <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                <li>• ₹25,000 paid on July 5</li>
                <li>• ₹25,000 paid on August 5</li>
              </ul>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">UI Mockup</h4>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="bg-white rounded-lg shadow p-4 space-y-3">
                <div className="flex justify-between items-center border-b pb-3">
                  <span className="font-bold text-lg">Payment History</span>
                  <div className="flex gap-2">
                    <select className="h-7 bg-gray-100 rounded px-2 text-xs text-gray-600 border-0">
                      <option>All Methods</option>
                      <option>Cash</option>
                      <option>Bank Transfer</option>
                      <option>UPI</option>
                    </select>
                    <div className="h-7 w-24 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">🔍 Search</div>
                  </div>
                </div>
                <div className="border rounded text-xs">
                  <div className="bg-gray-50 px-2 py-2 grid grid-cols-6 gap-1 font-semibold text-gray-600 border-b">
                    <span>Pay ID</span><span>Invoice</span><span>Date</span><span>Method</span><span>Amount</span><span>By</span>
                  </div>
                  <div className="px-2 py-2 grid grid-cols-6 gap-1 text-gray-700 border-b">
                    <span>PAY-001</span><span className="text-blue-600">INV-001</span><span>Jul 5</span>
                    <span className="bg-green-50 text-green-700 px-1 rounded">Cash</span>
                    <span>₹25,000</span><span>John</span>
                  </div>
                  <div className="px-2 py-2 grid grid-cols-6 gap-1 text-gray-700 border-b">
                    <span>PAY-002</span><span className="text-blue-600">INV-001</span><span>Aug 5</span>
                    <span className="bg-blue-50 text-blue-700 px-1 rounded">UPI</span>
                    <span>₹25,000</span><span>Sarah</span>
                  </div>
                  <div className="px-2 py-2 grid grid-cols-6 gap-1 text-gray-700 border-b">
                    <span>PAY-003</span><span className="text-blue-600">INV-002</span><span>Jul 8</span>
                    <span className="bg-purple-50 text-purple-700 px-1 rounded">Bank</span>
                    <span>₹40,000</span><span>Mike</span>
                  </div>
                  <div className="px-2 py-2 grid grid-cols-6 gap-1 text-gray-700">
                    <span>PAY-004</span><span className="text-blue-600">INV-004</span><span>Jul 10</span>
                    <span className="bg-indigo-50 text-indigo-700 px-1 rounded">Online</span>
                    <span>₹15,000</span><span>Auto</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500 pt-2">
                  <span>Total: 4 transactions</span>
                  <span className="font-semibold text-green-600">₹1,05,000 collected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={LayoutDashboard} title="Payments Dashboard Widget" />
        <p className="text-gray-600 mb-4">Overview widget showing payment metrics at a glance.</p>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Widget Cards</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Total Collected</span><span className="text-green-600 font-semibold">Sum of all paid</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Pending</span><span className="text-yellow-600 font-semibold">Awaiting payment</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Overdue</span><span className="text-red-600 font-semibold">Past due date</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-gray-600">Total Invoices</span><span className="text-blue-600 font-semibold">Count</span></div>
              <div className="flex justify-between py-2"><span className="text-gray-600">This Month</span><span className="text-purple-600 font-semibold">Monthly stats</span></div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">UI Mockup</h4>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="bg-white rounded-lg shadow p-4 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <span className="font-bold text-lg">Payments Overview</span>
                  <select className="h-7 bg-gray-100 rounded px-2 text-xs text-gray-600 border-0">
                    <option>This Month</option>
                    <option>Last 30 Days</option>
                    <option>This Year</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-green-700">₹2.5L</p>
                    <p className="text-xs text-green-600">Total Collected</p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-yellow-700">₹50K</p>
                    <p className="text-xs text-yellow-600">Pending</p>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-red-700">₹25K</p>
                    <p className="text-xs text-red-600">Overdue</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-blue-700">45</p>
                    <p className="text-xs text-blue-600">Total Invoices</p>
                  </div>
                </div>
                {/* Mini Chart */}
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Monthly Trend</p>
                  <div className="flex items-end gap-1 h-12">
                    <div className="flex-1 bg-blue-200 rounded-t" style={{height: '40%'}}></div>
                    <div className="flex-1 bg-blue-300 rounded-t" style={{height: '60%'}}></div>
                    <div className="flex-1 bg-blue-400 rounded-t" style={{height: '45%'}}></div>
                    <div className="flex-1 bg-blue-500 rounded-t" style={{height: '80%'}}></div>
                    <div className="flex-1 bg-blue-600 rounded-t" style={{height: '100%'}}></div>
                    <div className="flex-1 bg-blue-400 rounded-t" style={{height: '70%'}}></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Invoice Types */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={Plus} title="Invoice Types" />
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Invoice Categories</h4>
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-indigo-50 to-white rounded-lg p-4 border border-indigo-100">
                <h4 className="font-bold text-indigo-800 mb-2">Create Invoice</h4>
                <p className="text-sm text-indigo-600">For other kinds of requirements - general invoicing not tied to specific work orders.</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg p-4 border border-purple-100">
                <h4 className="font-bold text-purple-800 mb-2">Work Order Invoice</h4>
                <p className="text-sm text-purple-600">Only related to WO submissions - automatically linked to completed work orders.</p>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">UI Mockup</h4>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="bg-white rounded-lg shadow p-4 space-y-3">
                <div className="border-b pb-3">
                  <span className="font-bold text-lg">Create Invoice</span>
                </div>
                <p className="text-xs text-gray-500">Select invoice type:</p>
                <div className="space-y-2">
                  <div className="border-2 border-indigo-500 bg-indigo-50 rounded-lg p-3 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-indigo-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      </div>
                      <span className="font-semibold text-sm text-indigo-800">General Invoice</span>
                    </div>
                    <p className="text-xs text-indigo-600 ml-6 mt-1">For custom services & requirements</p>
                  </div>
                  <div className="border rounded-lg p-3 cursor-pointer hover:border-purple-300">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-gray-300 rounded-full"></div>
                      <span className="font-semibold text-sm text-gray-700">Work Order Invoice</span>
                    </div>
                    <p className="text-xs text-gray-500 ml-6 mt-1">Link to completed work order</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2 border-t">
                  <button className="px-3 py-1.5 text-xs border rounded text-gray-600">Cancel</button>
                  <button className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded">Continue</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BillingUI;
