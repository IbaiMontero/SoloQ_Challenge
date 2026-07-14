
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('LeagueMenu.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Change '🌱' to '💫' for Promesas everywhere
content = content.replace('🌱 Promesas', '💫 Promesas')
content = content.replace("'Promesas': '🌱'", "'Promesas': '💫'")
content = content.replace("'Promesas':'🌱'", "'Promesas':'💫'")
content = content.replace("'Promesas': '\U0001f331'", "'Promesas': '\U0001f4ab'")

# 2. Change '🛡️ Élite' to '💎 Élite' everywhere
content = content.replace('🛡️ Élite', '💎 Élite')
content = content.replace("'Élite': '🛡️'", "'Élite': '💎'")
content = content.replace("'Élite':'🛡️'", "'Élite':'💎'")
content = content.replace("'\u00c9lite':'\U0001f6e1\ufe0f'", "'\u00c9lite':'\U0001f48e'")
content = content.replace("'\u00c9lite': '\U0001f6e1\ufe0f'", "'\u00c9lite': '\U0001f48e'")

# 3. Fix populateDivisionSelector to show ALL divisions always
# Change `(divInfo.divisions || []).forEach(function (d) {` 
# to `(divInfo.all || divInfo.divisions || []).forEach(function (d) {`
old_loop = "(divInfo.divisions || []).forEach(function (d) {"
new_loop = "(divInfo.all || divInfo.divisions || []).forEach(function (d) {"
if old_loop in content:
    content = content.replace(old_loop, new_loop)
    print("Fixed populateDivisionSelector to use divInfo.all")
else:
    print("WARNING: Could not find populateDivisionSelector loop.")

with open('LeagueMenu.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Icons replaced successfully.")
