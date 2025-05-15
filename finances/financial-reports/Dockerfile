# Use the official lightweight Python image.
# https://hub.docker.com/_/python
FROM python:3.12-slim

# Allow statements and log messages to immediately appear in the Knative logs
ENV PYTHONUNBUFFERED True

# Copy local code to the container image.
ENV APP_HOME /app
WORKDIR $APP_HOME
COPY . ./

# Add scripts directory to PYTHONPATH so modules can be found
ENV PYTHONPATH="${PYTHONPATH}:${APP_HOME}/scripts"

# Create necessary directories if they don't exist
RUN mkdir -p config data

# Install production dependencies.
RUN pip install --no-cache-dir -r requirements.txt

# Run the web server on container startup.
# Use gunicorn for production deployments.
# The application's default port is 8080. Cloud Run needs the container to listen on $PORT, provided by Cloud Run.
# Gunicorn automatically uses the PORT environment variable when available.
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 scripts.main:app 