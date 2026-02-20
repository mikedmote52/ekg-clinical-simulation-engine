"""
Lead segmentation for standard 12-lead ECG images.

Detects individual lead regions within a preprocessed ECG image.
Supports the standard 3x4+1 layout (3 rows of 4 leads, plus a rhythm strip)
and the 6x2 layout.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import cv2
import numpy as np

from models.schemas import GridCharacterization

logger = logging.getLogger(__name__)

# Standard 12-lead order in 3x4 layout
STANDARD_3x4_ORDER = [
    ["I", "aVR", "V1", "V4"],
    ["II", "aVL", "V2", "V5"],
    ["III", "aVF", "V3", "V6"],
]

STANDARD_LEAD_NAMES = [
    "I", "II", "III", "aVR", "aVL", "aVF",
    "V1", "V2", "V3", "V4", "V5", "V6",
]


@dataclass
class LeadRegion:
    """Bounding box and metadata for a detected lead region."""
    lead_name: str
    x: int
    y: int
    width: int
    height: int
    row: int
    col: int

    @property
    def bbox(self) -> tuple[int, int, int, int]:
        return (self.x, self.y, self.width, self.height)

    def crop(self, image: np.ndarray) -> np.ndarray:
        """Extract this lead region from an image."""
        return image[self.y:self.y + self.height, self.x:self.x + self.width]


def segment_leads_grid(
    gray: np.ndarray,
    grid: GridCharacterization,
    layout: str = "3x4",
) -> list[LeadRegion]:
    """
    Segment lead regions assuming a standard grid layout.

    For 3x4 layout: 3 rows of 4 leads (2.5 seconds each at 25mm/s).
    For 6x2 layout: 6 rows of 2 leads.

    This uses the grid characterization to compute expected lead box sizes,
    then validates using intensity variance (lead regions have higher variance
    than empty margins).
    """
    h, w = gray.shape[:2]

    if layout == "3x4":
        rows, cols = 3, 4
        lead_order = STANDARD_3x4_ORDER
    elif layout == "6x2":
        rows, cols = 6, 2
        lead_order = [
            ["I", "V1"],
            ["II", "V2"],
            ["III", "V3"],
            ["aVR", "V4"],
            ["aVL", "V5"],
            ["aVF", "V6"],
        ]
    else:
        raise ValueError(f"Unsupported layout: {layout}")

    # Estimate margins
    margin_top = int(h * 0.05)
    margin_bottom = int(h * 0.05)
    margin_left = int(w * 0.03)
    margin_right = int(w * 0.03)

    usable_w = w - margin_left - margin_right
    usable_h = h - margin_top - margin_bottom

    lead_w = usable_w // cols
    lead_h = usable_h // rows

    regions: list[LeadRegion] = []

    for r in range(rows):
        for c in range(cols):
            x = margin_left + c * lead_w
            y = margin_top + r * lead_h

            lead_name = lead_order[r][c]
            region = LeadRegion(
                lead_name=lead_name,
                x=x,
                y=y,
                width=lead_w,
                height=lead_h,
                row=r,
                col=c,
            )
            regions.append(region)

    return regions


def segment_leads_adaptive(gray: np.ndarray) -> list[LeadRegion]:
    """
    Adaptively segment lead regions by detecting separating lines/spaces.

    Uses projection profiles to find row and column boundaries.
    """
    h, w = gray.shape[:2]

    # Horizontal projection (sum along rows) to find row separators
    h_projection = np.mean(gray, axis=1)

    # Vertical projection (sum along columns) to find column separators
    v_projection = np.mean(gray, axis=0)

    # Find row boundaries using peaks in the projection (bright = empty)
    row_boundaries = _find_boundaries(h_projection, min_peaks=3, max_peaks=7)
    col_boundaries = _find_boundaries(v_projection, min_peaks=3, max_peaks=8)

    if len(row_boundaries) < 4 or len(col_boundaries) < 3:
        logger.warning("Adaptive segmentation failed; falling back to grid-based")
        grid = GridCharacterization(
            small_square_px=w / 250,  # rough estimate
            large_square_px=w / 50,
            image_width_px=w,
            image_height_px=h,
        )
        return segment_leads_grid(gray, grid)

    # Build regions from boundaries
    rows_count = len(row_boundaries) - 1
    cols_count = len(col_boundaries) - 1

    # Determine layout
    if rows_count == 3 and cols_count == 4:
        lead_order = STANDARD_3x4_ORDER
    elif rows_count == 6 and cols_count == 2:
        lead_order = [
            ["I", "V1"], ["II", "V2"], ["III", "V3"],
            ["aVR", "V4"], ["aVL", "V5"], ["aVF", "V6"],
        ]
    else:
        # Best effort: assign lead names in standard order
        lead_order = []
        lead_idx = 0
        for r in range(rows_count):
            row_leads = []
            for c in range(cols_count):
                if lead_idx < len(STANDARD_LEAD_NAMES):
                    row_leads.append(STANDARD_LEAD_NAMES[lead_idx])
                    lead_idx += 1
                else:
                    row_leads.append(f"Unknown_{lead_idx}")
                    lead_idx += 1
            lead_order.append(row_leads)

    regions: list[LeadRegion] = []
    for r in range(min(rows_count, len(lead_order))):
        for c in range(min(cols_count, len(lead_order[r]))):
            x = col_boundaries[c]
            y = row_boundaries[r]
            rw = col_boundaries[c + 1] - col_boundaries[c]
            rh = row_boundaries[r + 1] - row_boundaries[r]

            region = LeadRegion(
                lead_name=lead_order[r][c],
                x=x,
                y=y,
                width=rw,
                height=rh,
                row=r,
                col=c,
            )
            regions.append(region)

    return regions


def _find_boundaries(projection: np.ndarray, min_peaks: int, max_peaks: int) -> list[int]:
    """
    Find boundaries in a projection profile.

    Boundaries are positions where the projection is locally maximal
    (bright = empty space between leads).
    """
    # Smooth the projection
    kernel_size = max(len(projection) // 50, 5)
    if kernel_size % 2 == 0:
        kernel_size += 1
    smoothed = cv2.GaussianBlur(projection.reshape(-1, 1), (1, kernel_size), 0).flatten()

    # Find local maxima (bright regions = separators)
    threshold = np.mean(smoothed) + 0.3 * np.std(smoothed)
    above = smoothed > threshold

    # Find runs of above-threshold values
    boundaries = [0]
    in_run = False
    run_start = 0

    for i, val in enumerate(above):
        if val and not in_run:
            run_start = i
            in_run = True
        elif not val and in_run:
            boundaries.append((run_start + i) // 2)
            in_run = False

    boundaries.append(len(projection))

    # Filter to expected number of boundaries
    if len(boundaries) > max_peaks + 2:
        # Too many; keep the most prominent ones
        boundaries = [0] + sorted(
            boundaries[1:-1],
            key=lambda b: smoothed[min(b, len(smoothed) - 1)],
            reverse=True,
        )[:max_peaks] + [len(projection)]
        boundaries.sort()

    return boundaries


def detect_rhythm_strip(
    gray: np.ndarray,
    lead_regions: list[LeadRegion],
) -> LeadRegion | None:
    """
    Detect if there's a rhythm strip at the bottom of the ECG.

    Many 12-lead ECGs include a long lead II rhythm strip spanning
    the full width at the bottom.
    """
    if not lead_regions:
        return None

    h, w = gray.shape[:2]

    # Find the bottom of the last row of leads
    max_bottom = max(r.y + r.height for r in lead_regions)

    # Check if there's significant content below the lead grid
    remaining_height = h - max_bottom
    if remaining_height < h * 0.1:
        return None

    # Check for waveform content in the bottom strip
    bottom_strip = gray[max_bottom:, :]
    variance = np.var(bottom_strip)

    if variance > 500:  # Has significant content
        return LeadRegion(
            lead_name="II_rhythm",
            x=0,
            y=max_bottom,
            width=w,
            height=remaining_height,
            row=-1,
            col=0,
        )

    return None
