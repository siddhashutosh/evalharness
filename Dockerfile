# Portable backend image — works on Railway, Fly.io, Cloud Run, etc.
#   docker build -t evalharness-api .
#   docker run -p 8000:8000 evalharness-api
FROM python:3.11-slim

WORKDIR /app

# Install the harness + backend deps. README is referenced by pyproject.
COPY pyproject.toml README.md ./
COPY evalharness ./evalharness
COPY server ./server
RUN pip install --no-cache-dir -e . && pip install --no-cache-dir -r server/requirements.txt

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# Hosts inject $PORT; default to 8000 locally.
CMD ["sh", "-c", "python -m uvicorn server.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
