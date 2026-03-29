FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv

COPY requirements.txt .
RUN /opt/venv/bin/pip install --no-cache-dir --upgrade pip && \
    /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p /app/docs

EXPOSE 8081

CMD ["/opt/venv/bin/uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8081", "--reload"]