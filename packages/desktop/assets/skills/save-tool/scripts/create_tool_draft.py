from __future__ import annotations

import argparse
import re
from datetime import datetime, timezone
from pathlib import Path


SECTION_IDS = {"servers", "cad", "revit", "workflow", "excel", "tekla"}


def safe_filename(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", name).strip().strip(".")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned or "untitled-tool"


def yaml_quote(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a local AI Program Markdown tool draft.")
    parser.add_argument("--name", required=True, help="Tool name")
    parser.add_argument("--description", default="", help="Short tool description")
    parser.add_argument("--author", default="Unknown", help="Tool author")
    parser.add_argument("--version", default="1.0.0", help="Tool version")
    parser.add_argument("--section-id", default="servers", help="AI Program section id")
    parser.add_argument("--body-file", required=True, help="Markdown body file to include")
    parser.add_argument("--output-dir", default="tool-drafts", help="Directory for generated draft")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite an existing draft")
    args = parser.parse_args()

    section_id = args.section_id if args.section_id in SECTION_IDS else "servers"
    body_path = Path(args.body_file)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    target_path = output_dir / f"{safe_filename(args.name)}.md"
    if target_path.exists() and not args.overwrite:
        raise SystemExit(f"Refusing to overwrite existing file: {target_path}")

    body = body_path.read_text(encoding="utf-8").strip()
    created_at = datetime.now(timezone.utc).isoformat()
    frontmatter = "\n".join(
        [
            "---",
            f"toolName: {yaml_quote(args.name)}",
            f"version: {yaml_quote(args.version)}",
            f"author: {yaml_quote(args.author)}",
            f"description: {yaml_quote(args.description)}",
            f"sectionId: {yaml_quote(section_id)}",
            f"createdAt: {yaml_quote(created_at)}",
            'source: "codex-save-tool"',
            "---",
            "",
        ]
    )

    target_path.write_text(f"{frontmatter}{body}\n", encoding="utf-8")
    print(target_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
