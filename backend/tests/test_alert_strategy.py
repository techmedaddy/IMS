from __future__ import annotations

import pytest

from ims.domain.alerts import alert_strategy_for_component_type


@pytest.mark.parametrize(
    ("component_type", "expected"),
    [
        ("RDBMS", "P0"),
        ("QUEUE", "P1"),
        ("MCP_HOST", "P1"),
        ("API", "P2"),
        ("NOSQL", "P2"),
        ("CACHE", "P2"),
        ("unknown", "P2"),
    ],
)
def test_alert_strategy_severity(component_type: str, expected: str) -> None:
    assert alert_strategy_for_component_type(component_type).severity() == expected

