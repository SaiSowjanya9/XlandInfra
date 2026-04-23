# Customer Portal - Project Documentation

> **Last Updated:** April 21, 2026 at 10:49 AM (UTC-05:00)
> **Version:** 1.0.2
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
│                        CLIENT LAYER                              │
├─────────────────────────────┬───────────────────────────────────┤
│   Customer Portal (React)   │      Admin Portal (React)         │
│   Port: 5173                │      Port: 3001                   │
└─────────────────────────────┴───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER                                 │
│                  Express.js Backend                              │
│                     Port: 5000                                   │
├─────────────────────────────────────────────────────────────────┤
│  Routes:                                                         │
│  - /api/admin/*        (Admin operations)                       │
│  - /api/residents/*    (Resident auth & profile)                │
│  - /api/units/*        (Unit management)                        │
│  - /api/properties/*   (Property management)                    │
│  - /api/categories/*   (Work order categories)                  │
│  - /api/work-orders/*  (Work order CRUD)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
│                   MySQL Database                                 │
│                   Port: 3306                                     │
├─────────────────────────────────────────────────────────────────┤
│  Tables:                                                         │
│  - properties, units, residents, admin_users                    │
│  - categories, subcategories, work_orders, attachments          │
│  - audit_logs                                                    │
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
customer-portal/
├── backend/                          # Backend API Server
│   ├── config/
│   │   ├── database.js               # MySQL connection pool
│   │   └── categories.js             # Static category data
│   ├── database/
│   │   ├── schema.sql                # Original database schema
│   │   └── schema_v2.sql             # Updated schema with all tables
│   ├── routes/
│   │   ├── admin.js                  # Admin CRUD & auth routes
│   │   ├── categories.js             # Category routes
│   │   ├── properties.js             # Property routes
│   │   ├── residents.js              # Resident auth routes
│   │   ├── units.js                  # Unit routes
│   │   └── workOrders.js             # Work order routes
│   ├── uploads/                      # Uploaded files directory
│   ├── .env                          # Environment variables
│   ├── .env.example                  # Environment template
│   ├── package.json                  # Backend dependencies
│   └── server.js                     # Express server entry point
│
├── frontend/                         # Customer Portal Frontend
│   ├── public/
│   │   └── vite.svg                  # App icon
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.jsx            # Main layout with navigation
│   │   ├── data/
│   │   │   └── categories.js         # Frontend category data
│   │   ├── pages/
│   │   │   ├── Contact.jsx           # Contact/Help page
│   │   │   ├── Dashboard.jsx         # Home dashboard
│   │   │   ├── Login.jsx             # User login page
│   │   │   ├── Payment.jsx           # Payment page (placeholder)
│   │   │   ├── Register.jsx          # User registration page
│   │   │   ├── Schedule.jsx          # Schedule page (placeholder)
│   │   │   └── WorkOrder.jsx         # Work order submission form
│   │   ├── services/
│   │   │   └── api.js                # Axios API client
│   │   ├── App.jsx                   # Main app with routing
│   │   ├── index.css                 # Global styles
│   │   └── main.jsx                  # React entry point
│   ├── index.html                    # HTML template
│   ├── package.json                  # Frontend dependencies
│   ├── postcss.config.js             # PostCSS configuration
│   ├── tailwind.config.js            # TailwindCSS configuration
│   └── vite.config.js                # Vite configuration
│
├── admin-portal/                     # Admin Portal Frontend
│   ├── public/
│   │   └── vite.svg                  # Admin app icon
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.jsx            # Admin layout with sidebar
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx         # Admin dashboard with stats
│   │   │   ├── Login.jsx             # Admin login page
│   │   │   ├── Properties.jsx        # Property management
│   │   │   ├── Residents.jsx         # Resident management
│   │   │   ├── Units.jsx             # Unit management
│   │   │   ├── WorkOrders.jsx        # Work order management
│   │   │   ├── Categories.jsx        # Category management
│   │   │   └── ServicePortal.jsx     # Task 2 Data Entry module
│   │   ├── App.jsx                   # Admin app with routing
│   │   ├── index.css                 # Admin global styles
│   │   └── main.jsx                  # React entry point
│   ├── index.html                    # HTML template
│   ├── package.json                  # Admin dependencies
│   ├── postcss.config.js             # PostCSS configuration
│   ├── tailwind.config.js            # TailwindCSS configuration
│   └── vite.config.js                # Vite configuration
│
├── Project_Documentation.md          # This documentation file
└── README.md                         # Project README
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
  "username": "admin",
  "password": "admin123"
}
```

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

When database is unavailable, the system falls back to demo users:

**Admin Portal Demo Users:**
| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| exec | exec123 | Executive |

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
| admin | Admin | Full system control, manage users, override all actions |
| manager | Operations Manager | Estimates, schedules, assigns vendor, closes work |
| supervisor | Site Supervisor | Raises request and tracks work |
| executive | Data Entry Executive | Enters basic data only |
| vendor | Vendor | Executes work and updates status |

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
