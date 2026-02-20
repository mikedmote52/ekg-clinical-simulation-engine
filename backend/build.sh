#!/usr/bin/env bash
set -o errexit

# Install Python dependencies with no cache to save RAM on free tier
pip install --no-cache-dir --upgrade pip
pip install --no-cache-dir -r requirements.txt
