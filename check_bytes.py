
with open(r"c:\Users\elzorro1\OneDrive\Escritorio\Nueva carpeta\SoloQ_Challenge\code.gs", "rb") as f:
    lines = f.readlines()
    for i in range(60, 68):
        print(f"Line {i+1}: {lines[i]}")
