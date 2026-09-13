import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, cities, health, hourly, live, meta, overview, stations
from app.config import get_settings
from app.scraper.scheduler import start_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = start_scheduler(get_settings())
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="EnviroCatalysts Air Quality API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    for router in (
        health.router,
        meta.router,
        overview.router,
        cities.router,
        hourly.router,
        stations.router,
        live.router,
        admin.router,
    ):
        app.include_router(router)
    return app


app = create_app()
