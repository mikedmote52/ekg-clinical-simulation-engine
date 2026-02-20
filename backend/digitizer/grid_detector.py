"""
Grid detection utilities.

Provides standalone functions for detecting and removing ECG paper grid lines.
Used by both the preprocessor and the waveform extractor.
"""

from __future__ import annotations

import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def remove_grid_morphological(gray: np.ndarray, grid_spacing_px: float) -> np.ndarray:
    """
    Remove grid lines using morphological operations.

    Strategy:
    1. Build horizontal and vertical structural elements sized to grid spacing
    2. Extract horizontal and vertical lines via morphological opening
    3. Subtract extracted grid from original image
    """
    # Ensure we're working with uint8
    if gray.dtype != np.uint8:
        gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

    # Invert so grid lines are white (high intensity)
    inverted = cv2.bitwise_not(gray)

    # Horizontal grid removal
    h_kernel_size = max(int(grid_spacing_px * 2), 15)
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (h_kernel_size, 1))
    horizontal_lines = cv2.morphologyEx(inverted, cv2.MORPH_OPEN, h_kernel)

    # Vertical grid removal
    v_kernel_size = max(int(grid_spacing_px * 2), 15)
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, v_kernel_size))
    vertical_lines = cv2.morphologyEx(inverted, cv2.MORPH_OPEN, v_kernel)

    # Combine detected grid
    grid_mask = cv2.add(horizontal_lines, vertical_lines)

    # Dilate grid mask slightly to cover grid line edges
    dilate_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    grid_mask = cv2.dilate(grid_mask, dilate_kernel, iterations=1)

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
        notch_width = 3
        for harmonic in range(1, 6):
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


def remove_grid_combined(gray: np.ndarray, grid_spacing_px: float) -> np.ndarray:
    """
    Combined grid removal using both morphological and frequency methods.

    The morphological pass handles the coarse grid structure,
    then the frequency pass cleans up remaining periodic artifacts.
    """
    # First pass: morphological
    morph_cleaned = remove_grid_morphological(gray, grid_spacing_px)

    # Second pass: frequency filtering on the result
    freq_cleaned = remove_grid_frequency(morph_cleaned, grid_spacing_px)

    return freq_cleaned


def detect_grid_color(bgr_image: np.ndarray) -> str:
    """
    Detect the grid color (red, blue, green, or black).
    This helps with grid removal as colored grids can be isolated
    in specific color channels.
    """
    hsv = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)

    # Define color ranges for common ECG paper grid colors
    color_ranges = {
        "red": ((0, 50, 50), (10, 255, 255)),
        "red2": ((170, 50, 50), (180, 255, 255)),
        "blue": ((100, 50, 50), (130, 255, 255)),
        "green": ((35, 50, 50), (85, 255, 255)),
    }

    max_count = 0
    detected_color = "black"

    for color_name, (lower, upper) in color_ranges.items():
        mask = cv2.inRange(hsv, np.array(lower), np.array(upper))
        count = cv2.countNonZero(mask)
        if count > max_count:
            max_count = count
            detected_color = color_name.replace("2", "")

    # If the dominant color covers less than 5% of the image, it's likely black grid
    total_pixels = bgr_image.shape[0] * bgr_image.shape[1]
    if max_count < 0.05 * total_pixels:
        return "black"

    return detected_color
