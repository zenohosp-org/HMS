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

# Expose the port the app runs on
EXPOSE 9001

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
