# Installation Instructions

## Install Dependencies

After the recent updates, you need to install the new PDF generation package:

```bash
npm install
```

This will install `pdfkit` which is required for generating PDF reports.

## Changes Made

### 1. Dashboard - Load Status Display
- The "Device Status" section now only appears when **hardware is connected** (`energyData.isHardware === true`)
- Changed "Testing Device" to "Load Type" in the dropdown
- Changed "Device Status" to "Load Status" in the status section
- Status will not show during simulation mode, only with real hardware data

### 2. Settings - System Specifications
- Added system maximum specifications info box:
  - Maximum Voltage: 300V
  - Maximum Current: 30A
  - Maximum Frequency: 10kHz
- Displayed prominently at the top of the Settings page

### 3. Reports - PDF Generation
- Implemented complete PDF report generation with professional formatting
- Reports now include:
  - **Header**: System name, report type, generation date, and period
  - **System Specifications**: Max voltage, current, and frequency
  - **Summary Statistics Table**: 
    - Average, Min, and Max values for Voltage, Current, Power
    - Average Temperature and Frequency
    - Total Energy consumption
  - **Fault Summary Table**: 
    - List of all faults detected during the period
    - Timestamp, type, and description for each fault
    - Color-coded for easy identification
  - **Footer**: Page numbers and confidential notice
- Professional styling with:
  - Blue color scheme matching the application
  - Alternating row colors for better readability
  - Proper spacing and margins
  - Multi-page support with automatic page breaks

## Testing

1. Start the server: `npm run dev`
2. Connect hardware to see the Load Status section appear on the dashboard
3. Go to Reports page and generate any report type (Daily, Weekly, Monthly, Custom)
4. The PDF will download automatically with proper formatting

## Notes

- Load Status only shows when `isHardware` flag is true in the energy data
- PDF reports fetch real data from the MongoDB database
- Reports are limited to 1000 data points and 15 fault entries per report for performance
