"""Spec → outline + fill SVG strings.
Roles  b  body: stroke · filled in fill state      o  outline-only stroke
       fo fill-only body                           l  line: stroke in both states
       c  cut: stroke · knocked out of the fill    d  dot: solid in both states
       dc dot: solid · knocked out in fill         h  halo: stroke · in fill, a 1.75 gap is cut around it, drawn as stroke on top
       hs halo solid (filled shape)                hd halo dot"""
HEAD = ('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" '
        'stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">')
SOLID = ' fill="currentColor" stroke="none"/>'

def _a(el, attrs): return el.replace('/>', ' ' + attrs + '/>', 1)

def outline(els):
    out = []
    for role, el in els:
        if role == 'fo': continue
        if role in ('d', 'dc', 'hd'): out.append(_a(el, 'fill="currentColor" stroke="none"'))
        elif role == 'hs': out.append(_a(el, 'fill="currentColor"'))
        else: out.append(el)
    return ''.join(out)

def fill(name, els):
    R = lambda *rs: [e for r, e in els if r in rs]
    mask = (R('c'), R('dc'), R('h', 'hs', 'hd'))
    body = ''.join(_a(e, 'fill="currentColor"') for e in R('b', 'fo')) + ''.join(R('l'))
    if any(mask):
        mid = f'tf-{name}'
        m = (f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">'
             '<rect width="24" height="24" fill="#fff" stroke="none"/>'
             + ''.join(_a(e, 'stroke="#000"') for e in mask[0])
             + ''.join(_a(e, 'fill="#000" stroke="none"') for e in mask[1])
             + ''.join(_a(e, 'fill="#000" stroke="#000" stroke-width="5.25"') for e in mask[2]) + '</mask>')
        body = f'<defs>{m}</defs><g mask="url(#{mid})">{body}</g>'
    top = ''.join(_a(e, 'fill="currentColor" stroke="none"') for e in R('d', 'hd'))
    top += ''.join(R('h')) + ''.join(_a(e, 'fill="currentColor"') for e in R('hs'))
    return body + top

def doc(inner): return HEAD + inner + '</svg>'
