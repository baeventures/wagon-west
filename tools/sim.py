import random, statistics
from collections import Counter

# Landmark geography. LM is the long road (v1.0 baseline, unchanged).
# The cutoff shares everything through the fork at mile 1480, then runs
# storeless to a deeper Broadback crossing and a 2050-mile finish.
LM = [(0,{}),(210,{}),(300,{'creek':1}),(430,{'store':1}),(640,{'river':1}),(860,{}),
      (1080,{'river':1}),(1300,{'store':1}),(1560,{}),(1800,{}),(2000,{'store':1}),
      (2300,{'river':1,'big':1}),(2450,{}),(2600,{})]
FORK = 1480
LM_CUT = [x for x in LM if x[0] <= FORK] + [(1830,{'river':1,'big':1,'deep':1})]
TOTAL=2600; FOOD_CAP=800; GOLD=18  # TOTAL overridden by KN/route at use sites
PACES={'steady':(12,18,0,1.0,1),'stren':(18,26,2,1.15,2),'gruel':(24,34,5,1.3,3)}
RAT={'fill':(3,0),'meag':(2,-1),'bare':(1,-3)}
SEA={'spring':(0.95,0,1,1),'summer':(1,0,1,1),'fall':(0.95,-1,1.1,0.9),'winter':(0.6,-4,0.5,0.45)}
def season(doy):
    d=((doy-1)%365)+1
    if d>=335 or d<=59: return 'winter'
    if d<=151: return 'spring'
    if d<=243: return 'summer'
    return 'fall'
PRICE={'f25':9,'f100':34,'wheel':15,'axle':20,'tongue':12,'ox':38,'tonic':30}
GEARP={'musket':40,'toolkit':38,'sluice':28,'oven':30,'medchest':45}

# difficulty presets: (event-rate mult, price mult) — mirrors DIFFICULTIES in WagonWest.jsx
DIFF={'greenhorn':(0.8,0.9),'settler':(1.0,1.0),'pioneer':(1.2,1.15)}

class Run:
    def __init__(s, prof, picks, seed, route='long'):
        s.prof=prof
        s.route=route
        s.LM=LM_CUT if route=='cutoff' else LM
        s.total=2050 if route=='cutoff' else KN['total']
        s.rng=random.Random(seed)
        s.money={'clerk':900,'carp':650,'farmer':500}[prof]
        s.traits=set()
        wage={'doc':90,'hawk':70,'ruth':60,'finch':50,'marta':55}
        for p in picks:
            if p in wage: s.money-=wage[p]; s.traits.add(p)
        s.h=[100.0]*4; s.food=0; s.parts={'wheel':0,'axle':0,'tongue':0}
        s.oxen=4; s.gold=0.0; s.tonics=0; s.gear=set()
        s.day=1; s.doy0=91; s.miles=0; s.lastHunt=-99
        s.cause=None; s.winterdays=0
    def alive(s): return sum(1 for x in s.h if x>0)
    def doy(s): return s.doy0+s.day-1
    def sea(s): return season(s.doy())
    def dfood(s,pace_mult=1.0):
        m=1.0
        if 'marta' in s.traits and s.h[s._idx('marta')]>0: m*=0.85
        if 'oven' in s.gear: m*=0.92
        return round(3*s.alive()*m*pace_mult) if s.ration=='fill' else round(RAT[s.ration][0]*s.alive()*m*pace_mult)
    def _idx(s,t):  # trait holder slots: leader=0, hires occupy 1..3 in pick order
        return s.slot.get(t,0)
    def trait_on(s,t): return t in s.traits and s.h[s.slot[t]]>0
    def hurt(s,d,who=None):
        if who is None:
            for i in range(4):
                if s.h[i]>0: s.h[i]=max(0,min(100,s.h[i]+d))
        else:
            if s.h[who]>0: s.h[who]=max(0,min(100,s.h[who]+d))
    def nearwater(s):
        return any(abs(m-s.miles)<130 for m,f in s.LM if f.get('river') or f.get('creek'))

