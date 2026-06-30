#!/usr/bin/env python3
"""Generate a 1024x1024 placeholder clock icon (RGBA PNG, stdlib only)."""
import math
import struct
import zlib

N = 1024
cx = cy = N / 2

# Palette
INDIGO = (94, 92, 230)      # face
WHITE = (245, 245, 247)
TRANSPARENT = (0, 0, 0, 0)

R_FACE = 470.0
R_RING_OUT = 470.0
R_RING_IN = 430.0
HAND_W = 26.0


def smooth(edge, d, soft=2.0):
    """Return coverage 0..1 for a point d inside `edge` with soft falloff."""
    return max(0.0, min(1.0, (edge - d) / soft + 0.5))


def point_line_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    seg = dx * dx + dy * dy
    if seg == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


# Clock hands: minute pointing up, hour pointing to ~2 o'clock.
min_end = (cx, cy - 300)
hour_end = (cx + 210, cy - 120)

rows = []
for y in range(N):
    row = bytearray()
    for x in range(N):
        fx, fy = x + 0.5, y + 0.5
        d = math.hypot(fx - cx, fy - cy)

        r = g = b = 0
        a = 0.0

        # Face disc
        face_a = smooth(R_FACE, d)
        if face_a > 0:
            r, g, b = INDIGO
            a = face_a

        # White ring near the rim
        if R_RING_IN - 4 <= d <= R_RING_OUT + 2:
            ring_a = min(smooth(R_RING_OUT, d), smooth(d, R_RING_IN, 2.0))
            if ring_a > 0:
                r, g, b = WHITE
                a = max(a, ring_a)

        # Hands (only over the face)
        if face_a > 0:
            dm = point_line_dist(fx, fy, cx, cy, *min_end)
            dh = point_line_dist(fx, fy, cx, cy, *hour_end)
            hand = max(smooth(HAND_W, dm), smooth(HAND_W, dh))
            if hand > 0:
                r, g, b = WHITE
                a = max(a, hand * face_a)

        # Center hub
        if d < 34:
            r, g, b = WHITE
            a = max(a, smooth(34, d))

        ai = int(round(a * 255))
        row += bytes((r, g, b, ai))
    rows.append(bytes(row))

# Encode PNG
raw = bytearray()
for row in rows:
    raw.append(0)  # filter type 0
    raw += row

def chunk(tag, data):
    c = struct.pack(">I", len(data)) + tag + data
    return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", N, N, 8, 6, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
png += chunk(b"IEND", b"")

with open("icon-src.png", "wb") as f:
    f.write(png)
print("wrote icon-src.png")
