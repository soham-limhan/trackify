import PyPDF2
import re

try:
    with open('../Statements.pdf', 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        
        lines = text.split('\n')
        current_date = None
        for line in lines:
            # Identify Date "2025-12-X" indicating start of transaction row
            if re.match(r'^(\d{4}-\d{2}-\d{2})$', line):
                date_str = line
                current_date = date_str
                current_desc = ""
                continue
            
            if current_date:
                # Based on the header: Date Particulars Instruments Dr Amount Cr Amount Total Amount
                # If there's 3 numbers at the end, it's Dr and Cr and Balance
                # But looking at PDF text, PyPDF merges the columns differently. 
                # Let's write specifically to test different matches
                
                # Check for: [Number] [Number] CR/DR? at end of line
                match_two_nums = re.search(r'([\d,]+_?\d*\.\d{2})\s+([\d,]+_?\d*\.\d{2})\s*(CR|DR|cr|dr)?$', line)
                if match_two_nums:
                    amount1 = float(match_two_nums.group(1).replace(',', ''))
                    amount2 = float(match_two_nums.group(2).replace(',', ''))
                    indicator = match_two_nums.group(3)
                    
                    print(f"MATCH: {amount1} and {amount2} | Indicator: {indicator}")
                    current_date = None
                    
except Exception as e:
    print(f"Error parsing PDF: {e}")
