import React from 'react';
import { Calendar, ClipboardList, Users, MapPin, Clock, Camera, CheckSquare, FileText } from 'lucide-react';

const SectionTitle = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
      <Icon className="w-5 h-5 text-green-600" />
    </div>
    <h2 className="text-xl font-bold text-gray-900">{title}</h2>
  </div>
);

const StatusBadge = ({ status, color }) => (
  <span className={`px-3 py-1 rounded-full text-xs font-medium ${color}`}>
    {status}
  </span>
);

const SchedulingUI = () => {
  return (
    <div className="space-y-10">
      {/* Module Overview */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={Calendar} title="Scheduling Module Overview" />
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 mt-4">
          <h3 className="font-semibold text-gray-900 mb-3">Sidebar Navigation Structure</h3>
          <div className="font-mono text-sm bg-white rounded-lg p-4 border">
            <pre className="text-gray-700">
{`Scheduling
│
├── Requests
├── Calendar
├── Quotes
├── Jobs
├── Invoices (linked to Billing)
└── Payments (linked to Billing)

NOTE: Use "Customers" instead of "Clients"`}
            </pre>
          </div>
        </div>
      </section>

      {/* Request Creation Flow */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={ClipboardList} title="Request Creation Flow (4 Steps)" />
        
        {/* Step 1 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
            <h3 className="text-lg font-semibold text-gray-800">Customer Details</h3>
          </div>
          <div className="ml-13 grid md:grid-cols-2 gap-4 pl-12">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-700 mb-3">Form Fields</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span>Title</span><span className="text-gray-400">Mr/Mrs/Ms/No title</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span>First Name</span><span className="text-gray-400">Text Input</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span>Last Name</span><span className="text-gray-400">Text Input</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span>Company Name</span><span className="text-gray-400">Text Input</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span>Phone</span><span className="text-gray-400">Phone Input</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Email</span><span className="text-gray-400">Email Input</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-700 mb-3">Additional Fields</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span>Lead Source</span><span className="text-gray-400">Dropdown</span>
                </div>
                <div className="text-xs text-gray-500 pb-2">Referral, Website, Walk-in, Advertisement</div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span>Referrer Name</span><span className="text-gray-400">If Referral</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span>Street 1, Street 2</span><span className="text-gray-400">Text</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span>City, State</span><span className="text-gray-400">Text</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Postal Code, Country</span><span className="text-gray-400">Text</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
            <h3 className="text-lg font-semibold text-gray-800">Service Details</h3>
          </div>
          <div className="ml-13 pl-12">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span>Service Category</span><span className="text-gray-400">Dropdown</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span>Subcategory</span><span className="text-gray-400">Dropdown</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span>Description</span><span className="text-gray-400">Textarea</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Comments</span><span className="text-gray-400">Textarea</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span>Availability Date</span><span className="text-gray-400">IST Format</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span>Preferred Time</span><span className="text-gray-400">Select</span>
                  </div>
                  <div className="text-xs text-gray-500 pb-2">Anytime, Morning, Afternoon, Evening</div>
                  <div className="flex justify-between py-1">
                    <span>Pets</span><span className="text-gray-400">Yes/No Toggle</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
            <h3 className="text-lg font-semibold text-gray-800">Upload Images</h3>
          </div>
          <div className="ml-13 pl-12">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <Camera className="w-8 h-8 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-700">Upload images of work area</p>
                  <p className="text-sm text-gray-500">Supported: JPG, PNG, WEBP (Max 5MB each)</p>
                </div>
              </div>
              <div className="mt-4 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Camera className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Drag & drop images or click to browse</p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">4</div>
            <h3 className="text-lg font-semibold text-gray-800">On-Site Assessment</h3>
          </div>
          <div className="ml-13 pl-12">
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg p-4 border border-amber-200">
              <p className="text-sm text-amber-800 mb-4">Visit the property to assess the job before doing the work</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-3">Schedule Fields</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b">
                      <span>Instructions</span><span className="text-gray-400">Textarea</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span>Start Date</span><span className="text-gray-400">Date Picker</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span>End Date</span><span className="text-gray-400">Date Picker</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span>Start Time</span><span className="text-gray-400">Time Picker</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>End Time</span><span className="text-gray-400">Time Picker</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-3">Options & Assignment</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b">
                      <span>Schedule Later</span><span className="text-gray-400">Checkbox</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span>Anytime</span><span className="text-gray-400">Checkbox</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span>Team Assignment</span><span className="text-gray-400">Assign + Button</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span>Checklists</span><span className="text-gray-400">Customizable Items</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Notes</span><span className="text-gray-400">Internal Notes</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Calendar Behavior */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={Calendar} title="Calendar Screen & Behavior" />
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              Unscheduled Sidebar
            </h4>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 mb-3">If on-site assessment is NOT 100% complete:</p>
              <ul className="text-sm text-yellow-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  Request appears in "Unscheduled" panel
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  Missing: dates not set, team not assigned
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500">•</span>
                  Checklists incomplete
                </li>
              </ul>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              Calendar Grid
            </h4>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 mb-3">If on-site assessment IS 100% complete:</p>
              <ul className="text-sm text-green-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">•</span>
                  Request appears on scheduled calendar date
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">•</span>
                  Color-coded by type
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">•</span>
                  Mark as Complete option available
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Calendar Controls */}
        <div className="mt-6">
          <h4 className="font-semibold text-gray-800 mb-3">Calendar Controls</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex flex-wrap gap-3 mb-4">
              <button className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded">Month</button>
              <button className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded">Week</button>
              <button className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded">Day</button>
            </div>
            <div className="grid md:grid-cols-4 gap-3 text-sm">
              <div className="bg-white rounded p-3 border">
                <p className="text-gray-500 text-xs mb-1">Type Filter</p>
                <p className="font-medium">All / Requests / Quotes / Jobs</p>
              </div>
              <div className="bg-white rounded p-3 border">
                <p className="text-gray-500 text-xs mb-1">Team Filter</p>
                <p className="font-medium">Select Team Members</p>
              </div>
              <div className="bg-white rounded p-3 border">
                <p className="text-gray-500 text-xs mb-1">Status Filter</p>
                <p className="font-medium">All Statuses</p>
              </div>
              <div className="bg-white rounded p-3 border">
                <p className="text-gray-500 text-xs mb-1">Actions</p>
                <p className="font-medium">Find a Time / Map View</p>
              </div>
            </div>
          </div>
        </div>

        {/* Color Coding */}
        <div className="mt-6">
          <h4 className="font-semibold text-gray-800 mb-3">Color Coding</h4>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-sm text-blue-700">Requests</span>
            </div>
            <div className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg">
              <div className="w-4 h-4 bg-purple-500 rounded"></div>
              <span className="text-sm text-purple-700">Quotes</span>
            </div>
            <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-green-700">Jobs</span>
            </div>
          </div>
        </div>
      </section>

      {/* Assessment Details Modal */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={CheckSquare} title="Assessment Details Modal" />
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Modal Tabs</h4>
            <div className="flex gap-1 mb-4">
              <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-t">Info</button>
              <button className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-t">Customer</button>
              <button className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-t">Notes</button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
              <div className="flex justify-between py-1 border-b">
                <span>Request Title</span><span className="text-gray-400">Text</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span>Customer Name</span><span className="text-gray-400">Text</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span>Address</span><span className="text-gray-400">Text</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span>Status</span><span className="text-gray-400">Badge</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span>Directions Link</span><span className="text-gray-400">Link</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span>Instructions</span><span className="text-gray-400">Text</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span>Request Date</span><span className="text-gray-400">Date</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span>Assigned To</span><span className="text-gray-400">Text</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Service Details</span><span className="text-gray-400">Text</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Actions</h4>
            <div className="space-y-3">
              <button className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                <CheckSquare className="w-5 h-5" />
                Mark as Complete
              </button>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">More Actions:</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-white border rounded text-xs">Edit</span>
                  <span className="px-2 py-1 bg-white border rounded text-xs">Reschedule</span>
                  <span className="px-2 py-1 bg-white border rounded text-xs">Create Quote</span>
                  <span className="px-2 py-1 bg-white border rounded text-xs">Convert to Job</span>
                  <span className="px-2 py-1 bg-white border rounded text-xs">Cancel</span>
                  <span className="px-2 py-1 bg-white border rounded text-xs text-red-600">Delete</span>
                </div>
              </div>
            </div>

            <h4 className="font-semibold text-gray-800 mb-3 mt-6">Status Flow</h4>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status="Unscheduled" color="bg-gray-100 text-gray-700" />
              <span className="text-gray-400">→</span>
              <StatusBadge status="Scheduled" color="bg-blue-100 text-blue-700" />
              <span className="text-gray-400">→</span>
              <StatusBadge status="In Progress" color="bg-yellow-100 text-yellow-700" />
              <span className="text-gray-400">→</span>
              <StatusBadge status="Completed" color="bg-green-100 text-green-700" />
            </div>
          </div>
        </div>
      </section>

      {/* Quotes Screen */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={FileText} title="Quotes Screen" />
        <p className="text-gray-600 mb-4">After assessment, create quotes for customers.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 font-semibold text-gray-700">Column</th>
                <th className="text-left p-3 font-semibold text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="p-3 font-medium">Quote ID</td><td className="p-3 text-gray-600">QUO-001, QUO-002...</td></tr>
              <tr><td className="p-3 font-medium">Customer</td><td className="p-3 text-gray-600">Customer name</td></tr>
              <tr><td className="p-3 font-medium">Request</td><td className="p-3 text-gray-600">Linked request</td></tr>
              <tr><td className="p-3 font-medium">Amount</td><td className="p-3 text-gray-600">Quoted amount</td></tr>
              <tr><td className="p-3 font-medium">Status</td><td className="p-3 text-gray-600">Draft, Sent, Accepted, Declined</td></tr>
              <tr><td className="p-3 font-medium">Actions</td><td className="p-3 text-gray-600">View, Edit, Send, Convert to Job</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Jobs Screen */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={Users} title="Jobs Screen" />
        <p className="text-gray-600 mb-4">Accepted quotes become jobs for execution.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 font-semibold text-gray-700">Column</th>
                <th className="text-left p-3 font-semibold text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="p-3 font-medium">Job ID</td><td className="p-3 text-gray-600">JOB-001, JOB-002...</td></tr>
              <tr><td className="p-3 font-medium">Customer</td><td className="p-3 text-gray-600">Customer name</td></tr>
              <tr><td className="p-3 font-medium">Service</td><td className="p-3 text-gray-600">Service type</td></tr>
              <tr><td className="p-3 font-medium">Scheduled Date</td><td className="p-3 text-gray-600">Job date</td></tr>
              <tr><td className="p-3 font-medium">Assigned Team</td><td className="p-3 text-gray-600">Team members</td></tr>
              <tr><td className="p-3 font-medium">Status</td><td className="p-3 text-gray-600">Scheduled, In Progress, Completed</td></tr>
              <tr><td className="p-3 font-medium">Actions</td><td className="p-3 text-gray-600">View, Edit, Complete, Create Invoice</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default SchedulingUI;
