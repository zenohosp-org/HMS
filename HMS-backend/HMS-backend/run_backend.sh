#!/bin/bash
# ZenoHosp HMS — Backend (macOS)
# Runs Spring Boot on http://localhost:9001 with the 'local' profile

export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"

cd "$(dirname "$0")"

echo ""
echo " ZenoHosp HMS Backend"
echo " Spring Boot 3 / Java 21"
echo " http://localhost:9001"
echo " Press Ctrl+C to stop."
echo ""

./mvnw spring-boot:run -Dspring-boot.run.profiles=local
