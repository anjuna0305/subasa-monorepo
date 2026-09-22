FROM python:3.10-slim AS builder

WORKDIR /usr/src/app

COPY requirements-base.txt requirements-app.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir --upgrade pip && \
    pip install --timeout=120 -r requirements-base.txt && \
    pip install --timeout=120 -r requirements-app.txt

COPY . .

# ---- runtime stage ----
FROM python:3.10 AS runtime

WORKDIR /usr/src/app

COPY --from=builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /usr/src/app /usr/src/app

EXPOSE 6001

CMD ["python3", "chatbot_api.py"]