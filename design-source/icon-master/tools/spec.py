"""TechApp icon family — Open Circuit v2. Single source of geometry. (category, has_fill, elements)"""
from geo import *
I = {}
def icon(name, cat, els, fill=False): I[name] = (cat, fill, els)

# ═════ NAVIGATION — her biri bir "düğüm" (node) taşır ═════
c = (12, 12); A = -45
tip, tail = P(9.6, A), P(4.6, A + 180); s1, s2 = P(3.1, A + 90), P(3.1, A - 90)
icon('discover', 'navigation', [('o', path(arc_ring(9, -22, 292))), ('fo', circle(12, 12, 9)),
     ('h', path(poly([tip, s1, tail, s2]))), ('hs', path(poly([tip, s1, s2])))], fill=True)
icon('event', 'navigation', [('b', rect(3.5, 5, 17, 16, 4)), ('l', path('M8 3v4M16 3v4')),
     ('c', path('M3.5 10.5h17')), ('dc', circle(15.5, 15.75, 1.9))], fill=True)
icon('opportunity', 'navigation', [('l', path('M5 21V6a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 6v15')),
     ('l', path('M3 21h18')), ('b', path('M5 7.25 12.5 9v10.75L5 21')), ('dc', circle(10.25, 14.75, 1.3))], fill=True)
icon('community', 'navigation', [('b', circle(7, 10.5, 2.6)), ('b', circle(17, 10.5, 2.6)),
     ('b', path('M3.25 20.5a3.75 3.75 0 0 1 7.5 0M13.25 20.5a3.75 3.75 0 0 1 7.5 0')), ('d', circle(12, 5, 1.6))], fill=True)
icon('profile', 'navigation', [('b', circle(12, 8.25, 3.75)), ('o', path('M5 20.5a7 7 0 0 1 11.4-5.45')),
     ('fo', path('M5 20.5a7 7 0 0 1 14 0z')), ('hd', circle(18.25, 18.75, 1.9))], fill=True)

# ═════ SYSTEM — saf, düğümsüz; yalnızca çizgi ═════
icon('search', 'system', [('b', circle(10.75, 10.75, 6.75)), ('l', path('M15.6 15.6 20 20'))])
icon('filter', 'system', [('l', path('M4 7h16M7 12h10M10 17h4'))])
g = []
for k in range(6):
    a = k * 60 - 90
    g += [P(6.6, a - 30 + 12), P(8.75, a - 11), P(8.75, a + 11), P(6.6, a + 30 - 12)]
icon('settings', 'system', [('b', path(rounded_poly(g, 0.9))), ('c', circle(12, 12, 2.75))], fill=True)
icon('bookmark', 'system', [('b', path('M6 5.5A2.5 2.5 0 0 1 8.5 3h7A2.5 2.5 0 0 1 18 5.5V21l-6-4.25L6 21z'))], fill=True)
icon('share', 'system', [('l', path('M12 14.5V3.5M8 7.5l4-4 4 4')),
     ('l', path('M8.5 10.5h-1A2.5 2.5 0 0 0 5 13v5.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V13a2.5 2.5 0 0 0-2.5-2.5h-1'))])
icon('bell', 'system', [('b', path('M18 16v-5.5a6 6 0 0 0-12 0V16l-1.5 2h15z')), ('l', path('M10 21h4'))], fill=True)
icon('edit', 'system', [('b', path('M15 4.5 19.5 9 9 19.5H4.5V15z')), ('c', path('M12.5 7l4.5 4.5'))])
icon('trash', 'system', [('l', path('M4 6.5h16M9.5 6.5V5A1.5 1.5 0 0 1 11 3.5h2A1.5 1.5 0 0 1 14.5 5v1.5')),
     ('b', path('M6 6.5l.9 12.2A2 2 0 0 0 8.9 20.5h6.2a2 2 0 0 0 2-1.8L18 6.5')), ('c', path('M10 10.5v6M14 10.5v6'))])
icon('plus', 'system', [('l', path('M12 5v14M5 12h14'))])
icon('close', 'system', [('l', path('M6.5 6.5l11 11M6.5 17.5l11-11'))])
icon('check', 'system', [('l', path('M5 12.5l4.5 4.5L19 7.5'))])
icon('back', 'system', [('l', path('M19 12H5M11 6l-6 6 6 6'))])
icon('arrow', 'system', [('l', path('M5 12h14M13 6l6 6-6 6'))])
icon('chevron', 'system', [('l', path('M9 5.5l6.5 6.5L9 18.5'))])
icon('link', 'system', [('l', path('M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1 1M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1-1'))])
icon('more', 'system', [('d', circle(5.5, 12, 1.6)), ('d', circle(12, 12, 1.6)), ('d', circle(18.5, 12, 1.6))])
icon('play', 'system', [('b', path(rounded_poly([(8, 5), (19.5, 12), (8, 19)], 1.2)))], fill=True)

