#!/usr/bin/env python3
"""
Cleans all data rows from the Master Leads sheet, keeping only the header row.
Also keeps the members list in the Members sheet intact.
"""

import openpyxl

DST = r'c:\Users\achir\Desktop\Lead tracking PS\Master_Leads_GoogleSheets.xlsx'

wb = openpyxl.load_workbook(DST)
ws = wb['Master Leads']

# Delete all rows starting from row 2 down to the end of sheet
max_row = ws.max_row
if max_row >= 2:
    ws.delete_rows(2, max_row)
    print(f"Cleared {max_row - 1} test lead rows from Master Leads sheet.")

# Add one blank formatted row to hold basic styling if needed (optional)
# But leaving it completely empty below row 1 is cleaner for Google Sheets import.

wb.save(DST)
print("Workbook cleaned successfully!")
