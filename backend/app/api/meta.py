from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.overview import MIN_COVERAGE, PM25_FLOOR
from app.db import get_session
from app.domain import CITY_GROUP_INFO
from app.models import City, Dataset, Period
from app.schemas.history import CoverageRules, DatasetOut, GroupOut, MetaOut, PeriodOut

router = APIRouter(prefix="/v1", tags=["meta"])

# The assignment brief fixes these as the default comparison on both screens.
PREFERRED_BASE = "FY2024-25"
PREFERRED_COMPARISON = "FY2025-26"


@router.get("/meta", response_model=MetaOut)
def meta(session: Session = Depends(get_session)) -> MetaOut:
    """Periods, states and groups to build the pickers, and where the data came from."""
    dataset = session.scalars(select(Dataset).order_by(Dataset.id.desc()).limit(1)).first()
    periods = list(session.scalars(select(Period).order_by(Period.frequency, Period.start_date)))
    keys = [p.key for p in periods]
    financial_years = [p.key for p in periods if p.frequency == "FY"]

    return MetaOut(
        dataset=DatasetOut.model_validate(dataset) if dataset else None,
        periods=[PeriodOut.model_validate(p) for p in periods],
        default_base=PREFERRED_BASE if PREFERRED_BASE in keys else _nth_last(financial_years, 2),
        default_comparison=(
            PREFERRED_COMPARISON if PREFERRED_COMPARISON in keys else _nth_last(financial_years, 1)
        ),
        states=list(session.scalars(select(City.state).distinct().order_by(City.state))),
        groups=[
            GroupOut(code=code, label=label, description=description)
            for code, (label, description) in CITY_GROUP_INFO.items()
        ],
        rules=CoverageRules(min_coverage=MIN_COVERAGE, pm25_floor=PM25_FLOOR),
    )


def _nth_last(items: list[str], n: int) -> str | None:
    return items[-n] if len(items) >= n else None
