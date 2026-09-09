"""Step 01 — download the configured World Bank workbook."""

from __future__ import annotations

import urllib.request
from pathlib import Path


def download_source(url: str, destination: Path) -> Path:
    """Download the source workbook to a reproducible local cache path."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "Corridor-Scout/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        content = response.read()
    if not content.startswith(b"PK"):
        raise ValueError("Downloaded source is not a valid XLSX workbook")
    temporary = destination.with_suffix(f"{destination.suffix}.tmp")
    temporary.write_bytes(content)
    temporary.replace(destination)
    return destination
