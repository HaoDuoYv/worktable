"""
Pure-Python command recorder compatible with algorithm-visualizer JS protocol.
Loaded into Pyodide; visualize() returns the commands list via return value of run().
"""

from __future__ import annotations

import json
import random
import string
from typing import Any, List, Optional

_commands: List[dict] = []
_object_count = 0


def _rand_key() -> str:
    letters = string.ascii_lowercase + string.digits
    return "".join(random.choice(letters) for _ in range(8))


def init() -> None:
    global _commands, _object_count
    _commands = []
    _object_count = 0


def get_commands() -> List[dict]:
    return _commands


def _jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    # tracers serialize as their key
    if hasattr(value, "key"):
        return value.key
    return str(value)


class _Commander:
    def __init__(self) -> None:
        global _object_count
        _object_count += 1
        if _object_count > 100:
            raise RuntimeError("Too Many Objects")
        self.key = _rand_key()

    def _cmd(self, method: str, args: list) -> None:
        global _commands
        if len(_commands) > 1_000_000:
            raise RuntimeError("Too Many Commands")
        _commands.append(
            {
                "key": self.key,
                "method": method,
                "args": [_jsonable(a) for a in args],
            }
        )

    def destroy(self) -> None:
        global _object_count
        _object_count -= 1
        _commands.append({"key": self.key, "method": "destroy", "args": []})


class Tracer(_Commander):
    def __init__(self, title: Optional[str] = None) -> None:
        _Commander.__init__(self)
        # JS uses class name as method
        cls = type(self).__name__
        args: list = [] if title is None else [title]
        _commands.append(
            {
                "key": self.key,
                "method": cls,
                "args": [_jsonable(a) for a in args],
            }
        )

    @staticmethod
    def delay(line_number: Optional[int] = None) -> None:
        args = [] if line_number is None else [line_number]
        _commands.append({"key": None, "method": "delay", "args": args})


class LogTracer(Tracer):
    def set(self, log: str = "") -> None:
        self._cmd("set", [str(log)])

    def print(self, message: Any) -> None:
        self._cmd("print", [str(message)])

    def println(self, message: Any) -> None:
        self._cmd("println", [str(message)])


class Array1DTracer(Tracer):
    def set(self, array1d: Optional[list] = None) -> None:
        self._cmd("set", [list(array1d or [])])

    def patch(self, x: int, v: Any = None) -> None:
        args: list = [x] if v is None else [x, v]
        self._cmd("patch", args)

    def depatch(self, x: int) -> None:
        self._cmd("depatch", [x])

    def select(self, sx: int, ex: Optional[int] = None) -> None:
        args = [sx] if ex is None else [sx, ex]
        self._cmd("select", args)

    def deselect(self, sx: int, ex: Optional[int] = None) -> None:
        args = [sx] if ex is None else [sx, ex]
        self._cmd("deselect", args)


class Array2DTracer(Tracer):
    def set(self, array2d: Optional[list] = None) -> None:
        self._cmd("set", [list(array2d or [])])

    def patch(self, x: int, y: int, v: Any = None) -> None:
        args: list = [x, y] if v is None else [x, y, v]
        self._cmd("patch", args)

    def depatch(self, x: int, y: int) -> None:
        self._cmd("depatch", [x, y])

    def select(self, sx: int, sy: int, ex: Optional[int] = None, ey: Optional[int] = None) -> None:
        args: list = [sx, sy]
        if ex is not None:
            args.append(ex)
        if ey is not None:
            args.append(ey)
        self._cmd("select", args)

    def deselect(self, sx: int, sy: int, ex: Optional[int] = None, ey: Optional[int] = None) -> None:
        args: list = [sx, sy]
        if ex is not None:
            args.append(ex)
        if ey is not None:
            args.append(ey)
        self._cmd("deselect", args)

    def select_row(self, x: int, sy: int, ey: Optional[int] = None) -> None:
        args = [x, sy] if ey is None else [x, sy, ey]
        self._cmd("selectRow", args)

    def deselect_row(self, x: int, sy: int, ey: Optional[int] = None) -> None:
        args = [x, sy] if ey is None else [x, sy, ey]
        self._cmd("deselectRow", args)


class GraphTracer(Tracer):
    def set(self, array2d: Optional[list] = None) -> None:
        self._cmd("set", [list(array2d or [])])

    def directed(self, is_directed: bool = True) -> None:
        self._cmd("directed", [bool(is_directed)])

    def visit(self, target: int, source: Optional[int] = None, weight: Any = None) -> None:
        args: list = [target]
        if source is not None:
            args.append(source)
        if weight is not None:
            args.append(weight)
        self._cmd("visit", args)

    def leave(self, target: int, source: Optional[int] = None, weight: Any = None) -> None:
        args: list = [target]
        if source is not None:
            args.append(source)
        if weight is not None:
            args.append(weight)
        self._cmd("leave", args)

    def select(self, target: int, source: Optional[int] = None) -> None:
        args: list = [target] if source is None else [target, source]
        self._cmd("select", args)

    def deselect(self, target: int, source: Optional[int] = None) -> None:
        args: list = [target] if source is None else [target, source]
        self._cmd("deselect", args)


