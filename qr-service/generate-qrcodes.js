/**
 * QR Code Generator for XLAND INFRA
 * Generates QR codes for:
 * 1. Main Website: https://xlandinfra.com
 * 2. Customer Portal: https://xlandinfra.com/login
 */

const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Define URLs
const URLS = {
  website: {
    url: 'https://xlandinfra.com',
    name: 'XLAND_INFRA_Website',
    description: 'Main Website'
  },
  customerPortal: {
    url: 'https://xlandinfra.com/login',
    name: 'XLAND_INFRA_Customer_Portal',
    description: 'Customer Portal Login'
  }
};

// Output directory
const OUTPUT_DIR = path.join(__dirname, 'qr-codes');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// QR Code options
const qrOptions = {
  errorCorrectionLevel: 'H',
  type: 'png',
  quality: 0.92,
  margin: 2,
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  },
  width: 400
};

async function generateQRCodes() {
  console.log('\n========================================');
  console.log('   XLAND INFRA QR Code Generator');
  console.log('========================================\n');

  for (const [key, config] of Object.entries(URLS)) {
    const filePath = path.join(OUTPUT_DIR, `${config.name}.png`);
    
    try {
      // Generate PNG file
      await QRCode.toFile(filePath, config.url, qrOptions);
      console.log(`✅ ${config.description}`);
      console.log(`   URL: ${config.url}`);
      console.log(`   File: ${filePath}\n`);

      // Also print ASCII version to console
      console.log(`   ASCII Preview for ${config.description}:`);
      const ascii = await QRCode.toString(config.url, { type: 'terminal', small: true });
      console.log(ascii);
      console.log('----------------------------------------\n');
    } catch (err) {
      console.error(`❌ Failed to generate QR for ${config.description}:`, err.message);
    }
  }

  console.log('========================================');
  console.log('   QR Codes saved to: ' + OUTPUT_DIR);
  console.log('========================================\n');
}

generateQRCodes();
