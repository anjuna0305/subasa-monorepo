import os

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
TTS_FILE_DIR = os.environ.get(
    "FILE_STORE_DIR", os.path.join(os.path.dirname(__file__), "fileStore", "tts")
)
CUSTOM_CHATBOT_SERVICE_URL = os.environ.get(
    "CUSTOM_CHATBOT_SERVICE_URL", "http://localhost:7006/chat"
)
TTS_SERVICE_URL = os.environ.get(
    "TTS_SERVICE_URL", "http://localhost:7002"
)
