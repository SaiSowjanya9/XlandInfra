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

      {/* Payment Links */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={Link2} title="Payment Links Screen" />
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Flow</h4>
            <div className="bg-gradient-to-b from-blue-50 to-white rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                <span className="text-gray-700">Invoice INV-001 is ₹50,000</span>
              </div>
              <div className="w-px h-4 bg-blue-300 ml-4"></div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                <span className="text-gray-700">Click Generate/Send Payment Link</span>
              </div>
              <div className="w-px h-4 bg-blue-300 ml-4"></div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                <span className="text-gray-700">Customer receives link by email/SMS</span>
              </div>
              <div className="w-px h-4 bg-blue-300 ml-4"></div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                <span className="text-gray-700">Opens the payment page</span>
              </div>
              <div className="w-px h-4 bg-blue-300 ml-4"></div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                <span className="text-gray-700">Customer pays online</span>
              </div>
            </div>
            <div className="mt-4">
              <h4 className="font-semibold text-gray-800 mb-3">Link Status Tracking</h4>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status="Generated" color="bg-gray-100 text-gray-700" />
                <StatusBadge status="Sent" color="bg-blue-100 text-blue-700" />
                <StatusBadge status="Expired" color="bg-red-100 text-red-700" />
                <StatusBadge status="Paid" color="bg-green-100 text-green-700" />
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">UI Mockup</h4>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="bg-white rounded-lg shadow p-4 space-y-3">
                <div className="flex justify-between items-center border-b pb-3">
                  <span className="font-bold text-lg">Payment Links</span>
                  <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded">+ Generate Link</button>
                </div>
                <div className="border rounded text-xs">
                  <div className="bg-gray-50 px-2 py-2 grid grid-cols-6 gap-1 font-semibold text-gray-600 border-b">
                    <span>Link ID</span><span>Invoice</span><span>Amount</span><span>Created</span><span>Status</span><span>Action</span>
                  </div>
                  <div className="px-2 py-2 grid grid-cols-6 gap-1 text-gray-700 border-b">
                    <span>PL-001</span><span className="text-blue-600">INV-001</span><span>₹50,000</span><span>Jul 10</span>
                    <span className="bg-green-100 text-green-700 px-1 rounded text-center">Paid</span>
                    <span className="text-gray-400">-</span>
                  </div>
                  <div className="px-2 py-2 grid grid-cols-6 gap-1 text-gray-700 border-b">
                    <span>PL-002</span><span className="text-blue-600">INV-002</span><span>₹75,000</span><span>Jul 8</span>
                    <span className="bg-blue-100 text-blue-700 px-1 rounded text-center">Sent</span>
                    <span className="text-blue-500">Resend</span>
                  </div>
                  <div className="px-2 py-2 grid grid-cols-6 gap-1 text-gray-700">
                    <span>PL-003</span><span className="text-blue-600">INV-003</span><span>₹25,000</span><span>Jun 20</span>
                    <span className="bg-red-100 text-red-700 px-1 rounded text-center">Expired</span>
                    <span className="text-blue-500">Regenerate</span>
                  </div>
                </div>
                {/* Customer Payment Page Preview */}
                <div className="border-t pt-3 mt-2">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Customer Payment Page:</p>
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded p-3 text-center">
                    <div className="w-10 h-10 bg-blue-600 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-lg font-bold">X</div>
                    <p className="text-xs font-semibold">XlandInfra</p>
                    <p className="text-lg font-bold text-gray-800 mt-2">₹50,000</p>
                    <p className="text-xs text-gray-500">Invoice: INV-001</p>
                    <button className="mt-2 w-full px-3 py-2 text-xs bg-green-600 text-white rounded font-semibold">Pay Now</button>
                  </div>
                </div>
              </div>
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
