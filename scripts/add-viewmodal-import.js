#!/usr/bin/env node
// Adds `import ViewModal, { ViewSection, ViewField, ViewGrid } from '<rel>/components/common/ViewModal';`
// after the existing `import Modal ...` line, but only when the file uses <ViewModal / ViewSection
// and lacks the import. Usage: node scripts/add-viewmodal-import.js <file>
const fs = require('fs');
const path = require('path');
const file = process.argv[2];
let src = fs.readFileSync(file, 'utf8');
if (!/<ViewModal|<ViewSection|<ViewField|<ViewGrid/.test(src)) { console.log(`${file}: no ViewModal usage`); process.exit(0); }
if (/from '.*components\/common\/ViewModal'/.test(src)) { console.log(`${file}: import exists`); process.exit(0); }

const norm = file.replace(/\\/g, '/');
let rel;
if (/admin-portal\/src\/pages\/(billing|schedules|marketing)\//.test(norm)) rel = '../../components/common/ViewModal';
else if (/admin-portal\/src\/pages\//.test(norm)) rel = '../components/common/ViewModal';
else if (/admin-portal\/src\/components\//.test(norm)) rel = './common/ViewModal';
else if (/frontend\/src\//.test(norm)) rel = '../components/common/ViewModal';
else { console.error(`no rule for ${file}`); process.exit(1); }

const imp = `import ViewModal, { ViewSection, ViewField, ViewGrid } from '${rel}';\n`;
const m = src.match(/^import Modal from '[^']+';\n/m);
if (m) src = src.replace(m[0], m[0] + imp);
else src = imp + src;
fs.writeFileSync(file, src);
console.log(`${file}: import added`);
