#!/bin/sh
# Run one SQL statement on the linked (staging) project and print only the rows (or the error message).
npx supabase db query --linked "$1" 2>&1 | python3 -c '
import sys, json
t = sys.stdin.read()
d = json.JSONDecoder()
i = t.find("{")
while i != -1:
    try:
        o, _ = d.raw_decode(t[i:]); break
    except ValueError:
        i = t.find("{", i + 1)
else:
    print(t[:1500]); sys.exit(1)
print(json.dumps(o.get("rows", o), ensure_ascii=False, indent=1, default=str))'
