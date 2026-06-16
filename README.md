# XLand Infra - Property Management System

A comprehensive full-stack web application for property management, work orders, vendor management, and AMC (Annual Maintenance Contract) packages, built with React, Node.js, and MySQL.

> **Last Updated:** June 16, 2026

## Features

### Customer Portal
- **Work Order Management**: Submit maintenance and repair requests with categories and subcategories
- **18 Service Categories**: Including Lifts, AC, Plumbing, Electrical, Appliances, and more
- **File Attachments**: Upload images from camera roll, take photos, or attach PDFs
- **Permission to Enter**: Grant access for service personnel when you're unavailable
- **Pet Notification**: Alert service personnel about pets in the premises

### Admin Portal
- **Property Management**: Manage properties (GC, APT, VILLA, FLAT, PLOT) with full CRUD operations
- **Vendor Management**: Track and manage vendors with GST, PAN, license, rating fields
- **Employee Management**: Manage employees with zone-based assignments and FP association
- **QR Code Management**: Track QR code scans with real-time analytics and geo data
- **User Management**: Full CRUD for admin users with role-based permissions
- **Estimates Module**:
  - **Create Estimate**: Property-based and direct estimates with auto-population
  - **AMC Package Manager**: Create and manage AMC packages with reusable templates
  - **AMC Templates**: Create templates per property type (AMC-GC, AMC-APT, AMC-VILLA) that auto-populate
  - **Add-ons**: Additional service management with property type filtering
  - **All Estimates**: View and manage all estimates with archive/restore
  - **Archived**: Access archived estimates with restore functionality
- **Contact Auto-Population**: Contact name, phone, and email auto-populate from Property Management
- **AMC Integration**: View AMC packages directly from Property Management table

### Franchise Partner (FP) Portal
- **Manager Portal**: Full access to properties, vendors, employees, estimates, work orders
- **Coordinator Portal**: Property and vendor management, employee zone assignments
- **Supervisor Portal**: View-only access to estimates, work order tracking and requests
- **Executive Portal**: Data entry, property viewing, basic work order access
- **Zone-Based Data Filtering**: Employees see only data from their assigned zones
- **Created By Tracking**: All records show creator name for accountability

### Responsive Design
- Works on desktop, tablet, and mobile devices
- Modern UI built with TailwindCSS

## Tech Stack

### Frontend
- React 18 with Vite
- TailwindCSS for styling
- React Router for navigation
- Lucide React for icons
- Axios for API calls

### Backend
- Node.js with Express
- MySQL2 for database
- Multer for file uploads
- CORS enabled for cross-origin requests

## Project Structure

```
customer-portal/
├── frontend/                 # Customer-facing React application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── data/             # Static data (categories)
│   │   ├── services/         # API service functions
│   │   ├── App.jsx           # Main app component
│   │   └── main.jsx          # Entry point
│   ├── public/               # Static assets
│   └── package.json
├── admin-portal/             # Admin React application
│   ├── src/
│   │   ├── components/       # Admin UI components
│   │   │   ├── estimates/    # Estimate components (AMC, Create, etc.)
│   │   │   ├── EmployeeLayout.jsx
│   │   │   └── Layout.jsx
│   │   ├── pages/            # Admin pages
│   │   │   ├── CustomerSubmissions.jsx  # Property Management
│   │   │   ├── CreateCustomer.jsx       # Add Property
│   │   │   ├── Estimates.jsx            # Estimates Module
│   │   │   └── ...
│   │   ├── utils/            # Utility stores
│   │   │   ├── estimateStore.js   # AMC & Estimate management
│   │   │   ├── propertyStore.js   # Property CRUD
│   │   │   ├── vendorStore.js     # Vendor management
│   │   │   └── employeeStore.js   # Employee management
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── backend/                  # Node.js backend API
│   ├── config/               # Configuration files
│   ├── routes/               # API routes
│   │   └── onboarding.js     # Property onboarding API
│   ├── database/             # SQL schema
│   ├── uploads/              # Uploaded files directory
│   ├── server.js             # Express server
│   └── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- MySQL 8.0+ installed (optional for full database functionality)
- npm or yarn package manager

### Installation

1. **Clone or navigate to the project directory**

2. **Set up the backend**
   ```bash
   cd backend
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Copy the example env file
   cp .env.example .env
   
   # Edit .env with your database credentials
   ```

4. **Set up MySQL database (optional)**
   ```bash
   # Connect to MySQL and run the schema
   mysql -u root -p < database/schema.sql
   ```

5. **Set up the frontend**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```
   The API will be available at `http://localhost:5000`

