from __future__ import annotations

from dataclasses import dataclass
from datetime import time
import json
from typing import Any
from ortools.sat.python import cp_model

from .db import get_connection


@dataclass
class TimetableSlotDemand:
    id: str
    section_id: str
    course_id: str
    weekday: int
    starts_at: time | str
    ends_at: time | str
    required_capacity: int
    requires_lab: bool


@dataclass
class RoomResource:
    id: str
    code: str
    kind: str
    capacity: int
    is_available: bool = True


def parse_time_to_minutes(t: time | str) -> int:
    """Convert time object or 'HH:MM:SS' string into minutes from midnight."""
    if isinstance(t, str):
        parts = t.split(":")
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
        return h * 60 + m
    return t.hour * 60 + t.minute


def slots_overlap(s1: TimetableSlotDemand, s2: TimetableSlotDemand) -> bool:
    """Return True if two slots occur on the same weekday and overlap in time."""
    if s1.weekday != s2.weekday:
        return False
    start1 = parse_time_to_minutes(s1.starts_at)
    end1 = parse_time_to_minutes(s1.ends_at)
    start2 = parse_time_to_minutes(s2.starts_at)
    end2 = parse_time_to_minutes(s2.ends_at)
    return max(start1, start2) < min(end1, end2)


def is_room_eligible(slot: TimetableSlotDemand, room: RoomResource) -> bool:
    """Check if a room meets availability, capacity, and lab requirements."""
    if not room.is_available:
        return False
    if room.capacity < slot.required_capacity:
        return False
    if slot.requires_lab and room.kind != "lab":
        return False
    # If not requiring lab, prefer educational rooms (not office/hostel_room)
    if room.kind in ("office", "hostel_room"):
        return False
    return True


def solve_room_allocation(
    slots: list[TimetableSlotDemand],
    rooms: list[RoomResource],
    time_limit_seconds: float = 20.0,
) -> tuple[str, list[dict[str, str]], float, dict[str, Any]]:
    """Solve room assignment using OR-Tools CP-SAT minimizing wasted seats."""
    if not slots:
        return "OPTIMAL", [], 0.0, {"total_slots": 0, "assigned_slots": 0, "wasted_seats": 0}

    model = cp_model.CpModel()

    # Decision variables: x[(s.id, r.id)] = 1 if slot s is assigned to room r
    x: dict[tuple[str, str], cp_model.IntVar] = {}
    eligible_rooms_by_slot: dict[str, list[RoomResource]] = {}

    for s in slots:
        eligible = [r for r in rooms if is_room_eligible(s, r)]
        eligible_rooms_by_slot[s.id] = eligible
        if not eligible:
            # Infeasible: at least one slot has no valid room
            return (
                "INFEASIBLE",
                [],
                0.0,
                {
                    "error": f"No eligible room found for slot {s.id} (capacity {s.required_capacity}, lab={s.requires_lab})",
                    "total_slots": len(slots),
                },
            )
        for r in eligible:
            x[(s.id, r.id)] = model.NewBoolVar(f"x_{s.id}_{r.id}")

    # Constraint 1: Each slot must be assigned to exactly one room
    for s in slots:
        model.Add(sum(x[(s.id, r.id)] for r in eligible_rooms_by_slot[s.id]) == 1)

    # Constraint 2: No two overlapping slots can share the same room
    n_slots = len(slots)
    for i in range(n_slots):
        for j in range(i + 1, n_slots):
            s1 = slots[i]
            s2 = slots[j]
            if slots_overlap(s1, s2):
                common_rooms = set(r.id for r in eligible_rooms_by_slot[s1.id]) & set(
                    r.id for r in eligible_rooms_by_slot[s2.id]
                )
                for r_id in common_rooms:
                    model.Add(x[(s1.id, r_id)] + x[(s2.id, r_id)] <= 1)

    # Objective: Minimize wasted seats: sum( (room.capacity - slot.required_capacity) * x )
    objective_terms = []
    room_map = {r.id: r for r in rooms}
    for (s_id, r_id), var in x.items():
        slot_obj = next(s for s in slots if s.id == s_id)
        room_obj = room_map[r_id]
        wasted = room_obj.capacity - slot_obj.required_capacity
        objective_terms.append(var * wasted)

    model.Minimize(sum(objective_terms))

    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds

    status_code = solver.Solve(model)
    status_str = solver.StatusName(status_code)

    if status_code in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        assignments: list[dict[str, str]] = []
        for (s_id, r_id), var in x.items():
            if solver.Value(var) == 1:
                assignments.append({"slot_id": s_id, "room_id": r_id})

        wasted_seats = float(solver.ObjectiveValue())
        stats = {
            "total_slots": len(slots),
            "assigned_slots": len(assignments),
            "wasted_seats": wasted_seats,
            "wall_time_seconds": round(solver.WallTime(), 3),
            "status": status_str,
        }
        return status_str, assignments, wasted_seats, stats

    return (
        status_str,
        [],
        0.0,
        {
            "total_slots": len(slots),
            "assigned_slots": 0,
            "error": "Solver could not find feasible assignment within time limit",
            "status": status_str,
        },
    )


