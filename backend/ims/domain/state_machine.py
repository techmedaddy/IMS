from __future__ import annotations

from ims.db.models import WorkItemState


_ALLOWED: dict[WorkItemState, set[WorkItemState]] = {
    WorkItemState.OPEN: {WorkItemState.INVESTIGATING},
    WorkItemState.INVESTIGATING: {WorkItemState.RESOLVED},
    WorkItemState.RESOLVED: {WorkItemState.CLOSED},
    WorkItemState.CLOSED: set(),
}


def is_valid_transition(from_state: WorkItemState, to_state: WorkItemState) -> bool:
    return to_state in _ALLOWED.get(from_state, set())
