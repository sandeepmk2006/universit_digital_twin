from __future__ import annotations

from edubase_ml.allocation import (
    RoomResource,
    TimetableSlotDemand,
    parse_time_to_minutes,
    slots_overlap,
    solve_room_allocation,
)


def test_time_parsing_and_overlap():
    assert parse_time_to_minutes("09:30:00") == 570
    assert parse_time_to_minutes("10:00") == 600

    s1 = TimetableSlotDemand(
        id="s1", section_id="sec1", course_id="c1", weekday=1,
        starts_at="09:00:00", ends_at="10:00:00", required_capacity=30, requires_lab=False,
    )
    # Overlapping slot on same day
    s2 = TimetableSlotDemand(
        id="s2", section_id="sec2", course_id="c2", weekday=1,
        starts_at="09:30:00", ends_at="10:30:00", required_capacity=30, requires_lab=False,
    )
    # Consecutive non-overlapping slot on same day
    s3 = TimetableSlotDemand(
        id="s3", section_id="sec3", course_id="c3", weekday=1,
        starts_at="10:00:00", ends_at="11:00:00", required_capacity=30, requires_lab=False,
    )
    # Same time but different weekday
    s4 = TimetableSlotDemand(
        id="s4", section_id="sec4", course_id="c4", weekday=2,
        starts_at="09:00:00", ends_at="10:00:00", required_capacity=30, requires_lab=False,
    )

    assert slots_overlap(s1, s2) is True
    assert slots_overlap(s1, s3) is False
    assert slots_overlap(s1, s4) is False


def test_allocation_solver_constraints_respected():
    slots = [
        # Slot 1 requires lab
        TimetableSlotDemand(
            id="slot_lab", section_id="sec1", course_id="c_lab", weekday=1,
            starts_at="09:00:00", ends_at="10:00:00", required_capacity=30, requires_lab=True,
        ),
        # Slot 2 overlaps with Slot 1, requires large classroom
        TimetableSlotDemand(
            id="slot_large", section_id="sec2", course_id="c_large", weekday=1,
            starts_at="09:00:00", ends_at="10:00:00", required_capacity=50, requires_lab=False,
        ),
        # Slot 3 starts at 10:00, small class
        TimetableSlotDemand(
            id="slot_small", section_id="sec3", course_id="c_small", weekday=1,
            starts_at="10:00:00", ends_at="11:00:00", required_capacity=20, requires_lab=False,
        ),
    ]

    rooms = [
        RoomResource(id="room_lab", code="L101", kind="lab", capacity=40),
        RoomResource(id="room_big", code="C201", kind="classroom", capacity=60),
        RoomResource(id="room_small", code="C101", kind="classroom", capacity=25),
    ]

    status, assignments, objective, stats = solve_room_allocation(slots, rooms)

    assert status == "OPTIMAL"
    assert len(assignments) == 3

    assign_map = {a["slot_id"]: a["room_id"] for a in assignments}

    # Lab requirement respected: slot_lab MUST get room_lab
    assert assign_map["slot_lab"] == "room_lab"

    # Capacity requirement respected: slot_large needs >= 50, only room_big fits
    assert assign_map["slot_large"] == "room_big"

    # Minimal wasted seats: slot_small needs 20, room_small (25) wastes 5 seats
    assert assign_map["slot_small"] == "room_small"

    # Overlap respected: slot_lab and slot_large run at same time, have different rooms
    assert assign_map["slot_lab"] != assign_map["slot_large"]

    # Objective = (40-30) + (60-50) + (25-20) = 10 + 10 + 5 = 25
    assert objective == 25.0


def test_allocation_infeasible_when_capacity_exceeded():
    slots = [
        TimetableSlotDemand(
            id="slot_oversized", section_id="sec1", course_id="c1", weekday=1,
            starts_at="09:00:00", ends_at="10:00:00", required_capacity=100, requires_lab=False,
        )
    ]
    rooms = [
        RoomResource(id="room1", code="C101", kind="classroom", capacity=60)
    ]

    status, assignments, objective, stats = solve_room_allocation(slots, rooms)
    assert status == "INFEASIBLE"
    assert len(assignments) == 0


def test_allocation_overlap_clash_infeasible():
    # Two overlapping slots needing lab, only 1 lab room available
    slots = [
        TimetableSlotDemand(
            id="s1", section_id="sec1", course_id="c1", weekday=1,
            starts_at="09:00:00", ends_at="10:00:00", required_capacity=30, requires_lab=True,
        ),
        TimetableSlotDemand(
            id="s2", section_id="sec2", course_id="c2", weekday=1,
            starts_at="09:30:00", ends_at="10:30:00", required_capacity=30, requires_lab=True,
        ),
    ]
    rooms = [
        RoomResource(id="room_lab", code="L101", kind="lab", capacity=40)
    ]

    status, assignments, objective, stats = solve_room_allocation(slots, rooms)
    assert status in ("INFEASIBLE", "MODEL_INVALID")
    assert len(assignments) == 0
