import os
import shutil
from pathlib import Path

# Config
SOURCE_DIR = Path(r"C:\Users\maden\Downloads\Phone Link")
DEST_DIR = SOURCE_DIR  # Organize in place (or change to new folder)

CATEGORIES = {
    "Videos": [".mp4", ".mov", ".avi", ".mkv"],
    "Screenshots": [], # Heuristic based
    "Facebook_Saved": [], # Heuristic based
    "Review_Needed": [] # The rest (Photos)
}

def setup_dirs():
    for cat in ["Videos", "Screenshots", "Facebook_Saved", "Selfies", "Individuals", "Upscale", "Ideas", "Misc", "Review_Needed"]:
        (DEST_DIR / cat).mkdir(exist_ok=True)

def is_screenshot(filename):
    return "screenshot" in filename.lower()

def is_facebook(filename):
    return "fb_img" in filename.lower()

def generate_contact_sheet(files):
    html = """
    <html>
    <head>
        <style>
            body { background: #333; color: white; font-family: sans-serif; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
            .card { background: #444; pading: 10px; text-align: center; }
            img { max-width: 100%; height: auto; display: block; margin: 0 auto; max-height: 200px; }
            .name { font-size: 10px; margin-top: 5px; word-break: break-all; }
        </style>
    </head>
    <body>
        <h1>Review Needed: Photos</h1>
        <div class="grid">
    """
    
    for f in files:
        # Use relative path for browser to load local file if in same dir
        # Note: Browser might block local file access unless opened correctly.
        # We will assume user opens this file in the same folder.
        html += f"""
        <div class="card">
            <img src="{f.name}" loading="lazy">
            <div class="name">{f.name}</div>
        </div>
        """
        
    html += "</div></body></html>"
    
    with open(SOURCE_DIR / "Review_Needed" / "contact_sheet.html", "w", encoding='utf-8') as f:
        f.write(html)

def main():
    setup_dirs()
    
    review_queue = []
    
    for file_path in SOURCE_DIR.iterdir():
        if file_path.is_dir(): continue
        if file_path.name == "organize_photos.py": continue
        
        name = file_path.name.lower()
        ext = file_path.suffix.lower()
        
        # 1. Videos
        if ext in CATEGORIES["Videos"]:
            print(f"Moving Video: {file_path.name}")
            shutil.move(str(file_path), str(DEST_DIR / "Videos" / file_path.name))
            continue
            
        # 2. Screenshots
        if is_screenshot(name):
            print(f"Moving Screenshot: {file_path.name}")
            shutil.move(str(file_path), str(DEST_DIR / "Screenshots" / file_path.name))
            continue

        # 3. Facebook/Social Saves
        if is_facebook(name):
            print(f"Moving FB Image: {file_path.name}")
            shutil.move(str(file_path), str(DEST_DIR / "Facebook_Saved" / file_path.name))
            continue

        # 4. Images to Sort (Heic, Jpg, Png)
        if ext in [".jpg", ".jpeg", ".png", ".heic", ".webp"]:
            # Move to Review_Needed folder temporarily
            dest = DEST_DIR / "Review_Needed" / file_path.name
            shutil.move(str(file_path), str(dest))
            review_queue.append(dest)

    # Generate HTML for the remaining photos
    if review_queue:
        generate_contact_sheet(review_queue)
        print(f"Moved {len(review_queue)} photos to 'Review_Needed' and generated contact sheet.")

if __name__ == "__main__":
    main()
