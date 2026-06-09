FROM python:3.10-slim

WORKDIR /usr/src/app

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install --timeout=120 -r requirements.txt

COPY . .

EXPOSE 6001

CMD ["python3", "chatbot_api.py"]

