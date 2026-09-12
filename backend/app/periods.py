"""Period keys used across the API and the importer.

FY2024-25  financial year, 1 Apr 2024 to 31 Mar 2025
CY2025     calendar year
2025-04    one month
"""

import calendar
import re
from dataclasses import dataclass
from datetime import date

from app.domain import Frequency

_FY = re.compile(r"^FY(\d{4})-(\d{2})$")
_CY = re.compile(r"^CY(\d{4})$")
_MONTH = re.compile(r"^(\d{4})-(\d{2})$")


@dataclass(frozen=True)
class PeriodSpec:
    key: str
    frequency: Frequency
    label: str
    start_date: date
    end_date: date  # inclusive

    @property
    def days(self) -> int:
        return (self.end_date - self.start_date).days + 1


def parse_period(key: str) -> PeriodSpec:
    """Turn a period key into its dates, or raise ValueError."""
    if match := _FY.match(key):
        start_year, end_suffix = int(match[1]), int(match[2])
        if (start_year + 1) % 100 != end_suffix:
            raise ValueError(f"{key!r}: a financial year must span consecutive years")
        return PeriodSpec(
            key,
            "FY",
            f"FY {start_year}-{end_suffix:02d}",
            date(start_year, 4, 1),
            date(start_year + 1, 3, 31),
        )
    if match := _CY.match(key):
        year = int(match[1])
        return PeriodSpec(key, "CY", f"CY {year}", date(year, 1, 1), date(year, 12, 31))
    if match := _MONTH.match(key):
        year, month = int(match[1]), int(match[2])
        if not 1 <= month <= 12:
            raise ValueError(f"{key!r}: month must be 01-12")
        last_day = calendar.monthrange(year, month)[1]
        return PeriodSpec(
            key,
            "MONTH",
            date(year, month, 1).strftime("%b %Y"),
            date(year, month, 1),
            date(year, month, last_day),
        )
    raise ValueError(f"{key!r} is not a period key (expected FY2024-25, CY2025 or 2025-04)")
