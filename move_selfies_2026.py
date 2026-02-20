import shutil
from pathlib import Path

# Config
SOURCE_DIR = Path(r"C:\Users\maden\Downloads\Phone Link\Photos\2026")
DEST_DIR = Path(r"C:\Users\maden\Downloads\Phone Link\Selfies")
DEST_DIR.mkdir(parents=True, exist_ok=True)

# Classification from Vision Agent
CLASSIFICATION = {
  "0eb1e2d1ea73822cc01dbbbbee5a31df.jpg": "Selfies",
  "1000055055.jpg": "Misc",
  "1000068018.png": "Selfies",
  "1000068019.png": "Selfies",
  "1000068020.png": "Selfies",
  "1000068021.png": "Selfies",
  "1000072149.webp": "Misc",
  "1000072215.png": "Misc",
  "1000072217.png": "Misc",
  "1000072219.png": "Misc",
  "1000072220.png": "Misc",
  "1000072254.png": "Misc",
  "1000072701.png": "Misc",
  "1000072722.png": "Misc",
  "1000072727.png": "Misc",
  "1000072730.png": "Misc",
  "1000072731.png": "Misc",
  "1000072732.png": "Misc",
  "1000072733.png": "Misc",
  "1000072734.png": "Misc",
  "1000072739.png": "Misc",
  "1000072748.png": "Misc",
  "1000072753.jpg": "Misc",
  "1000072754.jpg": "Misc",
  "1000072756.jpg": "Misc",
  "1000072856.png": "Misc",
  "1000072858.png": "Misc",
  "1000072859.png": "Misc",
  "1000081075.jpg": "Misc",
  "1000081081.jpg": "Misc",
  "1000081083.jpg": "Misc",
  "1768391386201.jpg": "Misc",
  "1768391543699.jpg": "Misc",
  "1768391579855.jpg": "Misc",
  "1768391711166.jpg": "Misc",
  "1768392190106.jpg": "Misc",
  "1768432480377.jpg": "Misc",
  "1768457539167.jpg": "Misc",
  "1768457604663.jpg": "Misc",
  "1768457974929.jpg": "Misc",
  "1768458042345.jpg": "Misc",
  "1768458090867.jpg": "Misc",
  "1768458143743.jpg": "Misc",
  "1768458261072.jpg": "Misc",
  "1768458301086.jpg": "Misc",
  "1768497937817.jpg": "Misc",
  "1768524742219.jpg": "Misc",
  "1768549993280.jpg": "Misc",
  "1768550052501.jpg": "Selfies",
  "1768550110563.jpg": "Selfies",
  "1768550156187.jpg": "Selfies",
  "1768550226151.jpg": "Selfies",
  "1768550317299.jpg": "Selfies",
  "1768550388593.jpg": "Selfies",
  "1768618005174.jpg": "Selfies",
  "1768618070386.jpg": "Selfies",
  "20260114_223106.heic": "Misc",
  "20260114_223118.heic": "Misc",
  "20260114_223119.jpg": "Misc",
  "20260115_010406.jpg": "Misc"
}

count = 0
for filename, category in CLASSIFICATION.items():
    if category == "Selfies":
        src = SOURCE_DIR / filename
        dest = DEST_DIR / filename
        if src.exists():
            shutil.move(str(src), str(dest))
            print(f"Moved Selfie: {filename}")
            count += 1
            
print(f"--- Moved {count} selfies to {DEST_DIR} ---")
