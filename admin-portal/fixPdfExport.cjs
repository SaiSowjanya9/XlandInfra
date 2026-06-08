const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'utils', 'pdfExport.js');
let content = fs.readFileSync(filePath, 'utf8');

// Remove the old XLAND_LOGO_BASE64 constant (lines 7-9)
// Match from the comment to the end of the declaration
const regex = /\n\/\/ XLand Infra Logo as base64 \(gold\/dark blue themed\)\nconst XLAND_LOGO_BASE64 = '[^']*';\n/;

if (regex.test(content)) {
  content = content.replace(regex, '\n');
  fs.writeFileSync(filePath, content);
  console.log('Successfully removed old XLAND_LOGO_BASE64 constant');
} else {
  console.log('Pattern not found - constant may already be removed');
}