2. **Start the customer frontend**
   ```bash
   cd frontend
   npm run dev
   ```
   The customer app will be available at `http://localhost:3000`

3. **Start the admin portal**
   ```bash
   cd admin-portal
   npm run dev
   ```
   The admin portal will be available at `http://localhost:3002`

## API Endpoints

### Employee Portal Routes
- `POST /api/manager/login` - Manager authentication
- `POST /api/coordinator/login` - Coordinator authentication
- `POST /api/supervisor/login` - Supervisor authentication
- `POST /api/executive/login` - Executive authentication
- `GET /api/manager/dashboard` - Manager dashboard stats
- `GET /api/coordinator/dashboard` - Coordinator dashboard stats
- `GET /api/supervisor/dashboard` - Supervisor dashboard stats
- `GET /api/executive/dashboard` - Executive dashboard stats

### Franchise Partner Routes
- `POST /api/franchise-partner/login` - FP Manager login
- `GET /api/franchise-partner/estimates` - FP estimates with zone filtering
- `GET /api/franchise-partner/vendors` - FP vendors by zone
- `GET /api/franchise-partner/properties` - FP properties by zone
- `GET /api/franchise-partner/work-orders` - FP work orders by zone

### QR Code Routes
- `GET /api/qr/scan/:code` - Track QR code scan
- `GET /api/qr/stats` - QR scan statistics
- `GET /api/qr/codes` - List all QR codes

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:id/subcategories` - Get subcategories for a category
- `GET /api/categories/all` - Get all categories with subcategories

### Work Orders
- `POST /api/work-orders` - Create a new work order
- `GET /api/work-orders` - Get all work orders
- `GET /api/work-orders/:id` - Get a specific work order
- `PATCH /api/work-orders/:id/status` - Update work order status

### Properties (Onboarding)
- `POST /api/onboarding` - Create a new property
- `GET /api/onboarding` - Get all properties
- `GET /api/onboarding/:id` - Get a specific property
- `DELETE /api/onboarding/:id` - Delete a property

### AMC Packages (localStorage)
- AMC packages are managed via localStorage in the admin portal
- Templates can be created per property type (GC, APT, VILLA, FLAT, PLOT)
- Auto-populate services when property type is selected

### Health Check
- `GET /api/health` - Check API status

## Service Categories

1. Lifts
2. Drainage
3. Septic Cleaning
4. Generator
5. Water Tank Cleaning
6. AC
7. Electrical
8. Plumbing
9. Appliances
10. Building Exterior
11. Building Interior
12. Flooring
13. Locks / Keys
14. Painting
15. Pest Control
16. Water Purification
17. Hot Water Geyser
18. Other

## Work Order Fields

- **Category** (required): Main service category
- **Subcategory** (required): Specific service type
- **Description**: Detailed issue description (max 500 characters)
- **Permission to Enter**: Yes/No - Allow entry when unavailable
- **Entry Notes**: Special instructions for entry
- **Pet Information**: Yes/No - Pet presence notification
- **Attachments**: Up to 5 files (images or PDFs, max 10MB each)

## Responsive Design

The application is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones

## Recent Updates (June 16, 2026)

### Work Order Email Notifications
- **Responsive Email Templates**: Fixed text wrapping for mobile/tablet devices
- **Zone-Centric Notifications**: Work order emails now sent to FP and zone-assigned employees
- **Customer Notifications**: Automatic email to customer on work order completion
- **Created By Tracking**: Admin work orders show creator name and property ID for customer submissions
- **Timestamp Cleanup**: Removed redundant timestamps from email notifications

### PDF Export Enhancements (June 2026)
- **Page Break Handling**: Fixed tables splitting across pages with proper height constraints
- **Tower/Block Fields**: Added Tower/Block information to PDF exports
- **Description Full Text**: Removed 35-char truncation, dynamic row height for full descriptions
- **Discount/GST Display**: Show GST always, discount only when > 0
- **Property Details Styling**: Matching blue color scheme with Customer Details section
- **Status Badge**: Added estimate status to PDF exports
- **Notes Section**: Moved Description/Notes after Price Summary in all view modals and PDF
- **XLAND INFRA Header**: Professional header with gold logo, black theme with gold accents

### FP Portal Links Feature
- **Portal Link Management**: Track FP portal URLs (Customer, Vendor, Website)
- **Done Status Tracking**: Mark portal links as completed with visual indicators
- **Aggregated View**: Admin can view all FP portal links in one place
- **Database Migration**: Added `fp_portal_links` table with proper schema

### FP Shared Resources
- **Admin Integration**: View FP-specific resources when creating estimates for a specific FP
- **Ops Manager Access**: FP Shared Resources section for Operations Managers
- **All FPs View**: Aggregated FP resources visible in Admin All FPs view

### Division Field Improvements
- **Proper JOINs**: Division field now correctly joins with `fp_divisions` table
- **Division Name Display**: Uses `division_name` alias with fallback across all portals
- **Consistent Display**: Fixed division field in Property Management tables for all user portals

### Zone Filtering Enhancements
- **Subquery Conversion**: Use subquery to convert zone names to zone IDs for properties table
- **Employee Visibility**: Work orders now visible to zone-assigned employees (coordinator/supervisor/executive/manager)
- **Zone Helper Fixes**: Corrected data restriction when no zones assigned

### Frequency/Visits Column Separation
- **Separate Columns**: Frequency shows type only (e.g., "Monthly"), Visits shows count only (e.g., "12")
- **All View Modals**: Consistent layout across FP, Manager, Coordinator, Supervisor, Executive portals
- **PDF Exports**: Strip "Nx " prefix from Frequency column to avoid duplication
- **Email Templates**: Format as "{frequencyType} - {count} visits"

### AMC Package & Add-on Descriptions
- **Description Enrichment**: All employee routes parse `addons_data` JSON and enrich with descriptions from `fp_addons` table
- **Package Services Fallback**: Fetch service descriptions from AMC package if not stored in estimate
- **Email PDF**: Services and add-ons show full descriptions with proper column layout

### Customer Portal Improvements
- **Login Fix**: Added JOIN with properties table for complete property details
- **Property ID Display**: Uses double JOIN, removed "PROP-" fallback
- **Password Reset**: Fixed icon overlap with placeholder text in ForgotPassword and ResetPassword pages

### UI/UX Improvements
- **Hero Banner**: Smooth crossfade transitions between intro and services phases
- **Corporate Landing Page**: New page added for corporate clients
- **Employee Zone Management**: Updated UI for better zone assignment workflow
- **Vendor Forms**: Removed Business Documents section (GST, PAN, License)
- **Favicon**: Updated to use optimized company logo (29KB)

---

## Previous Updates (June 8, 2026)

### PDF Export Enhancements
- **Add-ons "No. of Visits" Column**: Add-ons table now matches services table with #, Add-on Service, Frequency, and No. of Visits columns
- **New Header Design**: Clean white header with XLand Infra gold logo, gold accent line, and professional layout
- **Logo Integration**: Created `logoBase64.js` with full XLand Infra gold logo for PDF embedding
- **Existing Records Support**: Fixed add-on frequency parsing to extract from nested `services[0].frequency` structure
- **Header Layout**: Company name "XLAND INFRA" with tagline "Property Management Solutions" and "PVT LTD"
- **Document Badge**: Dark slate background with gold "ESTIMATE" text

### Add-ons Display Rules (All Portals)
- Individual add-on prices are NOT displayed in Create Estimates
- Add-on dropdowns show only add-on name (no price)
- Selected add-ons table shows: Service, Frequency, No. of Visits, Action columns only
- Only "Total Add-ons Price" row displayed at bottom
- View estimate modals show add-on names and frequency with Total Add-ons Price

---

## Previous Updates (June 2026)

### Franchise Partner (FP) Portal System
- **Multi-Role Employee Portal**: Complete FP portal with Manager, Coordinator, Supervisor, and Executive roles
- **Zone-Centric Architecture**: Data filtering based on employee assigned zones
- **Created By Tracking**: All estimates, properties, vendors, and work orders track creator with employee name
- **Elegant Gold Theme**: Soft amber/gold color palette for FP portal with modern UI
- **Auto-Refresh**: Dashboards sync every 30 seconds with real-time updates

### Employee Portal Restructure
- **Role Rename**: "Data Entry Executive" renamed to "Executive" across all portals
- **Coordinator Role**: New Coordinator role with property, vendor, and employee management
- **Portal Synchronization**: All FP employee dashboards match Manager layout exactly
- **Zone Assignment Management**: Employees can be assigned to specific zones for data scoping

### Estimates System Enhancements
- **Created By Column**: Shows employee name who created the estimate in all portals
- **Archive/Restore**: Full archive and restore functionality with archived date tracking
- **PDF Export Improvements**: Clean layout with gold XI logo, property type filtering
- **Add-ons Filtering**: Only show add-ons matching selected property type
- **Status Badges**: Color-coded status badges with proper styling
- **fp_estimates Table**: Unified estimate storage with proper property_id handling

### Vendor Management Updates
- **Unified Vendor Schema**: Added GST, PAN, license, rating fields to onboarded_vendors
- **Service Type Badges**: Colored service type badges (AMC, Ad-hoc, Contract)
- **Zone-Based Assignments**: Vendors filtered by employee's assigned zones
- **Detailed View Modals**: Full vendor details with address, contact, and service info
- **Vendor ID Display**: Name on top, Vendor ID below in consistent format

### Work Order Improvements
- **Email Notifications**: Automatic emails on work order creation and completion
- **Action Buttons**: Edit, assign, and delete functionality for all portals
- **Status Filters**: Default to pending view with filter options
- **Customer Name Display**: COALESCE logic for proper client name display

### QR Code Tracking System
- **Page Visit Tracking**: Count every scan with unique user tracking
- **Geo/Timezone Data**: Capture location and timezone information
- **Real-Time Updates**: Live scan tracking on QR management dashboard
- **Main Website Detection**: Differentiate between main website and customer portal visits

### Dashboard Enhancements
- **Work Order Summary**: Statistics cards showing pending, in-progress, completed counts
- **Consistent Layout**: All portals share same dashboard structure
- **Quick Actions**: Role-appropriate quick action buttons
- **Zone Display**: Employee's assigned zones shown on dashboard

### UI/UX Improvements
- **Modal Headers**: Full gray background with rounded corners
- **Property Type Utilities**: Shared utility for consistent property type display
- **Status Badges**: Lowercase support with color coding
- **View-Only Buttons**: Consistent styling across all view modals
- **Responsive Vendor Tables**: Name/ID display with service type badges

---

## Previous Updates (May 2026)

### Estimates & Add-ons UI Enhancements
- **Table Layout for All Add-ons**: Converted card layout to structured table with columns:
  - Add-on Name, Property Type, Frequency, Count, Total Rate, Actions
- **Table Layout for All AMC Packages**: Consistent table format with columns:
  - Package Name, Property Type, Billing, Services Included, Total Rate, Actions
- **Property Type Filters**: Added filter buttons (All, GC, Apt, Villa, Flat, Plot) for both sections
- **Blue Theme Consistency**: All add-ons now use blue color palette matching AMC packages

### Create Estimate Improvements
- **Removed Individual Price Column**: AMC Package services table no longer shows individual "-" prices
- **Total Package Price Only**: Summary shows only the final total, no redundant individual prices
- **Customizable GST**: GST field is now editable (default 18%), similar to Discount field
- **Percentage-Based Discount**: Discount now works as percentage of subtotal before GST
- **Price Summary Formula**: Sub Total → Discount (%) → GST (%) → Total Amount

### Dynamic Auto-Population by Property Type
Implemented throughout Create Estimate and Create Work Order sections:

| Property Type | Auto-Populated Fields |
|--------------|----------------------|
| **Gated Community (GC)** | Block Name, Number of Units |
| **Apartment (APT)** | Block Information, Number of Units |
| **Villa** | Villa Number |
| **Plot** | Plot Number |
| **Flat** | Flat Number |

- Fields display with green "(Auto-populated)" labels
- Read-only styling with `bg-indigo-50` background
- Real-time update when property is selected

### Create Work Order Enhancements
- **Dynamic Property Fields**: Block/Flat fields adapt based on property type
- **Auto-Fill Block Number**: First block name auto-populates for GC properties
- **Property Details Panel**: Shows Block Name, Number of Units for GC/APT
- **Villa/Plot/Flat Display**: Shows respective unit number when available

---

## Previous Updates (April-May 2026)

### AMC Package Manager Enhancements
- **Property Type Selection**: Select GC, APT, VILLA, FLAT, or PLOT before creating AMC package
- **All AMC Packages**: Renamed from "AMC Templates" - create and manage AMC packages
- **Auto-Population**: Packages auto-apply when property type is selected
- **Flexible Editing**: AMC packages are fully editable - can be modified anytime
- **Frequency Types**: Monthly, Months (custom), Quarterly, Half-Yearly, Yearly
- **Price Summary**: Shows Sub Total, GST, and Total with service-wise breakdown

### Property Management Improvements
- **AMC Status Column**: View AMC linkage directly in property table
- **AMC Details Modal**: Click "View AMC" to see full package details including:
  - Property information
  - Package summary
  - Services list with frequency and rates
  - Pricing breakdown (subtotal, GST, total)

### Contact Auto-Population
- Contact Name, Phone, and Email auto-populate from Property Management
- Works for all property types (GC, APT, VILLA, FLAT, PLOT)

### Employee Portal Redesign
- **Modern Login UI**: Glassmorphism design with animated backgrounds
- **Role-Based Access**: Four user roles - Admin, Manager, Supervisor, Executive
- **User Management**: Full CRUD operations for managing users
- **Demo Accounts**: Quick login options for testing different roles
- **Responsive Design**: Works seamlessly on all devices

### User Management System
- **Default Roles**:
  - **Admin**: Full system access with all permissions
  - **Manager**: Manage properties, vendors, employees
  - **Supervisor**: Supervise work orders, vendors
  - **Executive**: Execute daily operations
- **Status Management**: Activate/deactivate users
- **Flexible Addition**: Easily add new users of any role
- **Demo Mode**: Role-based demo access available (configured via environment variables)

> **Note**: Demo credentials are configured via environment variables. See `backend/.env.example` for setup instructions.

## Completed Features

- ✅ **PDF Export**: Export estimates to PDF with branded header and status badges
- ✅ **Email Integration**: Work order email notifications to customers, FP, and zone employees
- ✅ **QR Code Tracking**: Real-time scan analytics with geo data
- ✅ **Zone-Based Access**: Employees see data from assigned zones only
- ✅ **FP Portal Links**: Track and manage FP portal URLs with completion status
- ✅ **Division Management**: Proper division field display across all portals
- ✅ **Responsive Emails**: Mobile-friendly email templates with proper text wrapping
- ✅ **Password Reset**: Complete forgot/reset password flow with proper UI

## Future Features (Coming Soon)

- **Schedule**: View and manage appointments
- **Payment**: Make payments and view billing history
- **Live Chat**: Real-time support
- **Advanced Reporting**: Custom reports with date ranges and filters

## License

MIT License
