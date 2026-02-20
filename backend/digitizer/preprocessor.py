"""
ECG image preprocessor.

Accepts PIL Image or PDF bytes. Outputs a normalized grayscale image with:
- Perspective correction
- Grid detection and characterization
- Calibration pulse location and measurement
- Paper speed and amplitude scale extraction
- Debug overlay image with colored annotations
"""

from __future__ import annotations

import io
import logging
import uuid
from typing import Optional

import cv2
import numpy as np
from PIL import Image

from models.schemas import GridCharacterization, PreprocessedImage

logger = logging.getLogger(__name__)

# Standard ECG paper: 1 large square = 5 small squares
# At 25 mm/s: 1 small square = 1mm = 0.04s, 1 large square = 5mm = 0.2s
# Standard amplitude: 10 mm/mV, so 1 small square = 0.1 mV

STANDARD_PAPER_SPEED = 25.0  # mm/s
STANDARD_AMPLITUDE_SCALE = 10.0  # mm/mV


def convert_pdf_to_image(pdf_bytes: bytes, dpi: int = 300) -> Image.Image:
    """Convert first page of PDF to PIL Image."""
    try:
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(pdf_bytes, dpi=dpi, first_page=1, last_page=1)
        if not images:
            raise ValueError("PDF conversion produced no images")
        return images[0]
    except ImportError:
        raise RuntimeError(
            "pdf2image is required for PDF processing. "
            "Install with: pip install pdf2image (requires poppler system dependency)"
        )


