# Warehouse Manager - User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [User Roles](#user-roles)
4. [Login and Authentication](#login-and-authentication)
5. [Portal Selection](#portal-selection)
6. [St. Kitts Receiving Portal](#st-kitts-receiving-portal)
7. [St. Kitts Releasing Portal](#st-kitts-releasing-portal)
8. [Nevis Receiving Portal](#nevis-receiving-portal)
9. [Nevis Releasing Portal](#nevis-releasing-portal)
10. [Barcode Scanning](#barcode-scanning)
11. [Tools & Settings](#tools--settings)
12. [Troubleshooting](#troubleshooting)

---

## Introduction

Warehouse Manager is a comprehensive inventory management application designed for managing packages between St. Kitts and Nevis warehouses. The app allows you to:

- Receive and validate incoming packages
- Release packages to customers
- Transfer packages between St. Kitts and Nevis
- Import package data from Excel files
- Track user activity and financial reports
- Manage employee accounts and permissions

---

## Getting Started

### System Requirements
- **Mobile**: iOS or Android device with camera for barcode scanning
- **Web**: Modern web browser (Chrome, Safari, Firefox, Edge)
- **Hardware Scanner**: Compatible Bluetooth barcode scanner (optional)

### First-Time Setup

1. Open the Warehouse Manager app
2. Create an Admin account by tapping "Admin? Create an account"
3. Enter your username and password
4. Set up two security questions for password recovery
5. Log in to access the portal selection screen

---

## User Roles

### Admin (Manager)
- Full access to all portals
- Can create and manage employee accounts
- Can upload/export Excel files
- Can view financial reports
- Can reset inventory data

### Employee
- Limited access based on assigned privileges
- Requires a unique key provided by admin to login
- Can perform assigned tasks (receiving, releasing, etc.)

---

## Login and Authentication

### Admin Login
1. Select "Admin" at the top of the login screen
2. Enter your username and password
3. Tap "Sign In"

### Employee Login
1. Select "Employee" at the top of the login screen
2. Enter your username
3. Enter your password
4. Enter your unique employee key (provided by your admin)
5. Tap "Sign In"

### Forgot Password (Admin Only)
1. Tap "Forgot Password?"
2. Enter your username
3. Answer your two security questions
4. Set a new password

> **Note**: Employees must contact their administrator to reset passwords.

---

## Portal Selection

After logging in, you'll see the Portal Selection screen with access to:

- **St. Kitts Receiving**: Receive incoming packages
- **St. Kitts Releasing**: Release packages to customers
- **Nevis Receiving**: Receive packages at Nevis warehouse
- **Nevis Releasing**: Release packages in Nevis

Access to each portal depends on your assigned privileges.

### Navigation
- Tap any portal tile to enter that portal
- Tap "Tools & Settings" at the bottom for additional features
- Tap "Logout" in the header to sign out

---

## St. Kitts Receiving Portal

### Overview
The Receiving Portal displays all packages currently in the warehouse with status tracking.

### Dashboard Statistics
- **Total**: All packages in the system
- **Received**: Packages currently in warehouse
- **Awaiting**: Packages returned from Nevis pending verification
- **St. Kitts**: Packages destined for St. Kitts
- **Nevis**: Packages destined for Nevis

### Viewing Packages

#### List View
- Shows packages in chronological order
- Each card displays:
  - Barcode number
  - Customer name
  - Storage location
  - Price (if available)
  - Destination tag
  - Status badge (Uploaded, Validated, Awaiting from Nevis)

#### Customer Groups View
- Packages grouped by customer name
- Tap a customer header to expand/collapse their packages
- Shows package count per customer

### Searching & Filtering
1. **Search**: Type in the search bar to find packages by:
   - Customer name
   - Barcode
   - Storage location

2. **Filters**: Tap the filter icon to filter by:
   - Upload Status (All, Uploaded, Validated, Manual)
   - Destination (All, Saint Kitts, Nevis)

### Receiving a Package
1. Tap the blue **+** scan button (bottom right)
2. Scan the package barcode
3. If the package exists in the uploaded manifest:
   - Select a storage location (A-Z, Floor 1-5)
   - Confirm the destination
   - Tap "Validate Package"
4. Package status changes from "Uploaded" to "Validated"

### Workflow
**Upload → Validate → Release**
1. Admin uploads Excel manifest (packages get "Uploaded" status)
2. Staff scans packages to validate (changes to "Validated" status)
3. Staff releases packages to customers (changes to "Released" status)

---

## St. Kitts Releasing Portal

### Overview
The Releasing Portal is used when packages are being shipped or dispatched from the warehouse.

### Dashboard Statistics
- **In Warehouse**: Validated packages ready for release
- **Released**: Packages that have been released

### Releasing a Package
1. Tap "Scan Barcode to Release"
2. Choose scan mode:
   - **Hardware Scanner**: For external barcode scanners
   - **Camera**: Use device camera
3. Scan the package barcode
4. Review package details:
   - Barcode
   - Customer name
   - Price
   - Destination
   - Storage location
5. Tap "Confirm Release" or "Transfer to Nevis"

### Package Actions
- **St. Kitts packages**: "Confirm Release" - marks as released
- **Nevis packages**: "Transfer to Nevis" - marks as transferred

### Released Packages History
- View recently released packages
- Filter by date range, destination, or storage location
- Shows release timestamp and transferred status

---

## Nevis Receiving Portal

### Overview
Manages packages arriving at the Nevis warehouse from St. Kitts.

### Receiving Transferred Packages
1. Open the Nevis Receiving Portal
2. Scan incoming packages
3. Packages transferred from St. Kitts will be verified
4. Verified packages become available for release in Nevis

### Returning Packages to St. Kitts
If a package cannot be delivered in Nevis:
1. Use the "Send to St. Kitts" option
2. Package status changes to "Awaiting from Nevis"
3. When received back in St. Kitts, scan to verify

---

## Nevis Releasing Portal

### Overview
Release packages to customers at the Nevis location.

### Releasing Process
1. Open the Nevis Releasing Portal
2. Tap "Scan Barcode to Release"
3. Scan the package barcode
4. Confirm release details
5. Package is marked as released in Nevis

---

## Barcode Scanning

### Scan Modes

#### Hardware Scanner Mode
- Best for high-volume scanning
- Connect a Bluetooth barcode scanner
- Scanner input automatically processes barcodes
- Tap "Process Barcode" if needed for manual submission

#### Camera Mode
- Uses device camera to scan barcodes
- Position barcode within the frame
- Auto-detects when barcode is captured
- Works with various barcode formats:
  - QR codes
  - EAN-13, EAN-8
  - Code 128, Code 39, Code 93
  - UPC-A, UPC-E
  - Codabar, ITF-14
  - PDF417, DataMatrix

### Scanning Tips
1. Hold device steady for camera scanning
2. Ensure adequate lighting
3. Keep barcode flat and unobstructed
4. Wait for haptic/audio feedback confirming successful scan

---

## Tools & Settings

### Accessing Tools
1. Go to Portal Selection
2. Tap "Tools & Settings"

### Account Section
- View current logged-in user
- Logout button
- Employee Management (Admin only)

### Employee Management (Admin Only)

#### Creating an Employee
1. Tap "Add" button
2. Enter username and password
3. Select portal access privileges:
   - St. Kitts Receiving
   - St. Kitts Releasing
   - Nevis Receiving
   - Nevis Releasing
   - Scanner access
   - Add Product
   - Upload Excel
   - Export Excel
   - Reset Data
4. Tap "Create"
5. Note the unique key generated - employee needs this to login

#### Managing Employees
- **Reset Password**: Tap lock icon next to employee
- **Edit Privileges**: Tap edit icon to modify access
- **Delete Employee**: Tap trash icon
- **Copy Unique Key**: Tap copy icon to share key

### Financial Overview (Admin Only)
- **In Warehouse**: Total value of packages in warehouse
- **Collected**: Total value of released packages
- **Total Value**: Combined warehouse and collected value

#### Filtering Financial Data
- Filter by date range
- Filter by destination (St. Kitts/Nevis)
- Filter by status (In Warehouse/Released)
- Filter by user activity

#### Activity Log
- View all user actions
- Search by barcode, customer, or user
- Filter by date, action type, user, or status
- See who received, released, or transferred each package

### Excel Import

#### File Requirements
- Supported formats: .xlsx, .xls, .csv
- Required columns:
  - **Air Way Bill #** (or AWB, Barcode)
  - **Store Location** (destination: Saint Kitts or Nevis)
- Optional columns:
  - Customer Name
  - Price
  - Comment

#### Import Process
1. Tap "Select Excel File"
2. Choose your file
3. Preview imported data
4. Tap "Confirm Import"
5. Packages import with "Uploaded" status

### Export Inventory
- Exports all inventory data to Excel
- Includes: Barcode, Status, Location, Destination, Notes, Dates

### Reset Inventory
- **Warning**: Permanently deletes all data
- Requires secret code: 4086
- Cannot be undone

### Delete Account
- Permanently removes your account
- All associated data will be lost

---

## Troubleshooting

### Login Issues

**"Invalid credentials" error**
- Verify username spelling
- Check password is correct
- Employees: Ensure unique key is entered correctly

**"Access Denied" when opening portal**
- Your account may not have privileges for that portal
- Contact your administrator

### Scanning Issues

**Camera not working**
- Grant camera permissions when prompted
- Try switching to hardware scanner mode
- Ensure adequate lighting

**Barcode not detected**
- Clean the camera lens
- Hold device steady
- Ensure barcode is not damaged
- Try different angles

**Hardware scanner not working**
- Check Bluetooth connection
- Ensure scanner is in keyboard mode
- Tap the input field to focus

### Package Issues

**"Barcode Not Found" when scanning**
- Package may not be in the uploaded manifest
- Check if barcode was entered correctly in Excel
- Contact admin to verify upload

**"Not Validated" error when releasing**
- Package must be validated before release
- Go to Receiving Portal and scan to validate first

**"Already Released" message**
- Package has already been processed
- Check released packages list for details

### Data Issues

**Packages not showing**
- Check filter settings
- Clear search field
- Refresh the app

**Financial totals incorrect**
- Verify price data in Excel upload
- Check filter settings in financial overview

---

## Contact Support

For additional assistance:
- Contact your system administrator
- Report issues through your organization's IT support

---

*Document Version: 1.0*
*Last Updated: December 2024*
