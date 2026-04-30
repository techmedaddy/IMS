from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ims.domain.rca import is_rca_complete


def test_rca_incomplete_when_missing_fields() -> None:
    start = datetime.now(timezone.utc) - timedelta(minutes=5)
    end = datetime.now(timezone.utc)

    assert (
        is_rca_complete(
            start_time=start,
            end_time=end,
            root_cause_category=None,
            fix_applied="fixed it",
            prevention_steps="add alert",
        )
        is False
    )

    assert (
        is_rca_complete(
            start_time=start,
            end_time=end,
            root_cause_category="Network",
            fix_applied="",
            prevention_steps="add alert",
        )
        is False
    )


def test_rca_rejects_end_before_start() -> None:
    start = datetime.now(timezone.utc)
    end = start - timedelta(seconds=1)

    assert (
        is_rca_complete(
            start_time=start,
            end_time=end,
            root_cause_category="RDBMS",
            fix_applied="Restarted",
            prevention_steps="Auto-failover",
        )
        is False
    )


def test_rca_complete_when_all_fields_present() -> None:
    start = datetime.now(timezone.utc) - timedelta(minutes=5)
    end = datetime.now(timezone.utc)

    assert (
        is_rca_complete(
            start_time=start,
            end_time=end,
            root_cause_category="RDBMS",
            fix_applied="Restarted primary",
            prevention_steps="Add circuit breaker",
        )
        is True
    )
