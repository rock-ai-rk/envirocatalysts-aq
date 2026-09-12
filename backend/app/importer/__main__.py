"""Command line for the importer.

python -m app.importer load <dir> [--replace]   load a canonical dataset directory
python -m app.importer demo <dir>               write the synthetic demo dataset
"""

import argparse
import sys
from pathlib import Path

from app.db import SessionLocal
from app.importer.canonical import InvalidDataset, load_directory
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
    args = parser.parse_args()

    if args.command == "demo":
        write_demo_dataset(args.directory)
        print(f"Wrote synthetic demo dataset to {args.directory}")
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
