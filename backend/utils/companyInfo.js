/**
 * Who the estimate is from.
 *
 * The letterhead on every customer-facing estimate -- the view modal, the PDF download, the emailed
 * PDF and the email body -- is drawn from this one record, so the four never disagree about an
 * address or a phone number. Twin of `admin-portal/src/utils/companyInfo.js`; a test in
 * `backend/utils/companyInfo.test.js` compares them field by field.
 *
 * The name is set in two lines deliberately: XLAND INFRA, with PVT LTD ruled beneath it, as the
 * logo itself sets it.
 */

const COMPANY = {
  name: 'XLAND INFRA',
  suffix: 'PVT LTD',
  legalName: 'XLAND INFRA PVT LTD',
  tagline: 'Property Management Services',
  addressLines: ['D.No. 7-333/A/1, NRI Hospital Road', 'Mangalagiri, Guntur, 522503'],
  phone: '+91 8500 010 111',
  email: 'info@xlandinfra.com',
  website: 'www.xlandinfra.com'
};

/**
 * The contact lines under the address, in the order they are printed. The first element names the
 * icon drawn beside the line -- a handset, an envelope, a globe -- rather than a letter: `T`, `E`
 * and `W` read as initials of nothing in particular. Every surface draws the same three kinds.
 */
const COMPANY_CONTACT_LINES = [
  ['phone', COMPANY.phone],
  ['email', COMPANY.email],
  ['website', COMPANY.website]
];

/** One line for a footer: the legal name and the two ways to reach it. */
const COMPANY_FOOTER_LINE = `${COMPANY.legalName}  |  ${COMPANY.email}  |  ${COMPANY.phone}`;

module.exports = { COMPANY, COMPANY_CONTACT_LINES, COMPANY_FOOTER_LINE };
