import os
import uuid
from typing import Optional

import redis
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from langchain.chains import RetrievalQA
from langchain.prompts import ChatPromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain_community.embeddings import HuggingFaceBgeEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq
from pydantic import BaseModel

load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY")
redis_host = os.getenv("REDIS_HOST", "redis")
redis_port = int(os.getenv("REDIS_PORT", 6379))
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/usr/src/app/uploaded_files")

redis_client = redis.Redis(host=redis_host, port=redis_port, db=0)

app = FastAPI()

Instrumentator().instrument(app).expose(app, endpoint="/metrics")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    retrieval_key: Optional[str] = None
    file_path: str


class ChatResponse(BaseModel):
    response: str
    retrieval_key: str


huggingface_embeddings = HuggingFaceBgeEmbeddings(
    model_name="intfloat/multilingual-e5-large-instruct",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True},
)

prompt = ChatPromptTemplate.from_template("""
ශ්‍රී ලංකාවේ ආණ්ඩුක්‍රම ව්‍යවස්ථාව පහත සන්දර්භය තුළ දක්වා ඇත.
සම්පූර්ණ සන්දර්භය නිවැරදිව තේරුම් ගෙන පහත ප්‍රශ්නයට නිවැරදිව සවිස්තරාත්මක විධිමත් පිළිතුරු සිංහලෙන් සපයන්න.
""")

llm = ChatGroq(api_key=groq_api_key, model_name="llama-3.3-70b-versatile")


def get_or_create_vectorstore(retrieval_key: Optional[str], file_path: str):
    if retrieval_key:
        cached = redis_client.get(retrieval_key)
        if cached:
            db = FAISS.deserialize_from_bytes(cached, embeddings=huggingface_embeddings)
            return db, retrieval_key

    loader = TextLoader(file_path, encoding="utf-8")
    docs = loader.load()

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=514, chunk_overlap=20)
    documents = text_splitter.split_documents(docs)

    db = FAISS.from_documents(documents, huggingface_embeddings)

    new_key = str(uuid.uuid4())
    redis_client.set(new_key, db.serialize_to_bytes())

    return db, new_key


@app.post("/chat")
async def chat(chat_request: ChatRequest) -> ChatResponse:
    if not chat_request.message:
        raise HTTPException(status_code=400, detail="No message provided")

    if not chat_request.file_path:
        raise HTTPException(status_code=400, detail="No file_path provided")

    full_path = os.path.join(UPLOAD_DIR, chat_request.file_path)
    db, key = get_or_create_vectorstore(chat_request.retrieval_key, full_path)
    retriever = db.as_retriever()

    retrieval_chain = RetrievalQA.from_chain_type(
        llm=llm, retriever=retriever, chain_type="stuff"
    )

    result = retrieval_chain({"query": chat_request.message})
    return ChatResponse(response=result["result"], retrieval_key=key)


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=7006)
