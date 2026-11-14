#!/usr/bin/env python3
"""Build bounded, attributed shopping-name snapshots from official offline source files.
No network, AI calls, application data or production database access.
"""
import argparse,hashlib,io,json,re,unicodedata,zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
VERSION=2
def key(value):
    value=unicodedata.normalize('NFKD',value).casefold().replace('ß','ss')
    return ' '.join(re.sub(r'[^\w ]',' ',''.join(c for c in value if not unicodedata.combining(c))).split())
def clean(value):
    value=re.sub(r'\s+',' ',value).strip(' ,;')
    if not 2<=len(value)<=100 or re.search(r'[<>{}\x00-\x1f]',value):return None
    return value
def bls_rows(path):
    with zipfile.ZipFile(path) as outer:
        names=[n for n in outer.namelist() if n.endswith('BLS_4_0_Daten_2025_DE.xlsx')]
        if len(names)!=1:raise ValueError('Unexpected BLS archive')
        with zipfile.ZipFile(io.BytesIO(outer.read(names[0]))) as x:
            ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            strings=[''.join(node.itertext()) for node in ET.fromstring(x.read('xl/sharedStrings.xml')).findall('m:si',ns)]
            rows=ET.fromstring(x.read('xl/worksheets/sheet1.xml')).findall('m:sheetData/m:row',ns)[1:]
            for row in rows:
                values={}
                for cell in list(row)[:2]:
                    raw=cell.find('m:v',ns);value=raw.text if raw is not None else ''
                    values[cell.attrib['r'][0]]=strings[int(value)] if cell.attrib.get('t')=='s' else value
                if values.get('A') and values.get('B'):yield values['A'],values['B']
def bls_department(code,name):
    n=name.lower()
    if 'tiefgefroren' in n:return 'frozen'
    if any(word in n for word in ['konserve','getrocknet','pulver']):return 'pantry'
    if code[0] in 'FG':return 'produce'
    if code[0]=='B':return 'bakery'
    if code[0] in 'NP':return 'drinks'
    if code[0] in 'TUVW':return 'meat'
    if code[0]=='M':return 'chilled'
    if 'tofu' in n or 'tempeh' in n:return 'chilled'
    if code[0]=='H' and ('spross' in n or 'keimling' in n):return 'produce'
    if code[0]=='K' and not any(w in n for w in ['mehl','stärke','chips','instant','trocken']):return 'produce'
    if code[0]=='Q' and 'butter' in n:return 'chilled'
    if code[0]=='E' and ('hühnerei' in n or 'frischteig' in n):return 'chilled'
    return 'pantry'
def import_bls(path):
    entries=[]
    for code,original in bls_rows(path):
        if code[0] in 'XY' or re.search(r'gekocht|gegart|gebraten|gedünstet|gedämpft|frittiert|gratiniert|zubereitet|geschmort|gebacken|geröstet ohne|in mikro',original,re.I):continue
        # Keep storage/form distinctions; remove only the laboratory raw-state suffix.
        name=re.sub(r',?\s+roh\b','',original,flags=re.I)
        name=clean(name)
        if not name:continue
        # Preserve original label and ID; aliases only split true alternatives before comma.
        aliases=[a.strip() for a in name.split(',')[0].split('/') if clean(a.strip()) and a.strip()!=name][:4]
        entries.append({'id':code,'name':name,'aliases':aliases,'department':bls_department(code,original),'original':original})
    return sorted(entries,key=lambda e:(key(e['name']),e['id']))
