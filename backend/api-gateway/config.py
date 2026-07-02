import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "mysql+aiomysql://subasa:your_password@localhost:3306/subasa",
)
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "1440"))
IMAGE_UPLOAD_DIR = os.environ.get(
    "UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "uploads", "chatbot_images")
)
FILE_UPLOAD_DIR = os.environ.get(
    "UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "uploads", "chatbot_files")
)
CUSTOM_CHATBOT_SERVICE_URL = os.environ.get(
    "CUSTOM_CHATBOT_SERVICE_URL", "http://localhost:7006/chat"
)
TTS_SERVICE_URL = os.environ.get("TTS_SERVICE_URL", "http://localhost:6001")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get(
    "GOOGLE_REDIRECT_URI", "http://localhost:8000/users/login-with-google"
)
