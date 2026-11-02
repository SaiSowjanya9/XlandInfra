# -*- coding: utf-8 -*-
"""Generates XLand Infra — Technical Architecture & Project Model (.docx)."""
import re
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

DARK = RGBColor(0x1F, 0x29, 0x37)
ACCENT = RGBColor(0x92, 0x40, 0x0E)   # warm amber-brown
MUTED = RGBColor(0x6B, 0x72, 0x80)
CODE_RGB = RGBColor(0x33, 0x41, 0x55)

doc = Document()

# ---------- base styles ----------
st = doc.styles['Normal']
st.font.name = 'Calibri'
st.font.size = Pt(11)
st.font.color.rgb = DARK
st.paragraph_format.space_after = Pt(6)
st.paragraph_format.line_spacing = 1.15

for name, size, color, before in [('Heading 1', 18, ACCENT, 18), ('Heading 2', 14, DARK, 14), ('Heading 3', 12, ACCENT, 10)]:
    s = doc.styles[name]
    s.font.name = 'Calibri'
    s.font.size = Pt(size)
    s.font.bold = True
    s.font.color.rgb = color
    s.paragraph_format.space_before = Pt(before)
    s.paragraph_format.space_after = Pt(6)
    s.paragraph_format.keep_with_next = True

def set_bg(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:fill'), hex_color)
    tcPr.append(shd)

def h1(text):
    return doc.add_paragraph(text, style='Heading 1')

def h2(text):
    return doc.add_paragraph(text, style='Heading 2')

def h3(text):
    return doc.add_paragraph(text, style='Heading 3')

BOLD_RE = re.compile(r'\*\*(.+?)\*\*')

def add_rich(p, text):
    """Add runs, honoring **bold** and `code` markup."""
    # split on code first
    pos = 0
    for m in re.finditer(r'`([^`]+)`', text):
        chunk = text[pos:m.start()]
        _emit_bold(p, chunk)
        r = p.add_run(m.group(1))
        r.font.name = 'Consolas'
        r.font.size = Pt(9.5)
        r.font.color.rgb = CODE_RGB
        pos = m.end()
    _emit_bold(p, text[pos:])

def _emit_bold(p, chunk):
    pos = 0
    for m in BOLD_RE.finditer(chunk):
        p.add_run(chunk[pos:m.start()])
        b = p.add_run(m.group(1))
        b.bold = True
        pos = m.end()
    p.add_run(chunk[pos:])

def para(text, italic=False, space_after=None):
    p = doc.add_paragraph()
    add_rich(p, text)
    if italic:
        for r in p.runs:
            r.italic = True
    if space_after is not None:
        p.paragraph_format.space_after = Pt(space_after)
    return p

def bullets(items, style='List Bullet'):
    for it in items:
        p = doc.add_paragraph(style=style)
        if isinstance(it, str):
            add_rich(p, it)
        else:  # (text, level)
            p.style = 'List Bullet 2'
            add_rich(p, it)

def code(lines):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.left_indent = Inches(0.2)
    pf = p.paragraph_format
    for i, ln in enumerate(lines):
        r = p.add_run(('\n' if i else '') + ln)
        r.font.name = 'Consolas'
        r.font.size = Pt(8.5)
        r.font.color.rgb = CODE_RGB
    # light border on the paragraph
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    for edge in ('top', 'left', 'bottom', 'right'):
        e = OxmlElement(f'w:{edge}')
        e.set(qn('w:val'), 'single'); e.set(qn('w:sz'), '4')
        e.set(qn('w:space'), '4'); e.set(qn('w:color'), 'D9D2C4')
        pBdr.append(e)
    pPr.append(pBdr)
    shd = OxmlElement('w:shd'); shd.set(qn('w:val'), 'clear'); shd.set(qn('w:fill'), 'FAF7F2')
    pPr.append(shd)
    return p

def table(rows, widths=None, header=True):
    t = doc.add_table(rows=len(rows), cols=len(rows[0]))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = True
    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            cell = t.cell(ri, ci)
            cell.text = ''
            p = cell.paragraphs[0]
            add_rich(p, str(val))
            for r in p.runs:
                r.font.size = Pt(9.5)
            if header and ri == 0:
                set_bg(cell, 'F3E7D3')
                for r in p.runs:
                    r.bold = True
            if widths:
                cell.width = Inches(widths[ci])
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t

def page_break():
    doc.add_page_break()

# ---------- footer ----------
footer = doc.sections[0].footer
fp = footer.paragraphs[0]
fp.text = 'XLand Infra — Technical Architecture & Project Model  |  Confidential'
fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
for r in fp.runs:
    r.font.size = Pt(8); r.font.color.rgb = MUTED

# =====================================================================
# TITLE PAGE
# =====================================================================
for _ in range(6):
    doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('XLand Infra'); r.font.size = Pt(40); r.bold = True; r.font.color.rgb = ACCENT
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('Property Management Platform'); r.font.size = Pt(22); r.font.color.rgb = DARK
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('Technical Architecture & Project Model Document'); r.font.size = Pt(16); r.font.color.rgb = MUTED
doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('Backend · Frontend · Database — Design, Methodologies, and Implementation Locations')
r.font.size = Pt(11); r.italic = True; r.font.color.rgb = MUTED
for _ in range(8):
    doc.add_paragraph()
table([
    ['Document', 'Technical Architecture & Project Model'],
    ['Product', 'XLand Infra — multi-tenant property-maintenance management'],
    ['Stack', 'Node.js / Express · React 18 / Vite · MySQL 8 · WebSocket · Razorpay'],
    ['Date', 'November 2026'],
    ['Status', 'Living document — reflects the repository as-built'],
], widths=[1.6, 4.8])
page_break()

# =====================================================================
# CONTENTS
# =====================================================================
h1('Contents')
toc = [
    ('1', 'Executive Summary'),
    ('2', 'Project Model — What the System Is and How the Business Flows'),
    ('3', 'High-Level Architecture'),
    ('4', 'Technology Stack'),
    ('5', 'Backend — Design, Structure, and Implementation'),
    ('6', 'Database — Schema, Access Patterns, and Migration Methodology'),
    ('7', 'Frontend Applications — Design and Implementation'),
    ('8', 'End-to-End Data Flows'),
    ('9', 'Security Model'),
    ('10', 'Architectural Methodologies & Design Principles'),
    ('11', 'Environments, Configuration & Deployment'),
    ('12', 'Testing & Verification'),
    ('A', 'Appendix — Directory Map & API Surface'),
]
for num, title in toc:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(f'{num}.  '); r.bold = True; r.font.color.rgb = ACCENT
    p.add_run(title)
page_break()

# =====================================================================
# 1. EXECUTIVE SUMMARY
# =====================================================================
h1('1. Executive Summary')
para('**XLand Infra** is a multi-tenant, franchise-based **property-maintenance and facility-management platform**. '
     'It manages the complete lifecycle of a maintenance contract: a property is onboarded, a priced estimate (usually built from an '
     'Annual Maintenance Contract — AMC — package) is sent to the customer, the customer approves it online, an invoice is generated, '
     'payment is collected (online via Razorpay or offline via cash / cheque / bank transfer), and recurring service visits are then '
     'scheduled automatically — vendors are assigned, work orders are generated ahead of each visit, and the work is tracked to closure.')
para('The product is delivered as a **layered, monorepo-style architecture** on one VPS:')
bullets([
    '**Customer Portal** (`frontend/`) — a React 18 / Vite single-page app serving the public marketing website and the resident/customer portal (work-order requests, schedules, invoices, online payments). Production domain: `xlandinfra.com`.',
    '**Admin / Staff Portal** (`admin-portal/`) — a second React 18 / Vite SPA that hosts the Admin portal plus six staff portals — Franchise Partner (FP), Manager, Coordinator, Supervisor, Executive, Vendor — under URL prefixes such as `/fp`, `/manager`, `/coordinator`. Production domain: `admin.xlandinfra.com`.',
    '**Backend API** (`backend/`) — a single Node.js / Express application (port 5000, managed by PM2) that serves both front-ends, exposes ~30 top-level `/api/*` route families, embeds a WebSocket server at `/ws` for real-time sync, and runs cron schedulers for automatic work-order generation and contract renewal.',
    '**MySQL 8 database** — one database per environment (`xland_pm` in production, `customer_portal_local` in development) containing ~120 tables covering properties, estimates, invoices, payments, scheduling, QR analytics, marketing, and access control.',
    '**QR Redirect Service** (`qr-service/`) — a small standalone Express service (port 3500, PM2 cluster mode) behind `qr.xlandinfra.com` that resolves printed QR codes to redirect URLs and records per-scan analytics.',
])
para('The defining engineering methodology is **defensive, convention-driven development**: shared logic is centralized into single '
     'modules (ID generators, invoice settlement, refund ledger, schema guards), database migrations are written to be **idempotent** '
     'and the application **self-repairs schema drift at boot and at write-time**, and every hard-won production lesson is codified in '
     '`AGENTS.md` and `.devin/rules/` — a convention document (~1,900 lines) that serves as the authoritative design contract for the codebase.')

# =====================================================================
# 2. PROJECT MODEL
# =====================================================================
page_break()
h1('2. Project Model — What the System Is and How the Business Flows')

h2('2.1 Actors and Portals')
para('Access is organized around a strict role hierarchy. Each role maps to a portal UI and to a scoped set of backend routes.')
table([
    ['Actor', 'Portal / Login', 'Purpose in the model'],
    ['Admin / Operations Manager', 'Employee portal (`/employee`, `/admin` routes)', 'Full system control; oversees all franchise partners, estimates, schedules, billing, users, QR management.'],
    ['Franchise Partner (FP)', '`/fp` portal', 'An independent operator running the business in its territory. Owns its own properties, vendors, employees, estimates, invoices and marketing — fully isolated from other FPs.'],
    ['Manager', '`/manager` portal', 'Works under an FP. Full operational access — estimates, schedules, vendor assignment, work-order closure — filtered to assigned zones.'],
    ['Coordinator', '`/coordinator` portal', 'Field coordination — properties, vendors, employees by zone.'],
    ['Supervisor', '`/supervisor` portal', 'Raises and tracks work-order requests; largely view-only for estimates/schedules.'],
    ['Executive', '`/executive` portal', 'Data entry — client and vendor details.'],
    ['Vendor', '`/vendor` portal', 'External service provider. Accepts assigned work orders and updates status (Assigned → Accepted → In Progress → Completed). Cannot close a work order.'],
    ['Customer / Resident', 'Customer portal (`xlandinfra.com`)', 'Owns one login per email tied to one property. Raises work-order requests, views schedules, approves estimates, pays invoices, tracks complaints.'],
])
para('Role definitions, the module-access matrix and workflow rules are centralized in `backend/config/roles.js` and enforced by '
     '`backend/middleware/rbac.js` (requireRole, requireModuleAccess, adminOnly, managerOrAdmin, canAssign, canClose, etc.).')

h2('2.2 The Money-to-Work Chain')
para('The canonical business pipeline — the single mental model the whole codebase is organized around:')
code([
    'Property (onboarded)',
    '   → Estimate  (fp_estimates / estimates — property_based | direct | work_order | custom)',
    '   → Customer approval via emailed action link',
    '   → Invoice  (invoices, INV-nnnnn)',
    '   → Payment  (payments, PAY-<year>-n; receipt RCP-n; online Razorpay or offline)',
    '   → Pending Property Schedule  (pending_property_schedules)',
    '   → Schedule Series + Occurrences  (schedule_series, schedule_occurrences)',
    '   → Work Order auto-generated 7 days before each visit  (work_orders, WO-<ms>)',
    '   → Vendor executes → verifies → closes',
    '   → Contract auto-renewal  (schedule_renewals)',
])
bullets([
    '**Estimates** are either *property-based* or *direct*, and are built from an **AMC package** (a reusable service bundle priced from `fp_amc_packages.base_price`) or **custom services** drawn from the **service catalog** (`service_catalog` — pricing by area, capacity slab, manpower, unit, or fixed).',
    '**Invoices** carry per-FP numbering (`invoice_sequence`), a due date (+14 days), GST (stored on the document, defaulting to 0 — invoice GST is deliberately *delinked* from the estimate’s GST).',
    '**Payments** settle invoices. Settled money is *payments minus processed refunds*; invoice `amount_paid`/`balance_amount`/`payment_status`/`paid_at` are a **recomputed cache**, never incremented — recomputed by `resyncInvoiceSettlement()` inside the writer’s transaction.',
    '**Scheduling** is vendor- and frequency-aware: each service on a property gets its own series of recurring visits, vendors are matched on service capability + zone + availability, and `workOrderScheduler` creates work orders 7 days out.',
])

h2('2.3 Multi-Tenancy Model')
para('The platform is **multi-tenant by franchise partner**, implemented as **row-level scoping on a shared schema** rather than '
     'separate databases. Every tenant-owned table carries `franchise_partner_id` (NULL = head office / admin). Scope is enforced in two layers:')
bullets([
    '**Authentication layer** — the JWT carries `id`, `role`, and (for FP users and their employees) `franchisePartnerId` / `fpId` / `managerId` / `coordinatorId` / `supervisorId` / `executiveId` (`middleware/auth.js::generateToken`).',
    '**Scope middleware** — `attachFPScope`, `attachManagerScope`, `attachCoordinatorScope`, `attachSupervisorScope`, `attachExecutiveScope` resolve `req.franchisePartnerId` and the employee id from `users` / `fp_employees`, so every query can be filtered to the partner.',
    '**Zone-level filtering** — `middleware/zoneHelper.js` reads `fp_employee_zones` to restrict an employee to assigned zones; no assigned zones means *no data* (fail-closed), except the special `__ALL__` unrestricted marker.',
    '**ID sequences are per-FP** (`payment_sequence`, `receipt_sequence`, `invoice_sequence`, `id_sequences`) while the codes themselves (`PAY-…`, `INV-…`, `RCP-…`) are unique system-wide via UNIQUE constraints — `utils/paymentIds.js::firstFreeNumber` walks forward to the first unused code.',
])

# =====================================================================
# 3. HIGH-LEVEL ARCHITECTURE
# =====================================================================
page_break()
h1('3. High-Level Architecture')
h2('3.1 Topology')
para('A classic three-tier web architecture with an additional standalone analytics microservice. Everything runs on a single Hostinger VPS behind Nginx.')
code([
    '                         ┌───────────────────────────────────────────┐',
    ' Browser / Customer      │                NGINX (TLS, reverse proxy) │',
    ' ─────────────►  xlandinfra.com        ──►  frontend/dist (React SPA) │',
    ' Browser / Staff         │  admin.xlandinfra.com ─► admin/dist (SPA)  │',
    '                         │  qr.xlandinfra.com    ──► qr-service :3500  │',
    '                         └───────┬───────────────────────┬─────────────┘',
    '                                 │ /api/*  proxy         │  (own pool)',
    '                                 ▼                       │',
    '                    ┌────────────────────────┐           │',
    '                    │  Backend Express API   │           │',
    '                    │  Node.js :5000  (PM2)  │           │',
    '                    │  REST + WebSocket /ws  │           │',
    '                    │  + node-cron schedulers│           │',
    '                    └───────────┬────────────┘           │',
    '                                │ mysql2 pool            │',
    '                                ▼                       ▼',
    '                    ┌──────────────────────────────────────┐',
    '                    │        MySQL 8  (xland_pm)            │',
    '                    │   ~120 tables, one shared schema      │',
    '                    └──────────────────────────────────────┘',
    '   External: Razorpay (payments + webhooks) · SMTP/Nodemailer · OpenStreetMap/Leaflet',
])
h2('3.2 Component Responsibilities')
table([
    ['Component', 'Technology', 'Responsibility', 'Key entry points'],
    ['Backend API', 'Node.js + Express 4', 'All business logic, REST, auth, RBAC, payments, scheduling, PDF/email, WebSocket, cron', '`backend/server.js`'],
    ['Customer Portal', 'React 18 + Vite + Tailwind', 'Public site + resident portal (work orders, schedules, invoices, pay)', '`frontend/src/main.jsx`, `App.jsx`'],
    ['Admin / Staff Portal', 'React 18 + Vite + Tailwind', 'Six staff portals + vendor + customer-screens under `/employee`, `/fp`, `/manager`…', '`admin-portal/src/main.jsx`, `App.jsx`'],
    ['QR Service', 'Node.js + Express', 'QR slug → redirect + per-scan analytics (UA parsing, bot detection, geo)', '`qr-service/server.js`'],
    ['Database', 'MySQL 8', 'Single relational store shared by all components', '`backend/config/database.js`'],
    ['Payments', 'Razorpay (hosted)', 'Payment Links/Checkout, webhooks, refunds', '`backend/routes/razorpay.js`, `services/razorpayPayment.js`'],
])
h2('3.3 Request Flow')
para('Every request traverses a fixed pipeline. The order is deliberate and documented inline in `server.js`:')
code([
    'Client → Nginx → Express',
    '  1. trust proxy               (configureTrustProxy — needed for real client IP behind Nginx)',
    '  2. helmetConfig              (CSP, HSTS, X-Frame-Options, nosniff…)',
    '  3. CORS whitelist            (xlandinfra.com + localhost in dev)',
    '  4. body parser 2mb           (SKIPPED for /api/razorpay/webhook — raw body needed for HMAC)',
    '  5. hpp                       (HTTP parameter pollution)',
    '  6. xssSanitizer              (escapes every request string — data is STORED escaped)',
    '  7. apiRateLimiter on /api/*  (1000 req / 15 min / IP; login 5/15min via MySQL store)',
    '  8. static /uploads           (with forced-download + nosniff headers)',
    '  9. → router (/api/<family>)  → authenticate → scope middleware → RBAC → handler',
    ' 10. securityErrorHandler → general error handler → 404',
])

# =====================================================================
# 4. TECHNOLOGY STACK
# =====================================================================
page_break()
h1('4. Technology Stack')
table([
    ['Layer', 'Library / Tool', 'Version', 'Where used'],
    ['Runtime', 'Node.js', '18+ (20.x on VPS)', 'backend, qr-service'],
    ['API framework', 'Express', '^4.18.2', 'backend/server.js, qr-service/server.js'],
    ['DB driver', 'mysql2 (promise pools)', '^3.6.5', 'backend/config/database.js, qr-service'],
    ['Auth', 'jsonwebtoken, bcryptjs', '^9 / ^2.4.3', 'middleware/auth.js'],
    ['Security', 'helmet, hpp, xss-clean, express-rate-limit, express-validator', '—', 'middleware/security.js, paymentSecurity.js'],
    ['Uploads', 'multer, sharp', '^2.2 / ^0.35', 'routes, image processing'],
    ['Scheduling', 'node-cron', '^4.6.0', 'services/workOrderScheduler.js, utils/workOrderCleanup.js'],
    ['Email', 'nodemailer', '^9', 'services/emailService.js (single transporter)'],
    ['PDF (server)', 'pdfkit', '^0.19', 'services/pdfService.js'],
    ['Payments', 'razorpay', '^2.9.2', 'routes/razorpay.js'],
    ['Realtime', 'ws (WebSocket)', '^8.20', 'config/realtime.js'],
    ['Frontend', 'React / react-dom', '18.2', 'frontend, admin-portal'],
    ['Build', 'Vite', '^8.2', 'both SPAs'],
    ['Routing', 'react-router-dom', '^6.20', 'both SPAs'],
    ['Styling', 'tailwindcss, postcss, autoprefixer', '^3.3', 'both SPAs'],
    ['HTTP', 'axios (+ fetch helpers)', '^1.6', 'admin-portal utils/api.js'],
    ['Charts', 'recharts', '^3.8', 'admin-portal dashboards'],
    ['Maps', 'leaflet + react-leaflet (OpenStreetMap)', '^1.9 / ^4.2', 'admin-portal location capture'],
    ['PDF/Excel (client)', 'jspdf, jspdf-autotable, xlsx', '—', 'admin-portal exports'],
    ['Icons', 'lucide-react', '^0.294', 'both SPAs'],
    ['QR Service', 'express, mysql2, qrcode, ua-parser-js, cors', '—', 'qr-service'],
    ['Process mgr', 'PM2 (ecosystem.config.js)', '—', 'VPS'],
])

# =====================================================================
# 5. BACKEND
# =====================================================================
page_break()
h1('5. Backend — Design, Structure, and Implementation')
para('The backend is a **single Express monolith organized in clean layers**. `server.js` is deliberately thin — it wires middleware, '
     'mounts routers, and orchestrates startup — while domain logic lives in `routes/`, `services/`, `utils/`, `middleware/`, and `config/`.')

h2('5.1 Layer Structure')
table([
    ['Layer / Directory', 'Contents', 'Role'],
    ['`server.js` (~317 lines)', 'App assembly', 'Security middleware chain, 29 `/api/*` router mounts, `/uploads` static serving, startup orchestration'],
    ['`routes/` (34 routers)', 'REST handlers', 'Thin-ish handlers; the largest are per-portal routers: `franchisePartner.js` (~7,100 lines, 104 routes), `admin.js` (~5,400/89), `manager.js` (~4,000/68), `payments.js`, `schedules.js`, `coordinator.js`, `supervisor.js`, `executive.js`, `customers.js`'],
    ['`middleware/` (12 files)', 'Cross-cutting', '`auth.js`, `security.js`, `rbac.js`, `customerAuth.js`, `paymentSecurity.js`, scope middlewares (`fpScope`, `managerScope`, `coordinatorScope`, `supervisorScope`, `executiveScope`), `zoneHelper.js`'],
    ['`services/` (11 modules)', 'Business orchestration', '`emailService`, `invoiceService`, `pdfService`, `razorpayPayment`, `schedulingWorkflow`, `schedulingService`, `scheduleSeriesService`, `workOrderScheduler`, `autoRenewalService`, `paymentNotifications`, `complaintNotifications`'],
    ['`utils/` (~45 modules)', 'Shared single-source-of-truth helpers', 'ID generation, settlement, schema guards, zones, estimates, marketing, rate-limit store, entity decoding'],
    ['`config/`', 'Environment & constants', '`database.js` (pool + boot repairs), `roles.js`, `realtime.js`, `jwtSecret.js`, `schedulingSchema.js`, `schedulingPermissions.js`, `categories.js`'],
    ['`database/`', 'Schema', 'Versioned `schema_v*.sql` + `database/migrations/` (50 files)'],
    ['`uploads/`', 'File storage', 'Work-order attachments served with hardened headers'],
])

h2('5.2 Authentication & Authorization')
bullets([
    '**Staff** log in through `POST /api/employee/login` (`routes/employee.js`) — one endpoint routes the caller to the correct portal by role/FP association; only failed attempts count toward the 5/15-min limiter.',
    '**Customers** log in through `POST /api/customers/login`; their tokens carry `role: customer` and are validated by `middleware/customerAuth.js::requireCustomer`, which also confirms the `customer_accounts` row is still active — a staff token can never be read as a customer id.',
    '**JWT** signed with `JWT_SECRET` (64+ chars mandatory in production, `config/jwtSecret.js`; dev generates a per-session random secret). Payload carries id, username, email, role, names, and FP/employee ids.',
    '**`middleware/auth.js::authenticate`** verifies the token, then re-checks the account is still active in the right table (`vendors`, `franchise_partners`, `fp_employees`, or `users`) — fail-closed (`503`) only on a *fatal* DB error so a deactivated user cannot keep working through an outage; ordinary schema drift is tolerated (fail-open) because the code is built to survive it.',
    '**RBAC**: `config/roles.js` defines `ROLES`, `MODULES`, `ACCESS_LEVELS`, a full `MODULE_ACCESS` matrix, and ~30 capability predicates (`canViewEstimateMargins`, `canAssignVendor`…). `middleware/rbac.js` turns them into route guards.',
    '**Passwords** are bcrypt-hashed; reset flows use signed token columns and dedicated rate limiters.',
])

h2('5.3 The Router Catalog')
para('Top-level mounts in `server.js`, each backed by a file in `backend/routes/`:')
table([
    ['Mount', 'Router file', 'Domain'],
    ['/api/categories', 'categories.js', 'Service categories/subcategories'],
    ['/api/work-orders', 'workOrders.js', 'Work-order lifecycle'],
    ['/api/residents, /api/units, /api/properties', 'residents/units/properties.js', 'Master data'],
    ['/api/admin', 'admin.js', 'Super-admin + Ops Manager (also mounts `/service-catalog` and `/marketing` sub-routers)'],
    ['/api/staff', 'staff.js', 'Staff management'],
    ['/api/vendors[/onboarding|/work-orders]', 'vendors.js, vendorOnboarding.js, vendorWorkOrders.js', 'Vendor directory, onboarding, assigned work'],
    ['/api/menu', 'menu.js', 'Menu/permission feed'],
    ['/api/estimates, /api/estimates-sync', 'estimates.js, estimatesSync.js', 'Estimate CRUD + customer approval sync'],
    ['/api/schedules', 'schedules.js', 'Scheduling screens, confirm, reschedule, cancel'],
    ['/api/pricing', 'pricing.js', 'Pricing rules'],
    ['/api/contact', 'contact.js', 'Public contact form'],
    ['/api/onboarding', 'onboarding.js', 'Property onboarding, zone/city suggestions'],
    ['/api/customers', 'customers.js', 'Customer accounts, portal dashboard, invoices, offline payment intents, renewals, complaints (30 routes)'],
    ['/api/fp', 'franchisePartner.js', 'The FP portal — largest router (also mounts `/marketing`)'],
    ['/api/manager, /api/coordinator, /api/supervisor, /api/executive', 'manager.js, coordinator.js, supervisor.js, executive.js', 'Per-role staff portals (each mounts its own `/marketing` scope)'],
    ['/api/employee', 'employee.js', 'Staff login, set/reset password'],
    ['/api/qr', 'qr.js', 'QR code admin'],
    ['/api/addons, /api/amc-packages', 'addons.js, amcPackages.js', 'AMC add-ons & packages'],
    ['/api/payments', 'payments.js', 'Invoices, payments, verification, history, dashboard (34 routes)'],
    ['/api/razorpay', 'razorpay.js', 'Payment-link/checkout creation + webhooks (17 routes)'],
])
para('Shared sub-routers are mounted *inside* portal routers so one implementation serves many portals — the same DRY pattern used on the front-end:', space_after=4)
bullets([
    '`routes/marketing.js::createMarketingRouter({ resolveScope })` is mounted **six times** — under `/api/admin`, `/api/fp`, `/api/manager`, `/api/coordinator`, `/api/supervisor`, `/api/executive` — with each mount injecting a scope resolver (FP sees its own rows, Manager is zone-scoped, Admin sees all / `?fpId=`).',
    'Service catalog: `routes/serviceCatalog.js` (admin), `fpServiceCatalog.js` (FP), `managerServiceCatalog.js` (Manager) share `parseService`/`clientService`/`prepareService`; Coordinator/Supervisor/Executive get `staffServiceCatalog.js` (read-only).',
])

h2('5.4 Services — Business Orchestration')
bullets([
    '**`services/invoiceService.js`** — turns approved estimates / work orders into invoices (`INV-…` per-FP via `invoice_sequence` + `firstFreeNumber`), computes due dates, applies the document’s own GST, builds the PDF and emails it.',
    '**`services/razorpayPayment.js`** — the **single writer** for online payments. `recordRazorpayPayment()` is **idempotent on `razorpay_payment_id`**, so the three possible triggers (`payment_link.paid`, `payment.captured`, the `/payment/success` redirect) can all call it safely; only the first writes. It generates PAY/RCP ids, writes `payment_history.action = \'razorpay_payment\'`, marks the payment completed for scheduling.',
    '**`services/schedulingWorkflow.js`** — orchestrates payment→schedule: on payment completion a property enters `pending_property_schedules`; managers get recommended dates computed from vendor + zone + availability + existing calendar; confirmation writes recurring occurrences; audit trail on every reschedule/cancel.',
    '**`services/schedulingService.js`** — vendor eligibility (`getEligibleVendors` filters `onboarded_vendors` on service capability, zone, status, capacity), `assignVendorToService`, per-service schedule creation.',
    '**`services/scheduleSeriesService.js`** — the Series/Occurrence model: one `schedule_series` row per (property, service, vendor) with many `schedule_occurrences` — rescheduling one occurrence does not move the others.',
    '**`services/workOrderScheduler.js`** — `node-cron` jobs at 06:00 & 18:00 IST: auto-create `work_orders` for visits due within 7 days, notify customer + FP + admin + vendor, and drive `autoRenewalService` for contracts nearing end.',
    '**`services/pdfService.js`** — PDFKit templates for estimates, invoices, receipts (brand letterhead, cost columns gated internal-only).',
    '**`services/emailService.js`** — **the single nodemailer transporter** (`sendEmail`); every notification, receipt, activation and reminder goes through it.',
    '**`services/paymentNotifications.js` / `complaintNotifications.js`** — audience-aware alerts (customer vs FP vs zone-managers); written to **never throw and never run inside a transaction**, so a mail outage cannot roll back recorded money.',
])

h2('5.5 utils/ — the “single source of truth” layer')
para('The dominant methodology: any rule that more than one caller must agree on lives once in `utils/`. Representative modules:')
table([
    ['Module', 'Responsibility'],
    ['utils/workOrderId.js', 'generateWorkOrderId() — the only `WO-<digits>` generator; strictly increasing; a test fails if any other file builds a WO- id'],
    ['utils/paymentIds.js', 'generatePaymentId/generateReceiptId + firstFreeNumber + assignMissingReceiptIds'],
    ['utils/invoiceSettlement.js', 'resyncInvoiceSettlement() — recomputes amount_paid/balance/status/paid_at inside the caller’s transaction'],
    ['utils/invoiceColumns.js', 'paidAtAssignment(), ensureInvoiceColumns() — runtime schema guard for invoices.paid_at / archived'],
    ['utils/refundLedger.js', 'payment_refunds ledger; settled money = payments − processed refunds'],
    ['utils/paymentHistoryAction.js, paymentMethodDetails.js', 'Widen/repair narrow columns at write-time (ENUM action, TEXT method details)'],
    ['utils/pendingScheduleColumns.js', 'ensurePendingScheduleSchema() — drift repair before every scheduling writer'],
    ['utils/customerEmailGuard.js', 'customerEmailExists — the one-email-one-account rule: a known email is refused before anything is written'],
    ['utils/zoneDelete.js, middleware/zoneHelper.js', 'Zone as a merged entity across 3 tables; zone-scoped visibility'],
    ['utils/rateLimitStore.js', 'MySQLRateLimitStore — persistent rate-limit counters across restarts'],
    ['utils/estimateData.js, estimateScheduling.js, estimateMargins.js, packageSnapshot.js', 'Estimate normalization, internal-cost snapshots, margins'],
    ['utils/htmlEntities.js', 'Decode stored escaped text for display/editing'],
    ['utils/marketingDashboard.js, marketingFollowUp.js, marketingComplaints.js', 'Marketing tracker/dashboard/complaint rules'],
    ['utils/pendingProperties.js, scheduleStats.js, scheduleApproval.js', 'Scheduling queue, stats, and the approved-and-paid write gate'],
    ['utils/paymentSecurity.js', 'validatePaymentAmount, fingerprinting, analyzePaymentRisk, webhook HMAC verify'],
])

h2('5.6 Real-Time Sync')
para('`config/realtime.js` attaches a `ws` WebSocket server to the same HTTP server at `/ws`. It maintains a `Map<userId, Set<WebSocket>>`, '
     'supports `subscribe`/`ping`, and exposes `broadcastUpdate(channel, data)` and `notifyUsers(userIds, channel, data)` with channels '
     'per module (`work_orders`, `properties`, `vendors`, `employees`, `customers`, `estimates`, `addons`, `packages`, `users`, `notifications`). '
     'The admin portal consumes it through `admin-portal/src/hooks/useRealtime.js` so dashboards refresh live.')

h2('5.7 Background Jobs')
bullets([
    '`services/workOrderScheduler.js` — cron at 06:00 & 18:00 IST: creates work orders 7 days before each scheduled visit, sends reminder emails, and runs renewal processing.',
    '`utils/workOrderCleanup.js` — auto-deletes closed/cancelled work orders older than 30 days (with a `WARNING_DAYS` countdown feed).',
    '`services/autoRenewalService.js` — when a series completes all visits or nears its end date, creates `schedule_renewals` requests and notifies customer/FP/admin.',
    'Boot-time schema repair — `config/database.js` and server.js run `ensure*` guards for `portal_notifications`, `fp_employees`/`fp_employee_zones`, `fp_addons`, `fp_zones`, `payment_refunds`, `payments.invoice_id` nullable, `payments.transaction_id`, estimates terms columns, and `config/schedulingSchema.js` initializes the 8 scheduling tables under a MySQL advisory lock.',
])

# =====================================================================
# 6. DATABASE
# =====================================================================
page_break()
h1('6. Database — Schema, Access Patterns, and Migration Methodology')

h2('6.1 Connection Model')
bullets([
    'Driver: `mysql2/promise` connection **pool** in `config/database.js`. Pool size 25 in production, 10 locally.',
    '**Environment is selected by `NODE_ENV`**: `NODE_ENV=production` reads `DB_*` vars (→ `xland_pm`); otherwise `LOCAL_DB_*` (→ `customer_portal_local`). Optional `DB_SSL` support.',
    '`ensureDatabase()` creates the database if missing; `testConnection()` decides between **Connected** and **Demo mode** (server still starts without MySQL).',
    '`initOnboardingTables()` and the `ensure*` utils create/repair core tables at boot — the “schema as code” strategy.',
])

h2('6.2 Schema Organization (~120 tables)')
table([
    ['Domain', 'Representative tables'],
    ['Identity & access', 'users, admin_users, customer_accounts, customer_sessions, customer_activity_log, fp_users, fp_employees, fp_employee_zones, <role>_employees, <role>_permissions, <role>_employee_zones'],
    ['Property & customers', 'properties, onboarded_properties, property_contacts, residents, units, zones, fp_zones, divisions, fp_divisions, customers'],
    ['Vendors', 'vendors, onboarded_vendors, vendor_contacts, vendor_availability, vendor_zone_schedule, fp_assigned_vendors, <role>_assigned_vendors, property_vendor_assignments'],
    ['Estimates & pricing', 'estimates, estimate_items, fp_estimates, pricing, service_catalog, service_categories, service_units, addons, amc_packages, fp_addons, fp_amc_packages, <role>_addons, <role>_amc_packages, fp_categories, fp_subcategories, packages'],
    ['Billing & payments', 'invoices, invoice_sequence, payments, payment_history, payment_sequence, receipt_sequence, payment_refunds, payment_audit_trail, payment_security_logs, suspicious_payment_patterns, payment_rate_limit_overrides, payment_token_blacklist, payment_email_templates, payment_qr_codes, razorpay_config, razorpay_webhooks, id_sequences'],
    ['Scheduling & work', 'schedules, scheduled_visits, property_service_schedules, pending_property_schedules, schedule_series, schedule_occurrences, schedule_series_history, schedule_occurrence_history, schedule_renewals, schedule_renewal_history, property_renewal_settings, work_orders, work_order_history, work_order_status_history, work_order_attachments, attachments'],
    ['Marketing', 'fp_marketing_complaints + tracker columns on fp_estimates (schema_v42–v50)'],
    ['QR & analytics', 'qr_codes, qr_scans, qr_analytics_hourly/daily, qr_redirect_history, qr_geo_analytics, qr_bot_detections, qr_active_sessions, qr_rate_limits'],
    ['Notifications & misc', 'notifications, portal_notifications, audit_logs, priorities, problem_types, categories, subcategories, admin_categories, admin_subcategories, service_types'],
])

h2('6.3 Data-Access Methodology')
bullets([
    '**Prepared statements everywhere** (`pool.execute`) for SQL-injection safety, with explicit knowledge of driver limits — `execute` cannot bind `LIMIT` or `SHOW COLUMNS … LIKE ?`; LIMITs are inlined as clamped integers, and column checks go through `information_schema.columns` (a plain bindable SELECT).',
    '**Transactions for money**: every payment write and its invoice settlement share one connection/commit — `resyncInvoiceSettlement(invoiceId, conn)` runs inside the writer’s transaction so payment and invoice commit or roll back together.',
    '**Recompute, never increment**: derived money columns are caches of the payments/refunds rows, recomputed by SUM — prevents double-counting when a just-written payment is already inside the aggregate.',
    '**Idempotency keys**: `payments.razorpay_payment_id` is UNIQUE (schema_v36) — duplicate webhooks/callbacks cannot double-record; `payment_refunds` is keyed on `razorpay_refund_id` since Razorpay retries `refund.processed` events.',
    '**Per-FP sequences, globally-unique codes**: counters are scoped to `franchise_partner_id` but the issued code columns are UNIQUE; generators walk forward (`firstFreeNumber`) to the first free code.',
    '**ENUM discipline**: never write a status outside an ENUM’s members (errno 1265 truncations once silently rolled back payments); utilities resolve the nearest legal member.',
    '**DATE columns are read as date-only strings** (`dateOnly` helper / SQL `DATE_FORMAT`) to avoid mysql2 timezone shifts.',
    '**Stored text is HTML-escaped at ingress** (`xssSanitizer`); nothing is escaped on output, so display layers decode via `utils/htmlEntities.js` — and forms decode before editing to avoid double-escaping.',
])

h2('6.4 Migration Methodology — “idempotent, drift-tolerant”')
para('The VPS runs **MySQL 8**, which lacks MariaDB’s `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`. The convention:')
bullets([
    'New migrations check `information_schema` and emit **dynamic SQL** (no `DELIMITER`/stored procs so a statement-at-a-time runner can apply them) — pattern set by `schema_v29_fix_column_drift.sql` and `schema_v30_estimates_drift.sql`.',
    '**Two-layer safety net**: versioned SQL files *plus* runtime `ensure*` guards that repair the same columns at boot or at write-time (before `beginTransaction`, since DDL commits implicitly). A deployment can lag the migrations and still not lose data — “a settlement timestamp must never be the reason a payment is lost.”',
    'The runbook for each migration lists its requirement chain (e.g. the Razorpay path needs v17→v18→v20→v21→v22→v25→v27→v31→v36).',
])

# =====================================================================
# 7. FRONTEND
# =====================================================================
page_break()
h1('7. Frontend Applications — Design and Implementation')

h2('7.1 admin-portal — Six Staff Portals in One SPA')
para('`admin-portal/` is one React app hosting every non-customer interface, namespaced by URL prefix:')
table([
    ['Prefix', 'Portal', 'Layout component'],
    ['/employee', 'Admin / Ops Manager + admin-screens', 'components/EmployeeLayout.jsx, Layout.jsx'],
    ['/fp', 'Franchise Partner', 'components/FPLayout.jsx'],
    ['/manager', 'Manager', 'components/ManagerLayout.jsx'],
    ['/coordinator', 'Coordinator', 'components/CoordinatorLayout.jsx'],
    ['/supervisor', 'Supervisor', 'components/SupervisorLayout.jsx'],
    ['/executive', 'Executive', 'components/ExecutiveLayout.jsx'],
    ['/vendor', 'Vendor', 'components/VendorLayout.jsx'],
    ['(customer screens)', 'Customer admin views', 'components/CustomerLayout.jsx'],
])
bullets([
    '**Routing**: `App.jsx` mounts `AuthContext.Provider` → `FPProvider` → `BrowserRouter` with nested `<Routes>` per portal prefix and a `ProtectedRoute` gate (`user && portal === requiredPortal`). Public routes include `/employee/login`, `/reset-password/:token`, `/estimate-action/:id`, `/pay`, `/payment/success`.',
    '**Session model**: user + portal + JWT stored in `sessionStorage` (`pm_auth_token`); a 30-minute inactivity timeout is enforced client-side via activity listeners (`mousedown/keydown/scroll/touchstart`).',
    '**API layer**: `utils/api.js` (`apiRequest/apiGet/apiPost/…` adding the Bearer token) over `VITE_API_URL`; `config/api.js` exposes `apiFetch`/`getApiUrl`. Convention: always build URLs with `API_BASE`, never relative — in production a bare `/api` would hit `admin.xlandinfra.com` instead of the API host.',
    '**State**: no global store library — React Context (`AuthContext`, `FPContext`, `NavigationContext`) + `sessionStorage` helpers (`safeStorage`) + per-domain “stores” in `utils/` (`estimateStore`, `propertyStore`, `vendorStore`, `employeeStore`, `zoneStore`, `userStore`, `assignmentStore`, `fieldOptionsStore`).',
    '**Scale**: ~100 page components, ~70 shared components, ~70 utility modules, 7 custom hooks (`useRealtime`, `useUrlState`, `useServiceCategories`, `useServiceUnits`, `useViewportClamp`, `usePrintShortcut`, `useScrollLock`).',
])

h3('Design-system methodology')
bullets([
    '**Warm beige token system** in `tailwind.config.js` (`warm.*` colors + `shadow-warm`): `page #FAF7F2`, `section #FFF9EE`, `border #EADFCF`, `accent #D4A574`, `accent-hover #C69250`, `accent-soft #FEF3E2` — a deliberate global skin being rolled out page-by-page.',
    '**One modal, one view-modal, everywhere**: all dialogs render through `components/common/Modal.jsx` (backdrop, Escape/click-close, viewport clamping); read-only detail views through `common/ViewModal.jsx` (letterhead + `ViewSection`/`ViewField`/`ViewGrid`). Never hand-rolled overlays.',
    '**Shared screens by construction**: dashboards use `common/DashboardSummaryCards.jsx` (one agreed card design), estimate headers use `estimates/EstimateStatCards.jsx`, work-order headers use `workorders/WorkOrdersHeader.jsx`, estimate service lists use `estimates/EstimateServicesTable.jsx` — so a change can never diverge across portals.',
    '**Theming bridge**: `utils/estimateTheme.js` (`estimateSkin`/`useSkinClasses` + `<EstimateThemeProvider value="warm">`) lets shared components render byte-identical markup on un-themed portals.',
    '**Internal-cost gating**: vendor cost / XLAND cost / margin are rendered only for Admin, Ops Manager and FP (`canViewEstimateMargins`) and are `print:hidden` — customer-facing PDFs/emails never carry them.',
])

h3('Feature surface')
para('Dashboards (estimates/work-orders/payments/marketing with Recharts), Property Management (GC/APT/VILLA/FLAT/PLOT with block/unit data and Leaflet maps), Estimates & AMC (package manager, add-ons, custom services, cost & margin panel, PDF/email export via jspdf), Billing & Payments (invoices, make/record payments, cheque capture, history, archived), Scheduling (pending queue, per-property scheduling screen, calendar, reschedule/cancel), Vendor & Employee/Zone management, Marketing (dashboard, tracker, complaint form, archived), User & QR Management.')

h2('7.2 frontend — Marketing Site + Customer Portal')
bullets([
    '`frontend/` serves `xlandinfra.com`: public marketing pages (`LandingPage`, `CorporateLanding`, five `pages/services/*` service pages, `Contact`, legal pages) plus the resident portal (`CustomerHome`, `Dashboard`, `WorkOrder`, `Schedule`, `Payment`, `PaymentSuccess`).',
    'Same stack: React 18 + Vite + Tailwind + React Router 6 + axios + recharts + lucide; `usePortalRefresh` + `NotificationBell` consume the WebSocket feed.',
    'Customer-specific rules: the portal is **read-only for schedules** (`GET /api/customers/schedules` only — customers never schedule/reschedule/cancel), shows only customer-safe fields (no vendor ids, work-order refs, or costs), and initiates payments through Razorpay checkout/payment links or records *offline payment intents* (`verification_pending`) that staff then verify.',
])

h2('7.3 qr-service — Standalone Analytics Microservice')
bullets([
    '`qr-service/server.js` (Express :3500, PM2 cluster mode): `GET /:slug` resolves a printed QR to its target URL with a 302 redirect and records the scan; `GET /health` for monitoring.',
    'Own mysql2 pool; extensive bot-detection regexes (search crawlers, link-preview bots, headless browsers), `ua-parser-js` device classification, geo + hourly/daily analytics tables, redirect history, active sessions and per-slug rate limits.',
    'Deployed behind `qr.xlandinfra.com` with its own nginx vhost and `generate-qrcodes.js` for batch QR production.',
])

# =====================================================================
# 8. END-TO-END FLOWS
# =====================================================================
page_break()
h1('8. End-to-End Data Flows')
h2('8.1 Online payment (Razorpay)')
bullets([
    'Customer clicks Pay → backend creates a Razorpay Payment Link/Checkout order, stores `razorpay_payment_link_id` + `razorpay_short_url` on the invoice, and embeds `internal_invoice_id` in Razorpay **notes** (the key the webhook resolvers use).',
    'Three possible completion signals — `payment_link.paid`, `payment.captured`, or the browser landing on `/payment/success` (verified `POST /api/razorpay/verify-payment-callback`, which re-reads amount+captured status from the API and never trusts the query string).',
    'All three call `services/razorpayPayment.js::recordRazorpayPayment()` — idempotent on `razorpay_payment_id`; inside one transaction it inserts the `payments` row (PAY-/RCP- ids), writes `payment_history`, then `resyncInvoiceSettlement` settles the invoice, then `markPaymentCompleted` pushes the property into `pending_property_schedules`, then receipt email is sent (outside the transaction).',
    'Webhook authenticity: HMAC signature verified with `RAZORPAY_WEBHOOK_SECRET` (mandatory when configured); deliveries logged in `razorpay_webhooks` keyed on `<event>:<entity id>` for dedup; replayable via `scripts/replayRazorpayWebhooks.js`.',
    'Refunds live in `payment_refunds` (keyed on `razorpay_refund_id`); partial refunds reduce the settled amount without losing the payment row.',
])
h2('8.2 Offline payment (cash / cheque / bank transfer)')
bullets([
    'Customer records an *offline payment intent* → `payments.status = verification_pending` (settles nothing) → `paymentNotifications` emails the FP + its zone-managers.',
    'Staff verify on Billing > Payments (`PUT /api/payments/:id/verify`): payment → `paid`, cheque columns written, invoice re-settled (sum minus refunds — never incremented), scheduling triggered, receipt email + portal notification sent.',
])
h2('8.3 Schedule → Work Order')
bullets([
    '`POST /api/schedules/confirm` is gated by `utils/scheduleApproval.js` — requires estimate `status=approved` **and** `payment_status IN (paid,partial)` (properties with no estimate are allowed through); stamps `property_service_schedules.estimate_id`.',
    'Confirmation writes one `property_service_schedules` row per service + one `scheduled_visits`/`schedule_occurrences` row per visit (times normalized to `HH:MM:SS`), creating or extending the `schedule_series`.',
    '`workOrderScheduler` (06:00/18:00 IST) finds occurrences due within 7 days lacking a work order → creates `work_orders` (status `assigned`, WO-id via `generateWorkOrderId`) → notifies customer, FP, admin, vendor → vendor works it → manager/FP verifies & closes → cleanup deletes after 30 days.',
    'Auto-renewal creates `schedule_renewals` when a series completes or nears expiry; customer can approve/decline from their portal.',
])

# =====================================================================
# 9. SECURITY MODEL
# =====================================================================
page_break()
h1('9. Security Model')
table([
    ['Control', 'Implementation'],
    ['HTTP headers', 'helmet CSP/HSTS/X-Frame-Options/nosniff/referrer-policy (middleware/security.js)'],
    ['CORS', 'Explicit whitelist; production rejects unknown origins'],
    ['AuthN', 'JWT Bearer (jsonwebtoken); bcryptjs password hashing; JWT_SECRET ≥64 chars in prod'],
    ['AuthZ', 'RBAC module-access matrix + capability guards + FP/zone scope middleware; customer tokens isolated by role'],
    ['Rate limiting', 'express-rate-limit; API 1000/15min, login 5/15min (failed only), password-reset 3/hr, sensitive ops 10/hr, uploads 100/hr, payment-create 10/15min — persisted in MySQL (MySQLRateLimitStore) so limits survive restarts'],
    ['Injection', 'Parameterized queries everywhere; `validateIdParam`/`validatePagination`; HPP'],
    ['XSS', 'All request strings escaped at ingress (xssSanitizer, password fields preserved); uploads served with forced-download + CSP sandbox'],
    ['Payload limits', 'JSON/urlencoded 2mb, raw 10mb'],
    ['Payment security', 'Webhook HMAC verification, `payments.razorpay_payment_id` UNIQUE, payment fingerprinting + risk analysis + hashed-IP security logs, token blacklist, amount validation, fraud-pattern tables'],
    ['Error hygiene', 'Production hides error details; 404/hardened error handlers; secrets never exported (verifyToken only)'],
])

# =====================================================================
# 10. METHODOLOGIES
# =====================================================================
page_break()
h1('10. Architectural Methodologies & Design Principles')
bullets([
    '**Layered modular monolith** — thin `server.js`, feature routers per portal, orchestration in `services/`, shared rules in `utils/`, constants in `config/`.',
    '**DRY via single-writer modules** — one code path per cross-cutting rule: one WO-id generator, one payment writer (`razorpayPayment`), one settlement recompute (`resyncInvoiceSettlement`), one email transporter (`sendEmail`), one marketing router mounted six times, one modal component. Divergent copies are treated as defects.',
    '**Defensive schema-drift tolerance** — `information_schema`-guarded DDL at boot and at write-time (always before `beginTransaction`), because production may lag the repo; code must never lose money over a missing column.',
    '**Idempotency & at-least-once safety** — unique keys on external ids (razorpay_payment_id, refund id, webhook event id), deduped event processing, replayable webhooks.',
    '**Recompute-over-increment** — invoice settlement fields are a cache of the ledger, recomputed transactionally.',
    '**Fail-closed vs fail-open, decided deliberately** — auth fails closed on a dead DB (deactivated users must not keep working) but fails open on missing columns (schema drift is survivable); notifications never throw and never sit in a transaction.',
    '**Transaction boundaries** — everything that must commit together shares `conn`; DDL (implicit commit) and side-effects (email, notifications) run strictly outside it.',
    '**Convention-as-code documentation** — `AGENTS.md` (~1,900 lines) + `.devin/rules/{estimates,work-orders}.md` record every production lesson with its regression test; sidebar order, headers, palettes and table layouts are specified once and reused.',
    '**Per-portal reuse** — one SPA parameterized by portal prefix + one marketing/estimate/scheduling component set shared across all portals, rather than per-portal forks.',
])

# =====================================================================
# 11. ENVIRONMENTS & DEPLOYMENT
# =====================================================================
page_break()
h1('11. Environments, Configuration & Deployment')
h2('11.1 Environments')
table([
    ['Aspect', 'Local / Development', 'Production'],
    ['Backend port', '5000 (`npm run dev` → nodemon)', '5000 under PM2 (`backend/ecosystem.config.js`)'],
    ['Database', '`LOCAL_DB_*` → `customer_portal_local`', '`DB_*` → `xland_pm`'],
    ['Frontend dev servers', 'Vite :3000 (frontend), :3001 (admin-portal) with `/api` + `/uploads` proxies → :5000', 'Static `dist/` served by Nginx'],
    ['VITE_API_URL', 'empty (proxy) or http://localhost:5000', '`https://xlandinfra.com` (`.env.production` only)'],
    ['JWT secret', 'auto-generated per session', '`JWT_SECRET` ≥64 chars, mandatory'],
    ['CORS', 'localhost origins allowed', 'xlandinfra.com + admin subdomain only'],
])
para('Critical local-dev rule: **never** point a local frontend at `https://xlandinfra.com` — local edits would mutate live data.')
h2('11.2 Deployment (Hostinger VPS)')
bullets([
    'Layout: `/var/www/app/{frontend,admin,backend,uploads}`; `deploy.sh` installs deps, writes `.env.production`, builds both SPAs, restarts PM2, reloads Nginx.',
    'PM2: `backend` app (1 instance, 500MB restart cap, file logs); `xland-qr-service` (cluster, all cores). `pm2 save` + `pm2 startup` for boot persistence.',
    'Nginx vhosts: `xlandinfra.com` → `frontend/dist` (+ `/api/`→:5000, `/uploads`), `admin.xlandinfra.com` → `admin/dist` (+ same proxy), `qr.xlandinfra.com` → :3500. SPA fallback `try_files … /index.html`, gzip, 1-year immutable static caching, TLS via certbot.',
    'DNS (Hostinger): A records for the three hosts; Razorpay webhook registered at `https://xlandinfra.com/api/razorpay/webhook` (test and live modes are configured separately in Razorpay).',
    'Back-end env secrets: DB creds, JWT_SECRET, EMAIL_*/SMTP_*, RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET, PAYMENT_TOKEN_SECRET, QR_TOKEN_SECRET, IP_HASH_SALT, RECAPTCHA keys, FRONTEND_URL/ADMIN_PORTAL_URL.',
])

# =====================================================================
# 12. TESTING & VERIFICATION
# =====================================================================
h1('12. Testing & Verification')
bullets([
    '**Test runner**: Node’s built-in `node:test` — ~85 `*.test.js` files co-located with the code they verify (backend utils/routes/config, admin-portal utils, frontend utils). Run individually, e.g. `node --test backend/utils/workOrderId.test.js`.',
    '**Mocked-pool tests** assert SQL shape (e.g. a package mock must reject `SELECT price` without `base_price`, and static analysis prevents re-introductions like splicing `paid_at` last or hard-coding `dot={false}`).',
    '**Opt-in real-DB tests**: `RUN_LOCAL_MYSQL_TESTS=1 NODE_ENV=development` run true integration tests (routes, migration idempotency, scheduling schema) against the local DB and roll back their own data.',
    '**Verification commands**: backend regression tests, `npm run build` (both SPAs), ESLint (`no-undef`, `react/jsx-no-undef`) in `frontend/`.',
    'Regression tests are mandated alongside each convention in AGENTS.md — the convention document doubles as the test map.',
])

# =====================================================================
# APPENDIX
# =====================================================================
page_break()
h1('Appendix — Directory Map & API Surface')
h2('A.1 Repository Layout')
code([
    'XlandInfra-main/',
    '├─ backend/',
    '│  ├─ server.js            # app assembly + startup',
    '│  ├─ config/              # database, roles, realtime, jwtSecret, schedulingSchema',
    '│  ├─ middleware/          # auth, security, rbac, scopes, zoneHelper, paymentSecurity',
    '│  ├─ routes/              # 34 routers (per-portal + domain)',
    '│  ├─ services/            # invoice/pdf/email/razorpay/scheduling/renewal/notify',
    '│  ├─ utils/               # ~45 single-source helpers',
    '│  ├─ database/            # schema_v*.sql + migrations/ (50 files)',
    '│  ├─ scripts/ uploads/ assets/ docs/',
    '│  └─ ecosystem.config.js  # PM2',
    '├─ admin-portal/           # staff SPA (React+Vite)',
    '│  └─ src/{pages,components,contexts,hooks,utils,config}',
    '├─ frontend/               # customer SPA (React+Vite)',
    '│  └─ src/{pages,components,hooks,services,utils,data,assets}',
    '├─ qr-service/             # standalone QR redirect service (:3500)',
    '├─ scripts/                # repo tooling',
    '├─ docs/ portal-reports/   # portal QA reports',
    '├─ .devin/rules/           # estimates.md, work-orders.md',
    '├─ AGENTS.md               # authoritative conventions (~1900 lines)',
    '└─ deploy.sh, VPS_DEPLOYMENT_GUIDE.md, README.md, Project_Documentation.md',
])
h2('A.2 Scale')
table([
    ['Metric', 'Approx. size'],
    ['Backend JS files (excl. node_modules)', '191'],
    ['Backend routers / routes', '34 routers / ~700+ endpoints across files'],
    ['admin-portal src files', '~280 (≈100 pages, ~70 components, ~70 utils)'],
    ['frontend src files', '~49'],
    ['SQL schema/migration files', '113 (~120 tables)'],
    ['Test files (node:test)', '85'],
])
para('')
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('— End of Document —')
r.font.color.rgb = MUTED; r.italic = True

out = r'C:\Users\saiso\Downloads\XlandInfra-main\XLandInfra-Technical-Architecture.docx'
doc.save(out)
print('Wrote', out)
