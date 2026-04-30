from __future__ import annotations

from ims.domain.rca import can_close_incident


def test_reject_close_if_rca_missing_or_incomplete() -> None:
    assert can_close_incident(rca_present=False, rca_complete=False) is False
    assert can_close_incident(rca_present=True, rca_complete=False) is False


def test_allow_close_if_rca_present_and_complete() -> None:
    assert can_close_incident(rca_present=True, rca_complete=True) is True
