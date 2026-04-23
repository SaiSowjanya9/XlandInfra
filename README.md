# Customer Portal - Work Order Management System

A full-stack web application for managing customer work orders, built with React, Node.js, and MySQL.

## Features

- **Work Order Management**: Submit maintenance and repair requests with categories and subcategories
- **18 Service Categories**: Including Lifts, AC, Plumbing, Electrical, Appliances, and more
- **File Attachments**: Upload images from camera roll, take photos, or attach PDFs
- **Permission to Enter**: Grant access for service personnel when you're unavailable
- **Pet Notification**: Alert service personnel about pets in the premises
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Modern UI**: Built with TailwindCSS for a clean, professional look

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
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── data/             # Static data (categories)
│   │   ├── services/         # API service functions
│   │   ├── App.jsx           # Main app component
│   │   └── main.jsx          # Entry point
│   ├── public/               # Static assets
│   └── package.json
├── backend/                  # Node.js backend API
│   ├── config/               # Configuration files
│   ├── routes/               # API routes
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

2. **Start the frontend development server**
   ```bash
   cd frontend
   npm run dev
   ```
   The app will be available at `http://localhost:3000`

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

## Future Features (Coming Soon)

- **Schedule**: View and manage appointments
- **Payment**: Make payments and view billing history
- **Live Chat**: Real-time support

## License

MIT License
