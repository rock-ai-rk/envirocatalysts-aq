"""Loads historical data into the database.

Every source is first put into one "canonical" CSV layout (see canonical.py). The loader only
knows that layout, so supporting the EnviroCatalysts files means writing a converter from their
layout to it, without touching the database code.

    python -m app.importer load <dir> [--replace]
    python -m app.importer demo <dir>        # synthetic data for developing the app
"""
