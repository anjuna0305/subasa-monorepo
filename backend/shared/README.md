# shared

Code used by more than one backend service. Not a service; it has no app, no
port and no Dockerfile.

## `rag.py`

The single definition of the retrieval recipe:

| | |
|---|---|
| Embeddings | `intfloat/multilingual-e5-large-instruct`, CPU, normalized |
| Splitter | `RecursiveCharacterTextSplitter(chunk_size=514, chunk_overlap=20)` |
| LLM | Groq `llama-3.3-70b-versatile` |
| Prompt | `SINHALA_PROMPT` — answer from context only, in formal Sinhala |

`chatbot-modified` and `framework` both build from it. They used to carry
private copies, which had already drifted: different chunk overlaps, and two
different prompts — **neither of which was ever passed to the chain**, so the
"answer in Sinhala" instruction was dead code in both. The shared template
exposes the `{context}` and `{question}` placeholders a `stuff` chain needs, and
`build_retrieval_chain()` wires it in through `chain_type_kwargs`.

### Token accounting

`TokenCounter` is a LangChain callback that captures the usage a provider
reports — `llm_output["token_usage"]` on older versions, per-generation
`usage_metadata` on newer ones — because `RetrievalQA` otherwise discards it.
`answer_with_usage()` returns `(text, tokens)`, falling back to
`estimate_tokens()` (characters ÷ 4, minimum 1) when nothing is reported, so a
request is never billed as free. The services put that number in
`X-Tokens-Used`, which is what the gateway meters from.

## Compatibility constraints

This module is imported by services on **Python 3.9 and 3.10**, running
**LangChain 0.3 and 0.1** respectively. That is why it carries
`from __future__ import annotations`, `typing.Optional` rather than PEP 604
unions, and guarded imports for `langchain_text_splitters`. Check both services
before changing an import here.

## How it reaches the images

Docker build contexts cannot reach outside themselves, so both consuming
services build from `./backend` with a `dockerfile:` path, and their Dockerfiles
`COPY shared/ ./shared/`. `backend/.dockerignore` keeps everything else out.
