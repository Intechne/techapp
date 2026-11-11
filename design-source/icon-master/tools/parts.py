"""Fill state as 3 separate groups for Illustrator Pathfinder: BODY (add) − CUT (minus) + TOP (add)."""
import os, sys, re
from spec import I
from build import _a
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
K = '#20241F'
for name, (cat, has_fill, els) in I.items():
    if not has_fill: continue
    R = lambda *rs: [e for r, e in els if r in rs]
    body = ''.join(_a(e, f'fill="{K}"') for e in R('b', 'fo')) + ''.join(R('l'))
    cut = (''.join(R('c')) + ''.join(_a(e, f'fill="{K}" stroke="none"') for e in R('dc'))
           + ''.join(_a(e, f'fill="{K}" stroke-width="5.25"') for e in R('h', 'hs'))
           + ''.join(re.sub(r'r="([\d.]+)"', lambda m: f'r="{float(m.group(1)) + 2.625:g}"', e).replace('/>', f' fill="{K}" stroke="none"/>') for e in R('hd')))
    top = (''.join(_a(e, f'fill="{K}" stroke="none"') for e in R('d', 'hd')) + ''.join(R('h'))
           + ''.join(_a(e, f'fill="{K}"') for e in R('hs')))
    g = lambda gid, s: f'<g id="{gid}">{s}</g>' if s else ''
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="{K}" '
           f'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect id="BG" x="0" y="0" width="24" height="24" fill="none" stroke="none"/>'
           + g('BODY', body) + g('CUT', cut) + g('TOP', top) + '</svg>')
    open(os.path.join(out, f'{cat}__{name}.fill.svg'), 'w').write(svg)
print('ok')
