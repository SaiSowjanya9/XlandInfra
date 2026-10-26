const { sendEmail } = require('./emailService');
const { generateReceiptPDF } = require('./pdfService');
const { brandEmailHeader, BRAND_HEAD, BRAND_LOGO_ATTACHMENT, keepWhite } = require('../utils/emailBrandHeader');

const METHOD_LABELS = {
  razorpay: 'Card/Net Banking',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  check: 'Cheque'
};

const methodLabelFor = (paymentData) =>
  paymentData.methodLabel || METHOD_LABELS[paymentData.paymentMethod] || paymentData.paymentMethod || '-';

/**
 * Builds and sends the customer-facing payment receipt email (HTML + PDF attachment)
 * through the shared transporter. paymentData is the same shape used by the staff
 * receipt modal and the /receipt API: paymentId, invoiceId, customerName,
 * customerEmail, propertyName, amount, invoiceAmount, balanceAmount, paymentMethod,
 * paymentDate, transactionReference, referenceNumber, status.
 *
 * Returns the sendEmail result — the caller decides whether to mark receipt_sent.
 */
const sendReceiptEmail = async (paymentData) => {
  const customerEmail = paymentData.customerEmail;
  if (!customerEmail) return { success: false, error: 'Customer email not found' };

  const pdfBuffer = await generateReceiptPDF(paymentData);

  const amountPaid = parseFloat(paymentData.amount) || 0;
  const invoiceTotal = parseFloat(paymentData.invoiceAmount) || amountPaid;
  const currentBalance = parseFloat(paymentData.balanceAmount) || 0;
  const paymentDateFormatted = paymentData.paymentDate
    ? new Date(paymentData.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const balanceText = currentBalance <= 0 ? '₹0' : `₹${currentBalance.toLocaleString('en-IN')}`;
  const statusText = currentBalance <= 0 ? 'Fully Paid' : 'Partially Paid';
  const methodLabel = methodLabelFor(paymentData);

  return sendEmail({
    to: customerEmail,
    subject: `Payment Receipt - ₹${amountPaid.toLocaleString('en-IN')} | XLAND INFRA`,
    // The same dark + gold family the activation and reset emails use — a receipt from us
    // should look like it came from the same house as the account welcome
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">${BRAND_HEAD}
      </head>
      <body class="body" style="margin: 0; padding: 0; background-color: #0D0D0D;">
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #0D0D0D;">
        <!-- Header -->${brandEmailHeader()}

        <!-- Main content -->
        <div style="background: linear-gradient(180deg, #1a1a1a 0%, #141414 100%); padding: 40px 30px; border: 1px solid #D8B25C33; border-top: none; border-bottom: none;">
          <h2 style="color: #D8B25C; margin: 0 0 8px 0; font-size: 24px; font-weight: 400;">Payment Received</h2>
          <p style="color: #cccccc; font-size: 15px; line-height: 1.8; margin: 0 0 25px 0;">
            Thank you, <strong style="color: #ffffff;">${keepWhite(paymentData.customerName || 'Customer')}</strong> — we received
            <strong style="color: #D8B25C;">₹${amountPaid.toLocaleString('en-IN')}</strong>
            on ${paymentDateFormatted}. Your receipt is attached as a PDF.
          </p>

          <!-- Payment details -->
          <div style="background: #0D0D0D; border: 1px solid #D8B25C44; border-radius: 12px; padding: 25px; margin: 25px 0;">
            <h3 style="color: #D8B25C; margin: 0 0 18px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">Payment Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px;">Receipt No.</td>
                <td style="padding: 8px 0; text-align: right; color: #D8B25C; font-size: 13px; font-family: monospace;">${paymentData.receiptId || paymentData.paymentId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px;">Payment ID</td>
                <td style="padding: 8px 0; text-align: right; color: #ffffff; font-size: 13px; font-family: monospace;">${paymentData.paymentId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px;">Invoice</td>
                <td style="padding: 8px 0; text-align: right; color: #ffffff; font-size: 13px;">${paymentData.invoiceId || '-'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px;">Invoice Amount</td>
                <td style="padding: 8px 0; text-align: right; color: #ffffff; font-size: 13px;">₹${invoiceTotal.toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px;">Amount Paid</td>
                <td style="padding: 8px 0; text-align: right; color: #D8B25C; font-size: 14px; font-weight: bold;">₹${amountPaid.toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px;">Remaining Balance</td>
                <td style="padding: 8px 0; text-align: right; color: ${currentBalance <= 0 ? '#4ade80' : '#fbbf24'}; font-size: 13px; font-weight: bold;">${balanceText}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px;">Status</td>
                <td style="padding: 8px 0; text-align: right; color: ${currentBalance <= 0 ? '#4ade80' : '#fbbf24'}; font-size: 13px; font-weight: bold;">${statusText}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px;">Payment Method</td>
                <td style="padding: 8px 0; text-align: right; color: #ffffff; font-size: 13px;">${methodLabel}</td>
              </tr>
              ${paymentData.transactionReference || paymentData.referenceNumber ? `<tr>
                <td style="padding: 8px 0; color: #888; font-size: 13px;">Reference ID</td>
                <td style="padding: 8px 0; text-align: right; color: #ffffff; font-size: 13px; font-family: monospace;">${paymentData.transactionReference || paymentData.referenceNumber}</td>
              </tr>` : ''}
            </table>
          </div>

          <p style="color: #888; font-size: 12px; margin: 25px 0 0 0; line-height: 1.6;">
            Please don't reply to this email — if you need help, contact us directly.
          </p>

          <p style="color: #cccccc; font-size: 14px; margin: 25px 0 0 0;">Thank you,<br>
          <strong style="color: #D8B25C;">XLAND INFRA PM SERVICES PVT LTD</strong></p>
        </div>

        <!-- Footer -->
        <div style="background: #0D0D0D; padding: 25px 30px; border-radius: 0 0 16px 16px; border: 1px solid #D8B25C33; border-top: 2px solid #D8B25C;">
          <p style="color: #444; font-size: 11px; margin: 0; text-align: center;">
            © ${new Date().getFullYear()} XLAND INFRA Pvt Ltd. All rights reserved.
          </p>
        </div>
      </div>
      </body>
      </html>
    `,
    attachments: [BRAND_LOGO_ATTACHMENT, {
      filename: `Receipt_${paymentData.paymentId}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }]
  });
};

module.exports = { sendReceiptEmail };
