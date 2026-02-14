import os
from pathlib import Path

TARGET_DIR = Path(r"C:\Users\maden\Downloads\Phone Link\Photos\2026")

html = """
<html>
<head>
    <style>
        body { background: #222; color: #eee; font-family: sans-serif; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
        .card { background: #333; padding: 5px; }
        img { width: 100%; height: 150px; object-fit: cover; }
        .name { font-size: 10px; margin-top: 5px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    </style>
</head>
<body>
    <h1>2026 Photos Review</h1>
    <div class="grid">
"""

count = 0
for f in TARGET_DIR.iterdir():
    if f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp', '.heic']:
        html += f"""
        <div class="card">
            <img src="{f.name}" loading="lazy">
            <div class="name">{f.name}</div>
        </div>
        """
        count += 1

html += "</div></body></html>"

with open(TARGET_DIR / "review.html", "w", encoding='utf-8') as f:
    f.write(html)
    
print(f"Generated review.html for {count} files in 2026.")
