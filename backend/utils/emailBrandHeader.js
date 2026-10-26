const path = require('path');

/**
 * The dark + gold letterhead shared by the receipt and welcome emails: logo.png on the left,
 * "XLAND INFRA / PRIVATE LIMITED" centred.
 *
 * The Gmail apps' dark mode inverts solid background colours and light text but leaves a
 * background-image alone, so the gradient header stayed dark while its white "XLAND" was flipped to
 * near-black and vanished. The gmail-blend classes undo that inversion (Gmail puts a <u> before the
 * element it turns <body class="body"> into, so `u + .body` matches nowhere else); the header also
 * carries a solid colour under the gradient for clients that drop background-image.
 */

const BRAND_LOGO_CID = 'xland-brand-logo';
const BRAND_LOGO_ATTACHMENT = {
  filename: 'logo.png',
  path: path.join(__dirname, '../assets/logo.png'),
  cid: BRAND_LOGO_CID
};

// Goes inside <head>
const BRAND_HEAD = `
        <meta name="color-scheme" content="dark">
        <meta name="supported-color-schemes" content="dark">
        <style>
          u + .body .gmail-blend-screen { background: #000000; mix-blend-mode: screen; }
          u + .body .gmail-blend-difference { background: #000000; mix-blend-mode: difference; }
        </style>`;

// Text that must stay white under Gmail's dark-mode inversion
const keepWhite = (html) =>
  `<span class="gmail-blend-screen" style="display: inline-block;"><span class="gmail-blend-difference" style="display: inline-block; color: #ffffff;">${html}</span></span>`;

// 400x328 source, drawn at 60px tall
const brandEmailHeader = () => `
          <div style="padding: 24px 20px; background-color: #141414; background-image: linear-gradient(135deg, #1a1a1a 0%, #0D0D0D 100%); border-radius: 16px 16px 0 0; border: 1px solid #D8B25C33; border-bottom: none;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
              <tr>
                <td width="73" valign="middle" style="width: 73px;">
                  <img src="cid:${BRAND_LOGO_CID}" alt="XLAND INFRA" width="73" height="60" style="display: block; width: 73px; height: 60px; border: 0;">
                </td>
                <td valign="middle" align="center" style="text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; letter-spacing: 2px;">${keepWhite('XLAND')}<span style="color: #D8B25C;">INFRA</span></h1>
                  <p style="margin: 5px 0 0 0; color: #888888; font-size: 11px; letter-spacing: 3px;">PRIVATE LIMITED</p>
                </td>
                <td width="73" style="width: 73px;">&nbsp;</td>
              </tr>
            </table>
          </div>`;

module.exports = { brandEmailHeader, BRAND_HEAD, BRAND_LOGO_ATTACHMENT, BRAND_LOGO_CID, keepWhite };
