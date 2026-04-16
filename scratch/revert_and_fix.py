
import os
import re

file_path = r'd:\lpjd baruuuuuuuuuuuuuuuuuuu\lpjd-main\home.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Restore the buttons in tables
# Revert the wrapper logic
# Pattern: ${item.report_source !== 'public' ? ` BUTTON_CODE ` : '-'}
pattern = re.compile(r'\$\{item\.report_source\s*!==\s*\'public\'\s*\?\s*`\s*(<button\b.*?</button>)\s*`\s*:\s*\'.*?\'\}', re.DOTALL)

def restore_button(match):
    return match.group(1)

new_content = pattern.sub(restore_button, content)

# 2. Add ID to the Edit button in the modal
new_content = new_content.replace(
    '<button onclick="performAction(\'process\')"',
    '<button id="btn-edit-report" onclick="performAction(\'process\')" '
)

# 3. Update openActionModal function to hide the button
# Locate the function
func_pattern = re.compile(r'(function openActionModal\(id\) \{.*?)(\})', re.DOTALL)

def update_func(match):
    original = match.group(1)
    injection = "\n            // Hide edit button for citizen reports\n            const editBtn = document.getElementById('btn-edit-report');\n            if (editBtn) {\n                editBtn.style.display = report.report_source === 'public' ? 'none' : 'block';\n            }\n"
    return f"{original}{injection}        }}"

new_content = func_pattern.sub(update_func, new_content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Restored table buttons and updated modal logic in home.html")
