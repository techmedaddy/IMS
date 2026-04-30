from __future__ import annotations


SEVERITY_ORDER: dict[str, int] = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}

_COMPONENT_TYPE_TO_SEVERITY: dict[str, str] = {
    "RDBMS": "P0",
    "QUEUE": "P1",
    "MCP_HOST": "P1",
    "API": "P2",
    "NOSQL": "P2",
    "CACHE": "P2",
}


def severity_for_component_type(component_type: str) -> str:
    return _COMPONENT_TYPE_TO_SEVERITY.get(component_type.upper(), "P2")


def severity_rank(severity: str) -> int:
    return SEVERITY_ORDER.get(severity.upper(), 99)
