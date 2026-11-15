#!/bin/bash
# NEXORA — double-click to start on a Mac. Leave this window open while you use NEXORA.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Node.js is not installed. Opening nodejs.org — install the LTS version, then double-click this file again."
  open "https://nodejs.org/en/download"
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "First run: installing NEXORA (about a minute)…"
  npm install --no-fund --no-audit || { echo "Install failed."; read -n 1 -s -r; exit 1; }
fi
echo ""
echo "Starting NEXORA at http://localhost:3001 …"
( sleep 6; open "http://localhost:3001" ) &
npm run dev
