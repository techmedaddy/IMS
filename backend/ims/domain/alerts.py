from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

SEVERITY_ORDER: dict[str, int] = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}

DEFAULT_SEVERITY = "P2"


class AlertStrategy(Protocol):
    def severity(self) -> str: ...

    def dispatch(self, *, component_id: str, component_type: str, incident_id: str) -> None: ...


@dataclass(frozen=True, slots=True)
class BaseAlertStrategy:
    _severity: str

    def severity(self) -> str:
        return self._severity

    def dispatch(self, *, component_id: str, component_type: str, incident_id: str) -> None:
        # Demo dispatch: emit a structured console alert.
        print(
            f"[alert] severity={self._severity} component_id={component_id} component_type={component_type} incident_id={incident_id}"
        )


class RDBMSAlertStrategy(BaseAlertStrategy):
    def __init__(self) -> None:
        super().__init__("P0")


class QueueAlertStrategy(BaseAlertStrategy):
    def __init__(self) -> None:
        super().__init__("P1")


class MCPHostAlertStrategy(BaseAlertStrategy):
    def __init__(self) -> None:
        super().__init__("P1")


class APIAlertStrategy(BaseAlertStrategy):
    def __init__(self) -> None:
        super().__init__("P2")


class NoSQLAlertStrategy(BaseAlertStrategy):
    def __init__(self) -> None:
        super().__init__("P2")


class CacheAlertStrategy(BaseAlertStrategy):
    def __init__(self) -> None:
        super().__init__("P2")


class DefaultAlertStrategy(BaseAlertStrategy):
    def __init__(self) -> None:
        super().__init__(DEFAULT_SEVERITY)


_STRATEGIES: dict[str, AlertStrategy] = {
    "RDBMS": RDBMSAlertStrategy(),
    "QUEUE": QueueAlertStrategy(),
    "MCP_HOST": MCPHostAlertStrategy(),
    "API": APIAlertStrategy(),
    "NOSQL": NoSQLAlertStrategy(),
    "CACHE": CacheAlertStrategy(),
}


def alert_strategy_for_component_type(component_type: str) -> AlertStrategy:
    return _STRATEGIES.get(component_type.upper(), DefaultAlertStrategy())


def severity_for_component_type(component_type: str) -> str:
    # Shim for existing codepaths/tests: delegate to the Strategy registry.
    return alert_strategy_for_component_type(component_type).severity()


def severity_rank(severity: str) -> int:
    return SEVERITY_ORDER.get(severity.upper(), 99)
