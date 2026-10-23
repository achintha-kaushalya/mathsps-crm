import os
from fpdf import FPDF

class ProjectReportPDF(FPDF):
    def header(self):
        # Draw header on all pages except the first title page
        if self.page_no() > 1:
            self.set_font("helvetica", "I", 8)
            self.set_text_color(100, 110, 120)
            self.cell(0, 10, "Project Delivery & Handover Report - Custom CRM & Lead Analytics", border=0, align="R")
            self.ln(12)
            # Thin gray line
            self.set_draw_color(220, 225, 230)
            self.line(10, 22, 200, 22)

    def footer(self):
        self.set_y(-15)
        self.set_font("helvetica", "I", 8)
        self.set_text_color(120, 130, 140)
        # Page number
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", border=0, align="C")

def create_report():
    pdf = ProjectReportPDF()
    pdf.alias_nb_pages()
    
    # ---------------------------------------------------------
    # PAGE 1: TITLE PAGE, EXECUTIVE SUMMARY & BILLING BREAKDOWN
    # ---------------------------------------------------------
    pdf.add_page()
    
    # Cover Background Accents
    pdf.set_fill_color(13, 39, 68) # Navy #0D2744
    pdf.rect(0, 0, 210, 45, 'F')
    
    pdf.set_y(15)
    pdf.set_font("helvetica", "B", 18)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 8, "PROJECT DELIVERY & HANDOVER REPORT", align="C", ln=1)
    pdf.set_font("helvetica", "", 10)
    pdf.set_text_color(191, 219, 254) # Light blue
    pdf.cell(0, 6, "Custom CRM Database, Automated Workflows & Performance Analytics", align="C", ln=1)
    
    pdf.set_y(60)
    pdf.set_text_color(30, 41, 59) # Slate 800
    
    # Memo Details Table
    pdf.set_font("helvetica", "B", 11)
    pdf.cell(40, 7, "Project Title:")
    pdf.set_font("helvetica", "", 11)
    pdf.cell(0, 7, "CRM Lead Tracking & Analytics Automation System", ln=1)
    
    pdf.set_font("helvetica", "B", 11)
    pdf.cell(40, 7, "Client:")
    pdf.set_font("helvetica", "", 11)
    pdf.cell(0, 7, "Prabuddha Sampath", ln=1)
    
    pdf.set_font("helvetica", "B", 11)
    pdf.cell(40, 7, "Developer:")
    pdf.set_font("helvetica", "", 11)
    pdf.cell(0, 7, "Achintha Kaushalya", ln=1)
    
    pdf.set_font("helvetica", "B", 11)
    pdf.cell(40, 7, "Status:")
    pdf.set_font("helvetica", "", 11)
    pdf.set_text_color(22, 101, 52) # Dark green
    pdf.cell(0, 7, "Successfully Delivered & Live (Operational)", ln=1)
    pdf.set_text_color(30, 41, 59)
    
    pdf.set_font("helvetica", "B", 11)
    pdf.cell(40, 7, "Delivery Date:")
    pdf.set_font("helvetica", "", 11)
    pdf.cell(0, 7, "July 23, 2026", ln=1)
    
    pdf.set_font("helvetica", "B", 11)
    pdf.cell(40, 7, "Total Cost:")
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(13, 39, 68)
    pdf.cell(0, 7, "LKR 20,000.00 (One-Time Payment)", ln=1)
    pdf.set_text_color(30, 41, 59)
    
    pdf.ln(8)
    # Divider
    pdf.set_draw_color(200, 205, 210)
    pdf.line(10, 112, 200, 112)
    pdf.ln(12)
    
    # Executive Handover Note
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(0, 8, "1. Executive Summary", ln=1)
    pdf.set_font("helvetica", "", 10)
    summary_text = (
        "This project documentation marks the formal handover and completion of the CRM Lead Tracking and Analytics "
        "system developed by Achintha Kaushalya for Prabuddha Sampath. The system serves as a lightweight, "
        "high-efficiency CRM solution hosted entirely on Google Workspace, eliminating any subscription charges.\n\n"
        "All features have been fully coded, styled, and verified. The system is equipped with background Google Apps "
        "Script automation to prevent data loss, automatically link repeat students to their history, and build "
        "dynamic sales and campaign analytics."
    )
    pdf.multi_cell(0, 5, summary_text)
    
    pdf.ln(8)
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(0, 8, "2. Project Valuation & Cost Breakdown", ln=1)
    pdf.ln(1)
    
    # Table Header
    pdf.set_fill_color(13, 39, 68)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("helvetica", "B", 9.5)
    pdf.cell(140, 7, "  Development Module & Deliverables", border=1, fill=True, align="L")
    pdf.cell(50, 7, "Amount (LKR)  ", border=1, fill=True, align="R", ln=1)
    
    # Table Rows
    pdf.set_text_color(30, 41, 59)
    pdf.set_font("helvetica", "", 9)
    items = [
        ("Database Schema Design & Custom Color-Coding", "4,000.00"),
        ("Automated Lead Triggers (F-Code & Timestamping)", "5,000.00"),
        ("Data Integrity Engines (Duplicate & Repeat Lookup)", "4,000.00"),
        ("Team Roster Operations & Dynamic Validation Sync", "3,500.00"),
        ("Real-time Date-Filtered Summary Dashboard", "3,500.00")
    ]
    
    for idx, (name, val) in enumerate(items):
        bg = (idx % 2 == 1)
        pdf.set_fill_color(241, 245, 249) if bg else pdf.set_fill_color(255, 255, 255)
        pdf.cell(140, 6.5, f"  {name}", border=1, fill=True, align="L")
        pdf.cell(50, 6.5, f"{val}  ", border=1, fill=True, align="R", ln=1)
        
    # Total Row
    pdf.set_font("helvetica", "B", 9.5)
    pdf.set_fill_color(224, 231, 255) # light indigo #E0E7FF
    pdf.cell(140, 7, "  TOTAL ONE-TIME DEVELOPMENT COST", border=1, fill=True, align="L")
    pdf.cell(50, 7, "LKR 20,000.00  ", border=1, fill=True, align="R", ln=1)
    
    # ---------------------------------------------------------
    # PAGE 2: CORE SYSTEM FEATURES & CORE LOGIC
    # ---------------------------------------------------------
    pdf.add_page()
    pdf.set_y(30)
    pdf.set_text_color(30, 41, 59)
    
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(0, 8, "3. System Features & Operational Capability", ln=1)
    pdf.ln(2)
    
    features = [
        ("Automated Unique F-Code Allocation", 
         "Maintains clean records. Typing a phone number immediately checks for duplicates. If none are found, the background script auto-generates a unique F-Code (e.g., F1001, F1002) and sets the current date instantly."),
        
        ("Instant Repeat Student Detection", 
         "Finds returning students. If a phone number already exists in the sheets, it flags them as a 'Repeat' and displays their original F-Code in the 'Previous F-Code' column so sales representatives do not assign new duplicate codes."),
        
        ("Automatic Column Dropdown Validation", 
         "Maintains dropdown lists across 1000 rows. Keeps status dropdowns (New, Contacted, Converted, etc.) and Yes/No options for 'Second Call Done' and 'Paid' clean and free of input errors."),
        
        ("Real-time Team Roster Sync Menu", 
         "Simplifies staff updates. Through the 'Lead Tools' menu, you can select 'Add New Member' or 'Remove Member'. The script automatically handles formula updates and refreshes the Assigned Member dropdown options across all rows in real-time."),
        
        ("Fully Rebuilt Leads Summary Dashboard", 
         "Provides instant analytics. Clicking 'Rebuild Summary Sheet' programmatically generates the dashboard. It contains four date-filtered tables: (1) Lead count by grade, (2) Paid conversions, (3) Unresolved pipelines, and (4) Campaign ROI metrics.")
    ]
    
    for title, desc in features:
        pdf.set_font("helvetica", "B", 10)
        pdf.set_text_color(13, 39, 68)
        pdf.cell(0, 5, f"- {title}", ln=1)
        pdf.set_font("helvetica", "", 9.5)
        pdf.set_text_color(64, 74, 92)
        pdf.multi_cell(0, 4.5, desc)
        pdf.ln(3.5)
        
    # ---------------------------------------------------------
    # PAGE 3: FUTURE SCALABILITY
    # ---------------------------------------------------------
    pdf.add_page()
    pdf.set_y(30)
    pdf.set_text_color(30, 41, 59)
    
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(0, 8, "4. Future Analytics & Upgrade Possibilities", ln=1)
    pdf.ln(2)
    
    roadmap = [
        ("Lead Conversion Speed Metrics", 
         "Upgrade the sheets to track the exact time it takes to convert a lead from 'New' to 'Paid' to evaluate team efficiency."),
        
        ("Direct API Ad Integration", 
         "Connect Google Sheets to your Facebook / TikTok lead ads directly. Leads will automatically appear in the spreadsheet in real-time as users submit them."),
        
        ("Team Performance Leaderboard", 
         "Develop a visual leaderboard tab ranking sales agents based on total conversions, call success rates, and active pipelines to encourage competition."),
        
        ("Scheduled Email Reports", 
         "Configure daily evening emails to automatically send the management team a PDF snapshot of the campaign performance table.")
    ]
    
    for title, desc in roadmap:
        pdf.set_font("helvetica", "B", 10)
        pdf.set_text_color(22, 101, 52)
        pdf.cell(0, 5, f"+ {title}", ln=1)
        pdf.set_font("helvetica", "", 9.5)
        pdf.set_text_color(64, 74, 92)
        pdf.multi_cell(0, 4.5, desc)
        pdf.ln(4)
        
    # Sign-off block
    pdf.ln(10)
    pdf.set_draw_color(220, 225, 230)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(8)
    
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(13, 39, 68)
    pdf.cell(95, 5, "Delivered By:")
    pdf.cell(95, 5, "Accepted By:", ln=1)
    
    pdf.ln(12)
    pdf.set_font("helvetica", "", 10)
    pdf.set_text_color(100, 110, 120)
    pdf.cell(95, 5, "_______________________")
    pdf.cell(95, 5, "_______________________", ln=1)
    pdf.set_font("helvetica", "B", 9.5)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(95, 5, "Achintha Kaushalya")
    pdf.cell(95, 5, "Prabuddha Sampath", ln=1)
    pdf.set_font("helvetica", "", 9)
    pdf.set_text_color(100, 110, 120)
    pdf.cell(95, 5, "Software Developer")
    pdf.cell(95, 5, "Managing Director", ln=1)

    # Save PDF
    pdf.output("CRM_Project_Delivery_Report.pdf")
    print("PDF Report generated successfully!")

if __name__ == "__main__":
    create_report()