def pil_to_cv2(pil_image: Image.Image) -> np.ndarray:
    """Convert PIL Image to OpenCV BGR numpy array."""
    rgb = np.array(pil_image.convert("RGB"))
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def cv2_to_pil(cv2_image: np.ndarray) -> Image.Image:
    """Convert OpenCV BGR array to PIL Image."""
    if len(cv2_image.shape) == 2:
        return Image.fromarray(cv2_image, mode="L")
    rgb = cv2.cvtColor(cv2_image, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def apply_perspective_correction(image: np.ndarray) -> np.ndarray:
    """
    Detect the ECG paper region and apply perspective correction.

    Uses contour detection to find the largest rectangular region,
    then applies a perspective warp to produce a top-down view.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image.copy()
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)

    # Dilate edges to close gaps
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    dilated = cv2.dilate(edges, kernel, iterations=2)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        logger.warning("No contours found for perspective correction; returning original")
        return image

    # Find largest contour by area
    largest = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest)
    image_area = image.shape[0] * image.shape[1]

    # Only correct if we find a region covering >20% of image
    if area < 0.2 * image_area:
        logger.info("Largest contour too small for perspective correction; skipping")
        return image

    # Approximate to polygon
    peri = cv2.arcLength(largest, True)
    approx = cv2.approxPolyDP(largest, 0.02 * peri, True)

    if len(approx) == 4:
        pts = approx.reshape(4, 2).astype(np.float32)
        # Order points: top-left, top-right, bottom-right, bottom-left
        pts = _order_points(pts)

        width = max(
            np.linalg.norm(pts[0] - pts[1]),
            np.linalg.norm(pts[2] - pts[3]),
        )
        height = max(
            np.linalg.norm(pts[0] - pts[3]),
            np.linalg.norm(pts[1] - pts[2]),
        )

        dst = np.array([
            [0, 0],
            [width - 1, 0],
            [width - 1, height - 1],
            [0, height - 1],
        ], dtype=np.float32)

        matrix = cv2.getPerspectiveTransform(pts, dst)
        warped = cv2.warpPerspective(image, matrix, (int(width), int(height)))
        return warped

    logger.info("Could not find 4-corner polygon; skipping perspective correction")
    return image


def _order_points(pts: np.ndarray) -> np.ndarray:
    """Order 4 points as: top-left, top-right, bottom-right, bottom-left."""
    rect = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # top-left has smallest sum
    rect[2] = pts[np.argmax(s)]  # bottom-right has largest sum
    d = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(d)]  # top-right has smallest difference
    rect[3] = pts[np.argmax(d)]  # bottom-left has largest difference
    return rect


def detect_grid(gray: np.ndarray) -> GridCharacterization:
    """
    Detect ECG grid lines and characterize grid spacing.

    Uses FFT to find dominant spatial frequencies corresponding
    to the small and large grid squares.
    """
    h, w = gray.shape[:2]

    # Apply FFT to detect periodic grid pattern
    # Analyze horizontal lines (vertical frequency) and vertical lines (horizontal frequency)
    small_sq_px = _detect_grid_spacing_fft(gray, axis="horizontal")
    if small_sq_px is None:
        small_sq_px = _detect_grid_spacing_hough(gray)
    if small_sq_px is None:
        # Fallback: assume standard 1mm = ~4px at 96 DPI scanning
        small_sq_px = 4.0
        logger.warning("Grid detection failed; using fallback spacing of 4px")

    large_sq_px = small_sq_px * 5.0

    grid = GridCharacterization(
        small_square_px=small_sq_px,
        large_square_px=large_sq_px,
        paper_speed_mm_per_s=STANDARD_PAPER_SPEED,
        amplitude_scale_mm_per_mv=STANDARD_AMPLITUDE_SCALE,
        image_width_px=w,
        image_height_px=h,
    )

    return grid


def _detect_grid_spacing_fft(gray: np.ndarray, axis: str = "horizontal") -> Optional[float]:
    """Use FFT to find dominant spatial frequency of grid lines."""
    h, w = gray.shape[:2]

    # Take a central strip for analysis
    if axis == "horizontal":
        strip = gray[h // 3: 2 * h // 3, w // 2]  # vertical column in center
    else:
        strip = gray[h // 2, w // 3: 2 * w // 3]  # horizontal row in center

    strip = strip.astype(np.float64) - strip.mean()

    if len(strip) < 64:
        return None

    # Compute FFT
    fft = np.fft.rfft(strip)
    magnitude = np.abs(fft)

    # Ignore DC and very low frequencies
    magnitude[:3] = 0

    # Find peak frequency
    peak_idx = np.argmax(magnitude)
    if peak_idx == 0:
        return None

    # Convert frequency index to pixel spacing
    spacing = len(strip) / peak_idx

    # Sanity check: grid spacing should be between 2 and 30 pixels
    if 2.0 < spacing < 30.0:
        return spacing

    return None


def _detect_grid_spacing_hough(gray: np.ndarray) -> Optional[float]:
    """Use Hough line detection to find grid line spacing."""
    edges = cv2.Canny(gray, 30, 100)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100,
                            minLineLength=gray.shape[1] // 4, maxLineGap=10)

    if lines is None or len(lines) < 5:
        return None

    # Collect y-coordinates of approximately horizontal lines
    horizontal_ys = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = abs(np.arctan2(y2 - y1, x2 - x1))
        if angle < np.radians(5):  # Nearly horizontal
            horizontal_ys.append((y1 + y2) / 2.0)

    if len(horizontal_ys) < 3:
        return None

    horizontal_ys = sorted(horizontal_ys)
    diffs = np.diff(horizontal_ys)
    # Filter out very small diffs (duplicates) and very large ones
    diffs = diffs[(diffs > 2) & (diffs < 50)]

    if len(diffs) == 0:
        return None

    # The smallest common spacing is likely the small square
    median_spacing = float(np.median(diffs))
    return median_spacing


def detect_calibration_pulse(
    gray: np.ndarray,
    grid: GridCharacterization,
) -> tuple[bool, Optional[float]]:
    """
    Detect the 1mV calibration pulse typically at the start or end of the ECG strip.

    The calibration pulse is a rectangular deflection of known amplitude (typically 10mm = 1mV).
    """
    h, w = gray.shape[:2]

    # Search in leftmost 15% and rightmost 15% of image
    search_regions = [
        gray[:, :int(w * 0.15)],  # left
        gray[:, int(w * 0.85):],  # right
    ]

    for region in search_regions:
        if region.size == 0:
            continue

        # Threshold to find dark elements
        _, binary = cv2.threshold(region, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        # Look for rectangular shapes (calibration pulse)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for contour in contours:
            x, y, cw, ch = cv2.boundingRect(contour)
            aspect_ratio = cw / max(ch, 1)

            # Calibration pulse: narrow and tall (aspect ratio < 0.5, height ~10mm)
            expected_height = grid.amplitude_scale_mm_per_mv * grid.small_square_px
            if (
                0.05 < aspect_ratio < 0.5
                and abs(ch - expected_height) < expected_height * 0.3
            ):
                measured_mv = ch / grid.small_square_px / grid.amplitude_scale_mm_per_mv
                logger.info(f"Calibration pulse detected: {measured_mv:.2f} mV")
                return True, measured_mv

    return False, None


def create_debug_overlay(
    image: np.ndarray,
    grid: GridCharacterization,
    calibration_detected: bool,
    lead_regions: Optional[list[tuple[int, int, int, int]]] = None,
) -> np.ndarray:
    """
    Create a debug overlay image showing detected elements.

    Colors:
    - Green: detected grid lines
    - Blue: calibration pulse region
    - Red: lead region boundaries
    - Yellow: waveform traces
    """
    overlay = image.copy()
    if len(overlay.shape) == 2:
        overlay = cv2.cvtColor(overlay, cv2.COLOR_GRAY2BGR)

    h, w = overlay.shape[:2]

    # Draw detected grid lines (green, semi-transparent)
    if grid.small_square_px > 0:
        spacing = int(grid.small_square_px)
        if spacing > 1:
            for x in range(0, w, spacing):
                cv2.line(overlay, (x, 0), (x, h), (0, 180, 0), 1)
            for y in range(0, h, spacing):
                cv2.line(overlay, (0, y), (w, y), (0, 180, 0), 1)

        # Large squares (thicker green)
        large_spacing = int(grid.large_square_px)
        if large_spacing > 1:
            for x in range(0, w, large_spacing):
                cv2.line(overlay, (x, 0), (x, h), (0, 255, 0), 2)
            for y in range(0, h, large_spacing):
                cv2.line(overlay, (0, y), (w, y), (0, 255, 0), 2)

    # Draw calibration indicator
    if calibration_detected:
        cv2.putText(overlay, "CAL DETECTED", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 100, 0), 2)

    # Draw lead region boundaries (red)
    if lead_regions:
        for i, (x, y, rw, rh) in enumerate(lead_regions):
            cv2.rectangle(overlay, (x, y), (x + rw, y + rh), (0, 0, 255), 2)
            cv2.putText(overlay, f"Lead {i + 1}", (x + 5, y + 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)

    return overlay


def preprocess(
    source: Image.Image | bytes,
    session_id: Optional[str] = None,
    is_pdf: bool = False,
) -> tuple[np.ndarray, np.ndarray, GridCharacterization, PreprocessedImage, np.ndarray]:
    """
    Main preprocessing pipeline.

    Args:
        source: PIL Image or PDF bytes
        session_id: Optional session identifier
        is_pdf: Whether the source is PDF bytes

    Returns:
        Tuple of (normalized_gray, debug_overlay, grid, preprocessed_metadata, corrected_bgr)
    """
    if session_id is None:
        session_id = str(uuid.uuid4())

    warnings: list[str] = []

    # Step 1: Convert input to OpenCV image
    if is_pdf:
        if not isinstance(source, bytes):
            raise ValueError("PDF source must be bytes")
        try:
            pil_image = convert_pdf_to_image(source)
        except Exception as e:
            raise ValueError(f"PDF conversion failed: {e}")
        image = pil_to_cv2(pil_image)
    else:
        if isinstance(source, bytes):
            pil_image = Image.open(io.BytesIO(source))
        elif isinstance(source, Image.Image):
            pil_image = source
        else:
            raise ValueError(f"Unsupported source type: {type(source)}")
        image = pil_to_cv2(pil_image)

    logger.info(f"Input image size: {image.shape[1]}x{image.shape[0]}")

    # Step 2: Perspective correction
    corrected = apply_perspective_correction(image)
    if corrected.shape != image.shape:
        logger.info("Perspective correction applied")
    else:
        warnings.append("Perspective correction was not applied (no rectangular region detected)")

    # Step 3: Convert to grayscale
    if len(corrected.shape) == 3:
        gray = cv2.cvtColor(corrected, cv2.COLOR_BGR2GRAY)
    else:
        gray = corrected.copy()

    # Step 4: Normalize intensity
    gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)

    # Step 5: Detect and characterize grid
    grid = detect_grid(gray)
    logger.info(
        f"Grid detected: small={grid.small_square_px:.1f}px, "
        f"large={grid.large_square_px:.1f}px"
    )

    # Step 6: Detect calibration pulse
    cal_detected, cal_mv = detect_calibration_pulse(gray, grid)
    grid.calibration_pulse_detected = cal_detected
    if cal_detected and cal_mv is not None:
        grid.calibration_pulse_mv = cal_mv
        # Adjust amplitude scale if calibration differs from expected
        if abs(cal_mv - 1.0) > 0.15:
            warnings.append(
                f"Calibration pulse measures {cal_mv:.2f} mV "
                f"(expected 1.0 mV); amplitude scale may be non-standard"
            )
    else:
        warnings.append("Calibration pulse not detected; using default 10mm/mV")

    # Step 7: Create debug overlay
    debug_overlay = create_debug_overlay(corrected, grid, cal_detected)

    # Build metadata output
    preprocessed = PreprocessedImage(
        session_id=session_id,
        grid=grid,
        warnings=warnings,
    )

    return gray, debug_overlay, grid, preprocessed, corrected
