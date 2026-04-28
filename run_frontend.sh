#!/bin/bash
# ZenoHosp HMS — Frontend launcher (macOS)
# Dev server: http://localhost:5174
# API proxy → http://localhost:9001 (start backend first)

cd "$(dirname "$0")/HMS-frontend"

echo ""
echo " ZenoHosp HMS Frontend"
echo " http://localhost:5174"
echo " Proxy → http://localhost:9001"
echo " Press Ctrl+C to stop."
echo ""

npm run dev
