
import sys

def fix_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if we have double encoded characters
    if 'Ã' not in content:
        print("No double encoded characters found.")
        return

    # Try to decode the whole content
    try:
        # Encode back to bytes using latin-1, then decode as utf-8
        fixed = content.encode('latin1').decode('utf-8')
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(fixed)
        print("Successfully fixed the whole file.")
        return
    except Exception as e:
        print(f"Whole file fix failed: {e}. Falling back to manual replacements.")

    # Manual replacements for common Spanish double-encoded chars
    replacements = {
        'Ã¡': 'á',
        'Ã©': 'é',
        'Ã­': 'í',
        'Ã³': 'ó',
        'Ãº': 'ú',
        'Ã±': 'ñ',
        'Ã ': 'Á',
        'Ã‰': 'É',
        'Ã\x8d': 'Í',
        'Ã“': 'Ó',
        'Ãš': 'Ú',
        'Ã‘': 'Ñ',
        'Â¿': '¿',
        'Â¡': '¡'
    }
    
    changed = 0
    for bad, good in replacements.items():
        if bad in content:
            content = content.replace(bad, good)
            changed += 1
            
    if changed > 0:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Made manual replacements for {changed} character types.")

fix_file('Code.js')
fix_file('LeagueMenu.html')
