// The one work order ID format: "WO-" followed by digits, e.g. WO-1783455968280.
//
// Eight places used to make their own, so the list mixed WO-1783455968280 with base-36 codes such
// as WO-MTWCEEFE-0P6H (customer requests and the visit schedulers) and 17-digit ones (admin). Every
// work order is now numbered here.
//
// The number is the creation time in milliseconds, kept strictly increasing within the process:
// work_order_id is UNIQUE, and a scheduler creating several work orders in one loop used to land
// two in the same millisecond, which failed the insert for the second.
let lastIssued = 0;

// The ID for a given millisecond; only the renumbering script needs it directly
const formatWorkOrderId = milliseconds => `WO-${Math.trunc(milliseconds)}`;

const generateWorkOrderId = (now = Date.now()) => {
  lastIssued = now > lastIssued ? now : lastIssued + 1;
  return formatWorkOrderId(lastIssued);
};

const isNumericWorkOrderId = value => /^WO-\d+$/.test(String(value ?? ''));

module.exports = { generateWorkOrderId, formatWorkOrderId, isNumericWorkOrderId };
