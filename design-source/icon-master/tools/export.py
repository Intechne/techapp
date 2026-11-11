"""Write spec → design-source/icons/<category>/<name>.svg (+ .fill.svg). Clears old flat files."""
import os, glob, sys
from spec import I
from build import outline, fill, doc
root = sys.argv[1]
for f in glob.glob(os.path.join(root, '*.svg')) + glob.glob(os.path.join(root, '*/*.svg')): os.remove(f)
n = 0
for name, (cat, has_fill, els) in I.items():
    d = os.path.join(root, cat); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, f'{name}.svg'), 'w').write(doc(outline(els)) + '\n'); n += 1
    if has_fill: open(os.path.join(d, f'{name}.fill.svg'), 'w').write(doc(fill(name, els)) + '\n'); n += 1
print(n, 'files')
