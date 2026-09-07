"""The one RAG recipe shared by every chatbot service.

`chatbot-modified` and `framework` used to carry their own copy of the splitter
settings, the embedding model, the Groq model name and the Sinhala prompt. The
copies had already drifted — different chunk overlaps, and two different
prompts, neither of which was ever actually passed to the chain. This module is
the single definition; both services build their chains from it.

Kept compatible with Python 3.9 (framework) and langchain 0.1 (chatbot-modified)
as well as 3.10 / langchain 0.3, hence the guarded imports below.
"""

from __future__ import annotations

import os
from typing import Any, List, Optional

from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

try:  # langchain >= 0.2
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:  # langchain 0.1
    from langchain.text_splitter import RecursiveCharacterTextSplitter

from langchain.chains import RetrievalQA
from langchain_community.embeddings import HuggingFaceBgeEmbeddings

EMBEDDING_MODEL = "intfloat/multilingual-e5-large-instruct"
LLM_MODEL = "llama-3.3-70b-versatile"
CHUNK_SIZE = 514
CHUNK_OVERLAP = 20

# The retrieval chain is a "stuff" chain, so the template has to expose both
# {context} and {question}. The previous per-service templates exposed neither
# and were never wired into the chain, which is why answers came back in
# whatever language the model felt like.
SINHALA_PROMPT = ChatPromptTemplate.from_template(
    """පහත දක්වා ඇති සන්දර්භය පමණක් පදනම් කරගෙන ප්‍රශ්නයට පිළිතුරු සපයන්න.
සන්දර්භය තුළ පිළිතුර නොමැති නම්, ඔබ එය නොදන්නා බව සිංහලෙන් පවසන්න — කිසිවක් උපකල්පනය නොකරන්න.
පිළිතුර සවිස්තරාත්මකව, විධිමත් සිංහලෙන් ලියන්න.

සන්දර්භය:
{context}

ප්‍රශ්නය: {question}

පිළිතුර:"""
)


def build_embeddings() -> HuggingFaceBgeEmbeddings:
    return HuggingFaceBgeEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


def build_splitter() -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
    )


def split_documents(docs: List[Any]) -> List[Any]:
    return build_splitter().split_documents(docs)


def build_llm(api_key: Optional[str] = None) -> ChatGroq:
    key = api_key or os.getenv("GROQ_API_KEY")
    if not key:
        raise RuntimeError("GROQ_API_KEY is not set")
    return ChatGroq(api_key=key, model_name=LLM_MODEL)


def build_retrieval_chain(retriever: Any, llm: Optional[ChatGroq] = None) -> RetrievalQA:
    return RetrievalQA.from_chain_type(
        llm=llm or build_llm(),
        retriever=retriever,
        chain_type="stuff",
        chain_type_kwargs={"prompt": SINHALA_PROMPT},
        return_source_documents=False,
    )


def answer(chain: RetrievalQA, question: str) -> str:
    """Run a query through a chain, tolerating both langchain call styles."""
    try:
        result = chain.invoke({"query": question})
    except AttributeError:  # very old langchain: chains were plain callables
        result = chain({"query": question})
    return result["result"] if isinstance(result, dict) else str(result)