ROOTS=[
 ('produce',r'^(fruits?|vegetables?|fresh vegetables?|herbs?|mushrooms?|berries|citrus fruits?)$'),
 ('pantry',r'^(cereals?|grains?|nuts?|seeds?|legumes?|vegetable oils?|oils?|spices?|sugars?|sweeteners?|syrups?|caramel syrup|flours?|salts?|starches?|dried fruits?|pasta|vinegars?|sauces?)$'),
 ('chilled',r'^(milks?|dairy|dairy products?|cheeses?|yogurts?|eggs?|tofu|tempeh|butters?)$'),
 ('meat',r'^(meats?|fish|fishes|seafoods?|poultry|shellfish)$'),
 ('drinks',r'^(beverages?|drinks?|teas?|coffees?|fruit juices?|waters?)$'),
]
def import_off(path):
    nodes={};aliases={}
    for block in path.read_text().split('\n\n'):
        languages={};parents=[]
        for line in block.splitlines():
            if line.startswith('< '):parents.append(key(line[2:].strip().removeprefix('en:').strip()))
            elif re.match(r'^(en|de):',line):
                lang,value=line.split(':',1);languages[lang]=[v.strip() for v in value.split(',') if v.strip()]
        if not languages.get('en'):continue
        identity=key(languages['en'][0]);nodes[identity]={'languages':languages,'parents':parents}
        for term in languages['en']:aliases[key(term)]=identity
    def department(identity):
        queue=[identity];seen=set()
        while queue and len(seen)<100:
            parent=queue.pop(0)
            current=aliases.get(parent,parent)
            if current in seen:continue
            seen.add(current)
            for category,pattern in ROOTS:
                if re.fullmatch(pattern,current):return category
            queue.extend(nodes.get(current,{}).get('parents',[]))
        return None
    entries=[]
    reject=r'aroma|extrakt|säure|saeure|emulgator|stabilisator|farbstoff|konservierungs|hydrolys|enzym|imazalil|vitamin|isolat|protein|salzsäure|sulfat|phosphat|eisenoxid'
    for identity,node in nodes.items():
        german=node['languages'].get('de',[])
        if not german:continue
        category=department(identity)
        if not category:continue
        terms=[clean(term) for term in german if not re.search(reject,term,re.I)]
        terms=[term for term in terms if term and len(term)<=70]
        if not terms:continue
        entries.append({'id':'en:'+identity.replace(' ','-'),'name':terms[0],'aliases':terms[1:5],'department':category})
    return sorted(entries,key=lambda e:(key(e['name']),e['id']))
def write(path,data):path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--bls',type=Path,required=True);parser.add_argument('--off',type=Path,required=True);parser.add_argument('--off-commit',required=True);parser.add_argument('--output',type=Path,default=Path('data/catalog'));args=parser.parse_args()
    if not re.fullmatch('[0-9a-f]{40}',args.off_commit):raise ValueError('Pinned OFF commit required')
    args.output.mkdir(parents=True,exist_ok=True)
    bls=import_bls(args.bls);off=import_off(args.off)
    if not 500<=len(bls)<=10000 or not 100<=len(off)<=5000:raise ValueError('Unexpected import size; review source format')
    write(args.output/'bls.json',bls);write(args.output/'open-food-facts.json',off)
    unique={}
    for item in bls+off:
        identity=key(item['name'])
        if identity not in unique:unique[identity]=[item['name'],item['aliases'],item['department']]
        else:unique[identity][1]=list(dict.fromkeys(unique[identity][1]+item['aliases']))[:6]
    search=sorted(unique.values(),key=lambda row:key(row[0]))
    write(args.output/'search.json',search)
    metadata={'search_entries':len(search),'format_version':VERSION,'date':'2026-11-12','sources':[
      {'id':'bls','version':'4.0 (2025)','publisher':'Max Rubner-Institut','url':'https://blsdb.de/download','license':'CC-BY-4.0','license_url':'https://creativecommons.org/licenses/by/4.0/','attribution':'Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank.','sha256':hashlib.sha256(args.bls.read_bytes()).hexdigest(),'entries':len(bls)},
      {'id':'open-food-facts','version':args.off_commit,'publisher':'Open Food Facts contributors','url':'https://github.com/openfoodfacts/openfoodfacts-server/blob/'+args.off_commit+'/taxonomies/food/ingredients.txt','license':'ODbL-1.0','license_url':'https://opendatacommons.org/licenses/odbl/1-0/','attribution':'Contains information from Open Food Facts, made available under the Open Database License (ODbL).','sha256':hashlib.sha256(args.off.read_bytes()).hexdigest(),'entries':len(off)}]}
    write(args.output/'SOURCES.json',metadata);print(json.dumps({'bls':len(bls),'open_food_facts':len(off)}))
if __name__=='__main__':main()
