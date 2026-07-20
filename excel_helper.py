import sys
import os
import json
import zipfile
import xml.etree.ElementTree as ET
import shutil
import datetime

def check_file(filepath):
    if not os.path.exists(filepath):
        return json.dumps({"success": False, "error": f"File not found: {filepath}"})
    
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            workbook_xml = z.read('xl/workbook.xml')
            tree = ET.fromstring(workbook_xml)
            ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            sheets = []
            for s in tree.findall('.//s:sheet', ns):
                sheets.append(s.attrib.get('name'))
            return json.dumps({"success": True, "sheets": sheets, "path": filepath})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})

def get_month_sheet_name(d_str):
    month_names = [
        "January", "Feburary", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    try:
        clean_d = d_str.replace('/', '.').replace('-', '.')
        parts = [p for p in clean_d.split('.') if p]
        if len(parts) == 3:
            month_idx = int(parts[1]) - 1
            year = parts[2]
            if len(year) == 2:
                year = '20' + year
            if 0 <= month_idx < 12:
                return f"{month_names[month_idx]} - {year}"
    except:
        pass
    return "June - 2026"

def append_records(filepath, default_sheet_name, records):
    if not os.path.exists(filepath):
        return json.dumps({"success": False, "error": f"File not found: {filepath}"})
    
    # Create Safety Backup
    backup_dir = os.path.expanduser('~/Downloads/Excel_Backups')
    os.makedirs(backup_dir, exist_ok=True)
    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_file = os.path.join(backup_dir, f"Backup_{ts}_" + os.path.basename(filepath))
    shutil.copy(filepath, backup_file)

    ET.register_namespace('', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
    ET.register_namespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    ET.register_namespace('mc', 'http://schemas.openxmlformats.org/markup-compatibility/2006')
    ET.register_namespace('x14ac', 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac')
    
    scratch_temp = filepath + '.tmp.xlsx'
    
    try:
        # Group records by auto-detected month sheet
        sheet_records_map = {}
        for rec in records:
            s_name = get_month_sheet_name(rec.get('date', ''))
            if s_name not in sheet_records_map:
                sheet_records_map[s_name] = []
            sheet_records_map[s_name].append(rec)

        current_filepath = filepath
        added_rows_all = []

        for target_sheet_name, rec_list in sheet_records_map.items():
            with zipfile.ZipFile(current_filepath, 'r') as z:
                wb_tree = ET.fromstring(z.read('xl/workbook.xml'))
                ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                
                target_xml = None
                sheets = wb_tree.findall('.//s:sheet', ns)

                rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
                rel_map = {}
                for r in rels:
                    rel_map[r.attrib['Id']] = r.attrib['Target']

                target_sheet_search = target_sheet_name.strip().lower()
                for s in sheets:
                    if s.attrib.get('name').strip().lower() == target_sheet_search:
                        r_id = s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                        target = rel_map[r_id]
                        target_xml = 'xl/' + target if not target.startswith('xl/') else target
                        break
                
                if not target_xml:
                    target_xml = 'xl/worksheets/sheet2.xml' # Default to June - 2026 sheet
                    
                shared_strings_xml = z.read('xl/sharedStrings.xml')
                sheet_xml = z.read(target_xml)

            ss_tree = ET.fromstring(shared_strings_xml)
            sheet_tree = ET.fromstring(sheet_xml)
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
            
            existing_jcs = set()
            next_row = 6
            for r in sheet_tree.findall('.//s:row', ns_ss):
                r_num = int(r.attrib.get('r'))
                c_b = r.find(f'./s:c[@r="B{r_num}"]', ns_ss)
                c_i = r.find(f'./s:c[@r="I{r_num}"]', ns_ss)
                if c_i is not None:
                    v_i = c_i.find('./s:v', ns_ss)
                    if v_i is not None and v_i.text and v_i.text.isdigit():
                        existing_jcs.add(int(v_i.text))
                
                if c_b is not None:
                    v_b = c_b.find('./s:v', ns_ss)
                    if v_b is not None and v_b.text and v_b.text.strip():
                        next_row = r_num + 1

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

            for rec in rec_list:
                jc_val = int(rec.get('jobCardNo', 0)) if str(rec.get('jobCardNo', '')).isdigit() else 0
                if jc_val > 0 and jc_val in existing_jcs:
                    continue
                
                r_num = next_row
                row_elem = sheet_tree.find(f'./s:sheetData/s:row[@r="{r_num}"]', ns_ss)
                if row_elem is None:
                    row_elem = ET.Element('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
                    row_elem.attrib['r'] = str(r_num)
                    sheet_tree.find('./s:sheetData', ns_ss).append(row_elem)

                d_str = rec.get('date', '18.06.2026')
                try:
                    dt = datetime.datetime.strptime(d_str, '%d.%m.%Y').date()
                except:
                    dt = datetime.date(2026, 6, 18)
                date_ser = (dt - datetime.date(1899, 12, 30)).days
                
                c_id = add_ss(rec.get('customerName', 'ELECTROPNEUMATICS & HYDRAULICS (INDIA) PVT. LTD.'))
                d_id = add_ss(rec.get('partNumber', 'B01920DS3LB104R00A'))
                e_id = add_ss(rec.get('partName', 'PANEL STICKER-1'))
                po_id = add_ss(rec.get('poNo', '1100229203 / 104'))
                
                qty = rec.get('qty', 1)
                sqft = rec.get('sqft', 1.2)
                
                set_c(row_elem, 'B', 227, None, date_ser)
                set_c(row_elem, 'C', 86, 's', c_id)
                set_c(row_elem, 'D', 71, 's', d_id)
                set_c(row_elem, 'E', 85, 's', e_id)
                set_c(row_elem, 'F', 44, None, qty)
                set_c(row_elem, 'G', 44, None, sqft)
                set_c(row_elem, 'H', 54, 's', unit_id)
                set_c(row_elem, 'I', 44, None, jc_val if jc_val > 0 else rec.get('jobCardNo', 821))
                set_c(row_elem, 'J', 54, None, qty)
                set_c(row_elem, 'K', 54, None, 0)
                set_c(row_elem, 'N', 78, None, 0)
                set_c(row_elem, 'O', 79, None, 0)
                set_c(row_elem, 'Q', 71, 's', po_id)

                if jc_val > 0:
                    existing_jcs.add(jc_val)
                added_rows_all.append(r_num)
                next_row += 1

            ss_tree.attrib['count'] = str(len(si_list))
            ss_tree.attrib['uniqueCount'] = str(len(si_list))

            ss_bytes = ET.tostring(ss_tree, encoding='utf-8', xml_declaration=True)
            sheet_bytes = ET.tostring(sheet_tree, encoding='utf-8', xml_declaration=True)

            with zipfile.ZipFile(current_filepath, 'r') as zin:
                with zipfile.ZipFile(scratch_temp, 'w') as zout:
                    for item in zin.infolist():
                        if item.filename == 'xl/sharedStrings.xml':
                            zout.writestr(item, ss_bytes)
                        elif item.filename == target_xml:
                            zout.writestr(item, sheet_bytes)
                        else:
                            zout.writestr(item, zin.read(item.filename))

            shutil.copy(scratch_temp, filepath)
            downloads_path = os.path.expanduser('~/Downloads/Daily Production Report - 2026.xlsx')
            if os.path.exists(os.path.dirname(downloads_path)):
                shutil.copy(scratch_temp, downloads_path)
                
            os.remove(scratch_temp)
            current_filepath = filepath

        return json.dumps({"success": True, "addedRows": added_rows_all, "backupFile": backup_file})
    
    except Exception as e:
        if os.path.exists(scratch_temp):
            os.remove(scratch_temp)
        return json.dumps({"success": False, "error": str(e)})

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'check':
        print(check_file(sys.argv[2]))
    elif cmd == 'append':
        filepath = sys.argv[2]
        sheet_name = sys.argv[3]
        records = json.loads(sys.argv[4])
        print(append_records(filepath, sheet_name, records))
