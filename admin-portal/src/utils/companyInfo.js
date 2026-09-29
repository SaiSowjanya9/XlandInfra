/**
 * Who the estimate is from (portal side).
 *
 * Twin of `backend/utils/companyInfo.js`: the view modal and the PDF download read these, the
 * backend's PDF and email read the other, and `backend/utils/companyInfo.test.js` compares them so
 * a change to one without the other fails the tests rather than the customer's copy.
 */

export const COMPANY = {
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
export const COMPANY_CONTACT_LINES = [
  ['phone', COMPANY.phone],
  ['email', COMPANY.email],
  ['website', COMPANY.website]
];

/** One line for a footer: the legal name and the two ways to reach it. */
export const COMPANY_FOOTER_LINE = `${COMPANY.legalName}  |  ${COMPANY.email}  |  ${COMPANY.phone}`;

/** The logo icon on its own, as the letterhead sets it beside the typeset name. */
export const COMPANY_LOGO_ICON = '/logo-icon.png';
