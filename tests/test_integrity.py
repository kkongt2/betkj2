import copy,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from collect_payouts import payouts
from features_v7 import History,attach_historical
from archive_cards import window_start,extend
from datetime import datetime
from zoneinfo import ZoneInfo

class Integrity(unittest.TestCase):
    def test_two_complete_previous_weeks(self):
        now=datetime(2026,9,12,12,tzinfo=ZoneInfo('Asia/Seoul'))
        self.assertEqual(window_start(now),'20260824')
        self.assertEqual(window_start(now.replace(day=14)),'20260831')
        doc={'races':[{'date':'20260823','venue':'seoul','race_no':1}]}
        extend(doc,now=now)
        self.assertTrue(all(r['date']>='20260824' for r in doc['races']))
        self.assertTrue(any(r['date']=='20260829' and r['venue']=='seoul' for r in doc['races']))
        self.assertTrue(any(r['date']=='20260905' and r['venue']=='seoul' for r in doc['races']))
        r=next(r for r in doc['races'] if r['date']=='20260829' and r['venue']=='seoul')
        self.assertEqual(r['official_result']['pair']['status'],'confirmed')
        self.assertFalse(any('finish' in h or 'race_seconds' in h for h in r['horses']))
        count=len(doc['races']);extend(doc,now=now);self.assertEqual(len(doc['races']),count)
    def test_sales_not_dividends(self):
        self.assertEqual(payouts('복연: 1,000,000\n배당률 단: ①2.0\n복연: ①②3.2 ①③8.0 ②③4.1\n',[1,2,3]),{'1-2':3.2,'1-3':8.,'2-3':4.1})
    def test_missing_and_malformed_never_zero(self):
        for s in ['복연: 1,000,000','배당률 단: ①2.0\n복연: ①②3.2','배당률 단: ①2.0\n복연: ①②3.2 ①③8.0 ②③4.1 오류','배당률 단: ①2.0\n복연: ①②3.2 ①③8.0 ②③4.1 ①②3.2']:
            with self.assertRaises(ValueError):payouts(s,[1,2,3])
    def test_current_result_and_dividend_not_features(self):
        r=dict(date='20260912',venue='seoul',race_no=1,distance=1200,grade='국6등급',place_k=2,place_winners=[1,2],horses=[dict(number=i,name=f'horse{i}',age=3,sex='수',rating=10*i,burden=54,jockey='j',trainer='t',finish=i) for i in range(1,5)])
        history=History();x=history.field(r)[1];after=copy.deepcopy(r)
        after['payouts']={'1-2':9999};after['place_winners']=[4,3]
        for h in after['horses']:h.update(finish=5-h['finish'],race_seconds=99,early_position=4)
        self.assertEqual(x,history.field(after)[1])
        history.add_day([r]);self.assertEqual(x,history.field(r)[1])

    def test_historical_slice_excludes_same_day_and_future(self):
        def race(date):
            return dict(date=date,venue='seoul',race_no=1,distance=1200,grade='국6등급',place_k=2,place_winners=[1,2],horses=[dict(number=i,name=f'h{i}',age=3,sex='수',rating=i*10,burden=54,jockey='j',trainer='t',finish=i,race_seconds=70+i,early_position=i) for i in range(1,5)])
        history=History();history.add_day([race('20260909')]);card=race('20260910')
        expected=history.field(card)[1]
        history.add_day([race('20260910')]);history.add_day([race('20260911')])
        context=history.export();before=copy.deepcopy(context);attach_historical([card],context)
        self.assertEqual([h['features_v7'] for h in card['horses']],expected)
        self.assertEqual(card['history_through_v7'],'20260909')
        self.assertEqual(context,before)
        old_card=race('20260910')
        for h in old_card['horses']:h.pop('age');h.pop('sex')
        attach_historical([old_card],context)
        self.assertEqual([h['features_v7'] for h in old_card['horses']],expected)
        self.assertTrue(all(h['quality_v7']['history']>0 for h in old_card['horses']))
        for rows in context['records'].values():
            for row in rows:
                if row['day']>=__import__('datetime').datetime.strptime('20260910','%Y%m%d').toordinal():row['placed']=False;row['rating']=9999
        attach_historical([card],context)
        self.assertEqual([h['features_v7'] for h in card['horses']],expected)

if __name__=='__main__':unittest.main()
