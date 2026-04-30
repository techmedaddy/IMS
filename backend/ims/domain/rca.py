from __future__ import annotations

from datetime import datetime


def is_nonempty_text(value: str | None) -> bool:
    return bool(value and value.strip())


def is_rca_complete(
    *,
    start_time: datetime | None,
    end_time: datetime | None,
    root_cause_category: str | None,
    fix_applied: str | None,
    prevention_steps: str | None,
) -> bool:
    if start_time is None or end_time is None:
        return False
    if end_time < start_time:
        return False
    return all(
        [
            is_nonempty_text(root_cause_category),
            is_nonempty_text(fix_applied),
            is_nonempty_text(prevention_steps),
        ]
    )


def can_close_incident(*, rca_present: bool, rca_complete: bool) -> bool:
    return rca_present and rca_complete