class TreeTracer(GraphTracer):
    """Binary tree / hierarchical tree — same protocol as Graph with tree layout."""


class _SeqTracer(Tracer):
    def set(self, array1d: Optional[list] = None) -> None:
        self._cmd("set", [list(array1d or [])])

    def select(self, sx: int, ex: Optional[int] = None) -> None:
        args = [sx] if ex is None else [sx, ex]
        self._cmd("select", args)

    def deselect(self, sx: int, ex: Optional[int] = None) -> None:
        args = [sx] if ex is None else [sx, ex]
        self._cmd("deselect", args)

    def patch(self, x: int, v: Any = None) -> None:
        args: list = [x] if v is None else [x, v]
        self._cmd("patch", args)

    def depatch(self, x: int) -> None:
        self._cmd("depatch", [x])


class StackTracer(_SeqTracer):
    def push(self, value: Any) -> None:
        self._cmd("push", [value])

    def pop(self) -> None:
        self._cmd("pop", [])


class QueueTracer(_SeqTracer):
    def enqueue(self, value: Any) -> None:
        self._cmd("enqueue", [value])

    def dequeue(self) -> None:
        self._cmd("dequeue", [])


class LinkedListTracer(_SeqTracer):
    def push(self, value: Any) -> None:
        self._cmd("push", [value])

    def unshift(self, value: Any) -> None:
        self._cmd("unshift", [value])

    def pop(self) -> None:
        self._cmd("pop", [])

    def shift(self) -> None:
        self._cmd("shift", [])


class CircularQueueTracer(_SeqTracer):
    def init(self, capacity: int) -> None:
        self._cmd("init", [int(capacity)])


class DequeTracer(_SeqTracer):
    def push_front(self, value: Any) -> None:
        self._cmd("pushFront", [value])

    def pop_front(self) -> None:
        self._cmd("popFront", [])

    def push_back(self, value: Any) -> None:
        self._cmd("pushBack", [value])

    def pop_back(self) -> None:
        self._cmd("popBack", [])


class StaticLinkedListTracer(Tracer):
    def init(self, capacity: int) -> None:
        self._cmd("init", [int(capacity)])

    def set(self, data: Optional[list] = None, nxt: Optional[list] = None) -> None:
        self._cmd("set", [list(data or []), list(nxt or [])])

    def set_data(self, i: int, v: Any) -> None:
        self._cmd("setData", [i, v])

    def set_next(self, i: int, v: Any) -> None:
        self._cmd("setNext", [i, v])

    def select(self, row: int, col: Optional[int] = None) -> None:
        args = [row] if col is None else [row, col]
        self._cmd("select", args)

    def deselect(self, row: int, col: Optional[int] = None) -> None:
        args = [row] if col is None else [row, col]
        self._cmd("deselect", args)


class RedBlackTreeTracer(GraphTracer):
    def set_color(self, node_id: int, color: str) -> None:
        self._cmd("setColor", [node_id, color])

    def set_label(self, node_id: int, text: Any) -> None:
        self._cmd("setLabel", [node_id, text])

    def rotate_left(self, x: int) -> None:
        self._cmd("rotateLeft", [x])

    def rotate_right(self, x: int) -> None:
        self._cmd("rotateRight", [x])


class BPlusTreeTracer(GraphTracer):
    def set_label(self, node_id: int, text: Any) -> None:
        self._cmd("setLabel", [node_id, text])

    def split(self, old_id: int, new_id: int, promote: Any, left_label: Any = None, right_label: Any = None) -> None:
        self._cmd("split", [old_id, new_id, promote, left_label, right_label])


class _Layout(_Commander):
    def __init__(self, children: Optional[list] = None) -> None:
        _Commander.__init__(self)
        child_keys = []
        for c in children or []:
            child_keys.append(c.key if hasattr(c, "key") else str(c))
        _commands.append(
            {
                "key": self.key,
                "method": type(self).__name__,
                "args": [child_keys],
            }
        )


class VerticalLayout(_Layout):
    def __init__(self, children: Optional[list] = None) -> None:
        _Layout.__init__(self, children)


class HorizontalLayout(_Layout):
    def __init__(self, children: Optional[list] = None) -> None:
        _Layout.__init__(self, children)


class Layout:
    @staticmethod
    def set_root(root: Any) -> None:
        key = root.key if hasattr(root, "key") else str(root)
        _commands.append({"key": None, "method": "setRoot", "args": [key]})

    # alias matching JS setRoot style
    setRoot = set_root


def visualize() -> str:
    """Return commands as JSON string for the host."""
    return json.dumps(get_commands(), ensure_ascii=False)
