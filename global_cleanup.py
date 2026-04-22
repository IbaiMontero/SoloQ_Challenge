
import re

replacements = [
    (r"Puntuaci\s{4}n", "Puntuación"),
    (r"Actualizaci\s{4}n", "Actualización"),
    (r"Configuraci\s{4}n", "Configuración"),
    (r"Producci\s{4}n", "Producción"),
    (r"Misi\s{4}n", "Misión"),
    (r"Econom\s{4}a", "Economía"),
    (r"Vac\s{4}o", "Vacío"),
    (r"b\s{4}squeda", "búsqueda"),
    (r"\s{4}ltima", "última"), # Changed to 4 to be safer, I saw 5 but 4+1 might be it
    (r"a\s{4}adir", "añadir"),
    (r"a\s{4}adida", "añadida"),
    (r"est\s{4}n", "están"),
    (r"m\s{4}nimas", "mínimas"),
    (r"m\s{4}ximo", "máximo"),
    (r"L\s{4}nea", "Línea"),
    (r"l\s{4}nea", "línea"),
    (r"Cr\s{4}tico", "Crítico"),
    (r"R\s{4}pida", "Rápida"),
    (r"bane\s{4}", "baneó"),
    (r"in\s{4}til", "inútil"),
    (r"Regi\s{4}n", "Región"),
    (r"Da\s{4}o", "Daño"),
    (r"clave de CONFIG a\s{4}adida", "clave de CONFIG añadida"),
    (r"A\s{8}dela", "Añádela"),
    (r"S\s{4}/No", "Sí/No"),
    (r"S\s{4}\'", "Sí'"), # for setValues([['...','Active (Sí/No)',...]])
    (r"Duraci\s{4}n", "Duración"),
    (r"Descripci\s{4}n", "Descripción"),
    (r"Misi\s{4}n Semanal", "Misión Semanal"),
    (r"perdonar visi\s{4}n", "perdonar visión"),
    (r"Mitigaci\s{4}n", "Mitigación"),
    (r"Morir por torres", "morir por torres"), # just in case
    (r"M\s{4}ticos", "Míticos"),
    (r"Rub\s{4}", "Rubí"),
    (r"Jade\s{4}ta", "Jadeíta"),
    (r"M\s{4}rmol", "Mármol"),
    (r"C\s{4}smica", "Cósmica"),
    (r"Divisi\s{4}n", "División"),
    (r"lim\s{4}n", "limón"),
    (r"m\s{4}gico", "mágico"),
    (r"Vac\s{4}o", "Vacío"),
    (r"M\s{4}xima", "Máxima"),
    (r"penalizaci\s{4}n", "penalización"),
    (r"est\s{4}n listas", "están listas")
]

file_path = r"c:\Users\elzorro1\OneDrive\Escritorio\Nueva carpeta\SoloQ_Challenge\Code.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content)

# Special cases for the sample list which has different spacing
content = content.replace("H    m    ", "Hámá")
content = content.replace("Ry     Zacker", "RyZacker")
content = content.replace("Ry    96", "Ry96")
content = content.replace("ElS    muel", "Samuel")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Cleanup complete.")
