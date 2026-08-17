import React from 'react';
import { Calendar, CheckSquare } from 'lucide-react';

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

      {/* On-Site Assessment */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <SectionTitle icon={CheckSquare} title="On-Site Assessment" />
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Assessment Fields</h4>
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
    </div>
  );
};

export default SchedulingUI;
