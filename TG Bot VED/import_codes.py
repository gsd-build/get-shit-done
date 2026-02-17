import os
import re
import sqlite3
from pathlib import Path

import pdfplumber

# === НАСТРОЙКИ ===
PDF_PATH = Path(os.getenv("PDF_PATH", "ru.84_2022_21.09.2025.pdf"))
DB_PATH = Path(os.getenv("DB_PATH", "bot.db"))

# Фильтр по группам ТН ВЭД: оставить только коды с указанными префиксами (4 цифры).
# Пустой список = загружать все коды из PDF.
# Пример специализации для MVP: ["8408", "8418"]
TARGET_GROUPS: list[str] = os.getenv("TARGET_GROUPS", "").split(",") if os.getenv("TARGET_GROUPS") else []

# 1) ловим формат с пробелами: XXXX XX XXX X  (4 + 2 + 3 + 1 = 10 цифр)
CODE_SPACED_RE = re.compile(r"\b(\d{4})\s+(\d{2})\s+(\d{3})\s+(\d)\b")

# 2) ловим слитный формат: 10 цифр подряд
CODE_SOLID_RE = re.compile(r"\b(\d{10})\b")

# В PDF обычно после кода стоит "– описание"
DASH_SPLIT_RE = re.compile(r"\s*[–-]\s*")  # длинное тире или дефис


def init_tnved_table(conn: sqlite3.Connection) -> None:
    """
    Создаём таблицу tnved, если её нет.
    Минимальные поля: code (10 цифр) + title.
    """
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS tnved (
            code TEXT PRIMARY KEY,
            title TEXT NOT NULL
        )
        """
    )
    conn.commit()


def upsert_codes(conn: sqlite3.Connection, codes: dict[str, str]) -> int:
    """
    Вставляем/обновляем записи {code: title}.
    """
    cur = conn.cursor()
    count = 0
    for code, title in codes.items():
        cur.execute(
            """
            INSERT INTO tnved(code, title)
            VALUES (?, ?)
            ON CONFLICT(code) DO UPDATE SET
              title = excluded.title
            """,
            (code, title),
        )
        count += 1
    conn.commit()
    return count


def _extract_title_from_line(line: str, end_pos: int) -> str:
    """
    Пытаемся взять описание из "хвоста" строки после кода.
    Поддерживает варианты:
    - " ... – описание"
    - " ... - описание"
    - " ... описание" (без тире)
    """
    after = line[end_pos:].strip()
    if not after:
        return "—"

    parts = DASH_SPLIT_RE.split(after, maxsplit=1)
    title = parts[1].strip() if len(parts) > 1 else after
    title = re.sub(r"\s{2,}", " ", title).strip()
    return title or "—"


def extract_codes_from_pdf(pdf_path: Path) -> dict[str, str]:
    """
    Возвращает словарь: { "8408101100": "..." , ... } только для 8408/8418.
    Стараемся ловить и формат с пробелами, и слитный.
    """
    result: dict[str, str] = {}

    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if not text.strip():
                continue

            for line in text.splitlines():
                # 1) формат с пробелами (группы)
                for m in CODE_SPACED_RE.finditer(line):
                    code10 = "".join(m.groups())  # (8408/8418)+(2)+(3)+(1) => 10 цифр
                    title = _extract_title_from_line(line, m.end())

                    # не затираем хорошее описание "—"
                    if code10 not in result or result[code10] == "—":
                        result[code10] = title

                # 2) слитный формат (8408xxxxxx / 8418xxxxxx)
                for m in CODE_SOLID_RE.finditer(line):
                    code10 = m.group(1)
                    title = _extract_title_from_line(line, m.end())

                    if code10 not in result or result[code10] == "—":
                        result[code10] = title

    # оставляем только валидные 10-значные коды; при необходимости фильтруем по группам
    cleaned = {
        c: t
        for c, t in result.items()
        if len(c) == 10 and c.isdigit()
        and (not TARGET_GROUPS or any(c.startswith(g.strip()) for g in TARGET_GROUPS if g.strip()))
    }
    return cleaned


def main() -> None:
    if not PDF_PATH.exists():
        raise FileNotFoundError(f"PDF не найден: {PDF_PATH}")

    conn = sqlite3.connect(str(DB_PATH))
    try:
        init_tnved_table(conn)

        codes = extract_codes_from_pdf(PDF_PATH)
        inserted = upsert_codes(conn, codes)

        print(f"PDF: {PDF_PATH}")
        print(f"БД:  {DB_PATH}")
        print(f"Фильтр групп: {TARGET_GROUPS if TARGET_GROUPS else 'все группы'}")
        print(f"Найдено кодов: {len(codes)}")
        print(f"Загружено в БД: {inserted}")

        # покажем несколько примеров
        for i, (c, t) in enumerate(sorted(codes.items())[:15], start=1):
            print(f"{i}. {c} — {t}")

        if not codes:
            print(
                "\nНе найдено ни одного кода. Частые причины:\n"
                "1) В PDF текст извлекается плохо (таблица/скан).\n"
                "2) Коды в другом формате (переносы строк).\n"
                "3) Нужен page.extract_text(layout=True) или extract_table.\n"
            )
    finally:
        conn.close()


if __name__ == "__main__":
    main()