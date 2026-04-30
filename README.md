# Customer Portal - Property Management System

A comprehensive full-stack web application for property management, work orders, vendor management, and AMC (Annual Maintenance Contract) packages, built with React, Node.js, and MySQL.

## Features

### Customer Portal
- **Work Order Management**: Submit maintenance and repair requests with categories and subcategories
- **18 Service Categories**: Including Lifts, AC, Plumbing, Electrical, Appliances, and more
- **File Attachments**: Upload images from camera roll, take photos, or attach PDFs
- **Permission to Enter**: Grant access for service personnel when you're unavailable
- **Pet Notification**: Alert service personnel about pets in the premises

### Admin Portal
- **Property Management**: Manage properties (GC, APT, VILLA, FLAT, PLOT) with full CRUD operations
- **Vendor Management**: Track and manage vendors with service assignments
- **Employee Management**: Manage employees with zone-based assignments
- **Estimates Module**:
  - **Create Estimate**: Property-based and direct estimates with auto-population
  - **AMC Package Manager**: Create and manage AMC packages with reusable templates
  - **AMC Templates**: Create templates per property type (AMC-GC, AMC-APT, AMC-VILLA) that auto-populate
  - **Add-ons**: Additional service management
  - **All Estimates**: View and manage all estimates
  - **Archived**: Access archived estimates
- **Contact Auto-Population**: Contact name, phone, and email auto-populate from Property Management
- **AMC Integration**: View AMC packages directly from Property Management table

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

## Recent Updates (April 2026)

### AMC Package Manager Enhancements
- **Property Type Selection**: Select GC, APT, VILLA, FLAT, or PLOT before creating AMC package
- **AMC Templates**: Create reusable templates per property type
- **Auto-Population**: Templates auto-apply when property type is selected
- **Editable Templates**: Templates are not locked - can be modified anytime

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

## Future Features (Coming Soon)

- **Schedule**: View and manage appointments
- **Payment**: Make payments and view billing history
- **Live Chat**: Real-time support
- **PDF Export**: Export AMC packages and estimates to PDF
- **Email Integration**: Send estimates directly to customers

## License

MIT License
