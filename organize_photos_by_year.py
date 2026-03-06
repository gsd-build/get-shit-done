import os
import shutil
import re
from pathlib import Path
from datetime import datetime

SOURCE_DIR = Path(r"C:\Users\maden\Downloads\Phone Link\Review_Needed")
DEST_ROOT = Path(r"C:\Users\maden\Downloads\Phone Link\Photos")

def get_year_from_filename(filename):
    # Match YYYY-MM-DD or YYYYMMDD at start
    match = re.search(r'(20\d{2})[-_]?\d{2}[-_]?\d{2}', filename)
    if match:
        return match.group(1)
    
    # Match Unix Timestamp (starts with 17... for recent years)
    match_ts = re.search(r'^(17\d{8,})', filename)
    if match_ts:
        try:
            ts = int(match_ts.group(1)) / 1000  # ms to s
            return datetime.fromtimestamp(ts).strftime('%Y')
        except:
            pass
            
    return "Unsorted"

def main():
    if not SOURCE_DIR.exists():
        print(f"Source dir {SOURCE_DIR} not found!")
        return

    count = 0
    for file_path in SOURCE_DIR.iterdir():
        if file_path.is_dir(): continue
        if file_path.name == "contact_sheet.html": continue

        year = get_year_from_filename(file_path.name)
        
        # Fallback to file creation time if filename fails
        if year == "Unsorted":
            try:
                ts = os.path.getmtime(file_path)
                year = datetime.fromtimestamp(ts).strftime('%Y')
            except:
                pass

        target_dir = DEST_ROOT / year
        target_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            shutil.move(str(file_path), str(target_dir / file_path.name))
            print(f"Moved {file_path.name} -> {year}")
            count += 1
        except Exception as e:
            print(f"Error moving {file_path.name}: {e}")

    print(f"--- Complete. Sorted {count} photos by Year. ---")
    
    # Clean up empty source dir
    try:
        if not any(SOURCE_DIR.iterdir()):
            SOURCE_DIR.rmdir()
            print("Removed empty Review_Needed folder.")
    except:
        pass

if __name__ == "__main__":
    main()
