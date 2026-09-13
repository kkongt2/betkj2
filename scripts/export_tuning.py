"""All pre-race candidates, no refitting. Actual dividends are settlements only."""
import gzip,json,subprocess
from pathlib import Path
from features_v7 import prepare

def run():
    history=[json.loads(x) for x in gzip.decompress(Path('training/history-v7.jsonl.gz').read_bytes()).splitlines()]
    pp={(r['date'],r['venue'],r['race_no']):r['payouts'] for r in json.loads(gzip.decompress(Path('training/payouts.json.gz').read_bytes()))}
    rows,_=prepare(history);cards=[]
    for r in rows:
        key=(r['date'],r['venue'],r['race_no'])
        if not '20250401'<=r['date']<='20260910' or key not in pp:continue
        cards.append(dict(date=r['date'],venue=r['venue'],race_no=r['race_no'],horses=[dict(number=n,features_v7=x) for n,x in zip(r['numbers'],r['X'])],payouts=pp[key]))
    temp=Path('data/tuning-input.tmp.json');temp.write_text(json.dumps(cards,separators=(',',':')))
    try:subprocess.run(['node','scripts/export_tuning.cjs'],check=True)
    finally:temp.unlink(missing_ok=True)
if __name__=='__main__':run()
