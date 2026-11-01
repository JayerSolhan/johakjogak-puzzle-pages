#!/usr/bin/env python3
import array, hashlib, json, math, pathlib, subprocess, sys
SRC=pathlib.Path(sys.argv[1]); OUT=pathlib.Path(sys.argv[2]); OUT.mkdir(parents=True,exist_ok=True)
raw=subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-i',str(SRC),'-ac','1','-ar','16000','-f','f32le','-'])
x=array.array('f'); x.frombytes(raw)
step=160
rms=[math.sqrt(sum(t*t for t in x[i:i+step])/max(1,len(x[i:i+step]))) for i in range(0,len(x),step)]
signal=[sum(rms[max(0,i-2):min(len(rms),i+3)])/len(rms[max(0,i-2):min(len(rms),i+3)]) for i in range(len(rms))]
peak=max(signal); duration=len(x)/16000
def segments(frac,gap):
    active=[v>=peak*frac for v in signal];blocks=[];start=None
    for i,v in enumerate(active):
        if v and start is None:start=i
        elif not v and start is not None:
            if i-start>=7:blocks.append((start,i))
            start=None
    if start is not None and len(active)-start>=7:blocks.append((start,len(active)))
    merged=[]
    for b in blocks:
        if merged and (b[0]-merged[-1][1])*.01<=gap:merged[-1]=(merged[-1][0],b[1])
        else:merged.append(b)
    return [(a*.01,b*.01) for a,b in merged]
options=[];overview={}
for frac in [.008,.012,.016,.02,.025,.03,.035,.04,.05,.06,.08,.10,.12,.15]:
 for gap in [.07,.10,.13,.16,.20,.24,.29,.34,.40]:
    seg=segments(frac,gap);overview[f'{frac}:{gap}']=len(seg)
    if len(seg)!=26:continue
    lens=[b-a for a,b in seg]
    penalty=sum(max(0,.16-l)*25+max(0,l-2)*3 for l in lens)
    penalty+=abs(sum(lens)/26-.7)*.18+gap*.8+frac*.6
    options.append((penalty,frac,gap,seg))
if not options:
    print('FAILED: no safe 26-clip segmentation')
    for k,v in overview.items():print(k,v)
    sys.exit(2)
options.sort(key=lambda x:x[0]);score,frac,gap,chunks=options[0]
report={'source':'https://commons.wikimedia.org/wiki/File:English_alphabet_woman.oga',
        'source_sha256':hashlib.sha256(SRC.read_bytes()).hexdigest(),
        'duration':duration,'threshold':frac,'gap':gap,'segments':[]}
print('Candidate 26 segments; threshold',frac,'gap',gap,'duration',duration)
for i,(a,b) in enumerate(chunks):
    letter=chr(65+i);start=max(0,a-.08);end=min(duration,b+.12)
    if end-start<.20 or end-start>3.3:raise RuntimeError('Unsafe '+letter+' length '+str(end-start))
    dest=OUT/(letter+'.mp3')
    subprocess.check_call(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y',
       '-ss',str(start),'-to',str(end),'-i',str(SRC),
       '-ac','1','-ar','24000','-codec:a','libmp3lame','-b:a','80k',str(dest)])
    if not dest.exists() or dest.stat().st_size<1000:raise RuntimeError('Empty '+letter)
    sha=hashlib.sha256(dest.read_bytes()).hexdigest()
    report['segments'].append({'letter':letter,'start':round(start,2),'end':round(end,2),
                                'size':dest.stat().st_size,'sha256':sha})
    print(letter,round(start,2),round(end,2),dest.stat().st_size)
(OUT/'SPLIT_REPORT.json').write_text(json.dumps(report,indent=2)+'\n')
(OUT/'ATTRIBUTION.txt').write_text('Alphabet reading by Wikifriends, 2007 (public domain).\nOriginal: https://commons.wikimedia.org/wiki/File:English_alphabet_woman.oga\n')
print('VALIDATED',len(report['segments']),'clips')