---
description: How to implement the Scheduling module requests, calendar, quotes, and jobs flow
tags: scheduling, calendar, requests, on_site_assessment, jobs, quotes
---

# Scheduling Module Flow

## Sidebar Navigation

- Requests
- Calendar
- Quotes
- Jobs
- Invoices (linked)
- Payments (linked)

**Note:** Use **Customers**, not "Clients".

## Request Creation Flow (4 Steps)

### Step 1: Customer Details

- Title: Mr / Mrs / Ms / No title
- First Name, Last Name
- Company Name
- Phone, Email
- Lead Source: Referral / Website / Walk-in / Advertisement
- Referrer Name (if Referral)
- Address: Street 1, Street 2, City, State, Postal Code, Country

### Step 2: Service Details

- Service Category, Subcategory
- Description (textarea)
- Availability Date (IST format)
- Preferred Time: Anytime, Morning, Afternoon, Evening
- Pets: Yes/No toggle
- Comments (textarea)

### Step 3: Upload Images

- Upload images of the work area.
- Supported: JPG, PNG, WEBP (max 5MB each).

### Step 4: On-Site Assessment

- Instructions (textarea)
- Schedule: Start Date, End Date, Start Time, End Time
- Checkboxes: Schedule Later, Anytime
- Team Assignment (Assign + button)
- Checklists (customizable items)
- Notes (internal notes for the team)

## Calendar Behavior

### Unscheduled Sidebar

If on-site assessment is **not** 100% complete:

- Request appears in the **Unscheduled** panel on the calendar page.
- Missing items include dates not set, team not assigned, or checklists incomplete.

### Calendar Grid

If on-site assessment **is** 100% complete:

- Request appears on the scheduled calendar date.
- Events are color-coded by type: Request, Quote, Job.

### Calendar Controls

- Month / Week / Day view toggle
- Filters: Type (All / Requests / Quotes / Jobs), Team, Status
- Find a Time button
- Map View panel

## Assessment Details Modal

**Tabs:** Info, Customer, Notes

**Fields:**

- Request title
- Customer name
- Address
- Status: Unscheduled / Scheduled
- Directions link
- Instructions
- Request date
- Assigned to
- Reminders
- Service Details

### Actions

- Completed (Mark as Complete)
- More Actions: Edit, Reschedule, Create Quote, Convert to Job, Cancel, Delete

### Status Flow

```
Unscheduled → Scheduled → In Progress → Completed
```
