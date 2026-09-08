"""Step 01 — download the configured World Bank workbook."""

from __future__ import annotations

import urllib.request
from pathlib import Path


def download_source(url: str, destination: Path) -> Path:
    """Download the source workbook to a reproducible local cache path."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "Corridor-Scout/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        destination.write_bytes(response.read())
    return destination
