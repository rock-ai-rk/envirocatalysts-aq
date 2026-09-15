"""Command line for the importer.

python -m app.importer load <dir> [--replace]             load a canonical dataset directory
python -m app.importer demo <dir> [--hourly-only]         write the synthetic demo dataset
python -m app.importer convert-dashboard <export> <dir>   dashboard CSV downloads -> a dataset
"""

import argparse
import sys
from pathlib import Path

from app.db import SessionLocal
from app.importer.canonical import InvalidDataset, load_directory
from app.importer.dashboard_export import ConversionError, convert_dashboard_export
from app.importer.demo import write_demo_dataset


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m app.importer")
    commands = parser.add_subparsers(dest="command", required=True)
    load = commands.add_parser("load", help="load a canonical dataset directory")
    load.add_argument("directory", type=Path)
    load.add_argument(
        "--replace", action="store_true", help="delete existing historical data first"
    )
    demo = commands.add_parser("demo", help="write the synthetic demo dataset")
    demo.add_argument("directory", type=Path)
    demo.add_argument(
        "--hourly-only",
        action="store_true",
        help="only the demo stations and hours, to load on top of real city data",
    )
    convert = commands.add_parser(
        "convert-dashboard", help="convert the dashboard's CSV downloads into a canonical dataset"
    )
    convert.add_argument("export", type=Path, help="directory written by the export script")
    convert.add_argument("directory", type=Path, help="where to write the canonical dataset")
    convert.add_argument("--exported-on", required=True, help="date of the export, YYYY-MM-DD")
    args = parser.parse_args()

    if args.command == "demo":
        write_demo_dataset(args.directory, hourly_only=args.hourly_only)
        print(f"Wrote synthetic demo dataset to {args.directory}")
        replace = "" if args.hourly_only else " --replace"
        print(f"Load it with: python -m app.importer load {args.directory}{replace}")
        return 0

    if args.command == "convert-dashboard":
        try:
            summary = convert_dashboard_export(args.export, args.directory, args.exported_on)
        except ConversionError as exc:
            print(f"Conversion failed: {exc}", file=sys.stderr)
            return 1
        for line in summary:
            print(line)
        print(f"Load it with: python -m app.importer load {args.directory} --replace")
        return 0

    try:
        with SessionLocal() as session:
            report = load_directory(session, args.directory, replace=args.replace)
    except InvalidDataset as exc:
        print(f"Import failed, nothing was changed: {exc}", file=sys.stderr)
        return 1
    for table, rows in report.counts.items():
        print(f"{table:24} {rows:>9,} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
