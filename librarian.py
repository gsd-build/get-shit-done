import os
import shutil
import hashlib
import time
import datetime
import argparse
from pathlib import Path
from collections import defaultdict

# --- CONFIGURATION ---
# You can hardcode paths here or pass them as arguments
DEFAULT_SOURCE_DIR = "./inbox"  # Where files arrive (Downloads, Phone transfer)
DEFAULT_DEST_DIR = "./storage"  # Where files are organized (Photos, Documents)

# Mapping Extensions to Folders
CATEGORY_MAP = {
    'Images': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.heic', '.raw', '.svg'],
    'Videos': ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv'],
    'Documents': ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.xls', '.xlsx', '.ppt', '.pptx', '.md'],
    'Audio': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'],
    'Archives': ['.zip', '.rar', '.7z', '.tar', '.gz'],
    'Executables': ['.exe', '.msi', '.bat', '.sh', '.app'],
    'Code': ['.py', '.js', '.html', '.css', '.java', '.cpp', '.c', '.h', '.json', '.xml', '.yml', '.yaml']
}

# --- UTILS ---

def calculate_hash(file_path, block_size=65536):
    """Calculates SHA256 hash of a file to detect exact duplicates."""
    sha256 = hashlib.sha256()
    try:
        with open(file_path, 'rb') as f:
            for block in iter(lambda: f.read(block_size), b''):
                sha256.update(block)
        return sha256.hexdigest()
    except OSError:
        return None

def get_creation_date(file_path):
    """Gets the creation date of the file for sorting."""
    try:
        # Try to get creation time, fallback to modification time
        timestamp = os.path.getmtime(file_path)
        return datetime.datetime.fromtimestamp(timestamp)
    except OSError:
        return datetime.datetime.now()

def get_unique_filename(destination_folder, filename):
    """Ensures filename is unique in destination to prevent overwrites (if hash is different)."""
    name, ext = os.path.splitext(filename)
    counter = 1
    new_filename = filename
    
    while (destination_folder / new_filename).exists():
        new_filename = f"{name}_{counter}{ext}"
        counter += 1
        
    return new_filename

class Librarian:
    def __init__(self, source, destination, dry_run=True, recursive=False):
        self.source = Path(source).resolve()
        self.destination = Path(destination).resolve()
        self.dry_run = dry_run
        self.recursive = recursive
        self.stats = defaultdict(int)

    def determine_category(self, file_path):
        ext = file_path.suffix.lower()
        for category, extensions in CATEGORY_MAP.items():
            if ext in extensions:
                return category
        return "Others"

    def process_file(self, file_path):
        if file_path.name.startswith('.'): # Skip hidden files
            return

        self.stats['processed'] += 1
        
        # 1. Calculate Hash (Deduplication Check)
        file_hash = calculate_hash(file_path)
        if not file_hash:
            print(f"[ERROR] Could not read: {file_path}")
            self.stats['errors'] += 1
            return

        # 2. Extract Metadata (Date)
        date_obj = get_creation_date(file_path)
        year_str = date_obj.strftime("%Y")
        month_str = date_obj.strftime("%m")
        
        # 3. Determine Destination Structure
        category = self.determine_category(file_path)
        
        # Structure: Destination / Category / Year / Month (for chronological media)
        # OR: Destination / Category / Extension (for docs/others)
        
        if category in ['Images', 'Videos']:
            dest_folder = self.destination / category / year_str / month_str
        else:
            dest_folder = self.destination / category
            
        # 4. Construct New Filename (Standardized)
        # Naming: YYYY-MM-DD_OriginalName.ext
        date_prefix = date_obj.strftime("%Y-%m-%d")
        new_name = f"{date_prefix}_{file_path.name}"
        
        target_path = dest_folder / new_name

        # 5. Check for Duplicates in Destination
        # This is simple: if target exists, check hash. If hash matches -> Delete/Skip source.
        # If hash different -> Rename source.
        
        action = "MOVE"
        
        if target_path.exists():
            target_hash = calculate_hash(target_path)
            if target_hash == file_hash:
                action = "DUPLICATE"
                self.stats['duplicates'] += 1
            else:
                # Same name, different content. Resolve collision.
                new_name = get_unique_filename(dest_folder, new_name)
                target_path = dest_folder / new_name
                action = "RENAME_MOVE"

        # 6. Execute Action
        print(f"[{action}] {file_path.name} -> {target_path.relative_to(self.destination) if self.destination in target_path.parents else target_path}")
        
        if not self.dry_run:
            if action == "DUPLICATE":
                # Safe option: Move to specific 'Duplicates' folder or Delete
                # For safety, let's move to a duplicates folder instead of deleting
                dupe_folder = self.destination / "_Duplicates"
                dupe_folder.mkdir(parents=True, exist_ok=True)
                shutil.move(str(file_path), str(dupe_folder / file_path.name))
            else:
                dest_folder.mkdir(parents=True, exist_ok=True)
                shutil.move(str(file_path), str(target_path))
                self.stats['moved'] += 1

    def run(self):
        print(f"--- LIBRARIAN STARTED ---")
        print(f"Source: {self.source}")
        print(f"Dest:   {self.destination}")
        print(f"Mode:   {'DRY RUN (No changes)' if self.dry_run else 'LIVE (Moving files)'}")
        print("-------------------------")

        if not self.source.exists():
            print(f"Error: Source directory '{self.source}' does not exist.")
            return

        files_to_process = []
        if self.recursive:
            for root, _, files in os.walk(self.source):
                for file in files:
                    files_to_process.append(Path(root) / file)
        else:
            files_to_process = [x for x in self.source.iterdir() if x.is_file()]

        for file_path in files_to_process:
            self.process_file(file_path)

        print("-------------------------")
        print(f"SUMMARY:")
        print(f"Processed:  {self.stats['processed']}")
        print(f"Moved:      {self.stats['moved']}")
        print(f"Duplicates: {self.stats['duplicates']}")
        print(f"Errors:     {self.stats['errors']}")
        print(f"Time:       {datetime.datetime.now()}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Local File Manager 'Librarian'")
    parser.add_argument("--source", type=str, default=DEFAULT_SOURCE_DIR, help="Source inbox directory")
    parser.add_argument("--dest", type=str, default=DEFAULT_DEST_DIR, help="Destination storage directory")
    parser.add_argument("--live", action="store_true", help="Execute changes (Disable Dry Run)")
    parser.add_argument("--recursive", action="store_true", help="Scan source recursively")
    
    args = parser.parse_args()
    
    librarian = Librarian(args.source, args.dest, dry_run=not args.live, recursive=args.recursive)
    librarian.run()
