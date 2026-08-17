---
description: Rules for Work Orders portals including status options, form state, and subcategory loading
tags: work_orders, portals, status, form, subcategories, lucide-react
---

# Work Orders Rules

Applies to: `ManagerWorkOrders.jsx`, `SupervisorWorkOrders.jsx`, `ExecutiveWorkOrders.jsx`, `CoordinatorWorkOrders.jsx`, `FPWorkOrders.jsx`, and `EmployeeWorkOrders.jsx`.

## Icon Imports

All icons used in Work Orders portals must be imported from `lucide-react`. Examples: `User`, `Camera`, `Image`, `Upload`, etc.

## Required State Variables

Each Work Orders component must include:

```javascript
const [customers, setCustomers] = useState([]);
const [subcategories, setSubcategories] = useState([]);
const [statusFilter, setStatusFilter] = useState(''); // status dropdown filter
```

`formData` must contain:

```javascript
propertyId, categoryId, subcategoryId,
customerName, customerEmail, customerPhone,
description, priority, permissionToEnter, hasPet, entryNotes
```

## Auto-populate Customer Details

When a property is selected, auto-fill customer fields from the selected property:

- `customerName` from `contact_person` / `contactPerson` / `owner_name`
- `customerEmail` from `contact_email` / `contactEmail` / `email`
- `customerPhone` from `contact_phone` / `contactPhone` / `phone` / `mobile`

## Subcategory Loading

Use **embedded** subcategories from the `categories` state. Do **not** call `/api/*/categories/:id/subcategories`; the database table is empty.

```javascript
const handleCategoryChange = (categoryId) => {
  setFormData({ ...formData, categoryId, subcategoryId: '' });
  const category = categories.find(c => c.id === parseInt(categoryId));
  setSubcategories(category?.subcategories || []);
};
```

## Status Filter Dropdown

Add a status filter dropdown to the search bar for completed work orders:

- Options: `All Status`, `Pending`, `Assigned`, `In Progress`, `Completed`, `Cancelled`
- Do **not** include `Closed`.
- Remove `Closed` from all status dropdowns (filter and inline).
- Update `handleClear` to also reset `statusFilter` to its default.

## Actions to Exclude

For Supervisor, Executive, and Coordinator portals:

- Remove the **Mark As Closed** button; use **Completed** instead.
- Remove `'closed'` from the `completedStatuses` array; use only `['completed', 'verified']`.

## Reference Implementations

- Use `FPWorkOrders.jsx` for form structure.
- Use `ManagerWorkOrders.jsx` for full feature reference.
