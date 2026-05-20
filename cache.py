"""
DynamoDB response cache for FAQ agent.
- Cache hit: returns answer instantly, no LLM call
- Cache miss: caller invokes LLM, then calls set()
- TTL: 24h by default (telecom FAQs don't change hourly)
"""
import hashlib
import os
import time

import boto3
from botocore.exceptions import ClientError

TABLE = os.getenv("CACHE_TABLE", "faq-response-cache")
TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", 86400))  # 24h
REGION = os.getenv("AWS_REGION", "us-east-1")

_table = None


def _get_table():
    global _table
    if _table is None:
        _table = boto3.resource("dynamodb", region_name=REGION).Table(TABLE)
    return _table


def _hash(question: str) -> str:
    return hashlib.sha256(question.strip().lower().encode()).hexdigest()


def get(question: str) -> str | None:
    try:
        item = _get_table().get_item(Key={"question_hash": _hash(question)}).get("Item")
        if item and int(item["ttl"]) > int(time.time()):
            return item["answer"]
    except ClientError:
        pass
    return None


def set(question: str, answer: str) -> None:
    try:
        _get_table().put_item(Item={
            "question_hash": _hash(question),
            "answer": answer,
            "ttl": int(time.time()) + TTL_SECONDS,
        })
    except ClientError:
        pass  # cache write failure is non-fatal
