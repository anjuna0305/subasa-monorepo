FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir --upgrade pip && \
    pip install --timeout=100 --retries=5 -r requirements.txt

COPY . .

EXPOSE 7010

CMD sh -c "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 7010"