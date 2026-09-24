/**
 * Human-readable identifiers for payments and receipts.
 *
 * These live outside the payments router because a payment row is also written by the
 * Razorpay webhook and by the payment-success callback. All of them must draw from the
 * same sequence tables, or an online payment would get an ID in a different shape from
 * the PAY-<year>-<n> numbers the Payments screen shows for everything else.
 */

const { pool } = require('../config/database');

// Generate unique payment ID (Format: PAY-2025-00001)
const generatePaymentId = async (fpId = null) => {
  const year = new Date().getFullYear();
  const prefix = 'PAY';

  try {
    const [existing] = await pool.execute(
      'SELECT current_number FROM payment_sequence WHERE franchise_partner_id <=> ? AND year = ?',
      [fpId, year]
    );

    let nextNumber;
    if (existing.length > 0) {
      nextNumber = existing[0].current_number + 1;
      await pool.execute(
        'UPDATE payment_sequence SET current_number = ? WHERE franchise_partner_id <=> ? AND year = ?',
        [nextNumber, fpId, year]
      );
    } else {
      nextNumber = 1;
      await pool.execute(
        'INSERT INTO payment_sequence (franchise_partner_id, year, current_number, prefix) VALUES (?, ?, ?, ?)',
        [fpId, year, nextNumber, prefix]
      );
    }

    return `${prefix}-${year}-${String(nextNumber).padStart(5, '0')}`;
  } catch (error) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }
};

// Generate unique receipt ID (format: RCP-00001)
const generateReceiptId = async (fpId = null) => {
  const prefix = 'RCP';

  try {
    // Get max receipt number across all receipts (global sequence)
    const [existing] = await pool.execute(
      'SELECT MAX(current_number) as max_number FROM receipt_sequence WHERE franchise_partner_id <=> ?',
      [fpId]
    );

    let nextNumber;
    if (existing.length > 0 && existing[0].max_number) {
      nextNumber = existing[0].max_number + 1;
      await pool.execute(
        'UPDATE receipt_sequence SET current_number = ? WHERE franchise_partner_id <=> ?',
        [nextNumber, fpId]
      );
    } else {
      // Check if sequence record exists
      const [seqExists] = await pool.execute(
        'SELECT id FROM receipt_sequence WHERE franchise_partner_id <=> ?',
        [fpId]
      );

      nextNumber = 1;
      if (seqExists.length > 0) {
        await pool.execute(
          'UPDATE receipt_sequence SET current_number = ? WHERE franchise_partner_id <=> ?',
          [nextNumber, fpId]
        );
      } else {
        await pool.execute(
          'INSERT INTO receipt_sequence (franchise_partner_id, year, current_number, prefix) VALUES (?, ?, ?, ?)',
          [fpId, new Date().getFullYear(), nextNumber, prefix]
        );
      }
    }

    // Format: RCP-00001
    return `${prefix}-${String(nextNumber).padStart(5, '0')}`;
  } catch (error) {
    console.error('Error generating receipt ID:', error);
    const timestamp = Date.now().toString(36).toUpperCase();
    return `${prefix}-${timestamp}`;
  }
};

module.exports = { generatePaymentId, generateReceiptId };
