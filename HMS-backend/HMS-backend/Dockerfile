# Stage 1: Build the application
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Copy the pom.xml and source code
COPY pom.xml .
COPY src ./src

# Build the application
RUN mvn clean package -DskipTests

# Stage 2: Run the application
FROM eclipse-temurin:21-jre
WORKDIR /app

# Copy the built jar from the build stage
COPY --from=build /app/target/HMS-backend-0.0.1-SNAPSHOT.jar app.jar

# Expose the port (Render uses PORT env var, but EXPOSE is good for documentation)
EXPOSE 9001

# Run the application, ensuring it listens on the PORT provided by the environment
ENTRYPOINT ["java", "-Dserver.port=${PORT:9001}", "-jar", "app.jar"]
