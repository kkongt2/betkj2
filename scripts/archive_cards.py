"""Browse this week and the preceding two complete Korean calendar weeks."""
import gzip,json
from datetime import datetime,timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

VENUES={1:('seoul','서울'),2:('jeju','제주'),3:('busan','부산경남')}
def window_start(now):return (now-timedelta(days=now.weekday()+14)).strftime('%Y%m%d')
def key(r):return (r['date'],r['venue'],int(r['race_no']))

def extend(doc,now=None,fetch_missing=False):
    now=now or datetime.now(ZoneInfo('Asia/Seoul'));floor=window_start(now)
    cutoff=(now-timedelta(days=2)).strftime('%Y%m%d')
    cards={key(r):r for r in doc['races'] if r['date']>=floor}
    raw=[json.loads(x) for x in gzip.decompress(Path('training/history-v7.jsonl.gz').read_bytes()).splitlines()]
    pp={key(r):r for r in json.loads(gzip.decompress(Path('training/payouts.json.gz').read_bytes()))}
    for r in raw:
        if not floor<=r['date']<cutoff or key(r) in cards:continue
        payout=pp.get(key(r));venue_name=next(v[1] for v in VENUES.values() if v[0]==r['venue'])
        card={k:r[k] for k in ('date','venue','race_no','distance','grade')}
        card.update(venue_name=venue_name,start_time='',historical_view=True,history_archive=True,
            horses=[{k:h[k] for k in ('number','name','age','sex','rating','burden','jockey','trainer') if k in h} for h in sorted(r['horses'],key=lambda h:h['number'])])
        if payout:
            card['official_result']=dict(status='confirmed',version=2,source=payout['source'],checked_at=now.isoformat(timespec='seconds'),
                source_kind='official_daily_report',starters=[h['number'] for h in card['horses']],
                pair=dict(status='confirmed',payouts=[dict(numbers=list(map(int,k.split('-'))),odds=v) for k,v in payout['payouts'].items()]))
        cards[key(r)]=card
    # A few reports were excluded from model training. Fetch their original
    # entry cards for browsing instead of silently omitting those race numbers.
    if fetch_missing:
        from update_kra import parse_card,S,decode_response
        from results_kra import attach_results
        manifest=json.loads(Path('training/manifest.json').read_text())
        for report in manifest['reports']:
            if not floor<=report['date']<cutoff:continue
            for rn,_ in report.get('skips',[]):
                k=(report['date'],VENUES[report['meet']][0],int(rn))
                existing=cards.get(k)
                if existing and existing.get('official_result',{}).get('pair',{}).get('status') in ('confirmed','refund'):continue
                try:
                    card=existing
                    if card is None:card,_=parse_card(report['date'],rn,report['meet'])
                    if not card:continue
                    card.update(historical_view=True,history_archive=True)
                    attach_results([card],{k:dict(card)},now,S,decode_response)
                    cards[k]=card
                except Exception as exc:print('Archive card unavailable',k,str(exc),flush=True)
    doc['races']=sorted(cards.values(),key=lambda r:(r['date'],r['venue'],r['race_no']))
    status=doc.setdefault('status',{});status.update(race_count=len(cards),browse_from=floor,dates=sorted({r['date'] for r in cards.values()}))
    return doc
