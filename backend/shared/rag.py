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
from langchain_core.callbacks import BaseCallbackHandler

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


class TokenCounter(BaseCallbackHandler):
    """Capture prompt + completion tokens reported by the LLM.

    RetrievalQA returns only the answer text, so the usage the provider sends
    back is otherwise discarded. Groq reports it in llm_output["token_usage"];
    when a provider or version omits it the count stays 0 and the caller falls
    back to its own estimate.
    """

    def __init__(self) -> None:
        self.prompt_tokens = 0
        self.completion_tokens = 0

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens

    def on_llm_end(self, response, **kwargs) -> None:  # noqa: ANN001
        output = getattr(response, "llm_output", None) or {}
        usage = output.get("token_usage") or {}
        if not usage:
            # Newer langchain surfaces it per-generation instead.
            for batch in getattr(response, "generations", []) or []:
                for generation in batch:
                    message = getattr(generation, "message", None)
                    usage = getattr(message, "usage_metadata", None) or {}
                    if usage:
                        self.prompt_tokens += usage.get("input_tokens", 0)
                        self.completion_tokens += usage.get("output_tokens", 0)
            return
        self.prompt_tokens += usage.get("prompt_tokens", 0)
        self.completion_tokens += usage.get("completion_tokens", 0)


def estimate_tokens(text: str) -> int:
    """Rough fallback when the provider reports no usage.

    Sinhala is not well served by word counts, so this approximates on
    characters — deliberately coarse, and only ever a floor of 1 so a
    request is never billed as free.
    """
    return max(1, len(text or "") // 4)


def answer(chain: RetrievalQA, question: str) -> str:
    return answer_with_usage(chain, question)[0]


def answer_with_usage(chain: RetrievalQA, question: str) -> tuple:
    """Run a query, returning (answer, tokens_used)."""
    counter = TokenCounter()
    config = {"callbacks": [counter]}
    try:
        result = chain.invoke({"query": question}, config=config)
    except AttributeError:  # very old langchain: chains were plain callables
        result = chain({"query": question}, callbacks=[counter])
    text = result["result"] if isinstance(result, dict) else str(result)

    tokens = counter.total_tokens
    if not tokens:
        tokens = estimate_tokens(question) + estimate_tokens(text)
    return text, tokens
