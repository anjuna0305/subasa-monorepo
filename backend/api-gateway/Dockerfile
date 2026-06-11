FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --timeout=100 --retries=5 -r requirements.txt

COPY . .

EXPOSE 7010

# Run migrations first, then start app
CMD sh -c "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 7010"

