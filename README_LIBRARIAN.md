# Librarian: Your Trusted Local File Manager

**Librarian** is a privacy-first, local Python utility that organizes your chaotic downloads and uploads into a structured archive. It does this without ever sending a single byte to the internet.

## Features
- **Privacy Core**: Runs 100% offline.
- **Smart Sorting**: Categorizes files into `Images`, `Videos`, `Documents`, etc.
- **Time-Travel**: Organizes Photos/Videos by Year/Month automatically.
- **Deduplication**: Hashes every file. If you download the same meme twice, it catches it.
- **Safe Mode**: Runs in **Dry Run** mode by default. It tells you what it *would* do, but doesn't touch your files until you stick the `--live` flag on it.

## Quick Start

### 1. Prerequisites
You need Python installed.
```bash
python --version
```

### 2. The Command
Run the script from your terminal:

```bash
# Preview what would happen (Dry Run) - SAFE
python librarian.py --source "C:\Users\You\Downloads" --dest "C:\Users\You\Archive"

# Actually move the files (Live Mode) - DANGER
python librarian.py --source "C:\Users\You\Downloads" --dest "C:\Users\You\Archive" --live
```

### 3. Arguments
- `--source`: The folder to clean up (Inbox).
- `--dest`: The folder to store organized files (Root).
- `--recursive`: Look inside subfolders of the source.
- `--live`: **Actually move files**. If omitted, it just prints a plan.

## Directory Structure Created

```text
/Archive
    /Images
        /2024
            /01
                2024-01-15_IMG_5921.jpg
    /Documents
        2024-02-10_Invoice.pdf
    /Videos
        /2023
            /12
                2023-12-25_FamilyVideo.mp4
    /_Duplicates
        (Duplicate files are moved here safely)
```

## Security Note
This script uses `shutil.move` and standard libraries. It makes zero network calls. You can audit the code in `librarian.py`—it's only ~130 lines of Python.
