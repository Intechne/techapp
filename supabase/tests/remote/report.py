"""Pretty-print the REMOTE_RESULT / PROBE_RESULT carried in a `supabase db query` error (stdin)."""
import json, re, sys

raw = sys.stdin.read()
try:
    msg = json.loads(raw[raw.find('{'):])['error']['message']
    inner = json.loads(msg[msg.find('{'):])['message']
except Exception:
    print(raw[:2000]); sys.exit(2)
m = re.search(r'(REMOTE_RESULT|PROBE_RESULT) (\{.*\})', inner)
if not m:
    print('NO RESULT — the run failed before reporting:\n' + inner[:2000]); sys.exit(2)
data = json.loads(m.group(2))
if 'results' not in data:
    print(json.dumps(data, ensure_ascii=False, indent=1)); sys.exit(0)
for r in data.get('results', []):
    print(('PASS ' if r['ok'] else 'FAIL ') + r['t'] + ('' if r['ok'] else '   ← ' + str(r['d'])))
print(f"\n{data.get('pass')} passed, {data.get('fail')} failed")
sys.exit(1 if data.get('fail') else 0)
