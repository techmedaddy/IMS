from __future__ import annotations

from dataclasses import dataclass

from ims.db.models import WorkItemState


_ALLOWED: dict[WorkItemState, set[WorkItemState]] = {
    WorkItemState.OPEN: {WorkItemState.INVESTIGATING},
    WorkItemState.INVESTIGATING: {WorkItemState.RESOLVED},
    WorkItemState.RESOLVED: {WorkItemState.CLOSED},
    WorkItemState.CLOSED: set(),
}


def is_valid_transition(from_state: WorkItemState, to_state: WorkItemState) -> bool:
    # Shim for existing codepaths/tests: delegate to the class-based state machine.
    return to_state in _ALLOWED.get(from_state, set())


class TransitionError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class TransitionContext:
    rca_present: bool = False
    rca_complete: bool = False


class IncidentState:
    def allowed_transitions(self) -> set[WorkItemState]:
        raise NotImplementedError

    def can_transition(self, to_state: WorkItemState, ctx: TransitionContext) -> bool:
        return to_state in self.allowed_transitions()

    def on_enter(self, to_state: WorkItemState, ctx: TransitionContext) -> None:
        # Hook point for side-effects/validation.
        return


class OpenState(IncidentState):
    def allowed_transitions(self) -> set[WorkItemState]:
        return {WorkItemState.INVESTIGATING}


class InvestigatingState(IncidentState):
    def allowed_transitions(self) -> set[WorkItemState]:
        return {WorkItemState.RESOLVED}


class ResolvedState(IncidentState):
    def allowed_transitions(self) -> set[WorkItemState]:
        return {WorkItemState.CLOSED}

    def can_transition(self, to_state: WorkItemState, ctx: TransitionContext) -> bool:
        if to_state != WorkItemState.CLOSED:
            return False
        return ctx.rca_present and ctx.rca_complete


class ClosedState(IncidentState):
    def allowed_transitions(self) -> set[WorkItemState]:
        return set()


_STATE_IMPL: dict[WorkItemState, IncidentState] = {
    WorkItemState.OPEN: OpenState(),
    WorkItemState.INVESTIGATING: InvestigatingState(),
    WorkItemState.RESOLVED: ResolvedState(),
    WorkItemState.CLOSED: ClosedState(),
}


def state_for(work_item_state: WorkItemState) -> IncidentState:
    return _STATE_IMPL.get(work_item_state, ClosedState())


def transition_or_raise(
    *,
    from_state: WorkItemState,
    to_state: WorkItemState,
    ctx: TransitionContext,
) -> None:
    current = state_for(from_state)
    if not current.can_transition(to_state, ctx):
        raise TransitionError(f"Invalid transition {from_state.value} -> {to_state.value}")
    current.on_enter(to_state, ctx)