def allocate_rooms_for_term(term_id: str) -> dict[str, Any]:
    """Load slots and rooms for term from PostgreSQL, run CP-SAT allocation, persist run and return."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            # 1. Fetch timetable slots of the term
            cur.execute(
                """
                SELECT t.id, t.section_id, t.weekday, t.starts_at, t.ends_at,
                       cs.course_id, cs.capacity as section_capacity,
                       c.requires_lab,
                       coalesce(count(e.id), 0) as enrollment_count
                FROM public.timetable_slots t
                JOIN public.course_sections cs ON cs.id = t.section_id
                JOIN public.courses c ON c.id = cs.course_id
                LEFT JOIN public.enrollments e ON e.section_id = cs.id
                WHERE cs.term_id = %s
                GROUP BY t.id, t.section_id, t.weekday, t.starts_at, t.ends_at,
                         cs.course_id, cs.capacity, c.requires_lab
                """,
                (term_id,),
            )
            slot_rows = cur.fetchall()

            slots: list[TimetableSlotDemand] = []
            for r in slot_rows:
                enr = int(r["enrollment_count"])
                sec_cap = int(r["section_capacity"] or 60)
                req_cap = enr if enr > 0 else sec_cap
                slots.append(
                    TimetableSlotDemand(
                        id=str(r["id"]),
                        section_id=str(r["section_id"]),
                        course_id=str(r["course_id"]),
                        weekday=int(r["weekday"]),
                        starts_at=r["starts_at"],
                        ends_at=r["ends_at"],
                        required_capacity=req_cap,
                        requires_lab=bool(r["requires_lab"]),
                    )
                )

            # 2. Fetch available rooms
            cur.execute(
                """
                SELECT id, code, kind, capacity, is_available
                FROM public.rooms
                WHERE is_available = true
                """
            )
            room_rows = cur.fetchall()
            rooms = [
                RoomResource(
                    id=str(r["id"]),
                    code=r["code"],
                    kind=str(r["kind"]),
                    capacity=int(r["capacity"]),
                    is_available=bool(r["is_available"]),
                )
                for r in room_rows
            ]

        status_str, assignments, objective, stats = solve_room_allocation(
            slots, rooms, time_limit_seconds=20.0
        )

        run_id = None
        if assignments:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.room_allocation_runs
                        (term_id, status, objective, assignments)
                    VALUES (%s, 'proposed', %s, %s)
                    RETURNING id
                    """,
                    (term_id, objective, json.dumps(assignments)),
                )
                row = cur.fetchone()
                if row:
                    run_id = str(row["id"])
            conn.commit()

    return {
        "run_id": run_id,
        "term_id": term_id,
        "status": "proposed" if assignments else "failed",
        "objective": objective,
        "assignments": assignments,
        "stats": stats,
    }
