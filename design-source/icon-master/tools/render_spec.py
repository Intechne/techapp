import sys
from spec import I
from board import board
cats = ['navigation', 'system', 'status', 'entities']
items = [(f'{n}  ·  {I[n][0]}{"  · fill" if I[n][1] else ""}', I[n][2]) for c in cats for n in I if I[n][0] == c]
board(items, sys.argv[1], cols=4, title=f'OPEN CIRCUIT v2 — {len(items)} icons · outline · fill · 22/16 px')
