FROM python:3.9-slim

WORKDIR /usr/src/app

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install --timeout=120 -r requirements.txt

COPY . .
RUN pip install python-multipart

EXPOSE 6003

CMD [ "python3", "chatbot.py" ]
