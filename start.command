#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "========================================================"
echo "   ✨ Starting Smart Job Card & PO OCR Extractor ✨   "
echo "========================================================"

# Check node
if ! command -v node &> /dev/null
then
    echo "Node.js could not be found. Please install Node.js."
    exit 1
fi

# Ensure ocr_engine is compiled
if [ ! -f "ocr_engine" ]; then
    echo "Compiling Apple Vision OCR Engine..."
    mkdir -p .module_cache
    swiftc -module-cache-path .module_cache ocr.swift -o ocr_engine
fi

# Start server
echo "Launching web app server at http://localhost:3000..."
open "http://localhost:3000"
npm start
