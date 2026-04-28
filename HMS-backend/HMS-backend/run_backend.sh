#!/bin/bash
# ZenoHosp HMS — Backend (macOS)

export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"

cd "$(dirname "$0")"

# Kill anything already on port 9001
if lsof -ti:9001 > /dev/null 2>&1; then
  echo " Killing existing process on port 9001..."
  lsof -ti:9001 | xargs kill -9 2>/dev/null
  sleep 1
fi

echo ""
echo " ZenoHosp HMS Backend"
echo " Spring Boot 3 / Java 21"
echo " http://localhost:9001"
echo " Press Ctrl+C to stop."
echo ""

./mvnw spring-boot:run -Dspring-boot.run.profiles=local
