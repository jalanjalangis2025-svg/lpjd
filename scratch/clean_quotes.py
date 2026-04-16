
import os

file_path = r'd:\lpjd baruuuuuuuuuuuuuuuuuuu\lpjd-main\home.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the escaped quotes that my previous script introduced
new_content = content.replace("\\'", "'")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Cleaned up quotes in home.html")
