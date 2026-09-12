"""Enrich existing past cards without collecting or storing prediction records."""
import gzip,json
from pathlib import Path
from features_v7 import attach_historical

def run():
    path=Path('data/latest.json');doc=json.loads(path.read_text())
    context=json.loads(gzip.decompress(Path('data/history-context-v7.json.gz').read_bytes()))
    attach_historical(doc['races'],context)
    path.write_text(json.dumps(doc,ensure_ascii=False,indent=2))
    print('Past cards recalculated:',sum(r.get('prediction_view')=='historical_recalculation' for r in doc['races']))

if __name__=='__main__':run()
