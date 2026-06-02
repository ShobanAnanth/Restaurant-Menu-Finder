"""
Subprocess entry point for the Playwright-based scraper.

Runs in a child process so the parent can hard-kill it (and its Chromium
grandchildren) on timeout. Lives in its own module so the child process —
which under "spawn" re-imports the target's module — doesn't have to
re-import the heavier route/database layer.
"""

from __future__ import annotations

from multiprocessing.connection import Connection


def run_scrape(conn: Connection, url: str) -> None:
    try:
        from services.scraper_service import scrape_menu
        result = scrape_menu(url)
        conn.send(("ok", result))
    except BaseException as exc:  # noqa: BLE001 — must report anything to parent
        conn.send(("err", f"{type(exc).__name__}: {exc}"))
    finally:
        try:
            conn.close()
        except Exception:
            pass
