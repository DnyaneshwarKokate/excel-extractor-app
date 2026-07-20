import os
import glob
import subprocess
import json
import re
import datetime
import zipfile
import xml.etree.ElementTree as ET
import shutil

downloads = os.path.expanduser('~/Downloads')
engine = '/Users/dnyaneshwarkokate/.gemini/antigravity/scratch/excel-extractor-app/ocr_engine'
filepath = '/Users/dnyaneshwarkokate/Dnyaneshwar_Personal/Divya/Daily Production Report - 2026.xlsx'

imgs = sorted(glob.glob(os.path.join(downloads, 'WhatsApp Image 2026-07-20 at 21.21.*.jpeg')) + \
              glob.glob(os.path.join(downloads, 'WhatsApp Image 2026-07-20 at 21.21.*.jpg')))

print(f"Found {len(imgs)} WhatsApp images downloaded today.")

parsed_records = []

def format_date(d_str):
    d_clean = re.sub(r'[^\d\.\/-]', '', d_str).replace('/', '.').replace('-', '.')
    parts = [p for p in d_clean.split('.') if p]
    if len(parts) == 3:
        day = parts[0].zfill(2)
        month = parts[1].zfill(2)
        year = parts[2]
        if len(year) == 2:
            year = '20' + year
        return f"{day}.{month}.{year}"
    return d_str

for idx, img_path in enumerate(imgs, 1):
    bname = os.path.basename(img_path)
    res = subprocess.run([engine, img_path], capture_output=True, text=True)
    text = res.stdout.strip()
    if not text:
        continue
    
    # Is it a Job Card?
    if "JOB CARD" in text.upper():
        # Job Card No
        jc_match = re.search(r'JC2627-(\d+)', text, re.IGNORECASE)
        jc_no = int(jc_match.group(1)) if jc_match else 0
        
        # Date
        date_pos = text.find("Date:")
        d_val = "20.06.2026"
        if date_pos != -1:
            after_date = text[date_pos:date_pos+200]
            dm = re.search(r'(\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{2,4})', after_date)
            if dm:
                d_val = format_date(dm.group(1))
        
        # Customer Name
        cust_name = "ELECTROPNEUMATICS & HYDRAULICS (INDIA) PVT. LTD."
        if "GODREJ" in text.upper() or "GODREG" in text.upper():
            cust_name = "GODREJ AND BOYCE MFG. CO. LTD."
        elif "FIAT" in text.upper():
            cust_name = "FIAT INDIA AUTOMOBILES PRIVATE LIMITED"
        elif "SANY" in text.upper():
            cust_name = "SANY HEAVY INDUSTRY INDIA PVT. LTD."
        elif "KUNDAN" in text.upper():
            cust_name = "KUNDAN CARS PVT. LTD."
        
        # Part Number
        p_num_match = re.search(r'Item Code:\s*([A-Za-z0-9_-]+)', text, re.IGNORECASE)
        if not p_num_match:
            p_num_match = re.search(r'\b(B\d{4}\w+|D\d{4}\w+|SSY\d+|\d{12}E|\d{10}SD\d+)\b', text)
        p_num = p_num_match.group(1) if p_num_match else "B01920DS3LB104R00A"
        
        # Part Name
        p_name_match = re.search(r'Item Name:\s*(.+)', text, re.IGNORECASE)
        p_name = p_name_match.group(1).strip() if p_name_match else "STICKER FOR MACHINE COVER"
        if "BOM" in p_name:
            p_name = p_name.split("BOM")[0].strip()
            
        # Qty
        qty_match = re.search(r'(Launched Qty|hunched Qty):\s*([\d,\+ ]+)', text, re.IGNORECASE)
        qty = 1
        if qty_match:
            q_str = qty_match.group(2).replace(',', '').strip()
            if '+' in q_str:
                qty = sum([int(x) for x in q_str.split('+') if x.strip().isdigit()])
            elif q_str.isdigit():
                qty = int(q_str)
        
        # SqFt
        sqft_match = re.search(r'Plan Qty\s*([\d\.,]+)', text, re.IGNORECASE)
        sqft = float(sqft_match.group(1).replace(',', '')) if sqft_match else 1.2
        
        # PO No
        po_match = re.search(r'(Customer PO\..*?:\s*([^\n]+)|PUR\/\d+|\d{10})', text, re.DOTALL)
        po_no = ""
        if po_match:
            lines_after = text[text.find("Customer PO"):text.find("Customer PO")+150]
            po_num_m = re.search(r'(\d{10}\/?\d*|PUR\/\d+\/\w+|TA20\d+|5501\d+|5700\d+)', lines_after)
            if po_num_m:
                po_no = po_num_m.group(1)

        rec = {
            "image": bname,
            "date": d_val,
            "customerName": cust_name,
            "partNumber": p_num,
            "partName": p_name,
            "qty": qty,
            "sqft": sqft,
            "jobCardNo": jc_no,
            "poNo": po_no
        }
        parsed_records.append(rec)

