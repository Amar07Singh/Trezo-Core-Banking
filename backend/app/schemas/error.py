from typing import Any

from pydantic import BaseModel


class ProblemDetail(BaseModel):
    type: str
    title: str
    status: int
    detail: str
    instance: str
    correlation_id: str | None = None
    invalid_params: list[dict[str, Any]] | None = None