def event(s, pace, dist, crossed, diff='settler'):
    r=s.rng
    boost=0.12 if pace=='gruel' else 0.05 if pace=='stren' else 0
    def fever():
        dmg=round(r.uniform(6,16)*(0.5 if 'medchest' in s.gear else 1))
        liv=[i for i in range(4) if s.h[i]>0]
        if not liv: return
        wk=min(liv,key=lambda i:s.h[i])
        who=wk if r.random()<0.6 else r.choice(liv)
        s.hurt(-dmg,who)
    def breakdown():
        part=r.choice(['wheel','axle','tongue'])
        if s.trait_on('ruth') and r.random()<0.5: return
        if 'toolkit' in s.gear and r.random()<0.35: return
        if s.prof=='carp' and r.random()<KN['csave']: return
        if s.parts[part]>0: s.parts[part]-=1
        else: s.hurt(-4)
    def goodgame(): s.food=min(FOOD_CAP,s.food+round(r.uniform(15,40)))
    def spoil(): s.food=max(0,s.food-round(r.uniform(10,30)))
    def thieves():
        t=[]
        if s.money>10: t+=['money']*2
        if s.food>30: t+=['food']*2
        if sum(s.parts.values())>0: t.append('spare')
        if s.oxen>0: t.append('ox')
        if s.gold>=0.3: t.append('gold')
        c=r.choice(t) if t else 'money'
        if c=='money': s.money=max(0,s.money-round(r.uniform(20,60)))
        elif c=='food': s.food=max(0,s.food-round(r.uniform(20,50)))
        elif c=='spare':
            k=r.choice([k for k in s.parts if s.parts[k]>0]); s.parts[k]-=1
        elif c=='ox': s.oxen=max(0,s.oxen-1)
        else: s.gold=0
    def fair(): s.hurt(4)
    def storm(): s.miles=max(0,s.miles-round(dist*0.7))
    def fire():
        s.food=max(0,s.food-round(s.food*r.uniform(0.12,0.22)))
        have=[k for k in s.parts if s.parts[k]>0]
        if have: s.parts[r.choice(have)]-=1
    def lame():
        if s.prof=='farmer' and r.random()<KN['fsave']: return
        s.oxen=max(0,s.oxen-1)
    # ---- v1.1 events — mirror rollEvent() additions in WagonWest.jsx ----
    def snakebite():
        liv=[i for i in range(4) if s.h[i]>0]
        if not liv: return
        s.hurt(-round(r.uniform(8,18)*(0.5 if 'medchest' in s.gear else 1)), r.choice(liv))
    def abandoned():
        short=[k for k in s.parts if s.parts[k]<3]
        if short and r.random()<0.6: s.parts[r.choice(short)]+=1
        else: s.food=min(FOOD_CAP,s.food+round(r.uniform(20,45)))
    def caravan():
        s.food=min(FOOD_CAP,s.food+round(r.uniform(10,25))); s.hurt(3)
    def stray():
        if r.random()<KN['strayLoss']: s.oxen=max(0,s.oxen-1)
        else: s.miles=max(0,s.miles-round(r.uniform(4,10)))
    def hail():
        s.hurt(-4)
        have=[k for k in s.parts if s.parts[k]>0]
        if have and r.random()<0.25: s.parts[r.choice(have)]-=1
    def honey():
        s.food=min(FOOD_CAP,s.food+round(r.uniform(10,25)))
        if r.random()<0.2: s.hurt(-3, r.randrange(4))
    oxw=(3 if pace=='gruel' else 2 if pace=='stren' else 1)*KN['lame']
    pool=[(3,fever,1),(2,breakdown,1),(2,goodgame,1),(2,spoil,1),(1,thieves,1),(2,fair,1),
          (0 if crossed else KN['stormw'],storm,1),(1,fire,1),(oxw,lame,1)]
    if KN['newev']:
        pool+=[(KN['snakeW'],snakebite,0),(0.8,abandoned,0),(0.7,caravan,0),
               (KN['strayW'],stray,0),(KN['hailW'],hail,0),(KN['honeyW'],honey,0)]
    # The scaled trigger keeps every legacy event at its original per-day odds
    # while the v1.1 events ride on top; difficulty and the cutoff scale the
    # whole pool. Mirrors rollEvent() in WagonWest.jsx exactly.
    legw=sum(w for w,_,L in pool if L)
    allw=sum(w for w,_,_ in pool)
    trig=(0.35+boost)*(allw/legw)*DIFF[diff][0]*(KN['cutEvent'] if s.route=='cutoff' and s.miles>FORK else 1)
    if r.random()>trig: return
    x=r.random()*allw
    for w,f,_ in pool:
        x-=w
        if x<=0: f(); return

