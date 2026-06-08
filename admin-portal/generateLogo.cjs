const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, 'public', 'logo.png');
const logoBase64 = fs.readFileSync(logoPath).toString('base64');
const content = `// Auto-generated file - XLand Infra Logo Base64
export const XLAND_LOGO = "data:image/png;base64,${logoBase64}";
`;

fs.writeFileSync(path.join(__dirname, 'src', 'utils', 'logoBase64.js'), content);
console.log('Logo base64 file generated successfully!');