# ═════ STATUS — tek çember (r 9) + tek işaret ═════
icon('success', 'status', [('b', circle(12, 12, 9)), ('c', path('M8 12.25l2.75 2.75L16 9.5'))], fill=True)
icon('error', 'status', [('b', circle(12, 12, 9)), ('c', path('M12 7.5v5.5')), ('dc', circle(12, 16.4, 1.15))], fill=True)
icon('info', 'status', [('b', circle(12, 12, 9)), ('c', path('M12 11v5.5')), ('dc', circle(12, 7.6, 1.15))], fill=True)
icon('warning', 'status', [('b', path(rounded_poly([(12, 3.25), (21, 19.75), (3, 19.75)], 2.2))),
     ('c', path('M12 9.5v4.25')), ('dc', circle(12, 16.75, 1.1))], fill=True)
icon('clock', 'status', [('b', circle(12, 12, 9)), ('c', path('M12 7.5V12l3 2'))], fill=True)
icon('offline', 'status', [('l', path('M11 9l3-3a3.54 3.54 0 0 1 5 5l-3 3M13 15l-3 3a3.54 3.54 0 0 1-5-5l3-3')),
     ('l', path('M8.25 3.5v2M3.5 8.25h2M15.75 20.5v-2M20.5 15.75h-2'))])

# ═════ ENTITIES — ürün nesneleri; karakter + düğüm ═════
icon('team', 'entities', [('b', circle(12, 10.5, 2.5)), ('b', path('M7 20.5a5 5 0 0 1 10 0')),
     ('b', circle(5.75, 7.75, 2)), ('b', circle(18.25, 7.75, 2)),
     ('l', path(f'M2.5 18 A3.5 3.5 0 0 1 {f(P(3.5,-70,(6,18))[0])} {f(P(3.5,-70,(6,18))[1])} M21.5 18 A3.5 3.5 0 0 0 {f(P(3.5,-110,(18,18))[0])} {f(P(3.5,-110,(18,18))[1])}'))], fill=True)
icon('mentor', 'entities', [('b', circle(8.5, 8.5, 3)), ('b', path('M3 20.5a5.5 5.5 0 0 1 11 0')),
     ('d', path('M17.5 4C17.85 6.4 18.6 7.15 21 7.5 18.6 7.85 17.85 8.6 17.5 11 17.15 8.6 16.4 7.85 14 7.5 16.4 7.15 17.15 6.4 17.5 4Z'))], fill=True)
seal = [P(9 if k % 2 == 0 else 7.4, k * 22.5 - 90) for k in range(16)]
icon('verified', 'entities', [('b', path(rounded_poly(seal, 1.1))), ('c', path('M8.5 12.25l2.5 2.5 4.5-5'))], fill=True)
icon('experience', 'entities', [('l', path('M4 20h5v-5h5v-5h5')), ('d', circle(19, 5.25, 1.75))])
hexv = [P(9, a) for a in (-90, -30, 30, 90, 150, 210)]
icon('project', 'entities', [('b', path(rounded_poly(hexv, 1.4))), ('c', path(f'M{f(hexv[5][0]+.9)} {f(hexv[5][1]+.52)} L12 12 L{f(hexv[1][0]-.9)} {f(hexv[1][1]+.52)} M12 12 V20.1'))], fill=True)
icon('calendar', 'entities', [('b', rect(3.5, 5, 17, 16, 4)), ('l', path('M8 3v4M16 3v4')), ('c', path('M3.5 10.5h17'))], fill=True)
PIN = 'M12 21.25C12 21.25 5.25 15.4 5.25 10A6.75 6.75 0 0 1 18.75 10C18.75 15.4 12 21.25 12 21.25Z'
icon('location', 'entities', [('b', path(PIN)), ('dc', circle(12, 10, 2.1))], fill=True)
icon('in-person', 'entities', [('b', path('M12 17C12 17 6.75 12.75 6.75 8.75A5.25 5.25 0 0 1 17.25 8.75C17.25 12.75 12 17 12 17Z')),
     ('dc', circle(12, 8.75, 1.75)),
     ('l', path('M8 17.1C5.3 17.5 3.5 18.25 3.5 19.15 3.5 20.3 7.3 21.25 12 21.25S20.5 20.3 20.5 19.15C20.5 18.25 18.7 17.5 16 17.1'))], fill=True)
