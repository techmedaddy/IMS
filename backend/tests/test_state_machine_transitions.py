from __future__ import annotations

import pytest

from ims.db.models import WorkItemState
from ims.domain.state_machine import TransitionContext, TransitionError, transition_or_raise


@pytest.mark.parametrize(
    ("from_state", "to_state"),
    [
        (WorkItemState.OPEN, WorkItemState.INVESTIGATING),
        (WorkItemState.INVESTIGATING, WorkItemState.RESOLVED),
    ],
)
def test_allows_happy_path_transitions(from_state: WorkItemState, to_state: WorkItemState) -> None:
    transition_or_raise(from_state=from_state, to_state=to_state, ctx=TransitionContext())


def test_rejects_invalid_transition_open_to_resolved() -> None:
    with pytest.raises(TransitionError):
        transition_or_raise(from_state=WorkItemState.OPEN, to_state=WorkItemState.RESOLVED, ctx=TransitionContext())


def test_rejects_close_without_rca() -> None:
    with pytest.raises(TransitionError):
        transition_or_raise(from_state=WorkItemState.RESOLVED, to_state=WorkItemState.CLOSED, ctx=TransitionContext())


def test_allows_close_with_rca_complete() -> None:
    transition_or_raise(
        from_state=WorkItemState.RESOLVED,
        to_state=WorkItemState.CLOSED,
        ctx=TransitionContext(rca_present=True, rca_complete=True),
    )

