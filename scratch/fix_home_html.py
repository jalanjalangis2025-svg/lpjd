
import os
import re

file_path = r'd:\lpjd baruuuuuuuuuuuuuuuuuuu\lpjd-main\home.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find the buttons that call openActionModal
# We want to catch the whole button tag and its content
pattern = re.compile(r'(<button\s+onclick="openActionModal\(\$\{item\.id\}\)"\s+class="action-btn-small"[^>]*>.*?</button>)', re.DOTALL)

def replacer(match):
    original_button = match.group(1)
    # Check if it's already wrapped (though unlikely with this script)
    if '${item.report_source !== \'public\'' in content:
        # We need to be careful not to double wrap if we run this on a partially updated file
        # But since we are doing a single global replacement on the whole content, it should be fine
        pass
    
    # Get the indentation of the line where the button starts
    # This is slightly tricky with re.sub, so we'll just use a generic wrapper
    return f'${{item.report_source !== \'public\' ? `{original_button}` : \'-\'}}'

# We also need to handle cases where it might be slightly different or already partially wrapped
# Actually, let's target the <td> blocks directly to be cleaner.

# Pattern for <td> containing the button
td_pattern = re.compile(r'(<td style="text-align: center;">\s*)(<button onclick="openActionModal\(\$\{item\.id\}\)"[^>]*>.*?</button>)(\s*</td>)', re.DOTALL)

new_content = td_pattern.sub(r'\1${item.report_source !== \'public\' ? `\2` : \'-\'}\3', content)

# Special check for double wrapping of the one I already did manually
new_content = new_content.replace('${item.report_source !== \'public\' ? `${item.report_source !== \'public\' ?', '${item.report_source !== \'public\' ?')
# Actually, the manual one was:
# ${item.report_source !== 'public' ? `
# <button onclick="openActionModal(${item.id})" class="action-btn-small">
#     <i class="fas fa-cog"></i>
# </button>
# ` : '-'}

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully updated home.html")
