"""Run one scrape from the command line: `python -m app.scraper` (for cron or a demo)."""

import argparse
import json
import logging
import sys

from app.schemas import ScrapeRunOut
from app.scraper.scheduler import scrape_once


def main() -> int:
    argparse.ArgumentParser(
        prog="python -m app.scraper",
        description="Read the CAMS model at every city with coordinates and store new hours.",
    ).parse_args()
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )

    run = scrape_once()
    if run is None:
        print("Another scrape is already running", file=sys.stderr)
        return 1
    print(json.dumps(ScrapeRunOut.model_validate(run).model_dump(mode="json"), indent=2))
    return 0 if run.status == "success" else 1


if __name__ == "__main__":
    sys.exit(main())
