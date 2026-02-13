FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --root-user-action=ignore --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --root-user-action=ignore -r requirements.txt

COPY . .

# Create non-root user
RUN groupadd --system appuser && \
    useradd --system --gid appuser --no-create-home appuser

# Create data directories and set ownership
RUN mkdir -p /data/uploads /data/processed /data/logs && \
    chown -R appuser:appuser /data && \
    chown -R appuser:appuser /app

ENV DATA_DIR=/data
ENV FLASK_APP=app.py

USER appuser

EXPOSE 8000

CMD gunicorn --bind "0.0.0.0:${PORT:-8000}" app:app
