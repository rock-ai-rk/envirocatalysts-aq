"""Historical data imported from the EnviroCatalysts files (see app/importer).

City-level numbers are stored per period, already aggregated (AQI category days, mean
concentrations, dominant-pollutant days), because that is how the source dashboard's files are
organised and all the Overview needs. Station data is stored hourly, because the Hourly screen
derives everything (hour-of-day pattern, peaks, exceedances) from individual hours.
"""

from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, UTCDateTime, check_in, utcnow
from app.domain import CITY_GROUPS, DATASET_SCOPES, POLLUTANTS


class Dataset(Base):
    """Where the historical data came from. For each scope, the newest row covering it describes
    what the API is serving (see DATASET_SCOPES)."""

    __tablename__ = "datasets"
    __table_args__ = (CheckConstraint(check_in("scope", DATASET_SCOPES), name="scope"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    source: Mapped[str] = mapped_column(Text)
    # Synthetic data exists only to build and test the app before the real files arrive;
    # the app shows a banner on every screen it is being served on.
    synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    scope: Mapped[str] = mapped_column(String(10), default="all")
    imported_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class City(Base):
    __tablename__ = "cities"
    __table_args__ = (UniqueConstraint("name", "state"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    state: Mapped[str] = mapped_column(String(120))
    latitude: Mapped[float | None]
    longitude: Mapped[float | None]

    groups: Mapped[list["CityGroupMember"]] = relationship(
        back_populates="city", cascade="all, delete-orphan", lazy="selectin"
    )
    stations: Mapped[list["Station"]] = relationship(back_populates="city")

    @property
    def group_codes(self) -> list[str]:
        return sorted(member.code for member in self.groups)


class CityGroupMember(Base):
    """A city's membership of a group such as NCAP or Delhi NCR (a city can be in several)."""

    __tablename__ = "city_groups"
    __table_args__ = (CheckConstraint(check_in("code", CITY_GROUPS), name="code"),)

    city_id: Mapped[int] = mapped_column(
        ForeignKey("cities.id", ondelete="CASCADE"), primary_key=True
    )
    code: Mapped[str] = mapped_column(String(20), primary_key=True)

    city: Mapped[City] = relationship(back_populates="groups")


class Period(Base):
    __tablename__ = "periods"
    __table_args__ = (
        CheckConstraint(check_in("frequency", ("FY", "CY", "MONTH")), name="frequency"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(20), unique=True)
    frequency: Mapped[str] = mapped_column(String(5))
    label: Mapped[str] = mapped_column(String(40))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)

    @property
    def days(self) -> int:
        return (self.end_date - self.start_date).days + 1


class CityAqiDays(Base):
    """How many days a city spent in each AQI category during a period."""

    __tablename__ = "city_aqi_days"

    city_id: Mapped[int] = mapped_column(
        ForeignKey("cities.id", ondelete="CASCADE"), primary_key=True
    )
    period_id: Mapped[int] = mapped_column(
        ForeignKey("periods.id", ondelete="CASCADE"), primary_key=True
    )
    good: Mapped[int] = mapped_column(default=0)
    satisfactory: Mapped[int] = mapped_column(default=0)
    moderate: Mapped[int] = mapped_column(default=0)
    poor: Mapped[int] = mapped_column(default=0)
    very_poor: Mapped[int] = mapped_column(default=0)
    severe: Mapped[int] = mapped_column(default=0)
    # Days with a valid AQI; coverage is this divided by the days in the period.
    days_with_data: Mapped[int] = mapped_column(default=0)


class CityPollutantMean(Base):
    __tablename__ = "city_pollutant_means"
    __table_args__ = (CheckConstraint(check_in("pollutant", POLLUTANTS), name="pollutant"),)

    city_id: Mapped[int] = mapped_column(
        ForeignKey("cities.id", ondelete="CASCADE"), primary_key=True
    )
    period_id: Mapped[int] = mapped_column(
        ForeignKey("periods.id", ondelete="CASCADE"), primary_key=True
    )
    pollutant: Mapped[str] = mapped_column(String(8), primary_key=True)
    mean: Mapped[float]
    days_with_data: Mapped[int] = mapped_column(default=0)


class CityDominantDays(Base):
    """How many days each pollutant was the one driving a city's AQI."""

    __tablename__ = "city_dominant_days"
    __table_args__ = (CheckConstraint(check_in("pollutant", POLLUTANTS), name="pollutant"),)

    city_id: Mapped[int] = mapped_column(
        ForeignKey("cities.id", ondelete="CASCADE"), primary_key=True
    )
    period_id: Mapped[int] = mapped_column(
        ForeignKey("periods.id", ondelete="CASCADE"), primary_key=True
    )
    pollutant: Mapped[str] = mapped_column(String(8), primary_key=True)
    days: Mapped[int] = mapped_column(default=0)


class Station(Base):
    """A continuous monitoring station (CAAQMS) with hourly history."""

    __tablename__ = "stations"
    __table_args__ = (UniqueConstraint("city_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str | None] = mapped_column(String(50))
    latitude: Mapped[float | None]
    longitude: Mapped[float | None]

    city: Mapped[City] = relationship(back_populates="stations")


class StationHourly(Base):
    """One hour at one station. `observed_at` is the END of the hour, as CPCB labels it."""

    __tablename__ = "station_hourly"

    station_id: Mapped[int] = mapped_column(
        ForeignKey("stations.id", ondelete="CASCADE"), primary_key=True
    )
    observed_at: Mapped[datetime] = mapped_column(UTCDateTime, primary_key=True)
    pm25: Mapped[float | None]
    pm10: Mapped[float | None]
    no2: Mapped[float | None]
    so2: Mapped[float | None]
    co: Mapped[float | None]
    o3: Mapped[float | None]
