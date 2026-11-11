import sys, io, importlib
import resvg_py
from PIL import Image, ImageDraw
from build import outline, fill
from sheet import font, svg_png

def wrap(inner, color):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="1.75" '
            f'stroke-linecap="round" stroke-linejoin="round">' + inner.replace('currentColor', color) + '</svg>')

def board(items, out, cols=3, title=''):
    """items: list of (label, els). Shows outline 6x on grid, fill 6x, tab-bar strip at 22/16px light+dark."""
    S = 6; big = 144; cw, ch = big * 2 + 230, big + 64
    rows = (len(items) + cols - 1) // cols
    im = Image.new('RGB', (cols * cw + 30, rows * ch + 80), '#F6F7F2'); d = ImageDraw.Draw(im)
    d.text((20, 18), title, fill='#20241F', font=font(26))
    for i, (label, els) in enumerate(items):
        x0, y0 = 20 + (i % cols) * cw, 66 + (i // cols) * ch
        for k, inner in enumerate([outline(els), fill(f'x{i}', els)]):
            xx = x0 + k * (big + 8)
            d.rectangle([xx, y0, xx + big, y0 + big], fill='#FFFFFF')
            for q in range(25):
                c = '#EDEFE8' if q % 4 else '#D9DCD2'
                d.line([xx + q * S, y0, xx + q * S, y0 + big], fill=c); d.line([xx, y0 + q * S, xx + big, y0 + q * S], fill=c)
            d.rectangle([xx + 12, y0 + 12, xx + 132, y0 + 132], outline='#F4C7B4')
            g = svg_png(wrap(inner, '#4B46D6'), big); im.paste(g, (xx, y0), g)
        sx = x0 + 2 * big + 18
        for j, (bg, fg, ac) in enumerate([('#FFFFFF', '#666D66', '#4B46D6'), ('#20241F', '#9BA29B', '#D9F36E')]):
            yy = y0 + j * 72
            d.rectangle([sx, yy, sx + 196, yy + 64], fill=bg)
            for n, (inner, col, px) in enumerate([(outline(els), fg, 22), (fill(f'y{i}{j}', els), ac, 22), (outline(els), fg, 16), (fill(f'z{i}{j}', els), ac, 16)]):
                ic = svg_png(wrap(inner, col), px); im.paste(ic, (sx + 12 + n * 46, yy + (64 - px) // 2), ic)
        d.text((x0, y0 + big + 8), label, fill='#20241F', font=font(17))
    im.save(out)

if __name__ == '__main__':
    mod = importlib.import_module(sys.argv[1])
    board(list(mod.C.items()), sys.argv[2], title=sys.argv[3])
