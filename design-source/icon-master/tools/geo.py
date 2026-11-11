"""Geometry helpers for the TechApp icon spec (all coords on the 24×24 grid)."""
import math, re

def f(v):
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s

def P(r, deg, c=(12, 12)):
    a = math.radians(deg); return (c[0] + r * math.cos(a), c[1] + r * math.sin(a))

def pts(*ps):
    return ' '.join(f'{f(x)} {f(y)}' for x, y in ps)

def poly(ps, close=True):
    return 'M' + ' L'.join(f'{f(x)} {f(y)}' for x, y in ps) + (' Z' if close else '')

def arc_ring(r, a0, a1, c=(12, 12)):
    """Open circular arc from angle a0 to a1 (degrees, clockwise on screen)."""
    x0, y0 = P(r, a0, c); x1, y1 = P(r, a1, c)
    large = 1 if (a1 - a0) % 360 > 180 else 0
    return f'M{f(x0)} {f(y0)} A{f(r)} {f(r)} 0 {large} 1 {f(x1)} {f(y1)}'

def rot(p, deg, c=(12, 12)):
    a = math.radians(deg); x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * math.cos(a) - y * math.sin(a), c[1] + x * math.sin(a) + y * math.cos(a))

def xform_path(d, fn):
    """Apply point fn to an absolute-command path (M L C Q Z only)."""
    toks = re.findall(r'[MLCQZ]|-?\d*\.?\d+', d)
    out, i, cmd = [], 0, None
    while i < len(toks):
        t = toks[i]
        if t in 'MLCQZ':
            cmd = t; out.append(t); i += 1
            if t == 'Z': continue
            continue
        x, y = fn((float(toks[i]), float(toks[i + 1]))); out.append(f'{f(x)} {f(y)}'); i += 2
    return re.sub(r'([MLCQZ]) ', r'\1', ' '.join(out))

def circle(cx, cy, r):
    return f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"/>'

def path(d):
    return f'<path d="{d}"/>'

def rect(x, y, w, h, rx):
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="{f(rx)}"/>'

def rounded_poly(ps, r):
    """Closed polygon with circular-arc corners of radius r (handles convex + concave vertices)."""
    n = len(ps); segs = []
    for i in range(n):
        a, v, b = ps[i - 1], ps[i], ps[(i + 1) % n]
        u1 = (a[0] - v[0], a[1] - v[1]); u2 = (b[0] - v[0], b[1] - v[1])
        l1, l2 = math.hypot(*u1), math.hypot(*u2)
        u1 = (u1[0] / l1, u1[1] / l1); u2 = (u2[0] / l2, u2[1] / l2)
        ang = math.acos(max(-1, min(1, u1[0] * u2[0] + u1[1] * u2[1])))
        d = min(r / math.tan(ang / 2), l1 * .45, l2 * .45); rr = d * math.tan(ang / 2)
        p_in = (v[0] + u1[0] * d, v[1] + u1[1] * d); p_out = (v[0] + u2[0] * d, v[1] + u2[1] * d)
        cross = (v[0] - a[0]) * (b[1] - v[1]) - (v[1] - a[1]) * (b[0] - v[0])
        segs.append((p_in, p_out, rr, 1 if cross > 0 else 0))
    d = f'M{f(segs[0][1][0])} {f(segs[0][1][1])}'
    for k in range(1, n + 1):
        p_in, p_out, rr, sw = segs[k % n]
        d += f' L{f(p_in[0])} {f(p_in[1])} A{f(rr)} {f(rr)} 0 0 {sw} {f(p_out[0])} {f(p_out[1])}'
    return d + ' Z'
