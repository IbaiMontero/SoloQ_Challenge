
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('LeagueMenu.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

changed = 0

for i, line in enumerate(lines):
    # Fix lft-filter-div Elite option (line ~2621) → add Promesas, fix Elite text
    if 'value="Elite"' in line and '&#128737;' in line and 'E&#769;lite' in line:
        lines[i] = '                         <option value="\u00c9lite">\U0001f6e1\ufe0f \u00c9lite</option>\n'
        # Insert Promesas after this
        lines.insert(i+1, '                         <option value="Promesas">\U0001f331 Promesas</option>\n')
        changed += 1
        sys.stdout.write(f"Fixed Elite option and inserted Promesas at L{i+1}\n")
        break

# Reload since we inserted
content = ''.join(lines)

# Fix DIV_ICONS (the HTML entity version is ugly, replace with proper emoji)
old_div = "        var DIV_ICONS = { Premier:'&#128081;', Aspirante:'&#9876;&#65039;', '&Eacute;lite':'&#128737;&#65039;', Promesas:'&#127793;', Academia:'&#127891;' };"
new_div = "        var DIV_ICONS = { Premier:'\U0001f451', Aspirante:'\u2694\ufe0f', '\u00c9lite':'\U0001f6e1\ufe0f', Promesas:'\U0001f331', Academia:'\U0001f393' };"
if old_div in content:
    content = content.replace(old_div, new_div)
    changed += 1
    sys.stdout.write("Fixed DIV_ICONS\n")

# Fix TP_DIV_ICONS - find the line after "var TP_DIV_ICONS = {"
lines2 = content.split('\n')
for i, line in enumerate(lines2):
    if "var TP_DIV_ICONS = {" in line:
        # Replace next line
        lines2[i+1] = "        'Premier': '\U0001f451', 'Aspirante': '\u2694\ufe0f', '\u00c9lite': '\U0001f6e1\ufe0f', 'Promesas': '\U0001f331', 'Academia': '\U0001f393'"
        changed += 1
        sys.stdout.write(f"Fixed TP_DIV_ICONS at L{i+1}\n")
        break

content = '\n'.join(lines2)

with open('LeagueMenu.html', 'w', encoding='utf-8') as f:
    f.write(content)

sys.stdout.write(f"Total changes: {changed}\n")
sys.stdout.write("Done!\n")
sys.stdout.flush()
