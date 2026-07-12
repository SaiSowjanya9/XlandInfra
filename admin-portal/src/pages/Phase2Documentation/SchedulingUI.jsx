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
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Form Fields</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b"><span>Title</span><span className="text-gray-400">Mr/Mrs/Ms</span></div>
                <div className="flex justify-between py-1 border-b"><span>First Name, Last Name</span><span className="text-gray-400">Text</span></div>
                <div className="flex justify-between py-1 border-b"><span>Company Name</span><span className="text-gray-400">Text</span></div>
                <div className="flex justify-between py-1 border-b"><span>Phone, Email</span><span className="text-gray-400">Input</span></div>
                <div className="flex justify-between py-1 border-b"><span>Lead Source</span><span className="text-gray-400">Dropdown</span></div>
                <div className="flex justify-between py-1"><span>Address Fields</span><span className="text-gray-400">Text</span></div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">UI Mockup</h4>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
                <div className="bg-white rounded-lg shadow p-3 space-y-2">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold text-sm">New Request - Step 1</span>
                    <div className="flex gap-1">
                      <div className="w-6 h-6 bg-green-600 text-white rounded-full text-xs flex items-center justify-center">1</div>
                      <div className="w-6 h-6 bg-gray-200 rounded-full text-xs flex items-center justify-center">2</div>
                      <div className="w-6 h-6 bg-gray-200 rounded-full text-xs flex items-center justify-center">3</div>
                      <div className="w-6 h-6 bg-gray-200 rounded-full text-xs flex items-center justify-center">4</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select className="h-6 bg-gray-100 rounded px-1 text-xs border-0"><option>Mr</option></select>
                    <div className="h-6 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">First Name</div>
                    <div className="h-6 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">Last Name</div>
                  </div>
                  <div className="h-6 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">Company Name</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-6 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">📞 Phone</div>
                    <div className="h-6 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">✉️ Email</div>
                  </div>
                  <select className="w-full h-6 bg-gray-100 rounded px-2 text-xs border-0 text-gray-500"><option>Lead Source: Website</option></select>
                  <div className="h-6 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">Street Address</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-6 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">City</div>
                    <div className="h-6 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">State</div>
                    <div className="h-6 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">Postal</div>
                  </div>
                  <div className="flex justify-end pt-2 border-t">
                    <button className="px-3 py-1 text-xs bg-green-600 text-white rounded">Next →</button>
                  </div>
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
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Form Fields</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b"><span>Service Category</span><span className="text-gray-400">Dropdown</span></div>
                <div className="flex justify-between py-1 border-b"><span>Subcategory</span><span className="text-gray-400">Dropdown</span></div>
                <div className="flex justify-between py-1 border-b"><span>Description</span><span className="text-gray-400">Textarea</span></div>
                <div className="flex justify-between py-1 border-b"><span>Availability Date</span><span className="text-gray-400">IST Format</span></div>
                <div className="flex justify-between py-1 border-b"><span>Preferred Time</span><span className="text-gray-400">Anytime/Morning/etc</span></div>
                <div className="flex justify-between py-1 border-b"><span>Pets</span><span className="text-gray-400">Yes/No Toggle</span></div>
                <div className="flex justify-between py-1"><span>Comments</span><span className="text-gray-400">Textarea</span></div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">UI Mockup</h4>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
                <div className="bg-white rounded-lg shadow p-3 space-y-2">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold text-sm">Service Details - Step 2</span>
                    <div className="flex gap-1">
                      <div className="w-6 h-6 bg-green-600 text-white rounded-full text-xs flex items-center justify-center">✓</div>
                      <div className="w-6 h-6 bg-green-600 text-white rounded-full text-xs flex items-center justify-center">2</div>
                      <div className="w-6 h-6 bg-gray-200 rounded-full text-xs flex items-center justify-center">3</div>
                      <div className="w-6 h-6 bg-gray-200 rounded-full text-xs flex items-center justify-center">4</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select className="h-6 bg-gray-100 rounded px-2 text-xs border-0 text-gray-500"><option>Select Category</option></select>
                    <select className="h-6 bg-gray-100 rounded px-2 text-xs border-0 text-gray-500"><option>Select Subcategory</option></select>
                  </div>
                  <textarea className="w-full h-12 bg-gray-100 rounded p-2 text-xs resize-none border-0" placeholder="Description of work required..."></textarea>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-6 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">📅 Availability Date</div>
                    <select className="h-6 bg-gray-100 rounded px-2 text-xs border-0 text-gray-500"><option>Preferred Time</option></select>
                  </div>
                  <div className="flex items-center justify-between bg-gray-100 rounded px-2 py-1">
                    <span className="text-xs text-gray-600">Pets on Property?</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">No</span>
                      <div className="w-8 h-4 bg-gray-300 rounded-full relative"><div className="w-3 h-3 bg-white rounded-full absolute left-0.5 top-0.5"></div></div>
                      <span className="text-xs text-gray-500">Yes</span>
                    </div>
                  </div>
                  <textarea className="w-full h-10 bg-gray-100 rounded p-2 text-xs resize-none border-0" placeholder="Additional comments..."></textarea>
                  <div className="flex justify-between pt-2 border-t">
                    <button className="px-3 py-1 text-xs border rounded text-gray-600">← Back</button>
                    <button className="px-3 py-1 text-xs bg-green-600 text-white rounded">Next →</button>
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
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Requirements</h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-4 mb-4">
                  <Camera className="w-8 h-8 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-700">Upload images of work area</p>
                    <p className="text-sm text-gray-500">Supported: JPG, PNG, WEBP (Max 5MB each)</p>
                  </div>
                </div>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between py-1 border-b"><span>Max Files</span><span className="text-gray-400">5 images</span></div>
                  <div className="flex justify-between py-1 border-b"><span>Max Size</span><span className="text-gray-400">5MB each</span></div>
                  <div className="flex justify-between py-1"><span>Formats</span><span className="text-gray-400">JPG, PNG, WEBP</span></div>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">UI Mockup</h4>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
                <div className="bg-white rounded-lg shadow p-3 space-y-2">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold text-sm">Upload Images - Step 3</span>
                    <div className="flex gap-1">
                      <div className="w-6 h-6 bg-green-600 text-white rounded-full text-xs flex items-center justify-center">✓</div>
                      <div className="w-6 h-6 bg-green-600 text-white rounded-full text-xs flex items-center justify-center">✓</div>
                      <div className="w-6 h-6 bg-green-600 text-white rounded-full text-xs flex items-center justify-center">3</div>
                      <div className="w-6 h-6 bg-gray-200 rounded-full text-xs flex items-center justify-center">4</div>
                    </div>
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50">
                    <Camera className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">Drag & drop or click to upload</p>
                    <p className="text-xs text-gray-400">JPG, PNG, WEBP up to 5MB</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="aspect-square bg-gray-200 rounded flex items-center justify-center">
                      <span className="text-xs text-gray-400">IMG 1</span>
                    </div>
                    <div className="aspect-square bg-gray-200 rounded flex items-center justify-center">
                      <span className="text-xs text-gray-400">IMG 2</span>
                    </div>
                    <div className="aspect-square border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                      <span className="text-lg text-gray-300">+</span>
                    </div>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <button className="px-3 py-1 text-xs border rounded text-gray-600">← Back</button>
                    <button className="px-3 py-1 text-xs bg-green-600 text-white rounded">Next →</button>
                  </div>
                </div>
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
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg p-4 border border-amber-200">
                <p className="text-sm text-amber-800 mb-3">Visit the property to assess the job</p>
                <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b"><span>Instructions</span><span className="text-gray-400">Textarea</span></div>
                  <div className="flex justify-between py-1 border-b"><span>Start/End Date</span><span className="text-gray-400">Date Picker</span></div>
                  <div className="flex justify-between py-1 border-b"><span>Start/End Time</span><span className="text-gray-400">Time Picker</span></div>
                  <div className="flex justify-between py-1 border-b"><span>Schedule Later</span><span className="text-gray-400">Checkbox</span></div>
                  <div className="flex justify-between py-1 border-b"><span>Team Assignment</span><span className="text-gray-400">Assign +</span></div>
                  <div className="flex justify-between py-1 border-b"><span>Checklists</span><span className="text-gray-400">Items</span></div>
                  <div className="flex justify-between py-1"><span>Notes</span><span className="text-gray-400">Internal</span></div>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-3">UI Mockup</h4>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
                <div className="bg-white rounded-lg shadow p-3 space-y-2">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold text-sm">On-Site Assessment - Step 4</span>
                    <div className="flex gap-1">
                      <div className="w-6 h-6 bg-green-600 text-white rounded-full text-xs flex items-center justify-center">✓</div>
                      <div className="w-6 h-6 bg-green-600 text-white rounded-full text-xs flex items-center justify-center">✓</div>
                      <div className="w-6 h-6 bg-green-600 text-white rounded-full text-xs flex items-center justify-center">✓</div>
                      <div className="w-6 h-6 bg-green-600 text-white rounded-full text-xs flex items-center justify-center">4</div>
                    </div>
                  </div>
                  <textarea className="w-full h-10 bg-gray-100 rounded p-2 text-xs resize-none border-0" placeholder="Instructions for assessment..."></textarea>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-6 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">📅 Start Date</div>
                    <div className="h-6 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">📅 End Date</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-6 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">🕐 Start Time</div>
                    <div className="h-6 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400">🕐 End Time</div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> Schedule Later</label>
                    <label className="flex items-center gap-1"><input type="checkbox" className="rounded" /> Anytime</label>
                  </div>
                  <div className="bg-gray-100 rounded p-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium">Team Assignment</span>
                      <button className="text-xs text-green-600">+ Assign</button>
                    </div>
                    <div className="flex gap-1 mt-1">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">John D.</span>
                    </div>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <button className="px-3 py-1 text-xs border rounded text-gray-600">← Back</button>
                    <button className="px-3 py-1 text-xs bg-green-600 text-white rounded">Create Request</button>
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
            <h4 className="font-semibold text-gray-800 mb-3">Behavior Rules</h4>
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="font-semibold text-yellow-800">Unscheduled Sidebar</span>
                </div>
                <p className="text-sm text-yellow-700">If assessment NOT 100% complete → appears in sidebar panel</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="font-semibold text-green-800">Calendar Grid</span>
                </div>
                <p className="text-sm text-green-700">If assessment IS 100% complete → appears on calendar</p>
              </div>
            </div>
            <div className="mt-4">
              <h4 className="font-semibold text-gray-800 mb-2">Color Coding</h4>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2 bg-blue-50 px-2 py-1 rounded">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-xs text-blue-700">Requests</span>
                </div>
                <div className="flex items-center gap-2 bg-purple-50 px-2 py-1 rounded">
                  <div className="w-3 h-3 bg-purple-500 rounded"></div>
                  <span className="text-xs text-purple-700">Quotes</span>
                </div>
                <div className="flex items-center gap-2 bg-green-50 px-2 py-1 rounded">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-xs text-green-700">Jobs</span>
                </div>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">UI Mockup</h4>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
              <div className="bg-white rounded-lg shadow p-3 space-y-2">
                {/* Calendar Header */}
                <div className="flex justify-between items-center border-b pb-2">
                  <div className="flex items-center gap-2">
                    <button className="text-xs px-2 py-1 border rounded">←</button>
                    <span className="font-bold text-sm">July 2025</span>
                    <button className="text-xs px-2 py-1 border rounded">→</button>
                  </div>
                  <div className="flex gap-1">
                    <button className="text-xs px-2 py-1 bg-green-600 text-white rounded">Month</button>
                    <button className="text-xs px-2 py-1 bg-gray-200 rounded">Week</button>
                    <button className="text-xs px-2 py-1 bg-gray-200 rounded">Day</button>
                  </div>
                </div>
                {/* Filters */}
                <div className="flex gap-2 text-xs">
                  <select className="h-5 bg-gray-100 rounded px-1 border-0 text-gray-500"><option>All Types</option></select>
                  <select className="h-5 bg-gray-100 rounded px-1 border-0 text-gray-500"><option>All Team</option></select>
                  <button className="px-2 bg-gray-100 rounded text-gray-500">Map View</button>
                </div>
                {/* Calendar Grid with Sidebar */}
                <div className="flex gap-2">
                  {/* Unscheduled Sidebar */}
                  <div className="w-24 bg-yellow-50 rounded p-1 text-xs">
                    <p className="font-semibold text-yellow-800 mb-1">Unscheduled</p>
                    <div className="bg-yellow-200 rounded p-1 mb-1 text-yellow-800">
                      <p className="font-medium">Plumbing</p>
                      <p className="text-yellow-600">No date</p>
                    </div>
                  </div>
                  {/* Calendar Days */}
                  <div className="flex-1 border rounded">
                    <div className="grid grid-cols-7 gap-px bg-gray-200 text-xs">
                      <div className="bg-gray-50 p-1 text-center font-medium">Sun</div>
                      <div className="bg-gray-50 p-1 text-center font-medium">Mon</div>
                      <div className="bg-gray-50 p-1 text-center font-medium">Tue</div>
                      <div className="bg-gray-50 p-1 text-center font-medium">Wed</div>
                      <div className="bg-gray-50 p-1 text-center font-medium">Thu</div>
                      <div className="bg-gray-50 p-1 text-center font-medium">Fri</div>
                      <div className="bg-gray-50 p-1 text-center font-medium">Sat</div>
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-gray-200 text-xs">
                      <div className="bg-white p-1 h-10">1</div>
                      <div className="bg-white p-1 h-10">2</div>
                      <div className="bg-white p-1 h-10">3<div className="bg-blue-500 text-white rounded px-1 mt-0.5 truncate">Request</div></div>
                      <div className="bg-white p-1 h-10">4</div>
                      <div className="bg-white p-1 h-10">5<div className="bg-green-500 text-white rounded px-1 mt-0.5 truncate">Job</div></div>
                      <div className="bg-white p-1 h-10">6</div>
                      <div className="bg-white p-1 h-10">7</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Assessment Details Modal */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={CheckSquare} title="Assessment Details Modal" />
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Modal Fields</h4>
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
              <div className="flex justify-between py-1 border-b"><span>Request Title</span><span className="text-gray-400">Text</span></div>
              <div className="flex justify-between py-1 border-b"><span>Customer Name</span><span className="text-gray-400">Text</span></div>
              <div className="flex justify-between py-1 border-b"><span>Address</span><span className="text-gray-400">Text</span></div>
              <div className="flex justify-between py-1 border-b"><span>Status</span><span className="text-gray-400">Badge</span></div>
              <div className="flex justify-between py-1 border-b"><span>Directions Link</span><span className="text-gray-400">Link</span></div>
              <div className="flex justify-between py-1 border-b"><span>Instructions</span><span className="text-gray-400">Text</span></div>
              <div className="flex justify-between py-1 border-b"><span>Assigned To</span><span className="text-gray-400">Text</span></div>
              <div className="flex justify-between py-1"><span>Service Details</span><span className="text-gray-400">Text</span></div>
            </div>
            <div className="mt-4">
              <h4 className="font-semibold text-gray-800 mb-2">Status Flow</h4>
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
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">UI Mockup</h4>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
              <div className="bg-white rounded-lg shadow p-3 space-y-2">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-bold text-sm">Assessment Details</span>
                  <button className="text-gray-400 text-lg">×</button>
                </div>
                {/* Tabs */}
                <div className="flex gap-1 border-b">
                  <button className="px-3 py-1 text-xs bg-green-600 text-white rounded-t">Info</button>
                  <button className="px-3 py-1 text-xs bg-gray-100 rounded-t">Customer</button>
                  <button className="px-3 py-1 text-xs bg-gray-100 rounded-t">Notes</button>
                </div>
                {/* Content */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Request</span>
                    <span className="font-medium">Plumbing Repair</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer</span>
                    <span className="font-medium">John Doe</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Address</span>
                    <span className="font-medium text-blue-600">📍 123 Main St</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className="bg-blue-100 text-blue-700 px-2 rounded">Scheduled</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Assigned</span>
                    <span className="font-medium">Mike, Sarah</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date</span>
                    <span className="font-medium">Jul 15, 2025 - 10:00 AM</span>
                  </div>
                </div>
                {/* Actions */}
                <div className="border-t pt-2 space-y-2">
                  <button className="w-full px-3 py-2 bg-green-600 text-white rounded text-xs font-medium flex items-center justify-center gap-1">
                    <CheckSquare className="w-3 h-3" /> Mark as Complete
                  </button>
                  <div className="flex flex-wrap gap-1">
                    <button className="px-2 py-1 border rounded text-xs">Edit</button>
                    <button className="px-2 py-1 border rounded text-xs">Reschedule</button>
                    <button className="px-2 py-1 border rounded text-xs">Create Quote</button>
                    <button className="px-2 py-1 border rounded text-xs">Convert to Job</button>
                    <button className="px-2 py-1 border rounded text-xs text-red-600">Delete</button>
                  </div>
                </div>
              </div>
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
