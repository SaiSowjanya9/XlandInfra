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
├── Generate Invoice
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 font-semibold text-gray-700">Column</th>
                <th className="text-left p-3 font-semibold text-gray-700">Description</th>
                <th className="text-left p-3 font-semibold text-gray-700">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="p-3 font-medium">Invoice ID</td><td className="p-3 text-gray-600">INV-001, INV-002...</td><td className="p-3 text-gray-400">Link</td></tr>
              <tr><td className="p-3 font-medium">Property</td><td className="p-3 text-gray-600">Property name/ID</td><td className="p-3 text-gray-400">Text</td></tr>
              <tr><td className="p-3 font-medium">Customer</td><td className="p-3 text-gray-600">Customer name</td><td className="p-3 text-gray-400">Text</td></tr>
              <tr><td className="p-3 font-medium">Invoice Date</td><td className="p-3 text-gray-600">Date created</td><td className="p-3 text-gray-400">Date</td></tr>
              <tr><td className="p-3 font-medium">Due Date</td><td className="p-3 text-gray-600">Payment deadline</td><td className="p-3 text-gray-400">Date</td></tr>
              <tr><td className="p-3 font-medium">Amount</td><td className="p-3 text-gray-600">Total invoice amount</td><td className="p-3 text-gray-400">Currency</td></tr>
              <tr><td className="p-3 font-medium">Status</td><td className="p-3 text-gray-600">Draft, Sent, Paid, Overdue</td><td className="p-3 text-gray-400">Badge</td></tr>
              <tr><td className="p-3 font-medium">Actions</td><td className="p-3 text-gray-600">View, Edit, Send, Download PDF</td><td className="p-3 text-gray-400">Buttons</td></tr>
            </tbody>
          </table>
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
      </section>

      {/* Payments Screen */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={CreditCard} title="Payments Screen" />
        <p className="text-gray-600 mb-4">Main payment management screen showing all invoices and their payment status.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 font-semibold text-gray-700">Column</th>
                <th className="text-left p-3 font-semibold text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="p-3 font-medium">Property ID</td><td className="p-3 text-gray-600">Associated property</td></tr>
              <tr><td className="p-3 font-medium">Invoice ID</td><td className="p-3 text-gray-600">Linked invoice reference</td></tr>
              <tr><td className="p-3 font-medium">Total Amount</td><td className="p-3 text-gray-600">Full invoice amount</td></tr>
              <tr><td className="p-3 font-medium">Paid Amount</td><td className="p-3 text-gray-600">Amount received so far</td></tr>
              <tr><td className="p-3 font-medium">Balance Due</td><td className="p-3 text-gray-600">Remaining amount (auto-calculated)</td></tr>
              <tr><td className="p-3 font-medium">Payment Method</td><td className="p-3 text-gray-600">Cash, Bank Transfer, UPI</td></tr>
              <tr><td className="p-3 font-medium">Status</td><td className="p-3 text-gray-600">Pending, Partially Paid, Paid, Overdue</td></tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 bg-blue-50 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-2">Record Payment Action</h4>
          <p className="text-sm text-blue-700">FP or Manager can record payments for: <strong>Cash</strong>, <strong>Bank Transfer</strong>, <strong>UPI</strong></p>
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
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Link Status Tracking</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Generated</span>
                <StatusBadge status="Generated" color="bg-gray-100 text-gray-700" />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Sent</span>
                <StatusBadge status="Sent" color="bg-blue-100 text-blue-700" />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Expired</span>
                <StatusBadge status="Expired" color="bg-red-100 text-red-700" />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Paid</span>
                <StatusBadge status="Paid" color="bg-green-100 text-green-700" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Payment History */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={History} title="Payment History Screen" />
        <p className="text-gray-600 mb-4">Transaction record showing all payment activities. One invoice may have multiple payment entries.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 font-semibold text-gray-700">Column</th>
                <th className="text-left p-3 font-semibold text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="p-3 font-medium">Payment ID</td><td className="p-3 text-gray-600">PAY-001, PAY-002...</td></tr>
              <tr><td className="p-3 font-medium">Invoice ID</td><td className="p-3 text-gray-600">Linked invoice</td></tr>
              <tr><td className="p-3 font-medium">Date</td><td className="p-3 text-gray-600">Payment date</td></tr>
              <tr><td className="p-3 font-medium">Method</td><td className="p-3 text-gray-600">Cash, Bank Transfer, UPI, Online</td></tr>
              <tr><td className="p-3 font-medium">Amount</td><td className="p-3 text-gray-600">Payment amount</td></tr>
              <tr><td className="p-3 font-medium">Reference Number</td><td className="p-3 text-gray-600">Transaction reference</td></tr>
              <tr><td className="p-3 font-medium">Received By</td><td className="p-3 text-gray-600">Employee who recorded</td></tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-800 mb-2">Example</h4>
          <p className="text-sm text-yellow-700">One ₹50,000 invoice may have:</p>
          <ul className="text-sm text-yellow-700 mt-2 space-y-1">
            <li>• ₹25,000 paid on July 5</li>
            <li>• ₹25,000 paid on August 5</li>
          </ul>
        </div>
      </section>

      {/* Dashboard */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={LayoutDashboard} title="Payments Dashboard Widget" />
        <p className="text-gray-600 mb-4">Overview widget showing payment metrics at a glance.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-700">₹2.5L</p>
            <p className="text-xs text-green-600 mt-1">Total Collected</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-yellow-700">₹50K</p>
            <p className="text-xs text-yellow-600 mt-1">Pending</p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-700">₹25K</p>
            <p className="text-xs text-red-600 mt-1">Overdue</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">45</p>
            <p className="text-xs text-blue-600 mt-1">Total Invoices</p>
          </div>
        </div>
      </section>

      {/* Invoice Types */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={Plus} title="Invoice Types" />
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-indigo-50 to-white rounded-lg p-5 border border-indigo-100">
            <h4 className="font-bold text-indigo-800 mb-2">Create Invoice</h4>
            <p className="text-sm text-indigo-600">For other kinds of requirements - general invoicing not tied to specific work orders.</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg p-5 border border-purple-100">
            <h4 className="font-bold text-purple-800 mb-2">Work Order Invoice</h4>
            <p className="text-sm text-purple-600">Only related to WO submissions - automatically linked to completed work orders.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BillingUI;
