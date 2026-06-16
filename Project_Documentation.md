# Customer Portal - Project Documentation

> **Last Updated:** June 16, 2026 at 11:30 AM (UTC-05:00)
> **Version:** 3.2.0
> **Status:** In Development

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Directory Structure](#4-directory-structure)
5. [Database Design](#5-database-design)
6. [Backend API Documentation](#6-backend-api-documentation)
7. [Frontend Applications](#7-frontend-applications)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Features & Functionalities](#9-features--functionalities)
10. [Configuration & Environment](#10-configuration--environment)
11. [Installation & Setup](#11-installation--setup)
12. [Development Workflow](#12-development-workflow)
13. [Security Considerations](#13-security-considerations)
14. [Change Log](#14-change-log)

---

## 1. Project Overview

### 1.1 Description
The Customer Portal is a comprehensive property management system designed for residential properties. It consists of two main applications:

1. **Customer Portal** - For residents to submit work orders, view schedules, make payments, and contact support
2. **Admin Portal** - For property managers and administrators to manage residents, properties, units, and work orders

### 1.2 Objectives
- Provide residents with an easy-to-use interface for submitting maintenance requests
- Enable property managers to efficiently manage multiple properties and units
- Implement secure user registration with verification against leasing records
- Generate unique property IDs for tracking work orders
- Support role-based access control for administrative functions

### 1.3 Target Users
- **Residents** - Tenants living in managed properties
- **Executives** - Property managers who can enter and manage data
- **Administrators** - Full system access with CRUD operations on all data

---

## 2. Technology Stack

### 2.1 Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI Framework |
| Vite | 5.0.8 | Build Tool & Dev Server |
| React Router DOM | 6.20.1 | Client-side Routing |
| TailwindCSS | 3.3.6 | Utility-first CSS Framework |
| Lucide React | 0.294.0 | Icon Library |
| Axios | 1.6.2 | HTTP Client |

### 2.2 Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 24.13.0 | JavaScript Runtime |
| Express.js | 4.18.2 | Web Framework |
| MySQL2 | 3.6.5 | Database Driver |
| bcryptjs | 2.4.3 | Password Hashing |
| Multer | 1.4.5-lts.1 | File Upload Handling |
| CORS | 2.8.5 | Cross-Origin Resource Sharing |
| dotenv | 16.3.1 | Environment Variables |
| UUID | 9.0.1 | Unique ID Generation |
| Nodemon | 3.0.2 | Development Auto-restart |

### 2.3 Database

| Technology | Version | Purpose |
|------------|---------|---------|
| MySQL | 8.0+ | Relational Database |

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND LAYER                               │
├─────────────────────────────┬───────────────────────────────────┤
│  Public Website (React)     │   Admin Portal (React)            │
│  Port: 3000                 │   Port: 3001/3002                 │
│  - Landing Page             │   - System Administration Portal  │
│  - Service Browsing         │   - FP Manager Portal             │
│  - Login to Portal          │   - Manager/Coordinator Portal    │
│                             │   - Supervisor/Executive Portal   │
│                             │   - Customer/Vendor Portal        │
└─────────────────────────────┴───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER                                 │
│                  Express.js Backend                              │
│                     Port: 5000                                   │
├─────────────────────────────────────────────────────────────────┤
│  Routes:                                                         │
│  - /api/admin/*            (Admin operations)                   │
│  - /api/franchise-partner/*(FP Manager operations)              │
│  - /api/manager/*          (Manager operations)                 │
│  - /api/coordinator/*      (Coordinator operations)             │
│  - /api/supervisor/*       (Supervisor operations)              │
│  - /api/executive/*        (Executive operations)               │
│  - /api/vendors/*          (Vendor management)                  │
│  - /api/estimates/*        (Estimate management)                │
│  - /api/work-orders/*      (Work order CRUD)                    │
│  - /api/qr/*               (QR tracking)                        │
│  - /api/onboarding/*       (Property onboarding)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
│                   MySQL Database                                 │
│                   Port: 3306                                     │
├─────────────────────────────────────────────────────────────────┤
│  Tables:                                                         │
│  - onboarded_properties, onboarded_vendors                      │
│  - work_orders, work_order_attachments, work_order_history      │
│  - fp_estimates, fp_employees, fp_employee_zones                │
│  - zones, categories, subcategories                             │
│  - admin_users, audit_logs, qr_scans                            │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Request Flow

1. User interacts with React frontend
2. Frontend makes HTTP request to Express backend via Vite proxy
3. Backend validates request and queries MySQL database
4. Database returns data to backend
5. Backend formats response and sends to frontend
6. Frontend updates UI with received data

---

## 4. Directory Structure

```
XlandInfra/
├── backend/                          # Backend API Server
│   ├── config/
│   │   ├── database.js               # MySQL connection pool
│   │   ├── categories.js             # Static category data
│   │   └── realtime.js               # Real-time configuration
│   ├── database/
│   │   ├── migrations/               # Database migrations
│   │   ├── schema.sql                # Original database schema
│   │   └── schema_v2.sql             # Updated schema with all tables
│   ├── middleware/
│   │   ├── auth.js                   # Authentication middleware
│   │   ├── coordinatorScope.js       # Coordinator data scoping
│   │   ├── executiveScope.js         # Executive data scoping
│   │   └── zoneHelper.js             # Zone filtering utilities
│   ├── routes/
│   │   ├── admin.js                  # Admin CRUD & auth routes
│   │   ├── categories.js             # Category routes
│   │   ├── coordinator.js            # Coordinator portal routes
│   │   ├── estimates.js              # Estimate routes
│   │   ├── estimatesSync.js          # Estimate sync utilities
│   │   ├── executive.js              # Executive portal routes
│   │   ├── franchisePartner.js       # FP Manager routes
│   │   ├── manager.js                # Manager portal routes
│   │   ├── qr.js                     # QR tracking routes
│   │   ├── supervisor.js             # Supervisor portal routes
│   │   ├── vendors.js                # Vendor management routes
│   │   └── workOrders.js             # Work order routes
│   ├── uploads/                      # Uploaded files directory
│   ├── .env.example                  # Environment template
│   ├── package.json                  # Backend dependencies
│   └── server.js                     # Express server entry point
│
├── frontend/                         # Public Website Frontend
│   ├── public/                       # Static assets
│   ├── src/
│   │   ├── components/               # Reusable UI components
│   │   ├── data/                     # Static data files
│   │   ├── pages/                    # Page components
│   │   ├── App.jsx                   # Main app with routing
│   │   ├── index.css                 # Global styles
│   │   └── main.jsx                  # React entry point
│   └── package.json                  # Frontend dependencies
│
├── admin-portal/                     # Admin & Employee Portal Frontend
│   ├── public/                       # Static assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── estimates/            # Estimate components
│   │   │   ├── EmployeeLayout.jsx    # Employee portal layout
│   │   │   ├── Layout.jsx            # Admin layout with sidebar
│   │   │   └── VendorDetails.jsx     # Vendor details modal
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx         # Admin dashboard
│   │   │   ├── QRManagement.jsx      # QR tracking dashboard
│   │   │   ├── UserManagement.jsx    # User management
│   │   │   │
│   │   │   │ # FP Manager Portal
│   │   │   ├── FPDashboard.jsx       # FP Manager dashboard
│   │   │   ├── FPEstimates.jsx       # FP estimates management
│   │   │   ├── FPProperties.jsx      # FP properties
│   │   │   ├── FPVendors.jsx         # FP vendors
│   │   │   ├── FPWorkOrders.jsx      # FP work orders
│   │   │   ├── FPEmployees.jsx       # FP employee management
│   │   │   ├── FPEmployeeZones.jsx   # Zone assignments
│   │   │   │
│   │   │   │ # Manager Portal
│   │   │   ├── ManagerDashboard.jsx  # Manager dashboard
│   │   │   ├── ManagerEstimates.jsx  # Manager estimates
│   │   │   ├── ManagerProperties.jsx # Manager properties
│   │   │   ├── ManagerVendors.jsx    # Manager vendors
│   │   │   ├── ManagerWorkOrders.jsx # Manager work orders
│   │   │   │
│   │   │   │ # Coordinator Portal
│   │   │   ├── CoordinatorDashboard.jsx   # Coordinator dashboard
│   │   │   ├── CoordinatorEstimates.jsx   # Coordinator estimates
│   │   │   ├── CoordinatorProperties.jsx  # Coordinator properties
│   │   │   ├── CoordinatorVendors.jsx     # Coordinator vendors
│   │   │   ├── CoordinatorWorkOrders.jsx  # Coordinator work orders
│   │   │   ├── CoordinatorEmployees.jsx   # Coordinator employees
│   │   │   │
│   │   │   │ # Supervisor Portal
│   │   │   ├── SupervisorDashboard.jsx    # Supervisor dashboard
│   │   │   ├── SupervisorEstimates.jsx    # Supervisor estimates (view-only)
│   │   │   ├── SupervisorProperties.jsx   # Supervisor properties
│   │   │   ├── SupervisorVendors.jsx      # Supervisor vendors
│   │   │   ├── SupervisorWorkOrders.jsx   # Supervisor work orders
│   │   │   │
│   │   │   │ # Executive Portal
│   │   │   ├── ExecutiveDashboard.jsx     # Executive dashboard
│   │   │   ├── ExecutiveEstimates.jsx     # Executive estimates
│   │   │   ├── ExecutiveProperties.jsx    # Executive properties
│   │   │   ├── ExecutiveVendors.jsx       # Executive vendors
│   │   │   └── ExecutiveWorkOrders.jsx    # Executive work orders
│   │   │
│   │   ├── utils/                    # Utility stores and helpers
│   │   ├── App.jsx                   # Admin app with routing
│   │   ├── index.css                 # Admin global styles
│   │   └── main.jsx                  # React entry point
│   └── package.json                  # Admin dependencies
│
├── qr-service/                       # QR Code Service
│   ├── nginx/                        # Nginx configuration
│   ├── qr-codes/                     # Generated QR codes
│   └── server.js                     # QR service server
│
├── Project_Documentation.md          # This documentation file
├── README.md                         # Project README
├── DEPLOYMENT_GUIDE.md               # Deployment instructions
└── VPS_DEPLOYMENT_GUIDE.md           # VPS deployment guide
```

---

## 5. Database Design

### 5.1 Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  properties  │───────│    units     │───────│  residents   │
│              │ 1   N │              │ 1   N │              │
│  - id (PK)   │       │  - id (PK)   │       │  - id (PK)   │
│  - property_id│       │  - property_id│       │  - resident_id│
│  - name      │       │  - unit_number│       │  - unit_id   │
│  - address   │       │  - floor     │       │  - email     │
└──────────────┘       │  - bedrooms  │       │  - password  │
                       └──────────────┘       └──────────────┘
                                                     │
                              ┌───────────────────────┘
                              │
                              ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  categories  │───────│ subcategories│       │ work_orders  │
│              │ 1   N │              │       │              │
│  - id (PK)   │       │  - id (PK)   │───────│  - id (PK)   │
│  - name      │       │  - category_id│  N  1│  - work_order_id│
│  - icon      │       │  - name      │       │  - resident_id│
└──────────────┘       └──────────────┘       │  - property_id│
                                              │  - unit_id   │
┌──────────────┐       ┌──────────────┐       │  - category_id│
│ admin_users  │       │ attachments  │───────│  - status    │
│              │       │              │ N   1 └──────────────┘
│  - id (PK)   │       │  - id (PK)   │
│  - username  │       │  - work_order_id│
│  - role      │       │  - file_path │
└──────────────┘       └──────────────┘
```

### 5.2 Table Definitions

#### 5.2.1 properties
Stores property/building information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| property_id | VARCHAR(50) | UNIQUE, NOT NULL | Public property ID (e.g., PROP-ABC123) |
| name | VARCHAR(255) | NOT NULL | Property name |
| address | VARCHAR(500) | NOT NULL | Street address |
| city | VARCHAR(100) | | City name |
| state | VARCHAR(50) | | State/Province |
| zip_code | VARCHAR(20) | | Postal code |
| country | VARCHAR(100) | DEFAULT 'USA' | Country |
| is_active | BOOLEAN | DEFAULT TRUE | Active status |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation date |
| updated_at | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Last update |

#### 5.2.2 units
Stores individual unit information within properties.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| property_id | INT | FOREIGN KEY → properties(id) | Parent property |
| unit_number | VARCHAR(50) | NOT NULL | Unit number/name |
| floor | VARCHAR(20) | | Floor number |
| bedrooms | INT | DEFAULT 1 | Number of bedrooms |
| bathrooms | DECIMAL(2,1) | DEFAULT 1 | Number of bathrooms |
| square_feet | INT | | Unit size |
| is_occupied | BOOLEAN | DEFAULT FALSE | Occupancy status |
| is_active | BOOLEAN | DEFAULT TRUE | Active status |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation date |

#### 5.2.3 residents
Stores resident/tenant information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| resident_id | VARCHAR(50) | UNIQUE, NOT NULL | Public resident ID |
| unit_id | INT | FOREIGN KEY → units(id) | Assigned unit |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Email address |
| password_hash | VARCHAR(255) | | Hashed password |
| first_name | VARCHAR(100) | NOT NULL | First name |
| last_name | VARCHAR(100) | NOT NULL | Last name |
| phone | VARCHAR(20) | | Phone number |
| is_primary_resident | BOOLEAN | DEFAULT TRUE | Primary tenant flag |
| lease_start_date | DATE | | Lease start |
| lease_end_date | DATE | | Lease end |
| is_registered | BOOLEAN | DEFAULT FALSE | Portal registration status |
| registration_date | TIMESTAMP | | When user registered |
| is_active | BOOLEAN | DEFAULT TRUE | Active status |
| created_by | INT | FOREIGN KEY → admin_users(id) | Admin who created |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation date |

#### 5.2.4 admin_users
Stores administrator and staff accounts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| username | VARCHAR(100) | UNIQUE, NOT NULL | Login username |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Email address |
| password_hash | VARCHAR(255) | NOT NULL | Hashed password |
| first_name | VARCHAR(100) | NOT NULL | First name |
| last_name | VARCHAR(100) | NOT NULL | Last name |
| role | ENUM('admin', 'executive') | DEFAULT 'executive' | User role |
| is_active | BOOLEAN | DEFAULT TRUE | Active status |
| last_login | TIMESTAMP | | Last login time |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation date |

#### 5.2.5 categories
Stores work order categories.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| name | VARCHAR(100) | NOT NULL | Category name |
| icon | VARCHAR(50) | | Icon identifier |
| display_order | INT | DEFAULT 0 | Sort order |
| is_active | BOOLEAN | DEFAULT TRUE | Active status |

#### 5.2.6 subcategories
Stores work order subcategories.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| category_id | INT | FOREIGN KEY → categories(id) | Parent category |
| name | VARCHAR(100) | NOT NULL | Subcategory name |
| display_order | INT | DEFAULT 0 | Sort order |
| is_active | BOOLEAN | DEFAULT TRUE | Active status |

#### 5.2.7 work_orders
Stores maintenance work orders.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| work_order_id | VARCHAR(50) | UNIQUE, NOT NULL | Public work order ID |
| resident_id | INT | FOREIGN KEY → residents(id) | Submitting resident |
| property_id | INT | FOREIGN KEY → properties(id) | Property location |
| unit_id | INT | FOREIGN KEY → units(id) | Unit location |
| category_id | INT | FOREIGN KEY → categories(id) | Issue category |
| subcategory_id | INT | FOREIGN KEY → subcategories(id) | Issue subcategory |
| description | TEXT | | Problem description |
| permission_to_enter | ENUM('yes', 'no') | NOT NULL | Entry permission |
| entry_notes | TEXT | | Entry instructions |
| has_pet | ENUM('yes', 'no') | NOT NULL | Pet in unit |
| status | ENUM(...) | DEFAULT 'pending' | Order status |
| priority | ENUM(...) | DEFAULT 'normal' | Priority level |
| assigned_to | VARCHAR(255) | | Assigned technician |
| scheduled_date | DATETIME | | Scheduled service date |
| completed_date | DATETIME | | Completion date |
| notes | TEXT | | Internal notes |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Submission date |
| updated_at | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Last update |

#### 5.2.8 attachments
Stores work order file attachments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| work_order_id | INT | FOREIGN KEY → work_orders(id) | Parent work order |
| file_name | VARCHAR(255) | NOT NULL | Original filename |
| file_path | VARCHAR(500) | NOT NULL | Server file path |
| file_type | VARCHAR(100) | | MIME type |
| file_size | INT | | Size in bytes |
| uploaded_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Upload time |

### 5.3 Database Credentials

| Parameter | Value | Description |
|-----------|-------|-------------|
| Host | localhost | Database server |
| Port | 3306 | MySQL default port |
| Username | root | Database user |
| Password | (user-defined) | Set in .env file |
| Database | customer_portal | Database name |

---

## 6. Backend API Documentation

### 6.1 Base URL
```
http://localhost:5000/api
```

### 6.2 Response Format
All API responses follow this structure:
```json
{
  "success": true|false,
  "message": "Response message",
  "data": { ... } | [ ... ],
  "error": "Error message (if applicable)"
}
```

### 6.3 Admin Routes (`/api/admin`)

#### POST /api/admin/login
Authenticate admin user.

**Request Body:**
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

> **Note**: Demo credentials are configured via environment variables. See `backend/.env.example` for setup.

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "firstName": "System",
    "lastName": "Admin",
    "role": "admin"
  }
}
```

#### GET /api/admin/dashboard/stats
Get dashboard statistics.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "properties": 5,
    "units": 50,
    "residents": 45,
    "workOrders": 120,
    "pendingWorkOrders": 15,
    "completedWorkOrders": 100
  }
}
```

#### GET /api/admin/residents
Get all residents.

#### POST /api/admin/residents
Create new resident.

**Request Body:**
```json
{
  "unitId": 1,
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "555-0123",
  "leaseStartDate": "2024-01-01",
  "leaseEndDate": "2025-01-01",
  "adminId": 1
}
```

#### PUT /api/admin/residents/:id
Update resident.

#### DELETE /api/admin/residents/:id
Soft delete resident.

#### GET /api/admin/properties
Get all properties with unit counts.

#### POST /api/admin/properties
Create new property.

#### PUT /api/admin/properties/:id
Update property.

#### DELETE /api/admin/properties/:id
Soft delete property.

#### GET /api/admin/units
Get all units with property info.

#### POST /api/admin/units
Create new unit.

#### PUT /api/admin/units/:id
Update unit.

#### DELETE /api/admin/units/:id
Soft delete unit.

#### GET /api/admin/work-orders
Get all work orders with details.

#### PUT /api/admin/work-orders/:id
Update work order status.

### 6.4 Resident Routes (`/api/residents`)

#### POST /api/residents/verify
Verify resident information against leasing records.

**Request Body:**
```json
{
  "unitId": 1,
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "555-0123"
}
```

#### POST /api/residents/register
Complete resident registration with password.

**Request Body:**
```json
{
  "residentId": "RES-ABC123",
  "password": "securepassword"
}
```

#### POST /api/residents/login
Authenticate resident.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

#### GET /api/residents/profile/:residentId
Get resident profile.

### 6.5 Unit Routes (`/api/units`)

#### GET /api/units
Get all units for registration dropdown.

#### GET /api/units/property/:propertyId
Get units by property.

### 6.6 Property Routes (`/api/properties`)

#### GET /api/properties
Get all properties.

#### GET /api/properties/:id
Get property by ID.

### 6.7 Category Routes (`/api/categories`)

#### GET /api/categories
Get all categories with subcategories.

#### GET /api/categories/:id/subcategories
Get subcategories for a category.

### 6.8 Work Order Routes (`/api/work-orders`)

#### POST /api/work-orders
Create new work order.

**Request Body (multipart/form-data):**
- categoryId: number
- subcategoryId: number
- description: string
- permissionToEnter: 'yes' | 'no'
- entryNotes: string
- hasPet: 'yes' | 'no'
- residentId: number
- propertyId: number
- unitId: number
- attachments: File[] (optional)

#### GET /api/work-orders/:id
Get work order details.

#### GET /api/work-orders/resident/:residentId
Get work orders for a resident.

---

## 7. Frontend Applications

### 7.1 Customer Portal

#### 7.1.1 Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | /login | User authentication |
| Register | /register | New resident registration |
| Dashboard | / | Home page with quick actions |
| Work Order | /work-order | Submit maintenance request |
| Schedule | /schedule | View appointments (placeholder) |
| Payment | /payment | Make payments (placeholder) |
| Contact | /contact | Support information |

#### 7.1.2 Components

- **Layout.jsx** - Main layout with header, navigation, user menu, and mobile bottom nav
- **Dashboard.jsx** - Welcome message, property info card, navigation cards
- **WorkOrder.jsx** - Multi-step form with category selection, description, permissions, file upload
- **Login.jsx** - Email/password authentication form
- **Register.jsx** - 3-step registration (verify info → set password → success)

#### 7.1.3 Authentication Flow

1. User visits `/login` or `/register`
2. For new users: Enter info matching leasing records → Verify → Set password
3. For existing users: Enter email/password → Login
4. On success, user data stored in localStorage
5. Protected routes redirect to `/login` if not authenticated
6. Logout clears localStorage and redirects to `/login`

### 7.2 Admin Portal

#### 7.2.1 Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | / (when not auth) | Admin authentication |
| Dashboard | / | Stats overview and quick actions |
| Residents | /residents | CRUD for residents |
| Properties | /properties | CRUD for properties |
| Units | /units | CRUD for units |
| Work Orders | /work-orders | View and manage work orders |
| Categories | /categories | Category management |
| Service Portal | /service-portal | Task 2 - Data Entry Module |

#### 7.2.2 Components

- **Layout.jsx** - Sidebar navigation, admin info, logout button
- **Dashboard.jsx** - Stat cards, quick actions, system info
- **Residents.jsx** - Table with search, add/edit modal, delete
- **Properties.jsx** - Table with search, add/edit modal, delete
- **Units.jsx** - Table with search, add/edit modal, delete
- **WorkOrders.jsx** - Table with search, filter by status, detail modal
- **Categories.jsx** - Category and subcategory management
- **ServicePortal.jsx** - Task 2 Data Entry with step-by-step workflows

#### 7.2.3 Role-Based Access

| Feature | Admin | Executive |
|---------|-------|-----------|
| View all data | ✅ | ✅ |
| Create records | ✅ | ✅ |
| Edit records | ✅ | ✅ |
| Delete records | ✅ | ❌ |
| Update work order status | ✅ | ✅ |

---

## 8. Authentication & Authorization

### 8.1 Password Security

- Passwords hashed using bcryptjs with salt rounds of 10
- Passwords stored as hash in database, never plain text
- Minimum password length: 6 characters

### 8.2 Session Management

- Frontend stores user data in localStorage
- No server-side sessions (stateless API)
- User must re-login after clearing browser data

### 8.3 Demo Mode

When database is unavailable and demo mode is enabled, the system falls back to demo users.

**Configuration:**
Demo mode must be explicitly enabled via environment variables:
- Set `DEMO_MODE=true` in your `.env` file
- Set `DEMO_PASSWORD_HASH` to a bcrypt hash of your demo password

**Demo Users (when enabled):**
| Username | Role |
|----------|------|
| demo_admin | Admin |
| demo_exec | Executive |

> **Security Note**: Demo credentials are NOT stored in code. They must be configured via environment variables. See `backend/.env.example` for setup instructions.

### 8.4 Resident Verification

New residents must verify their information matches leasing records:
1. Select unit from dropdown
2. Enter email, first name, last name
3. System checks against pre-registered resident data
4. If match found, proceed to set password
5. If no match, show error message

---

## 9. Role-Based Access Control (RBAC) & Workflows

### 9.1 Role Hierarchy & Summary

| Role | Display Name | Description |
|------|--------------|-------------|
| admin | System Admin | Full system control, manage users, override all actions |
| fp_manager | FP Manager | Franchise Partner manager with full FP access |
| manager | Operations Manager | Estimates, schedules, assigns vendor, closes work |
| coordinator | Coordinator | Property/vendor management, employee zone assignments |
| supervisor | Site Supervisor | Raises request and tracks work |
| executive | Executive | Enters basic data, view properties and work orders |
| vendor | Vendor | Executes work and updates status |

### 9.1.1 Zone-Based Access

| Portal | Zone Filtering |
|--------|----------------|
| FP Manager | Access to all zones under franchise |
| Manager | Access to assigned zones |
| Coordinator | Access to assigned zones |
| Supervisor | Access to assigned zones (view-only for estimates) |
| Executive | Access to assigned zones (limited features) |

### 9.2 Exact Workflows

#### Flow 1 – Data Entry (Executive/Supervisor/Manager/Admin)
**Steps:**
1. Enter client details
2. Enter vendor details
3. Enter property details
4. Save data

#### Flow 2 – Estimate Creation (Manager/Admin)
**Steps:**
1. Select property-based estimate or direct estimate
2. Add service/package
3. Add pricing
4. Save estimate
5. Approve estimate if needed

**Important Rules:**
- Manager can view pricing
- Supervisor can only view estimate
- Executive cannot access estimate

#### Flow 3 – Schedule Creation (Manager/Admin)
**Steps:**
1. Estimate is created
2. Package/service is confirmed
3. Manager creates schedule
4. Assign service date/cycle/frequency
5. Supervisor can only view schedule

**Important Rules:**
- Schedule should be created ONLY after package/service is created from estimate
- Supervisor cannot create or edit schedule

#### Flow 4 – Work Order Request (Supervisor/Manager/Admin)
**Steps:**
1. Work order request is raised
2. Request goes to Manager and Admin
3. Supervisor can create request
4. Supervisor can track request status

**Important Rules:**
- Supervisor cannot assign vendor
- Supervisor cannot close work order

#### Flow 5 – Vendor Assignment (Manager/Admin)
**Steps:**
1. Manager reviews work order request
2. Manager assigns vendor
3. Vendor receives work order
4. Supervisor can only view

#### Flow 6 – Vendor Work Status Update (Vendor)
**Steps:**
1. Vendor accepts work order
2. Vendor updates status
3. Vendor marks work as completed

**Vendor Status Options:** Assigned → Accepted → In Progress → Completed

**Important Rules:**
- Vendor cannot close work order

#### Flow 7 – Work Order Closure (Manager/Admin)
**Steps:**
1. Vendor marks job as completed
2. Manager checks work completion
3. Manager closes work order

**Important Rules:**
- Only Manager or Admin can close
- Supervisor can view only

### 9.3 Status Flow

```
Draft → Work Order Requested → Under Review → Assigned to Vendor → Accepted by Vendor → In Progress → Completed by Vendor → Verified by Manager → Closed
```

### 9.4 Full Flow Chart

```
DATA ENTRY EXECUTIVE
    |
    |-- Add Client Details
    |-- Add Vendor Details
    |-- Add Basic Property Details
    |
    V

SUPERVISOR
    |
    |-- View Data
    |-- View Estimate
    |-- View Schedule
    |-- Raise Work Order Request
    |-- Track Work Order Status
    |
    X Cannot Assign Vendor
    X Cannot Close Work Order
    |
    V

MANAGER
    |
    |-- Create Estimate
    |-- View Pricing
    |-- Create Schedule after Estimate/Package
    |-- Review Work Order Request
    |-- Assign Vendor
    |-- Monitor Vendor Progress
    |-- Verify Completion
    |-- Close Work Order
    |
    V

VENDOR
    |
    |-- Receive Assigned Work Order
    |-- Update Status
    |-- Mark Work Completed
    |
    X Cannot Close Work Order
    |
    V

ADMIN
    |
    |-- Full Access
    |-- Manage Users
    |-- Manage Settings
    |-- Override All Actions
    |-- Close / Reopen / Delete if needed
```

### 9.5 Module-Wise Flow

#### A. Master Data
**Created and maintained by:** Admin (full), Manager (limited)

**Contains:**
- Zones
- Divisions
- Properties
- Categories
- Problem Types
- Priorities
- Statuses
- Packages

#### B. Estimate
**Flow:**
1. Manager/Admin creates estimate
2. Pricing visible to Manager/Admin
3. Package created/selected
4. Schedule can be created

#### C. Schedule
**Flow:**
1. Estimate/Package created
2. Manager creates schedule
3. Supervisor can only view
4. Vendor will later receive work order assignment

#### D. Work Order
**Flow:**
1. Supervisor/Manager/Admin raises request
2. Manager/Admin reviews
3. Manager assigns vendor
4. Vendor updates status
5. Manager closes

### 9.6 Login-Based Menu Visibility

| Role | Menu Items |
|------|------------|
| **Admin** | Dashboard, Master Data, Staff Management, Vendor Management, Work Orders, Estimate, Schedules, Reports, Settings |
| **Manager** | Dashboard, Data Entry, Estimate, Pricing, Schedules, Work Orders, Vendors, Reports |
| **Supervisor** | Dashboard, Data Entry, Estimate (view), Schedule (view), Work Order Request, Work Order Tracking |
| **Executive** | Data Entry only |
| **Vendor** | Dashboard, My Work Orders, Notifications |

### 9.7 Module Access Matrix

| Module | Admin | Manager | Supervisor | Executive |
|--------|-------|---------|------------|-----------|
| Dashboard | Full | Full | View | No Access |
| Master Data | Full | Limited | No Access | No Access |
| Staff Management | Full | No Access | No Access | No Access |
| Vendor Management | Full | Full | View Only | Limited Entry |
| Data Entry | Full | Full | Full | Limited |
| Estimate | Full | Full | View Only | No Access |
| Pricing | Full | Full | No Access | No Access |
| Schedules | Full | Full | View Only | No Access |
| Work Order Request | Full | Full | Create/View | No Access |
| Assign Vendor | Full | Full | No Access | No Access |
| Close Work Order | Full | Full | No Access | No Access |
| Reports | Full | Limited | Limited | No Access |
| Notifications | Full | Full | View | No Access |
| Settings | Full | No Access | No Access | No Access |

### 9.8 Permission Logic by Action

| Permission | Admin | Manager | Supervisor | Executive |
|------------|-------|---------|------------|-----------|
| can_view | ✓ | ✓ | ✓ | limited |
| can_create | ✓ | ✓ | selected_modules | data_only |
| can_edit | ✓ | ✓ | limited | limited |
| can_delete | ✓ | limited | ✗ | ✗ |
| can_approve | ✓ | ✓ | ✗ | ✗ |
| can_assign | ✓ | ✓ | ✗ | ✗ |
| can_close | ✓ | ✓ | ✗ | ✗ |

### 9.9 Final Approval Logic

**Estimate:**
- Created by Manager/Admin
- Pricing visible only to Manager/Admin
- Supervisor can only view estimate summary if needed

**Schedule:**
- Created only by Manager/Admin
- Trigger only after estimate/package creation

**Work Order:**
- Raised by Supervisor/Manager/Admin
- Assigned only by Manager/Admin
- Closed only by Manager/Admin

**Vendor:**
- Can only update execution status
- Cannot close work order

---

## 10. Features & Functionalities

### 10.1 Work Order Management

#### Work Order Form Fields:
- **Category** - Dropdown with icons (Appliances, Electrical, HVAC, etc.)
- **Subcategory** - Dynamic based on category selection
- **Description** - Optional text area for details
- **Permission to Enter** - Yes/No radio buttons
- **Entry Notes** - Conditional text area if permission granted
- **Pet Information** - Yes/No radio buttons
- **File Attachments** - Multiple files (images, documents, max 5MB each)

#### Work Order Statuses:
- `pending` - Newly submitted
- `assigned` - Assigned to technician
- `in_progress` - Work started
- `completed` - Work finished
- `cancelled` - Order cancelled

#### Work Order Priorities:
- `low` - Non-urgent
- `normal` - Standard priority
- `high` - Needs attention
- `emergency` - Urgent/safety issue

### 10.2 Unique ID Generation

| Entity | Format | Example |
|--------|--------|---------|
| Property | PROP-{timestamp36} | PROP-M1ABC2D |
| Resident | RES-{timestamp36} | RES-M1ABC2E |
| Work Order | WO-{timestamp}-{random} | WO-1713234567-A1B2 |

### 10.3 File Upload

- **Supported Types:** Images (jpg, png, gif), Documents (pdf, doc, docx)
- **Max File Size:** 5MB per file
- **Max Files:** 5 per work order
- **Storage Location:** `backend/uploads/`
- **Access URL:** `http://localhost:5000/uploads/{filename}`

### 10.4 Category System

| Category | Subcategories |
|----------|---------------|
| Appliances | Refrigerator, Stove/Oven, Dishwasher, Microwave, Washer, Dryer, Garbage Disposal |
| Electrical | Outlets, Light Fixtures, Ceiling Fan, Breaker/Fuse, Doorbell, Smoke Detector |
| HVAC | AC Not Cooling, Heater Not Working, Thermostat, Air Filter, Strange Noises, Leaking |
| Plumbing | Clogged Drain, Leaky Faucet, Running Toilet, Water Heater, Low Water Pressure, Garbage Disposal |
| Doors & Windows | Door Won't Lock, Window Stuck, Broken Glass, Screen Damage, Weather Stripping, Sliding Door |
| Pest Control | Ants, Roaches, Rodents, Bed Bugs, Wasps/Bees, Spiders |
| General | Keys/Locks, Painting, Flooring, Ceiling, Walls, Cabinets |
| Safety | Smoke Detector, Carbon Monoxide, Fire Extinguisher, Emergency Lighting, Handrails |

---

## 10. Configuration & Environment

### 10.1 Backend Environment Variables

**File:** `backend/.env`

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=customer_portal

# File Upload Configuration
MAX_FILE_SIZE=5242880
UPLOAD_DIR=uploads
```

### 10.2 Frontend Configuration

**File:** `frontend/vite.config.js`

```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
```

### 10.3 Admin Portal Configuration

**File:** `admin-portal/vite.config.js`

```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
```

### 10.4 TailwindCSS Configuration

**Primary Color Palette:**
```javascript
primary: {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
}
```

---

## 11. Installation & Setup

### 11.1 Prerequisites

- Node.js v18+ (v24.13.0 recommended)
- npm v9+
- MySQL 8.0+
- Git

### 11.2 Clone Repository

```bash
git clone <repository-url>
cd customer-portal
```

### 11.3 Backend Setup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create environment file
copy .env.example .env

# Edit .env with your database credentials
# DB_PASSWORD=your_mysql_password

# Start development server
npm run dev
```

### 11.4 Database Setup

```bash
# Login to MySQL
mysql -u root -p

# Create database
CREATE DATABASE customer_portal;

# Use database
USE customer_portal;

# Run schema
SOURCE database/schema_v2.sql;

# Verify tables
SHOW TABLES;
```

### 11.5 Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 11.6 Admin Portal Setup

```bash
# Navigate to admin portal
cd admin-portal

# Install dependencies
npm install

# Start development server
npm run dev
```

### 11.7 Verify Installation

| Service | URL | Expected Result |
|---------|-----|-----------------|
| Backend | http://localhost:5000/api/health | JSON with status: "ok" |
| Frontend | http://localhost:5173 | Login page |
| Admin Portal | http://localhost:3001 | Admin login page |

---

## 12. Development Workflow

### 12.1 Development Commands

| Command | Location | Description |
|---------|----------|-------------|
| `npm run dev` | backend/ | Start backend with nodemon |
| `npm run dev` | frontend/ | Start customer portal |
| `npm run dev` | admin-portal/ | Start admin portal |
| `npm run build` | frontend/ | Build for production |
| `npm run build` | admin-portal/ | Build for production |

### 12.2 Git Workflow

1. Create feature branch: `git checkout -b feature/feature-name`
2. Make changes and commit: `git commit -m "Add feature"`
3. Push branch: `git push origin feature/feature-name`
4. Create pull request
5. Merge after review

### 12.3 Testing Workflow

1. Start backend server
2. Start frontend(s)
3. Test features manually
4. Check browser console for errors
5. Check terminal for server errors

### 12.4 Debugging Tips

- **Backend Errors:** Check terminal running `npm run dev`
- **Frontend Errors:** Check browser DevTools Console
- **Network Issues:** Check DevTools Network tab
- **Database Issues:** Check MySQL connection and credentials

---

## 13. Security Considerations

### 13.1 Implemented Security Measures

- ✅ Password hashing with bcrypt
- ✅ CORS configuration for allowed origins
- ✅ Input validation on API endpoints
- ✅ Parameterized SQL queries (prevent SQL injection)
- ✅ File upload validation (type and size)
- ✅ Environment variables for sensitive data

### 13.2 Recommended for Production

- ⚠️ Implement JWT tokens for authentication
- ⚠️ Add rate limiting to API endpoints
- ⚠️ Enable HTTPS
- ⚠️ Set secure cookie flags
- ⚠️ Add request logging and monitoring
- ⚠️ Implement CSRF protection
- ⚠️ Add input sanitization
- ⚠️ Use Helmet.js for security headers

### 13.3 Sensitive Files (Do Not Commit)

- `backend/.env` - Database credentials
- `backend/uploads/*` - User uploaded files
- `node_modules/` - Dependencies

---

## 14. Change Log

### Version 3.2.0 (June 16, 2026)

#### Work Order Email System Overhaul

**1. Responsive Email Templates**
- Fixed text wrapping for mobile/tablet devices with proper responsive design
- Updated email template layout for better readability across all screen sizes
- Removed redundant timestamps from email notifications

**2. Zone-Centric Email Notifications**
- Work order creation emails now sent to FP and zone-assigned employees
- Completion notifications sent to both admin and customer
- Employee email lookup based on zone assignments

**3. Created By Tracking in Admin**
- Admin work orders show creator name and property ID for customer submissions
- Status dropdown visibility fixed in Admin portal
- Removed status dropdown from Manager portal (employees have View only)

---

#### PDF Export Major Improvements

**1. Page Break Handling**
- Fixed PDF table rows splitting across pages
- Added proper height constraints for all sections
- Keep Add-ons header with at least first row on same page

**2. Enhanced Fields & Layout**
- Added Tower/Block fields to PDF exports
- Property Details uses same blue color as Customer Details
- Description column width adjusted to 75mm for full text display
- Dynamic row height for full descriptions (removed 35-char truncation)

**3. Discount/GST Display**
- Always show GST in price summary
- Show discount only when value > 0
- Changed discount color from green to gray

**4. Status Badge & Notes**
- Added estimate status badge to PDF exports
- Notes section moved after Price Summary

---

#### FP Portal Links Feature

**1. Portal Link Management**
- Track FP portal URLs (Customer Portal, Vendor Portal, Website)
- Done status tracking with visual indicators
- Aggregated view for Admin to see all FP portal links
- Database migration: Added `fp_portal_links` table

---

#### FP Shared Resources

**1. Admin Integration**
- View FP-specific resources when creating estimates for specific FP
- FP selector dropdown in Create Estimate tab
- Aggregated FP Shared Resources for Admin All FPs view
- Ops Manager access to FP Shared Resources

---

#### Division Field Fixes

**1. Database Joins**
- Division field correctly joins with `fp_divisions` table
- Uses `division_name` alias with fallback across all portals
- Fixed Property Management tables for all user portals

---

#### Zone Filtering Enhancements

**1. Zone Helper Improvements**
- Subquery to convert zone names to zone IDs for properties table
- Fixed data restriction when no zones assigned
- Employee ID check added to zone filter for all employee portals

**2. Work Order Visibility**
- Work orders visible to zone-assigned employees
- Config categories used instead of DB query (fixes 'Unknown column' errors)

---

#### Frequency/Visits Column Separation

**1. All View Modals**
- Frequency shows type only (e.g., "Monthly")
- Visits shows count only (e.g., "12")
- Never combine as "12x Monthly" - always separate columns

**2. PDF & Email**
- Strip "Nx " prefix from Frequency column
- Email format: "{frequencyType} - {count} visits"

---

#### AMC Package & Add-on Descriptions

**1. Description Enrichment**
- All employee routes parse `addons_data` JSON
- Enrich with descriptions from `fp_addons` table
- Package services fetched from AMC package if not stored in estimate

---

#### Customer Portal Improvements

**1. Login Fixes**
- Added JOIN with properties table for complete property details
- Property lookup by both `id` and `property_id` columns

**2. Password Reset UI**
- Fixed icon overlap with placeholder text in ForgotPassword/ResetPassword pages

---

#### UI/UX Improvements

- Hero banner smooth crossfade transitions
- Corporate Landing page added
- Employee Zone Management UI updated
- Removed Business Documents section from vendor forms
- Updated favicon to optimized company logo (29KB)
- IST timezone in emails

---

### Version 3.1.0 (June 10, 2026)

#### Estimate Descriptions Enhancement

**1. Full Description Support**
- AMC package descriptions stored and displayed
- Service descriptions from AMC packages
- Add-on descriptions from fp_addons table

**2. PDF & Email**
- PDF exports include full descriptions
- Email notifications with PDF attachment
- Simplified estimate email with customer/property details

---

### Version 3.0.1 (June 8, 2026)

#### PDF Export Enhancements

**1. Add-ons Table Update**
- Add-ons table matches services table format
- Columns: #, Add-on Service, Frequency, No. of Visits

**2. Header Design**
- Clean white header with XLand Infra gold logo
- Company tagline "Property Management Solutions"
- Document badge with dark slate background

---

### Version 3.0.0 (June 5, 2026)

#### Franchise Partner (FP) Portal System

**1. Complete Multi-Role FP Portal**
- Implemented full Franchise Partner portal system with four employee roles:
  - **FP Manager**: Full access to properties, vendors, employees, estimates, work orders
  - **Coordinator**: Property and vendor management, employee zone assignments
  - **Supervisor**: View-only estimates, work order tracking and requests
  - **Executive**: Data entry, property viewing, basic work order access
- Each role has dedicated login, dashboard, and role-specific functionality
- Elegant gold/amber theme throughout FP portal

**2. Zone-Centric Data Architecture**
- Implemented zone-based data filtering across all portals
- Employees see only data from their assigned zones
- Zone helper middleware (`zoneHelper.js`) for consistent zone filtering
- Employee zone management for Managers and Coordinators
- Zone display on dashboards showing assigned zones

**3. Created By Tracking**
- All estimates, properties, vendors, and work orders track creator
- `created_by_name` field shows employee name (not just ID)
- Creator lookup from `fp_employees` table
- Visible in all portal list views and detail modals

**Files Added:**
- `admin-portal/src/pages/FPDashboard.jsx` - FP Manager dashboard
- `admin-portal/src/pages/FPEstimates.jsx` - FP estimates management
- `admin-portal/src/pages/FPProperties.jsx` - FP properties
- `admin-portal/src/pages/FPVendors.jsx` - FP vendors
- `admin-portal/src/pages/FPWorkOrders.jsx` - FP work orders
- `admin-portal/src/pages/FPEmployees.jsx` - FP employee management
- `admin-portal/src/pages/FPEmployeeZones.jsx` - Zone assignments
- `admin-portal/src/pages/CoordinatorDashboard.jsx` - Coordinator portal
- `admin-portal/src/pages/CoordinatorEstimates.jsx` - Coordinator estimates
- `admin-portal/src/pages/CoordinatorProperties.jsx` - Coordinator properties
- `admin-portal/src/pages/CoordinatorVendors.jsx` - Coordinator vendors
- `admin-portal/src/pages/CoordinatorWorkOrders.jsx` - Coordinator work orders
- `admin-portal/src/pages/CoordinatorEmployees.jsx` - Coordinator employee view
- `backend/routes/coordinator.js` - Coordinator API routes
- `backend/middleware/zoneHelper.js` - Zone filtering utilities

---

#### Estimates System Overhaul

**1. Created By Column**
- Added `created_by_name` to all estimate routes
- Shows employee name in all estimate tables
- Admin migration endpoint to update existing estimates

**2. Archive/Restore Functionality**
- Full archive and restore for estimates
- Archived date tracking (`archived_at` column)
- Archive/Restore buttons in all portals (Manager, Coordinator, FP)
- Archived estimates view with restore option

**3. PDF Export Improvements**
- Clean ESTIMATE TOTAL layout (heading left, price right)
- Gold XI logo in PDF header
- Property type filtering in PDF content
- Customer details box styling matching portal
- Fixed page overflow issues
- Proper add-ons parsing and display

**4. Add-ons Filtering by Property Type**
- Add-ons dropdown filtered by selected property type
- Only matching add-ons shown in selection
- Consistent filtering across all portals

**5. fp_estimates Table Integration**
- All employee portals use `fp_estimates` table
- Proper `property_id` handling
- Packages and addons stored as JSON
- Sync with admin portal estimates

**Files Modified:**
- `admin-portal/src/pages/ManagerEstimates.jsx` - Created By, archive/restore
- `admin-portal/src/pages/CoordinatorEstimates.jsx` - Synced with Manager
- `admin-portal/src/pages/SupervisorEstimates.jsx` - View-only updates
- `admin-portal/src/pages/ExecutiveEstimates.jsx` - Property auto-populate
- `admin-portal/src/pages/FPEstimates.jsx` - Full FP implementation
- `backend/routes/estimates.js` - Archive/restore endpoints
- `backend/routes/estimatesSync.js` - Sync utilities

---

#### Vendor Management Updates

**1. Unified Vendor Schema**
- Migrated all vendors to `onboarded_vendors` table
- Added fields: GST, PAN, license, rating, login credentials
- Consistent schema across all portals

**2. Service Type Badges**
- Colored badges for service types (AMC, Ad-hoc, Contract)
- Filter tabs by service type
- Consistent styling across all portals

**3. Vendor Display Updates**
- Name on top, Vendor ID below in all tables
- Detailed view modals with full information
- Zone and area display in vendor details
- Coverage/Day column centered
- Removed Rate/Visit from certain portals

**4. Zone-Based Vendor Assignments**
- Vendors filtered by employee's assigned zones
- Assigned vendors endpoint for all portals
- Vendor-property assignments by zone

**Files Modified:**
- `admin-portal/src/pages/ManagerVendors.jsx` - Service type badges
- `admin-portal/src/pages/CoordinatorVendors.jsx` - Zone filtering
- `admin-portal/src/pages/SupervisorVendors.jsx` - View updates
- `admin-portal/src/pages/ExecutiveVendors.jsx` - Service type filter tabs
- `admin-portal/src/pages/FPVendors.jsx` - Full vendor management
- `backend/routes/vendors.js` - Unified schema routes

---

#### Work Order Improvements

**1. Email Notifications**
- Automatic email on work order creation
- Completion notification emails
- Implemented for all portal types

**2. Action Buttons Enhancement**
- Edit, assign, and delete functionality
- Status dropdown for updates
- Always visible action buttons
- View modal with all work order details

**3. Status and Filtering**
- Default to pending view
- Filter by status (Pending, In Progress, Completed)
- Status badges with color coding
- Lowercase status support

**4. Customer Name Display**
- COALESCE logic for proper client name
- Handles both work_orders and onboarded_properties tables
- Consistent display across all portals

**Files Modified:**
- `admin-portal/src/pages/ManagerWorkOrders.jsx` - Full action buttons
- `admin-portal/src/pages/CoordinatorWorkOrders.jsx` - Status filters
- `admin-portal/src/pages/SupervisorWorkOrders.jsx` - View modal updates
- `admin-portal/src/pages/ExecutiveWorkOrders.jsx` - Simplified view
- `admin-portal/src/pages/FPWorkOrders.jsx` - Full implementation
- `backend/routes/workOrders.js` - Email notifications

---

#### QR Code Tracking System

**1. Page Visit Tracking**
- Track every QR code scan
- Unique user identification
- Timestamp and visit count

**2. Geo/Timezone Data**
- Capture geographic location
- Timezone information
- Browser and device data

**3. Real-Time Updates**
- Live scan tracking on dashboard
- QR management page with analytics
- Main website vs customer portal detection

**Files Added/Modified:**
- `admin-portal/src/pages/QRManagement.jsx` - QR management dashboard
- `admin-portal/src/pages/Dashboard.jsx` - QR tracking integration
- `backend/routes/qr.js` - QR tracking API
- `qr-service/` - QR code service

---

#### Dashboard Synchronization

**1. All FP Dashboards Synced**
- Manager, Coordinator, Supervisor, Executive dashboards match layout
- Consistent statistics cards
- Work Order Summary section
- Quick actions by role

**2. Auto-Refresh**
- 30-second auto-refresh on Manager dashboard
- Syncs with FP updates in real-time

**3. Zone Display**
- Employee's assigned zones shown on dashboard
- Zone-filtered statistics

**Files Modified:**
- `admin-portal/src/pages/ManagerDashboard.jsx`
- `admin-portal/src/pages/CoordinatorDashboard.jsx`
- `admin-portal/src/pages/SupervisorDashboard.jsx`
- `admin-portal/src/pages/ExecutiveDashboard.jsx`
- `admin-portal/src/pages/FPDashboard.jsx`

---

#### UI/UX Improvements

**1. Modal Headers**
- Full gray background with rounded corners
- Consistent styling across all modals
- VendorDetails modal header fix

**2. Property Type Utilities**
- Shared utility for property type display
- Consistent label formatting (GC, Apt, Villa, Flat, Plot)
- Used across all portals

**3. Status Badges**
- Lowercase status support
- Color-coded badges by status type
- Consistent styling

**4. View-Only Buttons**
- Consistent styling for view buttons
- Removed action buttons from view-only portals
- Eye icon for view actions

**5. Portal Theme Updates**
- FP Portal: Soft gold/amber theme
- Reverted FP Portal to original amber/gray theme
- Employee Login icon and button softer gold shades

**Files Modified:**
- Multiple portal pages for consistent styling
- `admin-portal/src/components/VendorDetails.jsx`
- Various CSS and component updates

---

#### Employee Portal Restructure

**1. Role Rename**
- "Data Entry Executive" renamed to "Executive"
- Updated across all UI labels and code

**2. Property Table Updates**
- Removed Units column from Executive Properties table
- Keep Units in view modals only
- Added zone, area, division fields to queries

**3. AMC Packages Display**
- Supervisor AMC Packages show actual data like Manager
- Property Type, Services, Total Rate visible
- Proper JSON parsing for services

**Files Modified:**
- `admin-portal/src/pages/ExecutiveProperties.jsx`
- `admin-portal/src/pages/SupervisorEstimates.jsx`
- `backend/routes/executive.js`
- `backend/routes/supervisor.js`

---

#### Backend Enhancements

**1. New Routes Added**
- `backend/routes/coordinator.js` - Full coordinator routes
- Vendor assignments routes for all portals
- Admin vendors, employees, delete work order routes

**2. Middleware Updates**
- `coordinatorScope.js` - Coordinator data scoping
- `executiveScope.js` - Executive data scoping
- `zoneHelper.js` - Zone filtering helper

**3. Database Queries**
- Zone joins for properties, vendors, work orders
- FP ID lookup improvements
- COALESCE for customer names
- Proper column aliases

**Files Added:**
- `backend/middleware/zoneHelper.js`
- `backend/routes/coordinator.js`

**Files Modified:**
- `backend/routes/manager.js`
- `backend/routes/supervisor.js`
- `backend/routes/executive.js`
- `backend/routes/franchisePartner.js`
- `backend/routes/admin.js`
- `backend/routes/vendors.js`

---

### Version 2.1.0 (May 19, 2026)

#### Mobile Responsiveness & Performance Optimization

**1. Mobile Responsiveness Fixes**
- Fixed Property Management comparison table - now stacks cards vertically on mobile
- Fixed content overflow issues in feature boxes on mobile devices
- Updated viewport meta tag with proper mobile settings (`minimum-scale=1.0, maximum-scale=5.0, viewport-fit=cover`)
- Added touch optimization to prevent unwanted zoom-out on mobile

**2. Header & Navigation Improvements**
- Fixed Services dropdown positioning (aligned left, no more diamond arrow)
- Added invisible bridge element to prevent dropdown flickering on hover
- Made header background solid (95% opacity minimum) to prevent content showing through
- Company name "XLAND INFRA" now displays on mobile alongside logo
- Fixed dropdown stability across all devices

**3. Performance Optimizations**
- Implemented React.lazy() code splitting for all page components
- Added Suspense boundaries with loading spinner fallback
- GPU acceleration for smooth animations using `translateZ(0)`
- Layout containment (`contain: layout style`) to isolate repaints
- Simplified blur/shadow effects on mobile for better performance
- Added `prefers-reduced-motion` support for accessibility
- Image lazy loading with `content-visibility: auto`

**4. CSS Enhancements**
- Added comprehensive mobile media queries for responsive text sizing
- Fixed grid overflow issues with `min-width: 0` on flex/grid items
- Reduced backdrop blur intensity on mobile devices
- Added Safari mobile viewport fix using `-webkit-fill-available`

**Files Modified:**
- `frontend/src/index.css` - Mobile responsiveness and performance CSS
- `frontend/src/index.html` - Updated viewport meta tag
- `frontend/src/App.jsx` - React.lazy code splitting
- `frontend/src/components/MainHeader.jsx` - Header and dropdown fixes
- `frontend/src/pages/CorporateLanding.jsx` - Header and dropdown fixes
- `frontend/src/pages/services/PropertyManagement.jsx` - Responsive comparison table

**Benefits:**
- Faster initial page load with code splitting
- Smoother scrolling and animations on all devices
- No more content overflow on mobile
- Stable dropdown navigation
- Better accessibility with reduced motion support

---

### Version 2.0.1 (April 29, 2026)

#### Work Order & Estimates Enhancement

**1. Work Order Form - Category & Subcategory ADD Buttons**
- Replaced custom dropdowns with `SelectWithAdd` component
- **Categories**: Admins can now add new categories directly from work order form
- **Subcategories**: Admins can now add new subcategories directly from work order form
- Added `handleAddCategory` and `handleAddSubcategory` functions
- Auto-selects newly added category/subcategory after creation
- Integrates with `fieldOptionsStore` for persistence

**2. Estimates Panel - Service Type ADD Button**
- Replaced custom `ServiceSelector` with `SelectWithAdd` component
- **Service Type**: Admins can now add new service types directly from estimates panel
- Consistent UI/UX across all dropdowns with ADD functionality
- Simplified code by reusing the common `SelectWithAdd` component

**Files Modified:**
- `admin-portal/src/pages/EmployeeWorkOrders.jsx` - Category/Subcategory dropdowns updated
- `admin-portal/src/components/estimates/ServiceSelector.jsx` - Replaced with SelectWithAdd

**Benefits:**
- Unified ADD button experience across all forms
- Reduced code duplication
- Easier maintenance and consistency
- Admins can add options without leaving the current form

---

### Version 2.0.0 (April 29, 2026)

#### Major Enhancement: Multi-Portal System Administration

**1. System Administration Portal Redesign**
- Completely redesigned Portal Selector with **black & gold elegant theme**
- **Customer Portal** and **Vendor Portal** now as main highlighted cards
- **Employee Portal** moved to top-right header as compact button
- Added animated gradient effects, shine animations, and modern hover states
- Responsive design for all screen sizes

**2. Portal Routing & Session Management**
- Fixed routing issue where "Login to Portal" bypassed portal selection
- Added automatic session clearing when accessing from public frontend
- Each portal type (Employee, Customer, Vendor) has its own login and dashboard
- Unified URL structure under single admin-portal application

**3. Terminology Standardization: Client → Customer**
- **Renamed Files:**
  - `CreateClient.jsx` → `CreateCustomer.jsx`
  - `ClientSubmissions.jsx` → `CustomerSubmissions.jsx`
- **Updated Routes:**
  - `/employee/create-client` → `/employee/create-customer`
  - `/employee/client-submissions` → `/employee/customer-submissions`
- All UI labels, form titles, and navigation updated to use "Customer"
- Backend maintains internal "client" for database compatibility

**4. Dynamic Field Management System**
- Created `fieldOptionsStore.js` for managing dropdown field options
- Created `SelectWithAdd.jsx` component for dropdowns with ADD functionality
- **Fields with ADD capability:**
  - Service Type (in Add Vendor form)
  - Division (in Add Vendor and Create Customer forms)
  - Categories and Sub-categories (managed via Categories page)
- Admins can add new options directly while filling forms

**5. Sidebar Navigation Cleanup**
- Removed ADD buttons from sidebar menu sections
- Streamlined navigation structure
- Clean separation between Vendor Management and Employee Management sections

**6. Employee Portal Enhancements**
- Added **Zone Management** page for managing operational zones
- Added **Employee Details** page with employee listing
- Added **Add Employee** form with validation
- Added **Assigned Vendors** page for vendor-property assignments
- Implemented vendor and employee assignment functionality in Customer Submissions

**Files Added:**
- `admin-portal/src/utils/fieldOptionsStore.js` - Field options management
- `admin-portal/src/components/SelectWithAdd.jsx` - Dropdown with ADD button
- `admin-portal/src/pages/ZoneManagement.jsx` - Zone management page
- `admin-portal/src/pages/AddEmployee.jsx` - Add employee form
- `admin-portal/src/pages/EmployeeDetails.jsx` - Employee listing
- `admin-portal/src/pages/AssignedVendors.jsx` - Vendor assignments
- `admin-portal/src/utils/zoneStore.js` - Zone data management
- `admin-portal/src/utils/employeeStore.js` - Employee data management
- `admin-portal/src/utils/assignmentStore.js` - Assignment management

**Files Modified:**
- `admin-portal/src/pages/PortalSelector.jsx` - Complete redesign
- `admin-portal/src/components/EmployeeLayout.jsx` - Navigation updates
- `admin-portal/src/App.jsx` - Route updates
- `admin-portal/src/pages/Dashboard.jsx` - Quick actions updates
- `admin-portal/src/pages/CustomerSubmissions.jsx` - Vendor/Employee assignment
- `frontend/src/pages/CustomerHome.jsx` - Session clearing on login

**Known Issues Resolved:**
- Fixed: "Login to Portal" bypassing portal selection
- Fixed: Old session persisting after logout
- Fixed: Inconsistent "Client" vs "Customer" terminology
- Fixed: Missing ADD functionality for dynamic fields

---

### Version 1.0.2 (April 21, 2026)

#### Task 2 - Service Portal with Data Entry Module

**New Feature: Service Portal (`/service-portal`)**

Added a comprehensive Data Entry module in the Admin Portal supporting three separate property entry workflows:

**Entry Types:**
- **Gated Community (GC)** - 10-step wizard for gated communities with multiple blocks
- **Apartment (APT)** - 10-step wizard for apartment buildings
- **Villas/Plots** - 9-step wizard for individual villas or plots

**Gated Community Workflow (10 Steps):**
1. Zone Selection (North, South, East, West, Central)
2. Area Name (text input)
3. Division Selection (Division A, B, C, D)
4. Property Type (Residential, Commercial, Mixed)
5. Community Name
6. Association/Client Details (Name, Email, Phone) with "Add Another Contact" option
7. Number of Blocks
8. Units per Block (dynamic inputs) + Total Flats calculation
9. Address/Landmark + Pin Location
10. Notes

**Apartment Workflow (10 Steps):**
1. Zone Selection
2. Area Name
3. Division Selection
4. Property Type (High Rise, Mid Rise, Low Rise)
5. Community Name
6. Association/Client Details with multiple contacts support
7. Block Information with N/A checkbox option
8. Number of Units
9. Address/Landmark + Pin Location
10. Notes

**Villas/Plots Workflow (9 Steps):**
1. Zone Selection
2. Area Name
3. Division Selection
4. Property Type (Villa, Plot - Residential, Plot - Commercial)
5. Community Name
6. Association/Client Details with multiple contacts support
7. Villa/Plot Number
8. Address/Landmark + Pin Location
9. Notes

**UI Features:**
- Visual step progress indicator with icons
- Step validation (Next button disabled until required fields completed)
- Real-time Entry Summary panel
- Success screen with "Add Another Entry" option
- Entry type badges with color coding (Blue for GC, Green for APT, Amber for Villas)
- Responsive design for all screen sizes

**Files Added/Modified:**
- ✅ `admin-portal/src/pages/ServicePortal.jsx` - New component (867 lines)
- ✅ `admin-portal/src/pages/Categories.jsx` - Category management
- ✅ `admin-portal/src/App.jsx` - Added route for `/service-portal`
- ✅ `admin-portal/src/components/Layout.jsx` - Added navigation item

**Navigation:**
- Added "Service Portal" link in admin sidebar with FileInput icon
- Accessible at route `/service-portal`

---

### Version 1.0.1 (April 17, 2026)

#### Database Setup Complete

**MySQL Installation:**
- ✅ Installed MySQL Community Server 8.0.45
- ✅ Configured MySQL as Windows Service (MySQL80)
- ✅ Set root password: `Database@321`
- ✅ Created `customer_portal` database
- ✅ Ran schema_v2.sql - created all 9 tables

**Tables Created:**
- `admin_users` - Admin/Executive accounts
- `attachments` - Work order file attachments
- `audit_logs` - System audit trail
- `categories` - Work order categories
- `properties` - Property/building records
- `residents` - Tenant records
- `subcategories` - Work order subcategories
- `units` - Unit records
- `work_orders` - Maintenance requests

**Configuration Updated:**
- ✅ Updated `.env` with database password
- ✅ Backend now connects to real MySQL database
- ✅ Demo mode still available as fallback

---

### Version 1.0.0 (April 15, 2026)

#### Initial Release

**Backend:**
- ✅ Express.js server setup with middleware
- ✅ MySQL database connection with connection pooling
- ✅ Category and subcategory API routes
- ✅ Work order CRUD with file uploads
- ✅ Resident verification, registration, and login
- ✅ Unit and property management routes
- ✅ Admin authentication with role-based access
- ✅ Admin CRUD for residents, properties, units
- ✅ Dashboard statistics endpoint
- ✅ Demo mode fallback when database unavailable

**Customer Portal Frontend:**
- ✅ React + Vite setup with TailwindCSS
- ✅ Responsive layout with mobile navigation
- ✅ Dashboard with property info and quick actions
- ✅ Work order form with category dropdowns
- ✅ File upload with preview
- ✅ User login and registration flow
- ✅ Authentication state management

**Admin Portal Frontend:**
- ✅ Separate React + Vite application
- ✅ Sidebar navigation layout
- ✅ Admin login with demo credentials
- ✅ Dashboard with statistics cards
- ✅ Residents management with CRUD modal
- ✅ Properties management with CRUD modal
- ✅ Units management with CRUD modal
- ✅ Work orders list with status filter
- ✅ Role-based UI (Admin vs Executive)

**Database:**
- ✅ Schema v2 with all required tables
- ✅ Foreign key relationships
- ✅ Sample data for testing

---

## Appendix A: Troubleshooting

### A.1 Port Already in Use

```bash
# Find process using port
netstat -ano | findstr :5000

# Kill process
taskkill /PID <process_id> /F
```

### A.2 Database Connection Failed

1. Verify MySQL is running
2. Check credentials in `.env`
3. Ensure database exists
4. Check firewall settings

### A.3 CORS Errors

Verify backend CORS configuration includes frontend URLs:
```javascript
origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173']
```

### A.4 File Upload Failures

1. Check `uploads/` directory exists
2. Verify file size < 5MB
3. Check file type is allowed

---

## Appendix B: API Quick Reference

```
POST   /api/admin/login              - Admin login
GET    /api/admin/dashboard/stats    - Dashboard stats
GET    /api/admin/residents          - List residents
POST   /api/admin/residents          - Create resident
PUT    /api/admin/residents/:id      - Update resident
DELETE /api/admin/residents/:id      - Delete resident
GET    /api/admin/properties         - List properties
POST   /api/admin/properties         - Create property
PUT    /api/admin/properties/:id     - Update property
DELETE /api/admin/properties/:id     - Delete property
GET    /api/admin/units              - List units
POST   /api/admin/units              - Create unit
PUT    /api/admin/units/:id          - Update unit
DELETE /api/admin/units/:id          - Delete unit
GET    /api/admin/work-orders        - List work orders
PUT    /api/admin/work-orders/:id    - Update work order

POST   /api/residents/verify         - Verify resident info
POST   /api/residents/register       - Complete registration
POST   /api/residents/login          - Resident login
GET    /api/residents/profile/:id    - Get profile

GET    /api/units                    - List all units
GET    /api/units/property/:id       - Units by property
GET    /api/properties               - List properties
GET    /api/properties/:id           - Get property
GET    /api/categories               - List categories
POST   /api/work-orders              - Submit work order
GET    /api/work-orders/:id          - Get work order
```

---

The better choice is usually MySQL Community Server.

Why this is better:

It gives you only the database, which is cleaner for a real custom website setup.
It fits better with a React + Node.js + MySQL architecture.
It is closer to how a production server is usually structured.
You avoid extra bundled tools you may not need, like Apache/PHP from XAMPP.
When XAMPP is better

Choose XAMPP only if:

you want the fastest beginner setup
you are building a PHP/WordPress site locally
you want phpMyAdmin immediately without manual setup

For learning or quick testing, XAMPP is convenient.
For a more professional custom stack, it is not the best long-term choice.

For your case

Since you mentioned a project with React + Node.js + MySQL, the best option is:

MySQL Community Server

Because your stack would be:

Frontend: React
Backend: Node.js / Express
Database: MySQL Community Server

*End of Documentation*