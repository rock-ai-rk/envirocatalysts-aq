"""Run one scrape from the command line: `python -m app.scraper [--force]` (for cron or a demo)."""

import argparse
import json
import logging
import sys

from app.config import get_settings
from app.schemas import ScrapeRunOut
from app.scraper.scheduler import scrape_once


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m app.scraper")
    parser.add_argument(
        "--force", action="store_true", help="fetch everything even if the feed hasn't changed"
    )
    args = parser.parse_args()
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    if not get_settings().datagov_api_key:
        print("DATAGOV_API_KEY is not set (see backend/.env.example)", file=sys.stderr)
        return 2

    run = scrape_once(force=args.force)
    if run is None:
        print("Another scrape is already running", file=sys.stderr)
        return 1
    print(json.dumps(ScrapeRunOut.model_validate(run).model_dump(mode="json"), indent=2))
    return 0 if run.status == "success" else 1


if __name__ == "__main__":
    sys.exit(main())