def cross_river(s, big, deep=False):
    r=s.rng
    depth=round(r.uniform(6,10)) if deep else round(r.uniform(5,9)) if big else round(r.uniform(2,7))
    fare=10+depth*4
    if s.money>=fare: s.money-=fare
    else:
        oz=-(-fare*10//14)/10  # ceil to 0.1
        if s.gold>=oz: s.gold=round(s.gold-oz,1)
        else:  # float
            if r.random()<0.25:
                s.food=max(0,s.food-round(r.uniform(15,40))); s.hurt(-6)
    s.food=max(0,s.food-s.dfood()); s.day+=1

def shop(s, mi, diff='settler'):
    r=s.rng
    pm=DIFF[diff][1]
    disc=0.9 if s.prof=='clerk' else 1.0
    PB={k:round(v*pm) for k,v in PRICE.items()}
    P={k:round(v*disc) for k,v in PB.items()}
    if KN['foxhalf'] and s.prof=='farmer': P['ox']=round(PB['ox']*0.5)
    # sell gold
    s.money+=round(s.gold*GOLD); s.gold=0
    # tonics to 2
    while s.tonics<2 and s.money>=P['tonic']+10:
        s.money-=P['tonic']; s.tonics+=1
    # spares to 2 each
    for k in ['wheel','axle','tongue']:
        while s.parts[k]<2 and s.money>=P[k]+60: s.money-=P[k]; s.parts[k]+=1
    # oxen back to 5 (speed cap + buffer)
    while s.oxen<5 and s.money>=P['ox']+50: s.money-=P['ox']; s.oxen+=1
    # gear (posts >=1300)
    if mi>=1300:
        prio=[]
        if not s.trait_on('hawk'): prio.append('musket')
        if not s.trait_on('ruth'): prio.append('toolkit')
        if not s.trait_on('marta'): prio.append('oven')
        if not s.trait_on('doc'): prio.append('medchest')
        G2={g:round(v*pm) for g,v in GEARP.items()}
        for g in prio:
            if g not in s.gear and s.money>=G2[g]+70: s.money-=G2[g]; s.gear.add(g)
    # fill food, keep reserve (bigger reserve before Broadback leg)
    reserve=50 if mi>=2000 else 40
    while s.food<=FOOD_CAP-100 and s.money>=P['f100']+reserve:
        s.money-=P['f100']; s.food+=100
    while s.food<=FOOD_CAP-25 and s.money>=P['f25']+reserve:
        s.money-=P['f25']; s.food+=25
    s.day+=1  # a day at the post

KN={'total':2600,'huntA':5,'huntB':0.42,'wintox':0.02,'stormw':2,'thin':0.6,'lame':1.0,'plague':0.008,'fsave':0.4,'foxhalf':0,'csave':0.3,
    'newev':1,'cutEvent':1.25,'cutHealth':1,'snakeW':0.8,'strayW':0.6,'hailW':0.5,'strayLoss':0.25,'honeyW':0.6}
def simulate(prof, picks, seed, route='long', diff='settler'):
    s=Run(prof,picks,seed,route); r=s.rng
    s.slot={p:i+1 for i,p in enumerate(picks)}
    s.ration='fill'
    # outfit: spares, an extra ox if rich, food, reserve $80 (tonic+ferry)
    RES=80
    pm=DIFF[diff][1]
    OD=0.9 if prof=='clerk' else 1.0
    PB2={k:round(v*pm) for k,v in PRICE.items()}
    PRICE2={k:round(v*OD) for k,v in PB2.items()}
    if KN['foxhalf'] and prof=='farmer': PRICE2['ox']=round(PB2['ox']*0.5)
    for k in ['wheel','axle','tongue']:
        if s.money>=PRICE2[k]+RES: s.money-=PRICE2[k]; s.parts[k]+=1
    if s.money>=PRICE2['ox']+RES+150: s.money-=PRICE2['ox']; s.oxen+=1
    while s.food<=FOOD_CAP-100 and s.money>=PRICE2['f100']+RES: s.money-=PRICE2['f100']; s.food+=100
    while s.food<=FOOD_CAP-25 and s.money>=PRICE2['f25']+RES: s.money-=PRICE2['f25']; s.food+=25
    visited=set()
    while True:
        if s.day>420: s.cause='timeout'; return s
        if s.alive()==0: s.cause='party'; return s
        if s.oxen<=0: s.cause='oxen'; return s
        if s.miles>=s.total: s.cause='win'; return s
        se=s.sea(); cfg=SEA[se]
        if se=='winter': s.winterdays+=1
        fdays=s.food/max(1,s.dfood())
        liv=[s.h[i] for i in range(4) if s.h[i]>0]
        mn=min(liv);
        # --- policy ---
        # rest if someone critical
        if mn<25 and s.food>s.dfood()*2:
            s.food=max(0,s.food-s.dfood()); s.hurt(8+cfg[1]); s.day+=1; continue
        # rations
        s.ration='fill' if fdays>8 else 'meag' if fdays>4 else 'bare'
        # hunt
        thin=s.day-s.lastHunt<=3
        if fdays<6 and not thin:
            s.food=max(0,s.food-s.dfood())
            acc=r.uniform(70,100); s.lastHunt=s.day
            y=(KN['huntA']+acc*KN['huntB'])*cfg[2]
            if s.trait_on('hawk'): y*=1.25
            if 'musket' in s.gear: y*=1.2
            s.food=min(FOOD_CAP,s.food+round(y)); s.day+=1; continue
        # pan if broke near water with slack
        days_left=max(1,319-(s.doy()%365) if s.doy()%365<319 else 1)
        req=(s.total-s.miles)/days_left
        gval=s.money+s.gold*14
        if gval<50 and s.miles<1900 and s.nearwater() and fdays>5 and req<14 and se!='winter':
            s.food=max(0,s.food-s.dfood()); s.hurt(-2)
            ch=(0.8+ (0.12 if s.trait_on('finch') else 0)+(0.08 if 'sluice' in s.gear else 0))*cfg[3]
            if r.random()<ch: s.gold=round(s.gold+r.uniform(0.3,1.4),1)
            s.day+=1; continue
        # pace scheduling
        if mn<40: pace='steady'
        elif req>20: pace='gruel'
        elif req>15: pace='stren'
        else: pace='steady'
        p=PACES[pace]
        oxf=max(0.55,min(1.15,s.oxen/4))
        dist=round(r.uniform(p[0],p[1])*oxf*cfg[0])
        need=round(s.dfood()* {'steady':1,'stren':1.15,'gruel':1.3}[pace])
        starve=False
        if s.food<need: starve=True; s.food=0
        else: s.food-=need
        if p[2]: s.hurt(-p[2])
        s.hurt(RAT[s.ration][1])
        if cfg[1]: s.hurt(cfg[1])
        if s.route=='cutoff' and s.miles>FORK: s.hurt(-KN['cutHealth'])  # thin air, cold nights
        if s.trait_on('doc'): s.hurt(1)
        if starve: s.hurt(-12)
        if se=='winter' and r.random()<KN['wintox'] and not (s.prof=='farmer' and r.random()<KN['fsave']): s.oxen=max(0,s.oxen-1)
        new=min(s.total,s.miles+dist)
        crossed=None
        for m,f in s.LM:
            if s.miles<m<=new: crossed=(m,f); break
        s.miles=new
        event(s,pace,dist,crossed is not None,diff)
        # plague
        if s.miles>500 and r.random()<KN['plague']:
            if s.tonics>0:
                s.tonics-=1
                liv2=[i for i in range(4) if s.h[i]>0]
                if liv2: s.hurt(-round(r.uniform(25,45)), r.choice(liv2))
            else:
                s.h=[0,0,0,0]; s.cause='plague'; return s
        s.day+=1
        if crossed:
            m,f=crossed
            if f.get('store') and m not in visited:
                visited.add(m); shop(s,m,diff)
            if f.get('river'):
                cross_river(s,f.get('big'),f.get('deep'))

def batch(prof,picks,n=1500,base=0,route='long',diff='settler'):
    res=[simulate(prof,picks,base*100000+i,route,diff) for i in range(n)]
    wins=[x for x in res if x.cause=='win']
    c=Counter(x.cause for x in res)
    out={'win%':100*len(wins)/n,'causes':dict(c),
         'med_days':int(statistics.median(x.day for x in wins)) if wins else 0,
         'avg_surv':round(statistics.mean(x.alive() for x in wins),2) if wins else 0,
         'winter%':round(100*sum(1 for x in res if x.winterdays>0)/n,1),
         'full4%':round(100*sum(1 for x in wins if x.alive()==4)/max(1,len(wins)),1)}
    return out

# Shipped constants (v1.0 balance + v1.1 additions)
SHIPPED=dict(total=2300,huntA=7,huntB=0.5,wintox=0.012,lame=0.75,plague=0.008,
             fsave=0,foxhalf=1,csave=0.4,stormw=2,thin=0.6,
             newev=1,cutEvent=1.75,cutHealth=2,snakeW=0.6,strayW=0.5,hailW=0.4,strayLoss=0.05,honeyW=0.7)
KEY=[('clerk',['doc','hawk','marta'],'Clerk best-build'),
     ('carp',['hawk','marta'],'Carpenter mid-build'),
     ('farmer',['hawk','marta'],'Farmer lean-build')]

def table(title, rows):
    print(f"\n=== {title} ===")
    print(f"{'CONFIG':26}{'WIN%':>6}{'MedDays':>9}{'Surv':>6}{'Full4%':>8}  TOP CAUSES")
    for label,o in rows:
        causes=', '.join(f"{k}:{v}" for k,v in sorted(o['causes'].items(),key=lambda x:-x[1])[:3])
        print(f"{label:26}{o['win%']:>6.1f}{o['med_days']:>9}{o['avg_surv']:>6}{o['full4%']:>8}  {causes}")

if __name__=='__main__':
    import sys, time
    n=int(sys.argv[1]) if len(sys.argv)>1 else 1500
    t0=time.time()

    # 1. v1.0 baseline check: legacy events only, long road, settler.
    KN.update(SHIPPED); KN['newev']=0
    table(f'v1.0 BASELINE CHECK (legacy events only, long/settler, n={n})',
          [(lb, batch(p,pk,n,base=i+1)) for i,(p,pk,lb) in enumerate(KEY)])

    # 2. v1.1 event pool on the same baseline.
    KN.update(SHIPPED)
    table(f'v1.1 EVENT POOL (long/settler, n={n})',
          [(lb, batch(p,pk,n,base=i+1)) for i,(p,pk,lb) in enumerate(KEY)])

    # 3. Full matrix: route x difficulty x key builds.
    for diff in ['greenhorn','settler','pioneer']:
        for route in ['long','cutoff']:
            KN.update(SHIPPED)
            table(f'{diff.upper()} / {"MOUNTAIN CUTOFF" if route=="cutoff" else "LONG ROAD"} (n={n})',
                  [(lb, batch(p,pk,n,base=i+1,route=route,diff=diff)) for i,(p,pk,lb) in enumerate(KEY)])
    print(f"\n[{time.time()-t0:.1f}s total]")