icon('online', 'entities', [('b', rect(3, 4, 18, 12.5, 3)), ('l', path('M9 20.5h6M12 16.5v4')),
     ('dc', circle(12, 10.25, 1.5)), ('c', path(arc_ring(3.6, 145, 215, (12, 10.25)) + arc_ring(3.6, -35, 35, (12, 10.25))))], fill=True)
icon('application', 'entities', [('b', path('M13.5 3.5H8A2 2 0 0 0 6 5.5v13A2 2 0 0 0 8 20.5h8a2 2 0 0 0 2-2V8z')),
     ('c', path('M13.5 3.5V7a1 1 0 0 0 1 1H18')), ('c', path('M9.25 12.5h5.5M9.25 16h3.5'))], fill=True)
icon('task', 'entities', [('l', path('M4 7.25l1.75 1.75L9.25 5.5M12.75 7.25H20M12.75 16.5H20')), ('b', rect(4, 14, 5, 5, 1.5))])
icon('badge', 'entities', [('b', circle(12, 9, 5.75)), ('l', path('M8.7 13.71 7.5 21l4.5-2.5 4.5 2.5-1.2-7.29')),
     ('dc', circle(12, 9, 1.75))], fill=True)
qr = [('b', rect(3.5, 3.5, 6.5, 6.5, 2)), ('b', rect(14, 3.5, 6.5, 6.5, 2)), ('b', rect(3.5, 14, 6.5, 6.5, 2))]
qr += [('dc', circle(6.75, 6.75, 1.1)), ('dc', circle(17.25, 6.75, 1.1)), ('dc', circle(6.75, 17.25, 1.1))]
qr += [('d', circle(x, y, 1.05)) for x, y in [(15, 15), (19.5, 15), (17.25, 17.25), (15, 19.5), (19.5, 19.5)]]
icon('qr', 'entities', qr, fill=True)
icon('ticket', 'entities', [('b', path('M3.5 8a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v1.75a2.25 2.25 0 0 0 0 4.5V16a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-1.75a2.25 2.25 0 0 0 0-4.5z')),
     ('dc', circle(15, 9.25, .95)), ('dc', circle(15, 12, .95)), ('dc', circle(15, 14.75, .95))], fill=True)
icon('shield', 'entities', [('b', path('M12 3.25 18.75 5.9V11.4C18.75 15.6 15.9 18.9 12 20.75 8.1 18.9 5.25 15.6 5.25 11.4V5.9Z')),
     ('c', path('M9 12l2.25 2.25 4-4.25'))], fill=True)
icon('learn', 'entities', [('b', path('M12 8.5C10.25 7.3 7.75 6.75 4 7v12c3.75-.25 6.25.3 8 1.5M12 8.5c1.75-1.2 4.25-1.75 8-1.5v12c-3.75-.25-6.25.3-8 1.5')),
     ('c', path('M12 8.5v12')), ('d', circle(12, 4, 1.6))], fill=True)
icon('robot', 'entities', [('b', rect(4.5, 7, 15, 12.5, 4)), ('l', path('M12 7V4.75')), ('d', circle(12, 3.5, 1.5)),
     ('dc', circle(9.25, 12.5, 1.3)), ('dc', circle(14.75, 12.5, 1.3)), ('c', path('M10.25 16h3.5'))], fill=True)
R45 = lambda p: rot(p, 45)
body = xform_path('M12 2.75 C15.25 5 16.25 9 15.5 15.5 L8.5 15.5 C7.75 9 8.75 5 12 2.75 Z', R45)
fins = xform_path('M8.35 12.25 L5.5 15.25 L5.5 18.25 L8.5 15.5 M15.65 12.25 L18.5 15.25 L18.5 18.25 L15.5 15.5', R45)
flame = xform_path('M12 18.25 L12 20.75', R45); wc = R45((12, 9.25))
icon('rocket', 'entities', [('b', path(body)), ('l', path(fins)), ('l', path(flame)), ('c', circle(wc[0], wc[1], 1.75))], fill=True)
icon('code', 'entities', [('l', path('M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14'))])
icon('leaf', 'entities', [('b', path('M5 19C5 10 10 5 19 5c0 9-5 14-14 14z')), ('l', path('M3.5 20.5 5 19')), ('c', path('M5 19 14 10'))], fill=True)
icon('spark', 'entities', [('b', path('M12 3.5C12.55 8.6 15.4 11.45 20.5 12 15.4 12.55 12.55 15.4 12 20.5 11.45 15.4 8.6 12.55 3.5 12 8.6 11.45 11.45 8.6 12 3.5Z'))], fill=True)
icon('mark', 'entities', [('d', path('M5 5h14v5h-5v9H9V10H5z')), ('d', circle(19, 18, 2))])
