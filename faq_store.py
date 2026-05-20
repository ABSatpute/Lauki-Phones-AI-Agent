"""
Shared FAQ vector store with S3 caching.
- First load: builds FAISS index from CSV, uploads to S3
- Subsequent loads: downloads from S3 (skips embedding API calls)
- Invalidate: delete s3://BUCKET/faq-index/ to force rebuild
"""
import csv
import os
import tempfile
from typing import List

import boto3
from langchain_aws import BedrockEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

REGION = os.getenv("AWS_REGION", "us-east-1")
ACCOUNT_ID = os.getenv("AWS_ACCOUNT_ID", "417780655467")
S3_BUCKET = os.getenv("FAQ_INDEX_BUCKET", f"bedrock-agentcore-faq-index-{ACCOUNT_ID}")
S3_PREFIX = "faq-index"
CSV_PATH = os.getenv("FAQ_CSV_PATH", "./lauki_qna.csv")

emb = BedrockEmbeddings(model_id="amazon.titan-embed-text-v2:0", region_name=REGION)
_store = None


def _s3_index_exists(s3: boto3.client) -> bool:
    try:
        s3.head_object(Bucket=S3_BUCKET, Key=f"{S3_PREFIX}/index.faiss")
        return True
    except s3.exceptions.ClientError:
        return False


def _load_csv() -> List[Document]:
    docs = []
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            docs.append(Document(page_content=f"Q: {row['question'].strip()}\nA: {row['answer'].strip()}"))
    return docs


def _build_and_upload(s3: boto3.client) -> FAISS:
    docs = _load_csv()
    chunks = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=0).split_documents(docs)
    store = FAISS.from_documents(chunks, emb)
    with tempfile.TemporaryDirectory() as tmp:
        store.save_local(tmp)
        for fname in ("index.faiss", "index.pkl"):
            s3.upload_file(f"{tmp}/{fname}", S3_BUCKET, f"{S3_PREFIX}/{fname}")
    print(f"FAISS index built ({len(chunks)} chunks) and cached to s3://{S3_BUCKET}/{S3_PREFIX}/")
    return store


def _download_and_load(s3: boto3.client) -> FAISS:
    with tempfile.TemporaryDirectory() as tmp:
        for fname in ("index.faiss", "index.pkl"):
            s3.download_file(S3_BUCKET, f"{S3_PREFIX}/{fname}", f"{tmp}/{fname}")
        store = FAISS.load_local(tmp, emb, allow_dangerous_deserialization=True)
    print(f"FAISS index loaded from s3://{S3_BUCKET}/{S3_PREFIX}/")
    return store


def get_faq_store() -> FAISS:
    global _store
    if _store is None:
        s3 = boto3.client("s3", region_name=REGION)
        if _s3_index_exists(s3):
            _store = _download_and_load(s3)
        else:
            _store = _build_and_upload(s3)
    return _store
