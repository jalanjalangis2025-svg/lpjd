
import os
import re

file_path = r'd:\lpjd baruuuuuuuuuuuuuuuuuuu\lpjd-main\home.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix HTML Table Truncation
# Replace ellipsis styles with wrapping styles
content = content.replace('white-space: nowrap; overflow: hidden; text-overflow: ellipsis;', 'white-space: normal; word-break: break-word;')

# 2. Fix PDF Export Truncation
# Replace the manual substring truncation in exportToPDF
old_pdf_line = "(item.description || '-').substring(0, 30) + (item.description && item.description.length > 30 ? '...' : '')"
new_pdf_line = "(item.description || '-')"

content = content.replace(old_pdf_line, new_pdf_line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully fixed description truncation in home.html (Web & PDF)")
