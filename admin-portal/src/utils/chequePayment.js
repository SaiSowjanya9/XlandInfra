/**
 * Cheque details shared by the two screens that capture them: recording a cheque payment
 * (pages/billing/MakePayments.jsx) and verifying one (pages/billing/Payments.jsx). Both read this
 * list, so the two screens can never offer different banks, and both prefill the same payee.
 */

export const CHEQUE_BANKS = [
  'State Bank of India',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'Indian Bank',
  'Bank of India',
  'Central Bank of India',
  'Indian Overseas Bank',
  'UCO Bank',
  'IDBI Bank',
  'Kotak Mahindra Bank',
  'IndusInd Bank',
  'Yes Bank',
  'Federal Bank',
  'South Indian Bank',
  'Karur Vysya Bank'
];

/**
 * Chosen when the cheque is drawn on a bank the list does not carry. The name is then typed into a
 * text field, so 'Other' is never saved as the bank itself.
 */
export const OTHER_BANK = 'Other';

/**
 * A cheque is made out to XLAND, so the payee field starts with this name. It stays editable: the
 * user can clear it and write whatever the cheque actually says.
 */
export const DEFAULT_PAYEE_NAME = 'XLAND INFRA PM SERVICES PVT LTD';

/** Cash and cheques are collected either at the office or at the property itself. */
export const paymentLocationLabel = (location) =>
  location === 'property_site' ? 'At Property Site' : 'Office / Collection Point';