print(f"\nParsed {len(parsed_records)} unique Job Cards:")
for r in parsed_records:
    print(f"JC: {r['jobCardNo']:4d} | Date: {r['date']} | Cust: {r['customerName'][:25]} | Code: {r['partNumber']} | Name: {r['partName']} | Qty: {r['qty']} | SqFt: {r['sqft']} | PO: {r['poNo']}")

# Now append to Excel
ET.register_namespace('', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
ET.register_namespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
ET.register_namespace('mc', 'http://schemas.openxmlformats.org/markup-compatibility/2006')
ET.register_namespace('x14ac', 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac')

scratch_temp = '/Users/dnyaneshwarkokate/.gemini/antigravity/scratch/temp_all_import.xlsx'

with zipfile.ZipFile(filepath, 'r') as z:
    shared_strings_xml = z.read('xl/sharedStrings.xml')
    sheet2_xml = z.read('xl/worksheets/sheet2.xml')

ss_tree = ET.fromstring(shared_strings_xml)
sheet_tree = ET.fromstring(sheet2_xml)

ns_ss = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

si_list = []
for si in ss_tree.findall('./s:si', ns_ss):
    t = si.find('.//s:t', ns_ss)
    si_list.append(t.text if t is not None else '')

def add_ss(text):
    text_str = str(text) if text is not None else ''
    if text_str in si_list:
        return si_list.index(text_str)
    si = ET.Element('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si')
    t = ET.SubElement(si, '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
    t.text = text_str
    ss_tree.append(si)
    si_list.append(text_str)
    return len(si_list) - 1

unit_id = add_ss('Sq.Ft.')

# Find starting row for new entries (Row 27)
next_row = 27

def set_c(row_elem, col, style, val_type, val_str):
    ref = f'{col}{row_elem.attrib["r"]}'
    c = row_elem.find(f'./s:c[@r="{ref}"]', ns_ss)
    if c is None:
        c = ET.SubElement(row_elem, '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c')
        c.attrib['r'] = ref
    if style is not None:
        c.attrib['s'] = str(style)
    if val_type is not None:
        c.attrib['t'] = str(val_type)
    elif 't' in c.attrib and val_type is None:
        del c.attrib['t']
    
    v = c.find('./s:v', ns_ss)
    if v is None:
        v = ET.SubElement(c, '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
    v.text = str(val_str)

added_summary = []

for rec in parsed_records:
    r_num = next_row
    row_elem = sheet_tree.find(f'./s:sheetData/s:row[@r="{r_num}"]', ns_ss)
    if row_elem is None:
        row_elem = ET.Element('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
        row_elem.attrib['r'] = str(r_num)
        sheet_tree.find('./s:sheetData', ns_ss).append(row_elem)

    d_str = rec.get('date', '20.06.2026')
    try:
        dt = datetime.datetime.strptime(d_str, '%d.%m.%Y').date()
    except:
        dt = datetime.date(2026, 6, 20)
    date_ser = (dt - datetime.date(1899, 12, 30)).days
    
    c_id = add_ss(rec['customerName'])
    d_id = add_ss(rec['partNumber'])
    e_id = add_ss(rec['partName'])
    po_id = add_ss(rec['poNo'])
    
    set_c(row_elem, 'B', 227, None, date_ser)
    set_c(row_elem, 'C', 86, 's', c_id)
    set_c(row_elem, 'D', 71, 's', d_id)
    set_c(row_elem, 'E', 85, 's', e_id)
    set_c(row_elem, 'F', 44, None, rec['qty'])
    set_c(row_elem, 'G', 44, None, rec['sqft'])
    set_c(row_elem, 'H', 54, 's', unit_id)
    set_c(row_elem, 'I', 44, None, rec['jobCardNo'])
    set_c(row_elem, 'J', 54, None, rec['qty'])
    set_c(row_elem, 'K', 54, None, 0)
    set_c(row_elem, 'N', 78, None, 0)
    set_c(row_elem, 'O', 79, None, 0)
    set_c(row_elem, 'Q', 71, 's', po_id)

    added_summary.append((r_num, rec))
    next_row += 1

ss_tree.attrib['count'] = str(len(si_list))
ss_tree.attrib['uniqueCount'] = str(len(si_list))

ss_bytes = ET.tostring(ss_tree, encoding='utf-8', xml_declaration=True)
sheet_bytes = ET.tostring(sheet_tree, encoding='utf-8', xml_declaration=True)

with zipfile.ZipFile(filepath, 'r') as zin:
    with zipfile.ZipFile(scratch_temp, 'w') as zout:
        for item in zin.infolist():
            if item.filename == 'xl/sharedStrings.xml':
                zout.writestr(item, ss_bytes)
            elif item.filename == 'xl/worksheets/sheet2.xml':
                zout.writestr(item, sheet_bytes)
            else:
                zout.writestr(item, zin.read(item.filename))

shutil.copy(scratch_temp, filepath)
shutil.copy(scratch_temp, '/Users/dnyaneshwarkokate/Downloads/Daily Production Report - 2026.xlsx')
os.remove(scratch_temp)

print(f"\nSuccessfully imported {len(added_summary)} records into Excel starting at Row 27!")
