import React, { useState } from 'react';
import { 
  Check, X, Clock, MapPin, Calendar, User, Wrench, 
  Camera, Play, CheckCircle, AlertCircle, ChevronRight,
  Building2, Phone, FileText
} from 'lucide-react';

/**
 * Vendor Work Order Notification Card
 * Displays work order details for vendor with action buttons
 * 
 * Vendor Actions:
 * - Accept
 * - View Details
 * - Start Work
 * - Upload Photos
 * - Complete Work (submit for verification)
 * 
 * Note: Vendor CANNOT close work order - only Manager/FP can close after verification
 */
const VendorWorkOrderCard = ({ 
  workOrder, 
  onAccept, 
  onViewDetails, 
  onStartWork,
  onUploadPhotos,
  onCompleteWork,
  isNotification = false
}) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusColor = (status) => {
    const colors = {
      assigned: 'bg-amber-100 text-amber-700 border-amber-200',
      accepted: 'bg-blue-100 text-blue-700 border-blue-200',
      in_progress: 'bg-purple-100 text-purple-700 border-purple-200',
      work_completed: 'bg-green-100 text-green-700 border-green-200',
      verified: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      closed: 'bg-gray-100 text-gray-700 border-gray-200'
    };
    return colors[status] || colors.assigned;
  };

  const getStatusLabel = (status) => {
    const labels = {
      assigned: 'New',
      accepted: 'Accepted',
      in_progress: 'In Progress',
      work_completed: 'Pending Verification',
      verified: 'Verified',
      closed: 'Closed'
    };
    return labels[status] || status;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatTime = (time) => {
    if (!time) return '';
    try {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
    } catch {
      return time;
    }
  };

  // Notification card view (compact)
  if (isNotification) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Wrench className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">New Work Order</p>
                <p className="font-bold text-gray-900">{workOrder.workOrderId}</p>
              </div>
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(workOrder.status)}`}>
              {getStatusLabel(workOrder.status)}
            </span>
          </div>

          {/* Details */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-900">{workOrder.serviceName || workOrder.categoryName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{workOrder.propertyName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">
                {formatDate(workOrder.scheduledDate)}
                {workOrder.scheduledTime && `, ${formatTime(workOrder.scheduledTime)}`}
              </span>
            </div>
            {workOrder.visitNumber && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">
                  Visit {workOrder.visitNumber} of {workOrder.totalVisits}
                </span>
              </div>
            )}
          </div>

          {/* Actions based on status */}
          <div className="flex gap-2">
            {workOrder.status === 'assigned' && (
              <>
                <button
                  onClick={() => onAccept && onAccept(workOrder)}
                  className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  Accept
                </button>
                <button
                  onClick={() => onViewDetails && onViewDetails(workOrder)}
                  className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                >
                  View Details
                </button>
              </>
            )}
            {workOrder.status === 'accepted' && (
              <button
                onClick={() => onStartWork && onStartWork(workOrder)}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
              >
                <Play className="w-4 h-4" />
                Start Work
              </button>
            )}
            {workOrder.status === 'in_progress' && (
              <>
                <button
                  onClick={() => onUploadPhotos && onUploadPhotos(workOrder)}
                  className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                >
                  <Camera className="w-4 h-4" />
                  Photos
                </button>
                <button
                  onClick={() => onCompleteWork && onCompleteWork(workOrder)}
                  className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete Work
                </button>
              </>
            )}
            {workOrder.status === 'work_completed' && (
              <div className="flex-1 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg text-center">
                <Clock className="w-4 h-4 inline mr-1" />
                Awaiting Manager Verification
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full card view (expanded)
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-lg text-gray-900">{workOrder.workOrderId}</p>
            <p className="text-sm text-gray-500">{workOrder.title || workOrder.serviceName}</p>
          </div>
        </div>
        <span className={`px-3 py-1.5 text-sm font-medium rounded-full border ${getStatusColor(workOrder.status)}`}>
          {getStatusLabel(workOrder.status)}
        </span>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Property</p>
              <div className="flex items-start gap-2">
                <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">{workOrder.propertyName}</p>
                  <p className="text-sm text-gray-500">{workOrder.propertyCode}</p>
                </div>
              </div>
            </div>
            
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Location</p>
              <div className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <p className="text-sm text-gray-700">{workOrder.propertyAddress}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Customer Contact</p>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">{workOrder.customerName || 'N/A'}</p>
                  {workOrder.customerPhone && (
                    <p className="text-sm text-blue-600">{workOrder.customerPhone}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Scheduled</p>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">{formatDate(workOrder.scheduledDate)}</p>
                  <p className="text-sm text-gray-500">{formatTime(workOrder.scheduledTime)}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Service</p>
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">{workOrder.serviceName || workOrder.categoryName}</p>
                  {workOrder.visitNumber && (
                    <p className="text-sm text-blue-600">
                      Visit {workOrder.visitNumber} of {workOrder.totalVisits}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Priority</p>
              <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                workOrder.priority === 'high' ? 'bg-red-100 text-red-700' :
                workOrder.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {workOrder.priority?.charAt(0).toUpperCase() + workOrder.priority?.slice(1) || 'Normal'}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        {workOrder.description && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Description</p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{workOrder.description}</p>
          </div>
        )}

        {/* Photos */}
        {workOrder.photos && workOrder.photos.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-2">
              Uploaded Photos ({workOrder.photos.length})
            </p>
            <div className="flex gap-2 flex-wrap">
              {workOrder.photos.map((photo, index) => (
                <div key={index} className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                  <img 
                    src={photo.path} 
                    alt={`Work photo ${index + 1}`} 
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
        {workOrder.status === 'assigned' && (
          <>
            <button
              onClick={() => onAccept && onAccept(workOrder)}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Accept Work Order
            </button>
          </>
        )}
        {workOrder.status === 'accepted' && (
          <button
            onClick={() => onStartWork && onStartWork(workOrder)}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Start Work
          </button>
        )}
        {workOrder.status === 'in_progress' && (
          <>
            <button
              onClick={() => onUploadPhotos && onUploadPhotos(workOrder)}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Upload Photos
            </button>
            <button
              onClick={() => onCompleteWork && onCompleteWork(workOrder)}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Complete Work
            </button>
          </>
        )}
        {workOrder.status === 'work_completed' && (
          <div className="flex-1 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-center">
            <Clock className="w-5 h-5 inline mr-2" />
            Work completed - Awaiting Manager/FP Verification
          </div>
        )}
        {(workOrder.status === 'verified' || workOrder.status === 'closed') && (
          <div className="flex-1 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center">
            <CheckCircle className="w-5 h-5 inline mr-2" />
            Work Order Closed
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorWorkOrderCard;
