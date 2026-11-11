"""Contact sheet: each icon at 6x with 24px grid + live area, plus 1x/2x on light & dark."""
import sys, re, glob, os, io
import resvg_py
from PIL import Image, ImageDraw, ImageFont

def svg_png(svg, px):
    return Image.open(io.BytesIO(bytes(resvg_py.svg_to_bytes(svg_string=svg, width=px, height=px)))).convert('RGBA')

def wrap(inner, color, fill='none'):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="{fill}" stroke="{color}" '
            f'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" color="{color}">'
            + inner.replace('currentColor', color).replace('var(--surface,white)', '#FFFFFF') + '</svg>')

def inner_of(path):
    s = open(path).read()
    return re.sub(r'^[\s\S]*?<svg[^>]*>', '', s).replace('</svg>', '').strip()

def font(sz):
    for f in ['/System/Library/Fonts/SFNSMono.ttf', '/System/Library/Fonts/Menlo.ttc']:
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()

def sheet(items, out, cols=6, title=''):
    S = 6; big = 24 * S; cw, ch = big + 150, big + 70
    rows = (len(items) + cols - 1) // cols
    W, H = cols * cw + 40, rows * ch + 90
    im = Image.new('RGB', (W, H), '#F6F7F2'); d = ImageDraw.Draw(im)
    d.text((20, 20), title, fill='#20241F', font=font(26))
    for i, (name, inner, filled_inner) in enumerate(items):
        x0, y0 = 20 + (i % cols) * cw, 70 + (i // cols) * ch
        # grid
        d.rectangle([x0, y0, x0 + big, y0 + big], fill='#FFFFFF')
        for k in range(25):
            c = '#E3E6DD' if k % 4 else '#CFD3C7'
            d.line([x0 + k * S, y0, x0 + k * S, y0 + big], fill=c); d.line([x0, y0 + k * S, x0 + big, y0 + k * S], fill=c)
        d.rectangle([x0 + 2 * S, y0 + 2 * S, x0 + 22 * S, y0 + 22 * S], outline='#F2B8A0')
        d.line([x0 + 12 * S, y0, x0 + 12 * S, y0 + big], fill='#F2B8A0'); d.line([x0, y0 + 12 * S, x0 + big, y0 + 12 * S], fill='#F2B8A0')
        g = svg_png(wrap(inner, '#4B46D6'), big)
        g.putalpha(g.getchannel('A').point(lambda a: int(a * .85)))
        im.paste(g, (x0, y0), g)
        # small sizes
        sx = x0 + big + 14
        for j, (bg, fg) in enumerate([('#FFFFFF', '#20241F'), ('#20241F', '#F6F7F2')]):
            yy = y0 + j * 74
            d.rectangle([sx, yy, sx + 124, yy + 66], fill=bg)
            for px, ox in [(16, 6), (24, 28), (48, 60)]:
                ic = svg_png(wrap(inner, fg), px); im.paste(ic, (sx + ox, yy + (66 - px) // 2), ic)
        if filled_inner is not None:
            ic = svg_png(wrap(filled_inner, '#4B46D6', fill='none'), 48); im.paste(ic, (sx + 70, y0 + 150 - 4), ic)
        d.text((x0, y0 + big + 8), name, fill='#20241F', font=font(18))
    im.save(out)

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    files = sorted(glob.glob(os.path.join(src, '**/*.svg'), recursive=True))
    items = [(os.path.basename(f)[:-4], inner_of(f), None) for f in files if not f.endswith('.fill.svg')]
    sheet(items, out, title=sys.argv[3] if len(sys.argv) > 3 else '')
