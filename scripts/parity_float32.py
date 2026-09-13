"""Independent Python reference for the training matrix's float32 precision."""
import json,math,struct
from pathlib import Path
from profit_model import pair_features

def run():
    model=json.loads(Path('data/model.json').read_text());p=Path('data/parity.json');fixture=json.loads(p.read_text())
    X,ij=pair_features([h['features_v7'] for h in fixture['horses']])
    def pred(m,x):
        z=m['bias']
        for t in m['trees']:
            i=0
            while not t[i][0]:
                n=t[i];i=n[3] if x[n[1]]<=n[2] else n[4]
            z+=t[i][5]
        return math.exp(z) if m['link']=='exp' else 1/(1+math.exp(-z))
    expected=[]
    for f,(i,j) in zip(X,ij):
        f=[struct.unpack('f',struct.pack('f',v))[0] for v in f];raw=max(1e-6,min(1-1e-6,pred(model['classifier'],f)));pr=1/(1+math.exp(-(model['calibrator']['a']*math.log(raw/(1-raw))+model['calibrator']['b'])))
        expected.append(dict(numbers=sorted([fixture['horses'][i]['number'],fixture['horses'][j]['number']]),prob=pr,dividend=max(1,pred(model['dividend'],f)*model['dividend_scale'])))
    fixture['expected']=expected;fixture['precision']='float32 pair matrix, same as training/backtest';p.write_text(json.dumps(fixture,separators=(',',':')))
if __name__=='__main__':run()
