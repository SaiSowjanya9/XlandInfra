const { sendEmail } = require('./emailService');
const { generateReceiptPDF } = require('./pdfService');

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
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <!-- Header with checkmark -->
        <div style="display: flex; align-items: center; margin-bottom: 5px;">
          <div style="width: 40px; height: 40px; background-color: #22c55e; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 15px;">
            <span style="color: white; font-size: 20px;">✓</span>
          </div>
          <div style="display: inline-block; vertical-align: middle;">
            <h1 style="margin: 0; font-size: 22px; color: #1f2937;">You paid ₹${amountPaid.toLocaleString('en-IN')}</h1>
          </div>
        </div>
        <p style="color: #6b7280; margin: 0 0 25px 55px; font-size: 14px;">to XLAND INFRA on ${paymentDateFormatted}</p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

        <!-- Payment Details -->
        <h2 style="font-size: 18px; color: #1f2937; margin-bottom: 20px;">Payment details</h2>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Invoice no.</td>
            <td style="padding: 10px 0; text-align: right; color: #3b82f6; font-size: 14px;">${paymentData.invoiceId || paymentData.paymentId}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Invoice amount</td>
            <td style="padding: 10px 0; text-align: right; color: #1f2937; font-size: 14px;">₹${invoiceTotal.toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Amount paid</td>
            <td style="padding: 10px 0; text-align: right; color: #1f2937; font-size: 14px; font-weight: bold;">₹${amountPaid.toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Remaining balance</td>
            <td style="padding: 10px 0; text-align: right; color: ${currentBalance <= 0 ? '#22c55e' : '#ef4444'}; font-size: 14px; font-weight: bold;">${balanceText}</td>
          </tr>
        </table>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Status</td>
            <td style="padding: 10px 0; text-align: right; color: ${currentBalance <= 0 ? '#22c55e' : '#f59e0b'}; font-size: 14px; font-weight: bold;">${statusText}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Payment method</td>
            <td style="padding: 10px 0; text-align: right; color: #1f2937; font-size: 14px;">${methodLabel}</td>
          </tr>
          ${paymentData.transactionReference || paymentData.referenceNumber ? `<tr>
            <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Reference ID</td>
            <td style="padding: 10px 0; text-align: right; color: #1f2937; font-size: 14px;">${paymentData.transactionReference || paymentData.referenceNumber}</td>
          </tr>` : ''}
        </table>

        <p style="color: #6b7280; font-size: 12px; margin-top: 30px; line-height: 1.5;">
          Please don't reply to this email, if you need any help regarding this message, please contact the business directly.
        </p>

        <p style="color: #1f2937; font-size: 14px; margin-top: 25px;">Thank you,</p>
        <p style="color: #1f2937; font-size: 14px; font-weight: bold; margin-top: 5px;">XLAND INFRA PM SERVICES PVT LTD</p>
      </div>
    `,
    attachments: [{
      filename: `Receipt_${paymentData.paymentId}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }]
  });
};

module.exports = { sendReceiptEmail };
