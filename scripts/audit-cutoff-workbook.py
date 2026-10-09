"""Compare every baseline slot with the specified public NAVI workbook, without editing it."""
import sys, json, hashlib
sys.dont_write_bytecode = True
from pathlib import Path
from collections import defaultdict
import openpyxl
from importlib.machinery import SourceFileLoader

root = Path(__file__).resolve().parents[1]
audit = SourceFileLoader('source_audit', str(root / 'scripts/audit-source.py')).load_module()
source, output = map(Path, sys.argv[1:3])
book = openpyxl.load_workbook(source, read_only=True, data_only=True)
index = defaultdict(list)
for line, values in enumerate(book['data'].iter_rows(min_row=2, values_only=True), 2):
    record = audit.source_record(values)
    index[(record.get('u'), record.get('m'))].append((line, record))
baseline = json.loads((root/'data/baseline/admissions.json').read_text(encoding='utf-8'))
rows=[]
for i, r in enumerate(baseline, 1):
    for slot in ('k1','k2','k3','j1','j2'):
        if not r.get(slot+'n'): continue
        candidates=[(line,x,s) for line,x in index[(r.get('u'),r.get('m'))] for s in ('k1','k2','k3','j1','j2') if s[0]==slot[0] and x.get(s+'n')==r[slot+'n']]
        exact=[line for line,x,s in candidates if all(x.get(s+k)==r.get(slot+k) for k in ('a','b'))]
        status='workbook-match' if exact else 'previous-official-correction-not-rechecked' if r.get(slot+'metric')=='donggukOfficial' else 'workbook-difference' if candidates else 'workbook-track-unmatched'
        rows.append(dict(id=i,slot=slot,uni=r['u'],major=r['m'],track=r[slot+'n'],status=status,sourceRows=exact or [x[0] for x in candidates],values={k:r.get(slot+k) for k in ('a','b')},sourceValues=[dict(row=line,slot=s,a=x.get(s+'a'),b=x.get(s+'b')) for line,x,s in candidates]))
counts={s:sum(r['status']==s for r in rows) for s in sorted(set(r['status'] for r in rows))}
output.write_text(json.dumps(dict(source=source.name,sha256=hashlib.sha256(source.read_bytes()).hexdigest(),counts=counts,rows=rows),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(counts,ensure_ascii=False))
