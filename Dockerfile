FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directory structure (although it will be mounted)
RUN mkdir -p /data/uploads /data/processed

# Environment variables
ENV DATA_DIR=/data
ENV FLASK_APP=app.py

# Expose port
EXPOSE 8000

# Run with Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]
