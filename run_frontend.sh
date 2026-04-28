#!/bin/bash
# ZenoHosp HMS — Frontend (macOS)

cd "$(dirname "$0")/HMS-frontend"

# Kill anything already on port 5174
if lsof -ti:5174 > /dev/null 2>&1; then
  echo " Killing existing process on port 5174..."
  lsof -ti:5174 | xargs kill -9 2>/dev/null
  sleep 1
fi

echo ""
echo " ZenoHosp HMS Frontend"
echo " http://localhost:5174"
echo " Proxy → http://localhost:9001"
echo " Press Ctrl+C to stop."
echo ""

npm run dev
