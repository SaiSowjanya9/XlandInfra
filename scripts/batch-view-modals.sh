#!/bin/bash
# Batch: retheme + chrome + import for every view modal. Lines: file<TAB>marker
cd "$(dirname "$0")/.." || exit 1
while IFS=$'\t' read -r file marker; do
  [ -z "$file" ] && continue
  echo "########## $file"
  node scripts/retheme-view-modal.js "$file" "$marker" || echo "RETHOME-FAIL $file"
  node scripts/chrome-view-modal.js "$file" "$marker" || echo "CHROME-FAIL $file"
  node scripts/add-viewmodal-import.js "$file" || true
done <<'EOF'
admin-portal/src/pages/CoordinatorProperties.jsx	{/* View Details Modal */}
admin-portal/src/pages/SupervisorProperties.jsx	{/* View Details Modal */}
admin-portal/src/pages/ExecutiveProperties.jsx	{/* View Details Modal */}
admin-portal/src/pages/CustomerSubmissions.jsx	{/* View Property Modal */}
admin-portal/src/pages/CustomerSubmissions.jsx	{/* AMC Details Modal */}
admin-portal/src/pages/CustomerWorkOrder.jsx	{/* Work Order Detail Modal */}
admin-portal/src/pages/EmployeeDetails.jsx	{/* View Employee Modal */}
admin-portal/src/pages/EmployeeManagement.jsx	{/* View Employee Modal */}
admin-portal/src/pages/EmployeeWorkOrders.jsx	{/* Work Order Detail Modal */}
admin-portal/src/pages/FPEmployees.jsx	{/* View Employee Modal */}
admin-portal/src/pages/FPPaymentHistory.jsx	{/* Payment Details Modal */}
admin-portal/src/pages/FPUserManagement.jsx	{/* View User Details Modal */}
admin-portal/src/pages/FPWorkOrders.jsx	{/* Work Order Detail Modal */}
admin-portal/src/pages/ManagerWorkOrders.jsx	{/* View Work Order Modal */}
admin-portal/src/pages/CoordinatorWorkOrders.jsx	{/* View Details Modal */}
admin-portal/src/pages/SupervisorWorkOrders.jsx	{/* View Details Modal */}
admin-portal/src/pages/ExecutiveWorkOrders.jsx	{/* View Details Modal */}
admin-portal/src/pages/WorkOrders.jsx	<Modal align="top" onClose={() => setSelectedOrder(null)}
admin-portal/src/pages/CoordinatorEmployees.jsx	{/* Employee Details Modal */}
admin-portal/src/pages/SupervisorEmployees.jsx	showDetailModal && selectedEmployee
admin-portal/src/pages/ManagerEmployees.jsx	<Modal className="max-w-lg w-full max-h-[90vh] overflow-y-auto"
admin-portal/src/pages/ZoneManagement.jsx	{/* View Employees Modal */}
admin-portal/src/components/FPEmployeeZonesView.jsx	{/* View Modal */}
admin-portal/src/pages/billing/PaymentLinks.jsx	{/* Detail Modal */}
admin-portal/src/pages/schedules/AllSchedulesPage.jsx	{/* View Details Modal */}
admin-portal/src/pages/schedules/ScheduleCalendar.jsx	{/* Schedule Detail Modal */}
admin-portal/src/pages/schedules/ScheduleService.jsx	{/* View Schedule Modal */}
admin-portal/src/pages/schedules/SchedulingCalendar.jsx	{/* Schedule Detail Modal */}
admin-portal/src/pages/schedules/SchedulingCalendar.jsx	{/* Day Detail Modal */}
admin-portal/src/pages/schedules/CancelledSchedulesPage.jsx	{/* Details Modal */}
admin-portal/src/pages/schedules/PendingPropertySchedules.jsx	{/* Services Modal - Simple compact lightbox */}
admin-portal/src/pages/UserManagement.jsx	{/* View User Details Modal */}
admin-portal/src/pages/CoordinatorEstimates.jsx	{/* View Service Modal */}
admin-portal/src/pages/ManagerEstimates.jsx	{/* View Service Modal */}
admin-portal/src/pages/SupervisorEstimates.jsx	{/* View Service Modal */}
admin-portal/src/pages/EmployeeZoneManagement.jsx	<Modal onClose={() => setViewZonesEmployee(null)}
admin-portal/src/pages/ManagerEmployeeZones.jsx	<Modal onClose={() => setViewZonesEmployee(null)}
admin-portal/src/pages/FPEmployeeZones.jsx	<Modal onClose={() => setViewZonesEmployee(null)}
admin-portal/src/pages/ComplaintsInbox.jsx	{viewing && (
admin-portal/src/pages/marketing/MarketingTracker.jsx	<Modal overlayClassName="lg:pl-72" className="w-full max-w-5xl
admin-portal/src/pages/marketing/MarketingComplaintForm.jsx	<Modal overlayClassName="lg:pl-72" className="w-full max-w-2xl
frontend/src/pages/Payment.jsx	const InvoiceDetailModal = (
frontend/src/pages/Payment.jsx	const CustomerReceiptModal = (
frontend/src/pages/Schedule.jsx	const VisitDetailModal = (
frontend/src/pages/Dashboard.jsx	{selectedWorkOrder && createPortal(
EOF
