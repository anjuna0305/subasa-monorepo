import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain.chains import LLMChain, RetrievalQA
from langchain.prompts import ChatPromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain_community.embeddings import HuggingFaceBgeEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq
from pydantic import BaseModel

# Load environment variables
load_dotenv()
groq_api_key = os.getenv("GROQ_API_KEY")

app = FastAPI()

# CORS configuration (same as Flask version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic model for request/response
class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str


# Initialize components (same as Flask version)
loader = TextLoader("Sri Lanka Constitution-Sinhala.txt", encoding="utf-8")
docs = loader.load()

text_splitter = RecursiveCharacterTextSplitter(chunk_size=514, chunk_overlap=20)
documents = text_splitter.split_documents(docs)

huggingface_embeddings = HuggingFaceBgeEmbeddings(
    model_name="intfloat/multilingual-e5-large-instruct",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True},
)

db = FAISS.from_documents(documents, huggingface_embeddings)
retriever = db.as_retriever()

prompt = ChatPromptTemplate.from_template("""
ශ්‍රී ලංකාවේ ආණ්ඩුක්‍රම ව්‍යවස්ථාව පහත සන්දර්භය තුළ දක්වා ඇත.
සම්පූර්ණ සන්දර්භය නිවැරදිව තේරුම් ගෙන පහත ප්‍රශ්නයට නිවැරදිව සවිස්තරාත්මක විධිමත් පිළිතුරු සිංහලෙන් සපයන්න.
""")

llm = ChatGroq(api_key=groq_api_key, model_name="llama-3.3-70b-versatile")
llm_chain = LLMChain(prompt=prompt, llm=llm)

retrieval_chain = RetrievalQA.from_chain_type(
    llm=llm, retriever=retriever, chain_type="stuff"
)


@app.post("/chat")
async def chat(chat_request: ChatRequest) -> ChatResponse:
    if not chat_request.message:
        raise HTTPException(status_code=400, detail="No message provided")

    response = retrieval_chain({"query": chat_request.message})
    return ChatResponse(response=response["result"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=6001)
