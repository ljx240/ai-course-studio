"""Local syllabus import for DOCX and text-layer PDF."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
import re
import subprocess
from zipfile import BadZipFile, ZipFile
import xml.etree.ElementTree as ET


WORD = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
MAX_XML = 8_000_000


def _xml(archive: ZipFile, name: str) -> ET.Element:
    info = archive.getinfo(name)
    if info.file_size > MAX_XML:
        raise ValueError("Word 文件的正文或样式超过大小限制")
    return ET.fromstring(archive.read(info))


def docx_outline(content: bytes) -> str:
    try:
        with ZipFile(BytesIO(content)) as archive:
            root = _xml(archive, "word/document.xml")
            styles = _xml(archive, "word/styles.xml") if "word/styles.xml" in archive.namelist() else None
    except (BadZipFile, ET.ParseError, KeyError) as error:
        raise ValueError("无法读取 DOCX 正文") from error

    levels: dict[str, int] = {}
    if styles is not None:
        for style in styles.findall(f"{WORD}style"):
            outline = style.find(f"{WORD}pPr/{WORD}outlineLvl")
            if outline is not None:
                value = outline.get(f"{WORD}val", "")
                if value.isdigit() and int(value) < 6:
                    levels[style.get(f"{WORD}styleId", "")] = int(value) + 1

    headings, paragraphs = [], []
    for paragraph in root.iter(f"{WORD}p"):
        title = "".join(node.text or "" for node in paragraph.iter(f"{WORD}t")).strip()
        if not title:
            continue
        paragraphs.append(title)
        outline = paragraph.find(f"{WORD}pPr/{WORD}outlineLvl")
        value = outline.get(f"{WORD}val", "") if outline is not None else ""
        if value.isdigit() and int(value) < 6:
            headings.append("#" * (int(value) + 1) + " " + title)
            continue
        style = paragraph.find(f"{WORD}pPr/{WORD}pStyle")
        if style is not None:
            style_id = style.get(f"{WORD}val", "")
            match = re.fullmatch(r"heading([1-6])", style_id, re.I)
            level = levels.get(style_id) or (int(match[1]) if match else 0)
            if level:
                headings.append("#" * level + " " + title)
    return "\n".join(headings or paragraphs)


def numbered_outline(text: str) -> str:
    lines = []
    for raw in text.splitlines():
        title = raw.strip()
        if not title or title.isdigit():
            continue
        if re.match(r"^第[一二三四五六七八九十百零\d]+[章单]", title):
            lines.append("# " + title)
            continue
        number = re.match(r"^(\d+(?:\.\d+)*)(?:\s|[、.)])", title)
        level = min(6, number[1].count(".") + 1) if number else 1
        lines.append("#" * level + " " + title)
    return "\n".join(lines)


def extract_outline(filename: str, content: bytes) -> str:
    extension = Path(filename).suffix.lower()
    if extension == ".docx":
        text = docx_outline(content)
    elif extension == ".pdf":
        try:
            result = subprocess.run(
                ["pdftotext", "-enc", "UTF-8", "-", "-"], input=content, capture_output=True,
                check=True, timeout=20,
            )
        except FileNotFoundError as error:
            raise ValueError("PDF 导入需要本机的 Poppler pdftotext") from error
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
            raise ValueError("无法读取 PDF 文字") from error
        text = numbered_outline(result.stdout.decode("utf-8"))
    elif extension in {".md", ".txt"}:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeError as error:
            raise ValueError("请使用 UTF-8 编码的文本文件") from error
    else:
        raise ValueError("支持 Markdown、TXT、DOCX 与带文字层的 PDF")
    if not text.strip():
        raise ValueError("文件没有可导入的文字")
    if len(text) > 100_000:
        raise ValueError("大纲文字超过 100,000 字")
    return text
