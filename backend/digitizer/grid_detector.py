"""
Grid detection utilities.

Provides standalone functions for detecting and removing ECG paper grid lines.
Used by both the preprocessor and the waveform extractor.

Includes color-aware removal for standard colored ECG grids (red, green, blue).
"""

from __future__ import annotations

import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def remove_grid_color_aware(bgr_image: np.ndarray, grid_spacing_px: float) -> np.ndarray:
    """
    Remove colored grid lines by isolating the grid color channel and subtracting it.

    Most ECG paper uses a red or light-red (pink) grid. The waveform is typically
    black ink. By working in the appropriate color channel, we can separate grid
    from signal much more cleanly than morphological/frequency methods.

    Returns a grayscale image with the grid removed but waveform preserved.
    """
    if len(bgr_image.shape) != 3:
        # Already grayscale, can't do color-aware removal
        return bgr_image

    hsv = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)

    # Detect grid color
    grid_color = detect_grid_color(bgr_image)
    logger.info(f"Detected grid color: {grid_color}")

    if grid_color == "black":
        # Can't do color separation on black grid — fall back
        return gray

    # Build a mask of grid-colored pixels
    if grid_color == "red":
        # Red in HSV wraps around 0/180
        mask1 = cv2.inRange(hsv, np.array([0, 25, 80]), np.array([15, 255, 255]))
        mask2 = cv2.inRange(hsv, np.array([165, 25, 80]), np.array([180, 255, 255]))
        grid_mask = cv2.bitwise_or(mask1, mask2)
    elif grid_color == "green":
        grid_mask = cv2.inRange(hsv, np.array([35, 25, 80]), np.array([85, 255, 255]))
    elif grid_color == "blue":
        grid_mask = cv2.inRange(hsv, np.array([90, 25, 80]), np.array([130, 255, 255]))
    else:
        return gray

    # Dilate the mask slightly to cover edges
    dilate_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    grid_mask = cv2.dilate(grid_mask, dilate_kernel, iterations=1)

    # Replace grid pixels with white (255) in the grayscale image
    result = gray.copy()
    result[grid_mask > 0] = 255

    # Light smoothing to blend edges
    result = cv2.medianBlur(result, 3)

    return result


def remove_grid_morphological(gray: np.ndarray, grid_spacing_px: float) -> np.ndarray:
    """
    Remove grid lines using morphological operations.

    Strategy:
    1. Build horizontal and vertical structural elements sized to grid spacing
    2. Extract horizontal and vertical lines via morphological opening
    3. Subtract extracted grid from original image
    """
    if gray.dtype != np.uint8:
        gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

    # Invert so grid lines are white (high intensity)
    inverted = cv2.bitwise_not(gray)

    # Horizontal grid removal — use a smaller kernel to avoid grabbing waveform
    h_kernel_size = max(int(grid_spacing_px * 1.5), 12)
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (h_kernel_size, 1))
    horizontal_lines = cv2.morphologyEx(inverted, cv2.MORPH_OPEN, h_kernel)

    # Vertical grid removal
    v_kernel_size = max(int(grid_spacing_px * 1.5), 12)
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, v_kernel_size))
    vertical_lines = cv2.morphologyEx(inverted, cv2.MORPH_OPEN, v_kernel)

    # Combine detected grid
    grid_mask = cv2.add(horizontal_lines, vertical_lines)

    # NO dilation — the original code dilated with a 3x3 kernel which was too aggressive
    # and ate into the waveform signal

    # Subtract grid from inverted image
    cleaned = cv2.subtract(inverted, grid_mask)

    # Re-invert so waveform is dark on light background
    result = cv2.bitwise_not(cleaned)

    return result


