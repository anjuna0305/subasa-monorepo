import os
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceBgeEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains import RetrievalQA
from langchain_groq import ChatGroq
from pydantic import BaseModel
import traceback

# Load environment variables
load_dotenv()

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploaded_files"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Global caches
retriever_cache = {}
retrieval_chain_cache = {}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Handle file upload, use appropriate loader for .txt or .pdf, and initialize retriever and chatbot.
    """
    global retriever_cache, retrieval_chain_cache

    file_path = os.path.join(UPLOAD_FOLDER, file.filename)

    try:
        # Save file locally
        with open(file_path, "wb") as f:
            f.write(await file.read())

        # Select the appropriate loader
        if file.filename.endswith(".txt"):
            loader = TextLoader(file_path, encoding="utf-8")
        elif file.filename.endswith(".pdf"):
            loader = PyPDFLoader(file_path)
        else:
            raise HTTPException(status_code=400, detail="සහාය නොදක්වන ගොනු වර්ගයකි")

        # Load and process the document
        docs = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=514, chunk_overlap=50)
        documents = text_splitter.split_documents(docs)

        # Create embeddings and set up retriever
        huggingface_embeddings = HuggingFaceBgeEmbeddings(
            model_name="intfloat/multilingual-e5-large-instruct",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        db = FAISS.from_documents(documents, huggingface_embeddings)
        retriever_cache[file_path] = db.as_retriever()

        return JSONResponse(content={"success": True, "message": "ගොනුව උඩුගත කර සාර්ථකව සකසන ලදී."})

    except Exception as e:
        traceback.print_exc()  # Print the stack trace to the console
        raise HTTPException(status_code=500, detail=f"ගොනුව සැකසීමේ දෝෂයකි: {str(e)}")

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Handle user queries and return responses from the chatbot.
    """
    message = request.message
    global retrieval_chain_cache

    if not message:
        raise HTTPException(status_code=400, detail="පණිවිඩයක් සපයා නැත")

    # Use the latest retriever
    if not retriever_cache:
        raise HTTPException(status_code=400, detail="තවමත් කිසිදු ලේඛනයක් උඩුගත කර සකසා නොමැත.")

    retriever_key = list(retriever_cache.keys())[-1]
    retriever = retriever_cache[retriever_key]

    # Check if a retrieval chain exists
    if retriever_key not in retrieval_chain_cache:
        try:
            llm = ChatGroq(api_key=os.getenv("GROQ_API_KEY"), model_name="llama-3.3-70b-versatile")

            prompt = ChatPromptTemplate.from_template("""
            සම්පූර්ණ සන්දර්භය නිවැරදිව තේරුම් ගෙන පහත ප්‍රශ්නයට නිවැරදිව සවිස්තරාත්මක විධිමත් පිළිතුරු සිංහලෙන් සපයන්න.
            """)

            retrieval_chain_cache[retriever_key] = RetrievalQA.from_chain_type(
                llm=llm,
                retriever=retriever,
                chain_type="stuff",
                return_source_documents=False
            )
        except Exception as e:
            traceback.print_exc()  # Print the stack trace to the console
            raise HTTPException(status_code=500, detail=f"LLM ආරම්භ කිරීමේදී දෝෂයකි: {str(e)}")

    retrieval_chain = retrieval_chain_cache[retriever_key]

    try:
        response = retrieval_chain({"query": message})
        return {"response": response['result']}
    except Exception as e:
        traceback.print_exc()  # Print the stack trace to the console
        raise HTTPException(status_code=500, detail=f"ඉල්ලීම සැකසීමේ දෝෂයකි: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=6003)