def remove_grid_frequency(gray: np.ndarray, grid_spacing_px: float) -> np.ndarray:
    """
    Remove grid lines using frequency-domain filtering.

    Grid lines appear as sharp peaks in the FFT at frequencies
    corresponding to the grid spacing. We notch-filter these.
    """
    rows, cols = gray.shape[:2]

    # Pad to optimal FFT size
    optimal_rows = cv2.getOptimalDFTSize(rows)
    optimal_cols = cv2.getOptimalDFTSize(cols)
    padded = np.zeros((optimal_rows, optimal_cols), dtype=np.float32)
    padded[:rows, :cols] = gray.astype(np.float32)

    # Compute DFT
    dft = cv2.dft(padded, flags=cv2.DFT_COMPLEX_OUTPUT)
    dft_shifted = np.fft.fftshift(dft, axes=[0, 1])

    # Create notch filter at grid frequencies
    center_row, center_col = optimal_rows // 2, optimal_cols // 2

    # Grid frequency in pixels
    if grid_spacing_px > 0:
        grid_freq_h = optimal_cols / grid_spacing_px
        grid_freq_v = optimal_rows / grid_spacing_px

        # Notch out horizontal grid line frequencies (vertical in freq domain)
        notch_width = 2  # narrower notch to preserve signal
        for harmonic in range(1, 4):  # fewer harmonics
            freq_h = int(harmonic * grid_freq_h)
            freq_v = int(harmonic * grid_freq_v)

            # Horizontal lines -> vertical frequency
            if center_row + freq_v < optimal_rows:
                dft_shifted[center_row + freq_v - notch_width:center_row + freq_v + notch_width, :] = 0
            if center_row - freq_v >= 0:
                dft_shifted[center_row - freq_v - notch_width:center_row - freq_v + notch_width, :] = 0

            # Vertical lines -> horizontal frequency
            if center_col + freq_h < optimal_cols:
                dft_shifted[:, center_col + freq_h - notch_width:center_col + freq_h + notch_width] = 0
            if center_col - freq_h >= 0:
                dft_shifted[:, center_col - freq_h - notch_width:center_col - freq_h + notch_width] = 0

    # Inverse DFT
    dft_unshifted = np.fft.ifftshift(dft_shifted, axes=[0, 1])
    result = cv2.idft(dft_unshifted, flags=cv2.DFT_SCALE | cv2.DFT_REAL_OUTPUT)
    result = result[:rows, :cols]

    # Normalize back to uint8
    result = cv2.normalize(result, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

    return result


def _has_signal(gray: np.ndarray, min_signal_fraction: float = 0.005) -> bool:
    """
    Check if a grayscale image still has meaningful waveform signal.

    Inverts the image (so signal is bright) and checks if enough pixels
    exceed a threshold. Returns False if grid removal was too aggressive.
    """
    inverted = 255 - gray
    # Pixels above threshold = likely waveform signal
    threshold = 20
    signal_pixels = np.sum(inverted > threshold)
    total_pixels = gray.shape[0] * gray.shape[1]
    fraction = signal_pixels / max(total_pixels, 1)
    return fraction >= min_signal_fraction


def remove_grid_combined(
    gray: np.ndarray,
    grid_spacing_px: float,
    bgr_image: np.ndarray | None = None,
) -> np.ndarray:
    """
    Combined grid removal with fallback strategy.

    Priority:
    1. Color-aware removal (if color image available) — most precise
    2. Morphological removal — good for black grids
    3. Frequency removal — last resort
    4. Raw image — if all methods destroy the signal

    Each method checks that signal is preserved before proceeding.
    """
    # Strategy 1: Color-aware removal (best for colored grids)
    if bgr_image is not None and len(bgr_image.shape) == 3:
        color_cleaned = remove_grid_color_aware(bgr_image, grid_spacing_px)
        if _has_signal(color_cleaned):
            logger.info("Grid removed via color-aware method")
            return color_cleaned
        else:
            logger.warning("Color-aware removal destroyed signal, trying morphological")

    # Strategy 2: Morphological removal (gentler version)
    morph_cleaned = remove_grid_morphological(gray, grid_spacing_px)
    if _has_signal(morph_cleaned):
        logger.info("Grid removed via morphological method")
        return morph_cleaned
    else:
        logger.warning("Morphological removal destroyed signal, trying frequency only")

    # Strategy 3: Frequency-only removal (gentlest)
    freq_cleaned = remove_grid_frequency(gray, grid_spacing_px)
    if _has_signal(freq_cleaned):
        logger.info("Grid removed via frequency method")
        return freq_cleaned
    else:
        logger.warning("All grid removal methods destroyed signal, using raw image")

    # Strategy 4: Return raw image — better to have grid noise than no signal
    return gray


def detect_grid_color(bgr_image: np.ndarray) -> str:
    """
    Detect the grid color (red, blue, green, or black).
    This helps with grid removal as colored grids can be isolated
    in specific color channels.
    """
    hsv = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)

    # Define color ranges for common ECG paper grid colors
    # Use wider saturation range to catch faint/pink grids
    color_ranges = {
        "red": ((0, 20, 80), (15, 255, 255)),
        "red2": ((165, 20, 80), (180, 255, 255)),
        "blue": ((90, 20, 80), (130, 255, 255)),
        "green": ((35, 20, 80), (85, 255, 255)),
    }

    max_count = 0
    detected_color = "black"

    for color_name, (lower, upper) in color_ranges.items():
        mask = cv2.inRange(hsv, np.array(lower), np.array(upper))
        count = cv2.countNonZero(mask)
        # Combine red and red2
        if color_name == "red2":
            color_name = "red"
        if count > max_count:
            max_count = count
            detected_color = color_name

    # If the dominant color covers less than 3% of the image, it's likely black grid
    total_pixels = bgr_image.shape[0] * bgr_image.shape[1]
    if max_count < 0.03 * total_pixels:
        return "black"

    return detected_color
