import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, useDeferredValue } from "react";
import * as d3 from "d3";
import JSZip from "jszip";

// Colour themes. C is mutated in place by applyTheme(); components read C when they render.
const THEMES={
  dark:{bg:"#0c0f14",card:"#141820",cardHover:"#1a1f2b",border:"#1e2430",text:"#c8cdd8",textDim:"#6b7280",textBright:"#e8ecf4",accent:"#d4a953",accentDim:"#a07d30",teal:"#3fb8af",tealDim:"#2a7a74",rose:"#e06c75",purple:"#b48ead",blue:"#5b9bd5",green:"#7fb685",orange:"#e09956",onAccent:"#0c0f14"},
  light:{bg:"#e7e9ed",card:"#f6f7f9",cardHover:"#eceef2",border:"#cdd2da",text:"#2c323c",textDim:"#5d6572",textBright:"#10141b",accent:"#94660a",accentDim:"#c9a14e",teal:"#0d7a73",tealDim:"#62aea8",rose:"#b8404a",purple:"#80508f",blue:"#2c66a8",green:"#3b7f45",orange:"#a85d1c",onAccent:"#ffffff"},
};
const C={...THEMES.dark};
const _themeHooks=[];                       // module-level values derived from C, refreshed on theme change
function applyTheme(name){
  Object.assign(C,THEMES[name]||THEMES.dark);
  _themeHooks.forEach(f=>f());
  try{document.documentElement.style.background=C.bg;document.body.style.background=C.bg;document.documentElement.style.colorScheme=name==="light"?"light":"dark";}catch(e){}
}
// Swap colours in already drawn charts (d3/SVG) from one theme to the other, so that zoom, layouts,
// simulations and selections stay exactly as they are. Handles #rrggbb and #rrggbbaa values.
function recolorCharts(from,to){
  const map=new Map();for(const k of Object.keys(from))if(k!=="onAccent"&&to[k])map.set(String(from[k]).toLowerCase(),to[k]);
  const swap=v=>{if(!v||v[0]!=="#"||(v.length!==7&&v.length!==9))return null;const n=map.get(v.slice(0,7).toLowerCase());return n?n+v.slice(7):null;};
  try{for(const el of document.querySelectorAll("svg, svg *")){
    for(const a of["fill","stroke","stop-color","color"]){const n=swap(el.getAttribute(a));if(n)el.setAttribute(a,n);}
    for(const a of["fill","stroke"]){const n=swap(el.style&&el.style[a]);if(n)el.style[a]=n;}
  }}catch(e){}
}
function savedTheme(){try{return localStorage.getItem("biblioscope-theme")==="light"?"light":"dark";}catch(e){return"dark";}}
applyTheme(savedTheme());
const PAL=["#d4a953","#3fb8af","#e06c75","#b48ead","#5b9bd5","#7fb685","#e09956","#c678dd","#61afef","#98c379","#d19a66","#56b6c2","#e5c07b","#be5046","#8fbcbb"];
const mono="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const SRC_COLORS={wos:"#5b9bd5",scopus:"#e09956",openalex:"#7fb685",manual:"#b48ead"};
const SRC_LABELS={wos:"Web of Science",scopus:"Scopus",openalex:"OpenAlex",manual:"Manual",biblioscope:"BiblioScope collection"};

/* ═══ SOURCE DETECTION ═══ */
function detectSource(text){
  const head=text.slice(0,2000);
  if(/^(\uFEFF)?FN\s+Clarivate/m.test(head))return"wos";
  if(/^(PT|AU|AF|TI|SO) /m.test(head)&&/^ER$/m.test(text.slice(0,10000)))return"wos";
  const trimmed=text.trimStart();
  if(trimmed[0]==="{"&&/"format"\s*:\s*"biblioscope-collection"/.test(head))return"biblioscope";
  const headJ=text.slice(0,20000);
  if(trimmed[0]==="{"&&/"(works|results)"\s*:\s*\[/.test(headJ)&&(/"augmented_by"/.test(headJ)||/openalex\.org/.test(headJ)))return"openalex_json";
  const firstLine=head.split(/\r?\n/)[0];
  // OpenAlex CSV: API column names (authorships.author.display_name) or the web interface's names (Work ID, Title, Cites …)
  if(/authorships\.author\.display_name/i.test(firstLine)||(/(^|,)"?Title"?(,|$)/.test(firstLine)&&/(^|,)"?(Work ID|Cites|Citation count)"?(,|$)/.test(firstLine)&&!/(^|,)"?Authors"?(,|$)/.test(firstLine)))return"openalex_csv";
  if(/(\"EID\"|,EID,|\"Abbreviated Source Title\")/i.test(firstLine))return"scopus";
  if(firstLine.includes('"Authors"')&&firstLine.includes('"Title"')&&firstLine.includes('"Year"'))return"scopus";
  return null;
}

/* ═══ HELPERS ═══ */
function splitField(v,sep="\n"){return v?v.split(sep).map(s=>s.trim()).filter(Boolean):[];}
/* Country reference table: display name | ISO-2 | ISO numeric (matches world-atlas ids) | aliases */
const COUNTRY_TABLE=`USA|US|840|United States,United States of America,U.S.A.,US
UK|GB|826|United Kingdom,England,Scotland,Wales,North Ireland,Northern Ireland,Great Britain
China|CN|156|Peoples R China,People's Republic of China,Peoples Republic of China,PR China,P.R. China
Afghanistan|AF|004|
Albania|AL|008|
Algeria|DZ|012|
Angola|AO|024|
Argentina|AR|032|
Armenia|AM|051|
Australia|AU|036|
Austria|AT|040|
Azerbaijan|AZ|031|
Bahrain|BH|048|
Bangladesh|BD|050|
Belarus|BY|112|
Belgium|BE|056|
Belize|BZ|084|
Benin|BJ|204|
Bhutan|BT|064|
Bolivia|BO|068|
Bosnia and Herzegovina|BA|070|Bosnia & Herceg,Bosnia & Herzegovina,Bosnia and Herz.
Botswana|BW|072|
Brazil|BR|076|
Brunei|BN|096|Brunei Darussalam
Bulgaria|BG|100|
Burkina Faso|BF|854|
Burundi|BI|108|
Cambodia|KH|116|
Cameroon|CM|120|
Canada|CA|124|
Central African Republic|CF|140|Central African Rep.,Cent Afr Republ
Chad|TD|148|
Chile|CL|152|
Colombia|CO|170|
Congo|CG|178|Rep Congo,Republic of the Congo
DR Congo|CD|180|Dem Rep Congo,Democratic Republic of the Congo,Dem. Rep. Congo,Congo, Democratic Republic of the
Costa Rica|CR|188|
Cote d'Ivoire|CI|384|Côte d'Ivoire,Cote Ivoire,Ivory Coast
Croatia|HR|191|
Cuba|CU|192|
Cyprus|CY|196|
Czech Republic|CZ|203|Czechia
Denmark|DK|208|
Dominican Republic|DO|214|Dominican Rep,Dominican Rep.
Ecuador|EC|218|
Egypt|EG|818|
El Salvador|SV|222|
Eritrea|ER|232|
Estonia|EE|233|
Eswatini|SZ|748|Swaziland
Ethiopia|ET|231|
Fiji|FJ|242|
Finland|FI|246|
France|FR|250|
Gabon|GA|266|
Gambia|GM|270|
Georgia|GE|268|Rep of Georgia
Germany|DE|276|Fed Rep Ger
Ghana|GH|288|
Greece|GR|300|
Greenland|GL|304|
Guatemala|GT|320|
Guinea|GN|324|
Guyana|GY|328|
Haiti|HT|332|
Honduras|HN|340|
Hong Kong|HK|344|
Hungary|HU|348|
Iceland|IS|352|
India|IN|356|
Indonesia|ID|360|
Iran|IR|364|Iran, Islamic Republic of
Iraq|IQ|368|
Ireland|IE|372|
Israel|IL|376|
Italy|IT|380|
Jamaica|JM|388|
Japan|JP|392|
Jordan|JO|400|
Kazakhstan|KZ|398|
Kenya|KE|404|
Kosovo|XK||
Kuwait|KW|414|
Kyrgyzstan|KG|417|
Laos|LA|418|Lao People's Democratic Republic
Latvia|LV|428|
Lebanon|LB|422|
Lesotho|LS|426|
Liberia|LR|430|
Libya|LY|434|
Lithuania|LT|440|
Luxembourg|LU|442|
Macao|MO|446|Macau
Madagascar|MG|450|
Malawi|MW|454|
Malaysia|MY|458|
Mali|ML|466|
Malta|MT|470|
Mauritania|MR|478|
Mauritius|MU|480|
Mexico|MX|484|
Moldova|MD|498|
Mongolia|MN|496|
Montenegro|ME|499|
Morocco|MA|504|
Mozambique|MZ|508|
Myanmar|MM|104|Burma
Namibia|NA|516|
Nepal|NP|524|
Netherlands|NL|528|The Netherlands
New Zealand|NZ|554|
Nicaragua|NI|558|
Niger|NE|562|
Nigeria|NG|566|
North Korea|KP|408|Dem. Rep. Korea
North Macedonia|MK|807|Macedonia,Rep of North Macedonia,Macedonia.
Norway|NO|578|
Oman|OM|512|
Pakistan|PK|586|
Palestine|PS|275|
Panama|PA|591|
Papua New Guinea|PG|598|
Paraguay|PY|600|
Peru|PE|604|
Philippines|PH|608|
Poland|PL|616|
Portugal|PT|620|
Puerto Rico|PR|630|
Qatar|QA|634|
Romania|RO|642|
Russia|RU|643|Russian Federation
Rwanda|RW|646|
Saudi Arabia|SA|682|
Senegal|SN|686|
Serbia|RS|688|
Sierra Leone|SL|694|
Singapore|SG|702|
Slovakia|SK|703|
Slovenia|SI|705|
Somalia|SO|706|
South Africa|ZA|710|
South Korea|KR|410|Korea,Republic of Korea,Korea, Republic of,Korea (South)
South Sudan|SS|728|S. Sudan
Spain|ES|724|
Sri Lanka|LK|144|
Sudan|SD|729|
Suriname|SR|740|
Sweden|SE|752|
Switzerland|CH|756|
Syria|SY|760|Syrian Arab Republic
Taiwan|TW|158|
Tajikistan|TJ|762|
Tanzania|TZ|834|
Thailand|TH|764|
Togo|TG|768|
Trinidad and Tobago|TT|780|Trinidad & Tobago
Tunisia|TN|788|
Turkey|TR|792|Turkiye,Türkiye
Turkmenistan|TM|795|
Uganda|UG|800|
Ukraine|UA|804|
United Arab Emirates|AE|784|U Arab Emirates,UAE
Uruguay|UY|858|
Uzbekistan|UZ|860|
Venezuela|VE|862|
Vietnam|VN|704|Viet Nam
Yemen|YE|887|
Zambia|ZM|894|
Zimbabwe|ZW|716|`;
const COUNTRY_BY_ALIAS=new Map(), COUNTRY_BY_ISO2=new Map(), COUNTRY_BY_NUM=new Map();
for(const line of COUNTRY_TABLE.split("\n")){
  const[name,iso2,num,aliases]=line.split("|");
  const rec={name,iso2,num};
  COUNTRY_BY_ALIAS.set(name.toLowerCase(),rec);
  for(const a of (aliases||"").split(",").map(x=>x.trim()).filter(Boolean))COUNTRY_BY_ALIAS.set(a.toLowerCase(),rec);
  COUNTRY_BY_ISO2.set(iso2,rec);
  if(num)COUNTRY_BY_NUM.set(num,rec);
}
// isoCodes=true for sources (OpenAlex) that report two-letter ISO codes
function normalizeCountry(c,isoCodes=false){
  if(!c)return"";c=String(c).trim().replace(/\.$/,"");
  if(isoCodes&&/^[A-Z]{2}$/.test(c)&&COUNTRY_BY_ISO2.has(c))return COUNTRY_BY_ISO2.get(c).name;
  const hit=COUNTRY_BY_ALIAS.get(c.toLowerCase());
  if(hit)return hit.name;
  if(/^[A-Z]{2}\s+\d{0,5}\s*USA$/.test(c)||/\bUSA$/.test(c))return"USA";
  return c;
}

/* Pick the organisation-level unit out of a free-text affiliation string
   ("Department of X, University Y, City, Country" → "University Y"). */
const SUBUNIT_RX=/^(dep(ar)?t\.?|department|faculty|division|section|unit|school of|college of|key laboratory|laboratory of|lab of|graduate school|centre for|center for|program|programme|chair|group)\b/i;
function institutionFromAffiliation(aff){
  const segs=String(aff||"").replace(/^[a-z]\.\s+/i,"").split(",").map(x=>x.trim().replace(/^[a-z]\.\s+/i,"")).filter(Boolean);
  if(!segs.length)return"";
  const body=segs.length>2?segs.slice(0,-1):segs;      // drop trailing country
  const pick=rx=>body.find(x=>rx.test(x)&&!SUBUNIT_RX.test(x));
  return pick(/universi|\buniv\b|universidad|università|universität|université|politecnic|polytechnic/i)
      || pick(/hospital|clinic|academy|academia|institut|college|\bcentre\b|\bcenter\b|foundation|council|agency|ministry|laborator|corporation|company|\binc\b|\bltd\b|gmbh|\bplc\b|\bag\b/i)
      || body.find(x=>!SUBUNIT_RX.test(x)&&!/\d/.test(x))
      || body[0];
}
function formatAuthorName(name){if(!name)return"";const parts=name.split(/\s+/);if(parts.length<2)return name;const last=parts[parts.length-1];const initials=parts.slice(0,-1).map(p=>p[0]+".").join("");return`${last}, ${initials}`;}

/* ═══ CSV PARSER ═══ */
function parseCSV(text){const rows=[];let row=[],field="",inQuote=false,i=0;if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);while(i<text.length){const ch=text[i];if(inQuote){if(ch==='"'&&text[i+1]==='"'){field+='"';i+=2;}else if(ch==='"'){inQuote=false;i++;}else{field+=ch;i++;}}else{if(ch==='"'){inQuote=true;i++;}else if(ch===','){row.push(field);field="";i++;}else if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.length>1||row[0]!=="")rows.push(row);row=[];field="";i++;}else{field+=ch;i++;}}}if(field||row.length)row.push(field);if(row.length&&(row.length>1||row[0]!==""))rows.push(row);if(!rows.length)return[];const headers=rows[0];return rows.slice(1).map(r=>{const obj={};headers.forEach((h,j)=>obj[h]=r[j]||"");return obj;});}

/* ═══ WOS PARSER ═══ */
function parseWosText(text){const records=[];let cur={},tag=null;for(const line of text.split(/\r?\n/)){if(line.startsWith("FN ")||line.startsWith("VR "))continue;if(line.trimEnd()==="ER"){if(Object.keys(cur).length)records.push(cur);cur={};tag=null;continue;}if(line.length>=3&&line[2]===" "&&/^[A-Z][A-Z0-9]$/.test(line.slice(0,2))){tag=line.slice(0,2);const val=line.slice(3);cur[tag]=cur[tag]?cur[tag]+"\n"+val:val;}else if(/^   /.test(line)&&tag){cur[tag]+="\n"+line.trim();}}if(Object.keys(cur).length)records.push(cur);return records;}

function wosToUnified(raw){
  const extractCountries=(c1)=>{if(!c1)return[];const out=[];for(const p of c1.split("\n")){const s=p.trim().split(",").map(x=>x.trim());if(s.length){let last=s[s.length-1].replace(/\.\s*$/,"").replace(/\d{3,}/g,"").trim();if(last)out.push(last);}}return out;};
  return raw.map(r=>{
    const rawCo=extractCountries(r.C1||"");
    const c1Lines=splitField(r.C1);
    // Affiliations: extract institution from "[Author] Univ X, Dept Y, City, Country"
    const c1Full=c1Lines.map(l=>{const m=l.match(/^\[.*?\]\s*(.*)/);return m?m[1].trim():l.trim();}).filter(Boolean);
    return {
      _src:"wos",ti:(r.TI||"").replace(/\n/g," "),au:splitField(r.AU),af:splitField(r.AF),
      so:(r.SO||"").replace(/\s*\n\s*/g," ").trim(),py:parseInt(r.PY)||0,pd:(r.PD||"").trim(),
      dt:(r.DT||"").trim(),de:splitField((r.DE||"").replace(/\s*\n\s*/g," "),";"),id:splitField((r.ID||"").replace(/\s*\n\s*/g," "),";"),
      wc:splitField(r.WC,";").map(w=>w.replace(/\n/g," ")),sc:splitField((r.SC||"").replace(/\s*\n\s*/g," "),";"),
      tc:parseInt(r.TC)||0,nr:parseInt(r.NR)||0,oa:(r.OA||"").trim(),
      la:(r.LA||"").trim(),ab:(r.AB||"").replace(/\n/g," ").trim(),
      co:rawCo,coNorm:[...new Set(rawCo.map(normalizeCountry))].filter(Boolean),
      c3:[...new Set(splitField((r.C3||"").replace(/\s*\n\s*/g," "),";"))],c1Full,
      pg:/^\d+$/.test((r.PG||"").trim())?parseInt(r.PG):0,
      di:(r.DI||"").trim().toLowerCase(),j9:(r.J9||"").trim().toUpperCase(),sn:issnList(r.SN,r.EI),
      vl:(r.VL||"").trim(),bp:(r.BP||"").trim(),ep:(r.EP||"").trim(),is:(r.IS||"").trim(),
      ut:(r.UT||"").trim(),em:(r.EM||"").trim(),rp:(r.RP||"").replace(/\n/g,"; ").trim(),
      crRaw:splitField(r.CR,"\n"),oaId:"",crOaIds:[],
      pm:(r.PM||"").trim(),fu:parseFundersWos(r.FU),fx:(r.FX||"").replace(/\s*\n\s*/g," ").trim(),oaAll:r.OA?[(r.OA||"").replace(/\s*\n\s*/g," ").trim()]:[],sdg:[],ind:{},ot:[],
    };
  });
}

/* ═══ SCOPUS PARSER ═══ */
function scopusRefSplit(refsStr){if(!refsStr)return[];const parts=[];const re=/\((\d{4})\);\s*/g;let last=0,m;while((m=re.exec(refsStr))!==null){parts.push(refsStr.slice(last,m.index)+"("+m[1]+")");last=re.lastIndex;}if(last<refsStr.length){const tail=refsStr.slice(last).trim();if(tail)parts.push(tail);}return parts;}

function scopusToUnified(rows){
  return rows.map(r=>{
    const au=(r["Authors"]||"").split(";").map(s=>s.trim()).filter(Boolean);
    const afFull=(r["Author full names"]||"").split(";").map(s=>s.trim()).filter(Boolean);
    const de=(r["Author Keywords"]||"").split(";").map(s=>s.trim()).filter(Boolean);
    const id=(r["Index Keywords"]||"").split(";").map(s=>s.trim()).filter(Boolean);
    const affils=(r["Affiliations"]||"").split(";").map(s=>s.trim()).filter(Boolean);
    const rawCo=affils.map(a=>{const parts=a.split(",").map(s=>s.trim());return parts[parts.length-1]||"";}).filter(c=>c&&COUNTRY_BY_ALIAS.has(c.toLowerCase()));
    const coNorm=[...new Set(rawCo.map(normalizeCountry))].filter(Boolean);
    const c3=[...new Set(affils.map(institutionFromAffiliation).filter(Boolean))];
    const doi=(r["DOI"]||"").trim().toLowerCase();
    const ps=parseInt(r["Page start"])||0,pe=parseInt(r["Page end"])||0;
    const crRaw=scopusRefSplit(r["References"]||"");
    const j9=(r["Abbreviated Source Title"]||"").trim().toUpperCase();
    return {
      _src:"scopus",ti:(r["Title"]||"").trim(),au,af:afFull,
      so:(r["Source title"]||"").trim(),sn:issnList(r["ISSN"]),py:parseInt(r["Year"])||0,pd:"",
      dt:(r["Document Type"]||"").trim(),de,id,wc:[],sc:[],
      tc:parseInt(r["Cited by"])||0,nr:crRaw.length,oa:(r["Open Access"]||"").trim(),
      la:(r["Language of Original Document"]||"").trim(),ab:(r["Abstract"]||"").trim(),
      co:rawCo,coNorm,c3,c1Full:affils,
      pg:ps&&pe?pe-ps+1:0,di:doi,j9,vl:(r["Volume"]||"").trim(),
      bp:String(ps||""),ep:String(pe||""),is:(r["Issue"]||"").trim(),
      ut:(r["EID"]||"").trim(),em:(r["Correspondence Address"]||"").trim(),rp:"",
      crRaw,oaId:"",crOaIds:[],
      pm:(r["PubMed ID"]||"").trim(),fu:parseFundersScopus(r["Funding Details"]),fx:(r["Funding Texts"]||"").trim(),oaAll:r["Open Access"]?[(r["Open Access"]||"").trim()]:[],sdg:[],ind:{},ot:[],
    };
  });
}

/* ═══ OPENALEX JSON PARSER ═══ */
let _oaLookup={};

function openalexJsonToUnified(text){
  const data=JSON.parse(text);const works=data.works||data.results||(Array.isArray(data)?data:[]);
  const enrich=data.meta&&data.meta.mode==="enrich";   // Open Sources Augmenter output: only adds indicators to matching records
  if(data.referenced_works_lookup)Object.assign(_oaLookup,data.referenced_works_lookup);
  return works.map(w=>{
    const auRaw=(w.authorships||[]).map(a=>a.author?.display_name||a.raw_author_name||"").filter(Boolean);
    const auFormatted=auRaw.map(formatAuthorName);
    const countries=[...new Set((w.authorships||[]).flatMap(a=>a.countries||[]))];
    const coNorm=[...new Set(countries.map(c=>normalizeCountry(c,true)))].filter(Boolean);
    const insts=(w.authorships||[]).flatMap(a=>(a.institutions||[]).map(inst=>inst.display_name).filter(Boolean));
    const c3=[...new Set(insts)];
    const c1Full=(w.authorships||[]).map(a=>{const inst=(a.institutions||[]).map(i=>i.display_name).join(", ");const co=(a.countries||[]).join(", ");return[inst,co].filter(Boolean).join(", ");}).filter(Boolean);
    let doi=(w.doi||"").trim().toLowerCase().replace(/^https?:\/\/doi\.org\//,"");
    const source=w.primary_location?.source;const so=source?.display_name||"";
    const de=(w.keywords||[]).map(k=>k.display_name).filter(Boolean);
    const topics=(w.topics||[]).map(t=>t.display_name).filter(Boolean);
    const primaryTopic=w.primary_topic?.display_name||"";
    const subfield=w.primary_topic?.subfield?.display_name||"";
    const field=w.primary_topic?.field?.display_name||"";
    const biblio=w.biblio||{};const ps=parseInt(biblio.first_page)||0,pe=parseInt(biblio.last_page)||0;
    const refWorks=(w.referenced_works||[]);
    return {
      _src:"openalex",ti:(w.title||w.display_name||"").trim(),au:auFormatted,af:auRaw,
      so,py:parseInt(w.publication_year)||0,pd:(w.publication_date||"").trim(),
      dt:(w.type||"").trim(),de,id:topics.slice(0,5),
      wc:primaryTopic?[primaryTopic]:[],sc:[subfield,field].filter(Boolean),
      tc:parseInt(w.cited_by_count)||0,nr:refWorks.length,oa:w.open_access?.oa_status||"",
      la:(w.language||"").trim(),ab:invertedAbstract(w.abstract_inverted_index)||(typeof w.abstract==="string"?w.abstract:""),
      co:countries,coNorm,c3,c1Full,
      pg:ps&&pe?pe-ps+1:0,di:doi,j9:"",sn:issnList(source?.issn||[],source?.issn_l),vl:(biblio.volume||"").toString(),
      bp:(biblio.first_page||"").toString(),ep:(biblio.last_page||"").toString(),is:(biblio.issue||"").toString(),
      ut:(w.id||"").trim(),em:"",rp:"",
      crRaw:[],oaId:(w.id||"").trim(),crOaIds:refWorks,
      pm:String(w.ids?.pmid||"").replace(/^.*\//,""),fu:parseFundersOpenAlex(w),fx:"",oaAll:w.open_access?.oa_status?[w.open_access.oa_status]:[],
      sdg:parseSdgs(w.sustainable_development_goals),_sdgKnown:Array.isArray(w.sustainable_development_goals),
      ind:openalexIndicators(w),ot:openalexOrgTypes(w),
      ...(enrich?{_enrich:true,_enrichSrc:data.meta.sources||["OpenAlex"]}:{}),
    };
  });
}

function invertedAbstract(inv){if(!inv||typeof inv!=="object")return"";const pos=[];for(const [word,ps] of Object.entries(inv))for(const p of ps||[])pos[p]=word;return pos.filter(x=>x!=null).join(" ");}
function openalexIndicators(w){const o={};
  if(typeof w.fwci==="number")o.fwci=w.fwci;const p=w.citation_normalized_percentile;
  if(p&&typeof p.value==="number"){o.pctl=Math.round(p.value*1000)/10;o.top10=!!p.is_in_top_10_percent;o.top1=!!p.is_in_top_1_percent;}
  if(typeof w.cited_by_count==="number")o.oaCites=w.cited_by_count;
  const x=w._biblioscope||{};   // values added by the Open Sources Augmenter (iCite, OpenAIRE)
  for(const k of ["rcr","rcrProv","nihPctl","citedByClin","bipInfluence","bipPopularity","bipImpulse","bipInfluenceClass","bipPopularityClass","bipImpulseClass","views","downloads"])if(x[k]!=null)o[k]=x[k];
  return o;}
function openalexOrgTypes(w){const m=new Map();for(const a of w.authorships||[])for(const i of a.institutions||[])if(i.display_name&&!m.has(i.display_name))m.set(i.display_name,{n:i.display_name,t:i.type||"other",ror:i.ror||""});return[...m.values()];}

/* ═══ OPENALEX CSV PARSER (legacy) ═══ */
function openalexCsvToUnified(rows){
  const pk=(r,...ks)=>{for(const k of ks){const v=r[k];if(v!=null&&String(v).trim()!=="")return String(v).trim();}return"";};
  const pipe=v=>String(v||"").split("|").map(s=>s.trim()).filter(Boolean);
  const num=v=>{const x=parseFloat(v);return Number.isFinite(x)?x:null;};
  return rows.map(r=>{
    const au=pipe(pk(r,"authorships.author.display_name","Author"));
    const auFormatted=au.map(formatAuthorName);
    const countries=pipe(pk(r,"authorships.countries"));
    const coNorm=[...new Set(countries.map(c=>normalizeCountry(c,true)))].filter(Boolean);
    const insts=pipe(pk(r,"authorships.institutions.display_name"));
    const c3=[...new Set(insts)];let doi=pk(r,"doi","DOI").toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//,"");
    const topic=pk(r,"primary_topic.display_name","Subfield","Topic");
    let wid=pk(r,"id","Work ID");if(/^W\d+$/i.test(wid))wid="https://openalex.org/"+wid.toUpperCase();
    // open access: API status (gold, green …) or the web interface's "Open Access" / "NOT Open Access"
    const oaRaw=pk(r,"open_access.oa_status","Open access","Open Access");
    // indicators in the export
    const ind={};const fw=num(pk(r,"fwci","FWCI"));if(fw!=null)ind.fwci=fw;
    const pc=num(pk(r,"citation_normalized_percentile.value","Citation percentile by subfield"));
    if(pc!=null){ind.pctl=Math.round(pc*1000)/10;ind.top10=pc>=0.9;ind.top1=pc>=0.99;ind.pctlFromCsv=true;}
    const fu=pipe(pk(r,"funders.display_name")).map(n=>({n,a:"",g:[],ror:""}));
    const cites=pipe(pk(r,"Cites","referenced_works")).map(x=>/^W\d+$/i.test(x)?"https://openalex.org/"+x.toUpperCase():x).filter(x=>/openalex\.org\/W\d+/i.test(x));
    return {
      _src:"openalex",ti:pk(r,"display_name","Title"),au:auFormatted,af:au,
      so:pk(r,"primary_location.source.display_name","Source"),
      py:parseInt(pk(r,"publication_year","Year"))||0,pd:pk(r,"publication_date"),
      dt:pk(r,"type"),de:[],id:topic?[topic]:[],wc:topic?[topic]:[],sc:topic?[topic]:[],
      tc:parseInt(pk(r,"cited_by_count","Citation count"))||0,nr:cites.length,oa:oaRaw,oaAll:oaRaw?[oaRaw]:[],
      la:pk(r,"language"),ab:pk(r,"abstract","Abstract"),
      co:countries,coNorm,c3,c1Full:insts,
      pg:0,di:doi,j9:"",sn:issnList(pk(r,"primary_location.source.issn","primary_location.source.issn_l","ISSN")),vl:"",bp:"",ep:"",is:"",
      ut:wid,em:"",rp:"",
      crRaw:[],oaId:wid,crOaIds:cites,
      pm:String(pk(r,"ids.pmid","PMID")).replace(/^.*\//,""),fu,fx:"",sdg:[],ind,ot:[],
    };
  });
}


/* ═══ INDICATORS (0.99): open access, Agenda 2030, sectors, funders ═══ */

// ── Funding fields ──
function _splitOutside(s,sep,open,close){const out=[];let depth=0,cur="";for(const ch of String(s||"")){if(ch===open)depth++;else if(ch===close)depth=Math.max(0,depth-1);if(ch===sep&&!depth){out.push(cur);cur="";}else cur+=ch;}out.push(cur);return out.map(x=>x.trim()).filter(Boolean);}
// WoS FU: "Funder A [grant1, grant2]; Funder B"
function parseFundersWos(fu){
  return _splitOutside(String(fu||"").replace(/\s*\n\s*/g," "),";","[","]").map(part=>{
    const g=[...part.matchAll(/\[([^\]]*)\]/g)].flatMap(m=>m[1].split(",").map(x=>x.trim()).filter(Boolean));
    const n=part.replace(/\[[^\]]*\]/g,"").replace(/\s+/g," ").trim().replace(/[,;.]$/,"");
    return n?{n,a:"",g}:null;}).filter(Boolean);
}
// Scopus Funding Details: "Funder A, ACR, (grant1, grant2); Funder B"
function parseFundersScopus(fd){
  return _splitOutside(fd,";","(",")").map(part=>{
    const g=[...part.matchAll(/\(([^)]*)\)/g)].flatMap(m=>m[1].split(",").map(x=>x.trim()).filter(Boolean));
    const parts=part.replace(/\([^)]*\)/g,"").split(",").map(x=>x.trim()).filter(Boolean);
    let a="";const last=parts[parts.length-1]||"";if(parts.length>1&&((/^[A-Z0-9&.\-\s]{2,15}$/.test(last)&&/[A-Z]/.test(last))||(/^[A-Za-z0-9&.\-]{2,12}$/.test(last)&&(last.match(/[A-Z]/g)||[]).length>=2)))a=parts.pop();
    const n=parts.join(", ");return n?{n,a,g}:null;}).filter(Boolean);
}
function parseFundersOpenAlex(w){
  const m=new Map();
  for(const f of w.funders||[]){if(f.display_name)m.set(f.id||f.display_name,{n:f.display_name,a:"",g:[],ror:f.ror||""});}
  for(const a of w.awards||[]){const k=a.funder_id||a.funder_display_name;if(!k)continue;if(!m.has(k))m.set(k,{n:a.funder_display_name||"",a:"",g:[],ror:""});if(a.funder_award_id)m.get(k).g.push(String(a.funder_award_id));}
  return[...m.values()].filter(f=>f.n);
}
function mergeFunders(x,y){const out=[...(x||[])];const key=f=>funderKey(f.n);const idx=new Map(out.map((f,i)=>[key(f),i]));
  for(const f of y||[]){const k=key(f);if(idx.has(k)){const o=out[idx.get(k)];out[idx.get(k)]={...o,a:o.a||f.a,ror:o.ror||f.ror,g:[...new Set([...(o.g||[]),...(f.g||[])])]};}else{idx.set(k,out.length);out.push(f);}}
  return out;}

const FUNDER_ALIASES={
  "natural science foundation of china":"national natural science foundation of china","nsfc":"national natural science foundation of china",
  "national science foundation of china":"national natural science foundation of china",
  "national key r and d program of china":"national key research and development program of china",
  "national key research and development programme of china":"national key research and development program of china",
  "nih":"national institutes of health","us national institutes of health":"national institutes of health",
  "nsf":"national science foundation","us national science foundation":"national science foundation",
  "erc":"european research council","dfg":"deutsche forschungsgemeinschaft","german research foundation":"deutsche forschungsgemeinschaft",
  "vr":"swedish research council","vetenskapsradet":"swedish research council",
};
function funderKey(n){
  let s=stripDiacritics(String(n||"").toLowerCase()).replace(/\([^)]*\)/g," ").replace(/&/g," and ").replace(/\br\s*and\s*d\b/g,"research and development")
    .replace(/programme/g,"program").replace(/[^a-z0-9]+/g," ").replace(/^the /,"").replace(/\s+/g," ").trim();
  return FUNDER_ALIASES[s]||s;
}
// Canonical funders of a collection: key → display name; acronyms given by Scopus are mapped to the full name
function buildFunderCanon(records){
  const forms=new Map(),acr=new Map();
  for(const r of records)for(const f of r.fu||[]){const k=funderKey(f.n);if(!k)continue;if(!forms.has(k))forms.set(k,new Map());forms.get(k).set(f.n,(forms.get(k).get(f.n)||0)+1);
    if(f.a){const ak=funderKey(f.a);if(ak&&ak!==k&&!acr.has(ak))acr.set(ak,k);}}
  const target=k=>forms.has(k)&&acr.has(k)&&k.split(" ").length===1?acr.get(k):k;   // a bare acronym used as a funder name
  const display=new Map();
  for(const [k,m] of forms){const best=[...m].sort((a,b)=>(/[a-z]/.test(b[0])-/[a-z]/.test(a[0]))||b[1]-a[1]||a[0].length-b[0].length)[0][0];display.set(k,best);}
  const canonKey=n=>target(funderKey(n));
  return{key:canonKey,name:n=>display.get(canonKey(n))||n};
}


// Regions and cities whose science funds are public (mainly Chinese provincial and municipal programmes)
const PUBLIC_PLACES=["anhui","beijing","chongqing","fujian","gansu","guangdong","guangxi","guizhou","hainan","hebei","heilongjiang","henan","hubei","hunan","inner mongolia","jiangsu","jiangxi","jilin","liaoning","ningxia","qinghai","shaanxi","shandong","shanghai","shanxi","sichuan","tianjin","tibet","xinjiang","yunnan","zhejiang","guangzhou","shenzhen","hangzhou","nanjing","wuhan","chengdu","xiamen","suzhou","ningbo","qingdao","dalian","harbin","changsha","zhenjiang","zhangjiajie","longhua","taiwan","hong kong","macau"];
const KNOWN_FUNDER_TYPES={
  "fct":"Government / public agency","fundacao para a ciencia e a tecnologia":"Government / public agency","ncn":"Government / public agency","national science centre":"Government / public agency",
  "lpdp":"Government / public agency","indonesian endowment fund for education":"Government / public agency","tubitak":"Government / public agency","conacyt":"Government / public agency",
  "cnpq":"Government / public agency","capes":"Government / public agency","fapesp":"Government / public agency","anr":"Government / public agency","jsps":"Government / public agency","kakenhi":"Government / public agency",
  "riksbankens jubileumsfond":"Private foundation / charity","knut and alice wallenberg foundation":"Private foundation / charity","wellcome trust":"Private foundation / charity","bill and melinda gates foundation":"Private foundation / charity",
  "novo nordisk foundation":"Private foundation / charity","volkswagen foundation":"Private foundation / charity","alfred p sloan foundation":"Private foundation / charity",
};
const FUNDER_TYPES=["Government / public agency","International / EU","Private foundation / charity","University / research organisation","Company","Unclassified"];
function funderTypeRule(name){
  const s=" "+stripDiacritics(String(name||"").toLowerCase())+" ";
  if(/european (commission|union|research council|regional|social fund)|horizon (2020|europe)|\bfp7\b|\berc\b|marie (sk|curie)|world bank|world health|\bwho\b|unesco|united nations|\bundp\b|\bnato\b|interreg|\bcost action|nordforsk|nordic council|asian development bank|wellcome leap/.test(s))return"International / EU";
  const publicMark=/\bnational\b|ministr|government|\bstate\b|federal|provinc|municipal|\bcity\b|county|council|agency|department of|commission|\bprogram\b|\bplan\b|central universities|postdoctoral science|\bnsf\b|\bnih\b|\bnsfc\b|\bdfg\b|forschungsgemeinschaft|research council|vetenskapsr|vinnova|formas|\bforte\b|academy of (sciences|finland)|key research|key r ?and ?d|science and technology (bureau|department|commission|program|project|plan|fund)|natural science foundation|social science(s)? fund|planning (office|project)|talent|\b111 project|\b973\b|\b863\b|public health|health commission|bureau/;
  if(KNOWN_FUNDER_TYPES[funderKey(name)])return KNOWN_FUNDER_TYPES[funderKey(name)];
  if(/central universities|\bcams\b|\b(ugc|dst|dbt|icmr|csir|serb|aicte)\b|\b(of|in) china\b|chinese academy/.test(s))return"Government / public agency";
  if(/^\s*(eu|european union)\s*$/.test(s))return"International / EU";
  const ownFunds=/(fund|foundation|project|program|grant|initiative)/.test(s)&&/universit|college|hospital|\bschool\b|laborator/.test(s);
  if(ownFunds)return"University / research organisation";
  const placePublic=new RegExp("\\b("+PUBLIC_PLACES.join("|")+")\\b");
  const foundation=/foundation|stiftelse|stiftung|fondation|fundacion|fundacao|\btrust\b|charit|\bfund\b|\bfonds?\b|jubileumsfond|endowment|philanthrop|\binitiative\b/;
  if(placePublic.test(s)&&/fund|foundation|program|project|plan|research|science|technolog|innovation|talent|scholar|key|special/.test(s)&&!/universit|college|hospital/.test(s))return"Government / public agency";
  if(foundation.test(s)&&!publicMark.test(s))return"Private foundation / charity";
  if(/\b(inc|ltd|llc|gmbh|corp|plc|co|s ?a|ag|bv|ab|oy|as)\b\.?\s*$|company|corporation|pharmaceutic|\bgroup co|technolog(y|ies) co|elsevier|springer|clarivate|google|microsoft|\bibm\b|huawei|tencent|alibaba|novartis|pfizer|roche|siemens/.test(s))return"Company";
  if(publicMark.test(s)&&!/universit/.test(s))return"Government / public agency";
  if(/universit|college|hospital|\binstitute\b|\bschool\b|academy|polytechn|research cent(er|re)|laborator|medical cent/.test(s)){
    if(/national institutes? of health|national institute of/.test(s))return"Government / public agency";
    return"University / research organisation";}
  if(publicMark.test(s))return"Government / public agency";
  return"Unclassified";
}

// ── Organisation sectors ──
const SECTORS=["Higher education","Research institute","Healthcare","Government","Company","Nonprofit","Independent","Unclassified"];
const SECTOR_COLORS={"Higher education":"#4e79a7","Research institute":"#76b7b2","Healthcare":"#e15759","Government":"#edc948","Company":"#f28e2b","Nonprofit":"#b07aa1","Independent":"#9c755f","Unclassified":"#7b8494"};
const ROR_SECTOR={education:"Higher education",facility:"Research institute",archive:"Research institute",healthcare:"Healthcare",government:"Government",company:"Company",nonprofit:"Nonprofit",funder:"Nonprofit",other:"Unclassified"};
function sectorRule(text){
  const s=" "+stripDiacritics(String(text||"").toLowerCase())+" ";
  if(/independent (researcher|scholar|consultant|scientist)|\bunaffiliated\b|\bretired\b|private researcher/.test(s))return"Independent";
  if(/hospital|\bhosp\b|\bclinic|medical cent(er|re)|\bmed ctr\b|health (care|system|service)|\bhlth (serv|syst)|\bnhs\b|infirmary|sanatori/.test(s))return"Healthcare";
  if(/\b(inc|ltd|llc|gmbh|corp|plc|co ltd|s ?a|ag|bv|oy|kk)\b\.?(\s|$)|\bco\b,? ?ltd|company|corporation|\bconsult|elsevier|clarivate|thomson|springer|\bibm\b|google|microsoft|huawei|tencent|alibaba|\bbank\b(?! of)|pharmaceut|\bpharm\b/.test(s))return"Company";
  if(/^\s*(univ|university)\b|\buniversity\b|\buniv\b(?! hosp)/.test(s)&&!/\bhosp|hospital/.test(s))return"Higher education";
  if(/ministr|\bminist\b|government|\bgovt\b|\bnatl (inst|lab|ctr|agcy|bur|lib)|national (institute|laborator|agency|bureau|center|centre|office|library|archive)|agency|\bagcy\b|federal|bureau|municipal|commission|\bcommiss\b|\bacad sci\b|academy of sciences|\bcas\b|liberat army|state key lab|cent(ral)? bank|bank of|\bcdc\b|council|parliament|police|armed forces|\bmilitary\b/.test(s))return"Government";
  if(/foundation|\bfdn\b|\bgesell|non-?profit|\bngo\b|association|\bassoc\b|society|\bsoc\b|\btrust\b|charit|stiftung|fondation/.test(s))return"Nonprofit";
  if(/univ|college|\bcoll\b|school|\bsch\b|polytech|inst technol|institute of technology|\biit\b|faculty|\bfac\b|hochschule|ecole|universidad|universit|\bhgsk\b|hogskola|hogeschool/.test(s))return"Higher education";
  if(/research (institute|cent(er|re))|\bres (inst|ctr)\b|laborator|\blab\b|\binst\b|institute|institut|observ|museum|archive|librar|\blib\b|\bacad\b|academy/.test(s))return"Research institute";
  return"Unclassified";
}
// Organisations of a record with their sector: OpenAlex (ROR types) where available, else name rules on the address
function recordOrgs(r,ovr){
  const out=[];
  if(r.ot&&r.ot.length){for(const o of r.ot){const k=o.n.toLowerCase();out.push({n:o.n,s:ovr&&ovr[k]||ROR_SECTOR[o.t]||"Unclassified",how:ovr&&ovr[k]?"manual":"ROR (OpenAlex)"});}}
  else for(const a of r.c1Full||[]){const org=parseAffiliation(a,r._src).org||a;const k=org.toLowerCase();
    let s=ovr&&ovr[k];let how="manual";if(!s){s=sectorRule(org);how="name rule";if(s==="Unclassified"){s=sectorRule(a);}}
    out.push({n:org,s,how});}
  const seen=new Set();return out.filter(o=>{const k=o.n.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});
}

// ── Open access ──
const OA_STATUSES=["Diamond","Gold","Hybrid","Bronze","Green","Open (type not given)","Closed","Unknown"];
const OA_COLORS={"Diamond":"#8e7cc3","Gold":"#e2b93b","Hybrid":"#e08a3c","Bronze":"#a86f3c","Green":"#59a14f","Open (type not given)":"#76b7b2","Closed":"#7b8494","Unknown":"#4b5563"};
function oaTokens(r){return[...(r.oaAll||[]),r.oa].filter(Boolean).flatMap(s=>String(s).split(/[;,]/)).map(t=>t.trim().toLowerCase()).filter(Boolean);}
// One status per record (diamond > gold > hybrid > bronze > green), plus whether a green copy is also reported
function oaStatus(r){
  const t=oaTokens(r);let best=null;const rank={Diamond:0,Gold:1,Hybrid:2,Bronze:3,Green:4,"Open (type not given)":5};let green=false;
  for(const x of t){let s=null;if(/hybrid/.test(x))s="Hybrid";else if(/diamond/.test(x))s="Diamond";else if(/gold|doaj/.test(x))s="Gold";else if(/bronze|free to read/.test(x))s="Bronze";else if(/green/.test(x)){s="Green";green=true;}else if(/all open access|^open access$|^oa$|^true$/.test(x))s="Open (type not given)";
    if(s&&(best==null||rank[s]<rank[best]))best=s;}
  if(!best)best=(r._src==="manual"&&!t.length)?"Unknown":"Closed";
  return{status:best,green:green&&best!=="Green",any:!["Closed","Unknown"].includes(best)};
}

// ── Agenda 2030 ──
const SDG_NAMES=["No poverty","Zero hunger","Good health and well-being","Quality education","Gender equality","Clean water and sanitation","Affordable and clean energy","Decent work and economic growth","Industry, innovation and infrastructure","Reduced inequalities","Sustainable cities and communities","Responsible consumption and production","Climate action","Life below water","Life on land","Peace, justice and strong institutions","Partnerships for the goals"];
const SDG_COLORS=["#E5243B","#DDA63A","#4C9F38","#C5192D","#FF3A21","#26BDE2","#FCC30B","#A21942","#FD6925","#DD1367","#FD9D24","#BF8B2E","#3F7E44","#0A97D9","#56C02B","#00689D","#19486A"];
function parseSdgs(list){return(list||[]).map(s=>{const m=String(s.id||"").match(/(\d+)\s*$/);const id=m?+m[1]:0;return id>=1&&id<=17?{id,s:typeof s.score==="number"?Math.round(s.score*100)/100:null}:null;}).filter(Boolean);}
const sdgLabel=id=>`SDG ${id} ${SDG_NAMES[id-1]}`;

// ── Overrides (kept in this browser) ──
const _ovr={};const _ovrHooks=new Set();
function getOverrides(kind){if(!_ovr[kind]){try{_ovr[kind]=JSON.parse(localStorage.getItem("biblioscope-ovr-"+kind)||"{}");}catch(e){_ovr[kind]={};}}return _ovr[kind];}
function setOverride(kind,key,val){const o={...getOverrides(kind)};if(val)o[key]=val;else delete o[key];_ovr[kind]=o;try{localStorage.setItem("biblioscope-ovr-"+kind,JSON.stringify(o));}catch(e){}for(const f of _ovrHooks)f();}
function useOverrides(kind){const[,tick]=useState(0);useEffect(()=>{const f=()=>tick(t=>t+1);_ovrHooks.add(f);return()=>_ovrHooks.delete(f);},[]);return getOverrides(kind);}

function median(a){if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;}

/* ═══ DEDUP & ROUTING ═══ */
/* ═══════════════════════════════════════════════════════════════════════════
   DEDUPLICATION — multi-tier matching
   Tier 1: DOI (exact, normalized)
   Tier 2: normalized title (exact) + corroboration
   Tier 3: fuzzy title (Dice ≥ threshold) + corroboration
   Corroboration = shared author surname OR publication year within tolerance.
   Non-DOI tiers additionally require a title of sufficient length and reject
   generic titles (Editorial, Corrigendum, …) to avoid false merges.
   ═══════════════════════════════════════════════════════════════════════════ */
const SRC_PRIORITY={wos:0,scopus:1,openalex:2,manual:0};
// records the user has added or edited outrank anything freshly imported
function srcPrio(r){return(r._manual||r._edited)?-1:(SRC_PRIORITY[r._src]??9);}

const GENERIC_TITLES=new Set(["editorial","introduction","preface","foreword","corrigendum","erratum","correction","retraction","commentary","obituary","book review","reviews","letter to the editor","in this issue","contents","index","abstracts","errata","comment","reply","response","news","announcements","acknowledgements","acknowledgments","author index","subject index","front matter","back matter","table of contents","from the editor","guest editorial","call for papers"]);

function stripDiacritics(s){return s.normalize("NFKD").split("").filter(c=>{const cp=c.charCodeAt(0);return!(cp>=0x0300&&cp<=0x036f);}).join("");}

function normalizeTitle(t){
  if(!t)return"";
  let s=String(t);
  // 1. Unwrap sub/superscripts and strip remaining markup FIRST, so that
  //    HistCite<sup>TM</sup> is reduced to HistCiteTM before the trademark
  //    rules below can act on it.
  s=s.replace(/<su[bp]>(.*?)<\/su[bp]>/gi,"$1");   // CO<sub>2</sub> → CO2
  s=s.replace(/<[^>]+>/g,"");
  s=s.replace(/&amp;/gi," and ").replace(/&/g," and ");
  s=s.replace(/&[a-z]+;/gi," ");
  // 2. Trademark / registered / copyright markers are rendered inconsistently
  //    across databases: ™, (TM), <sup>TM</sup> and fused "HistCiteTM" all
  //    denote the same word. Remove every form.
  s=s.replace(/[\u2122\u00AE\u00A9]/g,"");          // ™ ® ©
  s=s.replace(/[([\[](?:tm|r|c)[)\]]/gi,"");        // (TM) [TM] (R) (C)
  //    Fused suffix: only TM is stripped. SM is deliberately excluded — it
  //    would mangle ordinary words such as "mechanism" or "criticism".
  s=s.replace(/([a-z]{3,})tm\b/gi,"$1");            // HistCiteTM / histcitetm → HistCite
  // 3. Fold to a comparable form.
  s=stripDiacritics(s);
  s=s.toLowerCase();
  s=s.replace(/[^a-z0-9]+/g," ");
  return s.trim().replace(/\s+/g," ");
}

function normalizeDoi(d){
  if(!d)return"";
  return String(d).trim().toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//,"")
    .replace(/^doi:\s*/,"")
    .replace(/[.\s]+$/,"");
}

function authorSurnameSet(auArr){
  const out=new Set();
  for(const a of auArr||[]){
    if(!a)continue;
    let s=String(a).includes(",")?String(a).split(",")[0]:String(a).trim().split(/\s+/).pop();
    s=stripDiacritics(s||"").toLowerCase().replace(/[^a-z]/g,"");
    if(s.length>=2)out.add(s);
  }
  return out;
}

function setsIntersect(a,b){for(const x of a)if(b.has(x))return true;return false;}

function diceCoefficient(t1,t2){
  const a=new Set(t1.split(" ").filter(Boolean)),b=new Set(t2.split(" ").filter(Boolean));
  if(!a.size||!b.size)return 0;
  let inter=0;for(const x of a)if(b.has(x))inter++;
  return 2*inter/(a.size+b.size);
}

// Open indicators from an Open Sources Augmenter record, added to the matching record without changing its bibliographic data
function applyEnrichment(r,e){
  return{...r,ind:{...(r.ind||{}),...(e.ind||{})},sdg:e._sdgKnown?e.sdg:(r.sdg||[]),_sdgKnown:!!(r._sdgKnown||e._sdgKnown),
    ot:(r.ot&&r.ot.length)?r.ot:(e.ot||[]),sn:(r.sn&&r.sn.length)?r.sn:(e.sn||[]),fu:mergeFunders(r.fu,e.fu),pm:r.pm||e.pm||"",oaId:r.oaId||e.oaId||"",
    oaAll:[...new Set([...(r.oaAll||[]),r.oa,...(e.oaAll||[])].filter(Boolean))],
    _enrichedBy:[...new Set([...(r._enrichedBy||[]),...(e._enrichSrc||["OpenAlex"])])]};
}
// ISSNs follow the source title that is kept, so two different journals are never linked through a merged record
function mergeIssn(p,q){const keep=(p.so&&String(p.so).trim())?p:q,other=keep===p?q:p;
  return other.so&&nameKey(other.so)!==nameKey(keep.so)?[...(keep.sn||[])]:[...new Set([...(keep.sn||[]),...(other.sn||[])])];}
// Merge two records field-by-field, keeping the richest value for each field.
function mergeRecordPair(a,b){
  const pa=srcPrio(a), pb=srcPrio(b);
  const primary=pa<=pb?a:b, secondary=pa<=pb?b:a;
  const pickStr=(x,y)=>(x&&String(x).trim())?x:y;
  const pickLonger=(x,y)=>{const sx=String(x||""),sy=String(y||"");return sy.length>sx.length?y:x;};
  const pickArr=(x,y)=>(x&&x.length)?((y&&y.length>x.length)?y:x):(y||[]);
  const unionArr=(x,y)=>[...new Set([...(x||[]),...(y||[])])];
  const merged={
    ...primary,
    ti:pickStr(primary.ti,secondary.ti),
    au:pickArr(primary.au,secondary.au),
    af:pickArr(primary.af,secondary.af),
    so:pickStr(primary.so,secondary.so),
    py:primary.py||secondary.py,
    pd:pickStr(primary.pd,secondary.pd),
    dt:pickStr(primary.dt,secondary.dt),
    la:pickStr(primary.la,secondary.la),
    ab:pickLonger(primary.ab,secondary.ab),
    de:unionArr(primary.de,secondary.de),
    id:unionArr(primary.id,secondary.id),
    wc:unionArr(primary.wc,secondary.wc),
    sc:unionArr(primary.sc,secondary.sc),
    tc:Math.max(primary.tc||0,secondary.tc||0),          // best-known global citations
    co:pickArr(primary.co,secondary.co),
    coNorm:unionArr(primary.coNorm,secondary.coNorm),
    c3:unionArr(primary.c3,secondary.c3),
    c1Full:pickArr(primary.c1Full,secondary.c1Full),
    pg:primary.pg||secondary.pg,
    di:normalizeDoi(primary.di)||normalizeDoi(secondary.di),
    j9:pickStr(primary.j9,secondary.j9),sn:mergeIssn(primary,secondary),
    vl:pickStr(primary.vl,secondary.vl),
    bp:pickStr(primary.bp,secondary.bp),
    ep:pickStr(primary.ep,secondary.ep),
    is:pickStr(primary.is,secondary.is),
    em:pickStr(primary.em,secondary.em),
    rp:pickStr(primary.rp,secondary.rp),
    oaId:pickStr(primary.oaId,secondary.oaId),
    pm:pickStr(primary.pm,secondary.pm),fu:mergeFunders(primary.fu,secondary.fu),fx:pickLonger(primary.fx,secondary.fx),
    oaAll:unionArr([...(primary.oaAll||[]),primary.oa].filter(Boolean),[...(secondary.oaAll||[]),secondary.oa].filter(Boolean)),
    sdg:pickArr(primary.sdg,secondary.sdg),_sdgKnown:!!(primary._sdgKnown||secondary._sdgKnown),
    ind:{...(secondary.ind||{}),...(primary.ind||{})},ot:pickArr(primary.ot,secondary.ot),
    // References: keep the richer list; never mix formats
    crRaw:(primary.crRaw&&primary.crRaw.length>=(secondary.crRaw||[]).length)?primary.crRaw:(secondary.crRaw||[]),
    crOaIds:(primary.crOaIds&&primary.crOaIds.length>=(secondary.crOaIds||[]).length)?primary.crOaIds:(secondary.crOaIds||[]),
    crLocal:unionArr(primary.crLocal,secondary.crLocal),
    _id:primary._id||secondary._id,
    _manual:!!(primary._manual||secondary._manual),
    _edited:!!(primary._edited||secondary._edited),
    _src:primary._src,
    _mergedFrom:[...new Set([...(primary._mergedFrom||[primary._src]),...(secondary._mergedFrom||[secondary._src])])],
  };
  merged.nr=Math.max(primary.nr||0,secondary.nr||0,merged.crRaw.length,merged.crOaIds.length);
  return merged;
}

/* ═══ PROVENANCE OF MERGED RECORDS (0.994) ═══
   A record merged from several databases keeps a snapshot of each original
   version (_versions) and of the automatic merge (_auto). For each group of
   fields the value can be taken from one database, for the whole collection
   (mergePrefs) or for one record (_pick, which wins). References are not
   switchable: their format and matching depend on the database. */
const FIELD_GROUPS=[
  {k:"title",l:"Title",f:["ti"],cmp:r=>normalizeTitle(r.ti||"")},
  {k:"authors",l:"Authors",f:["au","af"],cmp:r=>(r.au||[]).length+"|"+[...new Set((r.au||[]).map(surnameKey))].sort().join(",")},
  {k:"affil",l:"Affiliations and countries",f:["c1Full","c3","co","coNorm","ot","rp","em"],cmp:r=>[...new Set(r.coNorm||[])].sort().join(","),
    note:"compared by country; organisation names are spelled differently in every database"},
  {k:"source",l:"Source, year, volume and pages",f:["so","j9","sn","vl","is","bp","ep","pg","py","pd"],cmp:r=>[r.py||"",String(r.vl||"").trim(),String(r.bp||"").trim()].join("|")},
  {k:"dt",l:"Document type and language",f:["dt","la"],cmp:null},
  {k:"abstract",l:"Abstract",f:["ab"],cmp:r=>r.ab?"y":"n"},
  {k:"keywords",l:"Author keywords and index terms",f:["de","id"],cmp:r=>[...new Set((r.de||[]).map(k=>k.toLowerCase().trim()))].sort().join("|")},
  {k:"subjects",l:"Subject categories",f:["wc","sc"],cmp:null},
  {k:"funding",l:"Funding",f:["fu","fx"],cmp:r=>String((r.fu||[]).length)},
  {k:"oa",l:"Open access",f:["oa","oaAll"],cmp:r=>oaStatus(r).status},
  {k:"tc",l:"Citations in the database (GCS)",f:["tc"],cmp:r=>String(r.tc||0)},
];
const PROV_FIELDS=FIELD_GROUPS.flatMap(g=>g.f);
function snapshotFields(r){const v={};for(const f of PROV_FIELDS)if(r[f]!==undefined)v[f]=r[f];return v;}
function snapshotVersion(r){return{src:r._src,file:r._file||"",nr:Math.max(r.nr||0,(r.crRaw||[]).length,(r.crOaIds||[]).length),...snapshotFields(r)};}
const isEmptyVal=x=>x==null||x===""||x===0||(Array.isArray(x)&&!x.length);
const groupEmpty=(o,g)=>g.f.every(f=>isEmptyVal(o[f]));
// Do the databases disagree on this group? Only versions that have a value count.
function groupDiffers(r,g){if(!g.cmp||!r._versions)return false;const vs=r._versions.filter(v=>!groupEmpty(v,g));if(vs.length<2)return false;const c0=g.cmp(vs[0]);return vs.some(v=>g.cmp(v)!==c0);}
// Which value a group shows: "v<i>" (a version) or "auto"
function groupChoice(r,g,prefs){
  const pick=r._pick&&r._pick[g.k];if(pick)return pick;
  const want=prefs&&prefs[g.k];if(!want||want==="auto"||!r._versions)return"auto";
  const i=r._versions.findIndex(v=>v.src===want&&!groupEmpty(v,g));return i<0?"auto":"v"+i;}
function applyFieldChoice(r,prefs){
  if(!r._versions||!r._auto)return r;
  const out={...r};
  for(const g of FIELD_GROUPS){const ch=groupChoice(r,g,prefs);const from=ch==="auto"?r._auto:ch==="edit"?(r._edit||r._auto):(r._versions[+ch.slice(1)]||r._auto);
    for(const f of g.f)out[f]=from[f]!==undefined?from[f]:r._auto[f];}
  return out;}
const versionLabel=(r,i)=>{const v=r._versions[i];const same=r._versions.filter(x=>x.src===v.src).length>1;return(SRC_LABELS[v.src]||v.src)+(same?` (${r._versions.slice(0,i+1).filter(x=>x.src===v.src).length})`:"");};
function groupText(o,g){
  const j=(a,n=6)=>{a=a||[];return a.slice(0,n).join("; ")+(a.length>n?` … (${a.length})`:"");};
  switch(g.k){
    case"title":return o.ti||"";
    case"authors":return j((o.af&&o.af.length?o.af:o.au),8);
    case"affil":return[(o.c1Full||[]).length?j(o.c1Full,4):j(o.c3,6),(o.coNorm||[]).length?`Countries: ${[...new Set(o.coNorm)].join(", ")}`:""].filter(Boolean).join(" · ");
    case"source":return[o.so,o.py,o.vl&&`vol. ${o.vl}`,o.is&&`(${o.is})`,o.bp&&`pp. ${o.bp}${o.ep&&o.ep!==o.bp?"–"+o.ep:""}`].filter(Boolean).join(", ");
    case"dt":return[o.dt,o.la].filter(Boolean).join(" · ");
    case"abstract":return o.ab?(o.ab.length>220?o.ab.slice(0,220)+"…":o.ab):"";
    case"keywords":return[(o.de||[]).length?`Author: ${j(o.de,8)}`:"",(o.id||[]).length?`Index: ${j(o.id,6)}`:""].filter(Boolean).join(" · ");
    case"subjects":return[j(o.wc,4),j(o.sc,4)].filter(Boolean).join(" · ");
    case"funding":return(o.fu||[]).length?j(o.fu.map(f=>f.n),5):(o.fx?o.fx.slice(0,160)+(o.fx.length>160?"…":""):"");
    case"oa":return o.oa||(o.oaAll||[]).join(", ")||"";
    case"tc":return String(o.tc||0);
    default:return"";}
}

/**
 * mode: "doi"      → DOI only (most conservative)
 *       "balanced" → DOI + exact normalized title with corroboration  [default]
 *       "fuzzy"    → adds fuzzy title matching (Dice ≥ 0.92)
 */
function deduplicateRecords(records,mode="balanced"){
  const MIN_TITLE_LEN=25, YEAR_TOL=2, DICE_MIN=0.92;
  const stats={input:records.filter(r=>!r._enrich).length,byDoi:0,byTitle:0,byFuzzy:0,rejectedNoCorroboration:0,output:0,enriched:0,enrichUnmatched:0,enrichInput:records.length-records.filter(r=>!r._enrich).length};

  // Precompute matching keys
  const items=records.map((r,i)=>({r,i,doi:normalizeDoi(r.di),nt:normalizeTitle(r.ti),
    sn:authorSurnameSet(r.au),py:r.py||0,dead:false}));

  const titleOk=nt=>nt.length>=MIN_TITLE_LEN&&!GENERIC_TITLES.has(nt);
  const corroborate=(a,b)=>{
    if(setsIntersect(a.sn,b.sn))return true;
    if(a.py&&b.py&&Math.abs(a.py-b.py)<=YEAR_TOL)return true;
    return false;
  };

  // Union-find over item indices
  const parent=items.map((_,i)=>i);
  const find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;};
  const union=(x,y)=>{const rx=find(x),ry=find(y);if(rx!==ry)parent[ry]=rx;return rx!==ry;};

  // ── Tier 1: DOI ──────────────────────────────────────────────────────
  const doiMap=new Map();
  for(const it of items){
    if(!it.doi)continue;
    if(doiMap.has(it.doi)){
      const other=doiMap.get(it.doi);
      // Guard: shared DOIs are reused by some book series / proceedings.
      // Require at least weak corroboration before merging.
      if(corroborate(it,other)||!titleOk(it.nt)||!titleOk(other.nt)){
        if(union(other.i,it.i))stats.byDoi++;
      }else stats.rejectedNoCorroboration++;
    }else doiMap.set(it.doi,it);
  }

  if(mode!=="doi"){
    // ── Tier 2: exact normalized title + corroboration ─────────────────
    const titleMap=new Map();
    for(const it of items){
      if(!titleOk(it.nt))continue;
      if(!titleMap.has(it.nt))titleMap.set(it.nt,[]);
      titleMap.get(it.nt).push(it);
    }
    for(const group of titleMap.values()){
      if(group.length<2)continue;
      for(let x=0;x<group.length;x++)for(let y=x+1;y<group.length;y++){
        const a=group[x],b=group[y];
        if(find(a.i)===find(b.i))continue;
        if(corroborate(a,b)){if(union(a.i,b.i))stats.byTitle++;}
        else stats.rejectedNoCorroboration++;
      }
    }

    // ── Tier 3: fuzzy title (blocked by shared rare tokens) ────────────
    if(mode==="fuzzy"){
      const tokenIndex=new Map();
      const cand=items.filter(it=>titleOk(it.nt));
      for(const it of cand){
        for(const tok of new Set(it.nt.split(" "))){
          if(tok.length<5)continue;                 // skip common short words
          if(!tokenIndex.has(tok))tokenIndex.set(tok,[]);
          tokenIndex.get(tok).push(it);
        }
      }
      const seen=new Set();
      for(const bucket of tokenIndex.values()){
        if(bucket.length<2||bucket.length>60)continue;   // skip ultra-common tokens
        for(let x=0;x<bucket.length;x++)for(let y=x+1;y<bucket.length;y++){
          const a=bucket[x],b=bucket[y];
          if(a.nt===b.nt)continue;
          const key=a.i<b.i?`${a.i}:${b.i}`:`${b.i}:${a.i}`;
          if(seen.has(key))continue;seen.add(key);
          if(find(a.i)===find(b.i))continue;
          if(!corroborate(a,b))continue;
          if(diceCoefficient(a.nt,b.nt)>=DICE_MIN){if(union(a.i,b.i))stats.byFuzzy++;}
        }
      }
    }
  }

  // ── Collapse clusters, merging field-by-field ────────────────────────
  const clusters=new Map();
  for(const it of items){const root=find(it.i);if(!clusters.has(root))clusters.set(root,[]);clusters.get(root).push(it.r);}
  let out=[];const alias=new Map();   // merged-away _id → surviving _id
  for(const all of clusters.values()){
    const members=all.filter(m=>!m._enrich),enr=all.filter(m=>m._enrich);
    if(!members.length){stats.enrichUnmatched+=enr.length;continue;}   // augmenter record without a matching record
    if(members.length===1&&!enr.length){out.push(members[0]);continue;}
    let acc=members[0];
    for(let k=1;k<members.length;k++)acc=mergeRecordPair(acc,members[k]);
    if(members.length>1){acc={...acc,_versions:members.flatMap(m=>m._versions||[snapshotVersion(m)]),_files:[...new Set(members.flatMap(m=>m._files||[m._file]).filter(Boolean))]};}
    if(enr.length){for(const e of enr)acc=applyEnrichment(acc,e);stats.enriched++;}
    if(acc._versions)acc._auto=snapshotFields(acc);
    if(members.length===1){out.push(acc);continue;}
    for(const m of members)if(m._id&&acc._id&&m._id!==acc._id)alias.set(m._id,acc._id);
    out.push(acc);
  }
  // manual links that pointed at a merged-away duplicate now point at the survivor
  if(alias.size)out=out.map(r=>r.crLocal&&r.crLocal.length?{...r,crLocal:[...new Set(r.crLocal.map(id=>alias.get(id)||id))].filter(id=>id!==r._id)}:r);
  stats.output=out.length;
  stats.removed=stats.input-stats.output;
  return{records:out,stats};
}
function parseFileText(text){const src=detectSource(text);if(src==="biblioscope")return parseCollectionFile(text);if(src==="wos")return wosToUnified(parseWosText(text));if(src==="scopus")return scopusToUnified(parseCSV(text));if(src==="openalex_json")return openalexJsonToUnified(text);if(src==="openalex_csv")return openalexCsvToUnified(parseCSV(text));return[];}


/* ═══ RECORD IDENTITY, COLLECTION FILES, BROWSER STORAGE ═══
   Every record carries a stable _id so that manual reference links (crLocal),
   selections and undo survive edits, removals and re-sorting. */
const COLLECTION_FORMAT="biblioscope-collection";
let _uidSeq=0;
function uid(prefix="r"){return`${prefix}${Date.now().toString(36)}${(_uidSeq++).toString(36)}`;}
function emptyRecord(){return{_src:"manual",ti:"",au:[],af:[],so:"",py:0,pd:"",dt:"",de:[],id:[],wc:[],sc:[],tc:0,nr:0,oa:"",la:"",ab:"",co:[],coNorm:[],c3:[],c1Full:[],pg:0,di:"",j9:"",sn:[],vl:"",bp:"",ep:"",is:"",ut:"",em:"",rp:"",crRaw:[],oaId:"",crOaIds:[],crLocal:[],pm:"",fu:[],fx:"",oaAll:[],sdg:[],ind:{},ot:[]};}
function ensureIds(records){return records.map(r=>r._id?{crLocal:[],...r}:{crLocal:[],...r,_id:uid("r")});}

// Re-import an exported collection. IDs are re-keyed so two exports can be mixed.
function parseCollectionFile(text){
  const data=JSON.parse(text);
  if(data.oaLookup)Object.assign(_oaLookup,data.oaLookup);
  const tag=Math.random().toString(36).slice(2,7);
  const recs=data.records||[];
  const idMap=new Map(recs.map(r=>[r._id,`${tag}-${r._id||uid()}`]));
  return recs.map(r=>({...emptyRecord(),...r,_id:idMap.get(r._id),
    crLocal:(r.crLocal||[]).map(id=>idMap.get(id)).filter(Boolean)}));
}
function exportCollection(records){
  const ids=new Set(records.flatMap(r=>r.crOaIds||[]));
  const oaLookup={};for(const id of ids)if(_oaLookup[id])oaLookup[id]=_oaLookup[id];
  const payload={format:COLLECTION_FORMAT,version:1,exportedAt:new Date().toISOString(),recordCount:records.length,records,oaLookup};
  const blob=new Blob([JSON.stringify(payload)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`biblioscope-collection-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);
}

// Minimal IndexedDB key–value store (localStorage is too small for a collection)
const IDB_NAME="biblioscope",IDB_STORE="kv";
function idbOpen(){return new Promise((res,rej)=>{
  if(typeof indexedDB==="undefined")return rej(new Error("IndexedDB unavailable"));
  const rq=indexedDB.open(IDB_NAME,1);
  rq.onupgradeneeded=()=>rq.result.createObjectStore(IDB_STORE);
  rq.onsuccess=()=>res(rq.result);rq.onerror=()=>rej(rq.error);});}
async function idbDo(mode,fn){const db=await idbOpen();return new Promise((res,rej)=>{
  const tx=db.transaction(IDB_STORE,mode);const rq=fn(tx.objectStore(IDB_STORE));
  tx.oncomplete=()=>{db.close();res(rq?.result);};tx.onerror=()=>{db.close();rej(tx.error);};});}
const idbGet=k=>idbDo("readonly",st=>st.get(k));
const idbSet=(k,v)=>idbDo("readwrite",st=>st.put(v,k));
const idbDel=k=>idbDo("readwrite",st=>st.delete(k));


/* ═══ REFERENCE RESOLVER ═══
   One place that decides whether a cited reference points at a record in the
   collection. Used by LCS/LCR, the historiograph, Cited Refs, the record view
   and the record editor, so they always agree.
   Order: OpenAlex id / record id → DOI → WoS composite key → Scopus title
   (+ author or year) → WoS surname + year + volume + page. */
function surnameKey(a){return(String(a||"").split(",")[0]||"").trim().split(/\s+/)[0].toLowerCase().replace(/[^a-zÀ-ɏ'-]/gi,"");}
function extractDoi(line){
  const m=line.match(/DOI\s+(?:DOI\s+)?\[?(10\.\d{4,}\/[^\s,;\]]+)/i)||line.match(/(10\.\d{4,}\/[^\s,;\]]+)/i);
  return m?m[1].toLowerCase().replace(/[.)]+$/,""):"";
}
function crLineKind(line,src){
  if(/^\s*(doi[:\s]+|https?:\/\/(dx\.)?doi\.org\/)?10\.\d{4,}\/\S+\s*$/i.test(line))return"doi";
  const wosLike=/^[^,]+,\s*(1[5-9]|20)\d\d\s*(,|$)/.test(line);
  if(wosLike)return"wos";
  if(/\((1[5-9]|20)\d\d\)\s*$/.test(line))return"scopus";
  return src==="scopus"?"scopus":"wos";
}
function makeRefResolver(records){
  const doiIdx=new Map(),oaIdx=new Map(),idIdx=new Map(),keyIdx=new Map(),titleIdx=new Map(),snYear=new Map();
  const maxYear=new Date().getFullYear()+1;
  records.forEach((r,i)=>{
    if(r.di)doiIdx.set(r.di,i);
    if(r.oaId)oaIdx.set(r.oaId,i);
    if(r._id)idIdx.set(r._id,i);
    const sn=surnameKey(r.au&&r.au[0]);
    if(sn&&r.py&&r.j9)keyIdx.set(`${sn}_${r.py}_${r.j9}_${r.vl}_${r.bp}`,i);
    if(sn&&r.py){const k=`${sn}_${r.py}`;(snYear.get(k)||snYear.set(k,[]).get(k)).push(i);}
    const nt=normalizeTitle(r.ti);if(nt.length>=25)titleIdx.set(nt,i);
  });
  const byDoi=d=>d&&doiIdx.has(d)?doiIdx.get(d):null;
  return{
    byDoi,
    byId:id=>idIdx.has(id)?idIdx.get(id):null,
    byOaId:id=>{if(oaIdx.has(id))return oaIdx.get(id);const m=_oaLookup[id];return m?byDoi(normalizeDoi(m.doi)):null;},
    line(line,src){
      const kind=crLineKind(line,src);
      const doi=extractDoi(line);
      let idx=byDoi(doi),meta={author:"",source:""},year=0,sn="",wosVol="",wosPage="";
      if(kind==="doi")return{idx,doi,kind,meta,year};
      if(kind==="wos"){
        meta=refMetaWos(line);const cr=parseCREntryWos(line);year=parseInt(cr.year)||0;sn=cr.surname;wosVol=cr.volume;wosPage=cr.page;
        if(idx==null&&sn&&cr.year&&cr.journal){const k=`${sn}_${cr.year}_${cr.journal}_${cr.volume}_${cr.page}`;if(keyIdx.has(k))idx=keyIdx.get(k);}
      }else{
        meta=refMetaScopus(line);const ym=line.match(/\((\d{4})\)\s*$/);year=ym?parseInt(ym[1]):0;sn=surnameKey((meta.author||"").split(/\s+/)[0]);
        if(idx==null){const parts=line.split(", ");if(parts.length>2){const i=titleIdx.get(normalizeTitle(parts[1]));
          if(i!=null&&(surnameKey(records[i].au[0])===sn||Math.abs((records[i].py||0)-year)<=2))idx=i;}}
      }
      if(year<1600||year>maxYear)year=0;
      // last resort for WoS-style lines whose journal abbreviation differs from the record's
      // (e.g. the target came from OpenAlex): surname + year + volume + first page must all agree
      if(idx==null&&kind==="wos"&&sn&&year&&wosVol&&wosPage){
        const c=(snYear.get(`${sn}_${year}`)||[]).filter(i=>String(records[i].vl)===wosVol&&String(records[i].bp).toLowerCase()===wosPage.toLowerCase());
        if(c.length===1)idx=c[0];
      }
      return{idx,doi,kind,meta,year};
    },
  };
}

/* ═══ LOCAL CITATION ANALYSIS ═══ */
function parseCREntryWos(line){let doi=null;const dm=line.match(/DOI\s+(10\.\S+)/i);if(dm)doi=dm[1].toLowerCase().replace(/\.$/,"");const parts=line.split(",").map(s=>s.trim());const surname=parts[0].split(/\s+/)[0].toLowerCase().replace(/[^a-z\u00C0-\u024F'-]/gi,"");let year="";if(parts.length>1){const ym=parts[1].match(/\d{4}/);if(ym)year=ym[0];}let journal=parts.length>2?parts[2].toUpperCase():"";let volume="",page="";for(const p of parts.slice(3)){const vm=p.trim().match(/^V(\d+)/);if(vm)volume=vm[1];const pm=p.trim().match(/^[Pp](\w+)/);if(pm)page=pm[1];}return{doi,surname,year,journal,volume,page};}
function parseCREntryScopus(line){let doi=null;const dm=line.match(/(10\.\d{4,}\/\S+)/i);if(dm)doi=dm[1].toLowerCase().replace(/\.$/,"");let year="";const ym=line.match(/\((\d{4})\)\s*$/);if(ym)year=ym[1];const fsc=line.indexOf(";"),fco=line.indexOf(",");let surname="";if(fsc>=0&&fsc<fco)surname=line.slice(0,fsc).trim().split(/\s+/).pop()||"";else if(fco>=0)surname=line.slice(0,fco).trim().split(/\s+/).pop()||"";surname=surname.toLowerCase().replace(/[^a-z\u00C0-\u024F'-]/gi,"");return{doi,surname,year,journal:"",volume:"",page:""};}

function buildLocalCitationData(records,R=makeRefResolver(records)){
  const citesLocal=records.map(()=>new Set());
  records.forEach((r,i)=>{
    const add=t=>{if(t!=null&&t!==i)citesLocal[i].add(t);};
    for(const id of r.crOaIds||[])add(R.byOaId(id));
    for(const id of r.crLocal||[])add(R.byId(id));
    for(const line of r.crRaw||[])if(line&&line.trim())add(R.line(line,r._src).idx);
  });
  const lcrArr=citesLocal.map(s=>s.size),lcsArr=new Array(records.length).fill(0);
  for(let i=0;i<records.length;i++)for(const j of citesLocal[i])lcsArr[j]++;
  const edges=[];for(let i=0;i<records.length;i++)for(const j of citesLocal[i])edges.push({source:i,target:j});
  const papers=records.map((r,i)=>({idx:i,ti:r.ti,au:r.au,so:r.so,py:r.py,gcs:r.tc,ncr:r.nr,lcs:lcsArr[i],lcr:lcrArr[i],di:r.di,ut:r.ut,coNorm:r.coNorm,j9:r.j9,_src:r._src}));
  return{papers,edges,totalLCS:lcsArr.reduce((s,v)=>s+v,0),totalLCR:lcrArr.reduce((s,v)=>s+v,0),papersWithLCS:lcsArr.filter(v=>v>0).length,papersWithLCR:lcrArr.filter(v=>v>0).length};
}

/* ═══ CITED REFERENCES LIST ═══ */
function buildCitedRefsList(records,R=makeRefResolver(records)){
  const refMap=new Map();
  const add=(citer,ref)=>{
    const key=ref.localIdx!=null?`local:${ref.localIdx}`:(ref.doi?`doi:${ref.doi}`:ref.rawKey);
    const e=refMap.get(key);
    if(e){e.citers.add(citer);
      if(ref.rich&&!e.rich)Object.assign(e,{display:ref.display,author:ref.author,year:ref.year,source:ref.source,rich:true});
      return;}
    refMap.set(key,{...ref,citers:new Set([citer])});
  };
  const fromLocal=i=>{const r=records[i];return{author:r.au[0]||"",year:r.py||0,source:r.so||"",doi:r.di||"",rich:true,
    display:`${r.au[0]||"[Anonymous]"}, ${r.py||"n.d."}, ${r.ti}${r.so?", "+r.so:""}${r.di?", DOI "+r.di:""}`};};

  records.forEach((r,ci)=>{
    for(const refId of r.crOaIds||[]){
      const m=_oaLookup[refId];const localIdx=R.byOaId(refId);
      let ref;
      if(m){
        const a=(m.authorships||[])[0]?.author?.display_name||"";const author=a?formatAuthorName(a):"";
        const year=m.publication_year||0,title=m.display_name||"",source=m.primary_location?.source?.display_name||"";
        const doi=normalizeDoi(m.doi);
        ref={display:`${author||"[Anonymous]"}, ${year||"n.d."}, ${title}${source?", "+source:""}${doi?", DOI "+doi:""}`,author,year,source,doi,rich:true};
      }else if(localIdx!=null)ref=fromLocal(localIdx);
      else ref={display:refId,author:"",year:0,source:"",doi:"",rich:false};
      add(ci,{...ref,localIdx,rawKey:refId});
    }
    for(const id of r.crLocal||[]){
      const t=R.byId(id);if(t==null)continue;          // target was removed
      add(ci,{...fromLocal(t),localIdx:t,rawKey:`id:${id}`});
    }
    for(const crLine of r.crRaw||[]){
      if(!crLine||!crLine.trim())continue;
      const res=R.line(crLine,r._src);
      if(res.kind==="doi"){
        add(ci,res.idx!=null?{...fromLocal(res.idx),localIdx:res.idx,rawKey:`doi:${res.doi}`}
          :{display:`DOI ${res.doi}`,author:"",year:0,source:"",doi:res.doi,localIdx:null,rich:false,rawKey:`doi:${res.doi}`});
        continue;
      }
      let display=crLine.trim();if(display.length>300)display=display.slice(0,297)+"…";
      add(ci,{display,author:res.meta.author||"",year:res.year,source:res.meta.source||"",doi:res.doi,localIdx:res.idx,rich:true,
              rawKey:crLine.trim().toLowerCase().replace(/\s+/g," ").slice(0,200)});
    }
  });
  return[...refMap.values()].map(({citers,...r})=>({...r,citers,count:citers.size,isLocal:r.localIdx!=null})).sort((a,b)=>b.count-a.count);
}

/* ═══ AUTHOR NAME DISAMBIGUATION ═══
   Names that differ only in commas, periods/spaces between initials, or
   accents are treated as one author: "Garfield, E." = "Garfield E" and
   "Lopez-Cozar, ED" = "López-Cózar E.D.". The most frequent spelling is shown
   (ties go to the accented form). Case and full first names are kept apart. */
const INITIAL_TOKEN=/^(\p{Lu}\.?-?){1,4}$/u;
function authorKey(a){
  let s=stripDiacritics(String(a||"")).replace(/\s+/g," ").trim();if(!s)return"";
  let sur,rest;
  if(s.includes(",")){const i=s.indexOf(",");sur=s.slice(0,i);rest=s.slice(i+1);}
  else{const t=s.split(" ");let k=t.length;while(k>1&&INITIAL_TOKEN.test(t[k-1]))k--;sur=t.slice(0,k).join(" ");rest=t.slice(k).join(" ");}
  sur=sur.replace(/\./g,"").replace(/\s+/g," ").trim();
  const toks=rest.replace(/,/g," ").trim().split(/\s+/).filter(Boolean);
  const ini=toks.length&&toks.every(x=>INITIAL_TOKEN.test(x))?toks.join("").replace(/[.\-]/g,""):toks.join(" ").replace(/\./g,"");
  return`${sur}|${ini}`.toLowerCase();
}
// Cited author/source names come in several spellings ("DOHERTY P", "Doherty P", "Schaefer T.J."/"Schaefer TJ").
// Group them by a normalised key and show the best variant: mixed case first, then the most frequent.
const isAnonName=v=>/^\[?anonymous\]?\.?$/i.test(String(v||"").trim())||/no title captured/i.test(String(v||""));
function citedNameKey(v,kind){return kind==="author"?authorKey(v):stripDiacritics(String(v||"")).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function makeNameCanon(names,kind){
  const groups=new Map();
  for(const v of names){if(!v||(kind==="author"&&isAnonName(v)))continue;const k=citedNameKey(v,kind);if(!k)continue;
    if(!groups.has(k))groups.set(k,new Map());const g=groups.get(k);g.set(v,(g.get(v)||0)+1);}
  const caseRank=v=>(/\p{L}/u.test(v)&&(v===v.toUpperCase()||v===v.toLowerCase())?1:0);
  const label=new Map();
  for(const[k,g]of groups)label.set(k,[...g.entries()].sort((x,y)=>caseRank(x[0])-caseRank(y[0])||y[1]-x[1]||y[0].length-x[0].length)[0][0]);
  const key=v=>{if(!v||(kind==="author"&&isAnonName(v)))return"";const k=citedNameKey(v,kind);return label.has(k)?k:"";};
  return{key,label:k=>label.get(k)||k,name:v=>{const k=key(v);return k?label.get(k):"";}};
}
function canonicalizeAuthors(records){
  const groups=new Map();                       // key → Map(variant → count)
  for(const r of records)for(const a of r.au||[]){const k=authorKey(a);if(!k)continue;
    if(!groups.has(k))groups.set(k,new Map());const g=groups.get(k);g.set(a,(g.get(a)||0)+1);}
  const nonAscii=v=>(v.match(/[^\x00-\x7f]/g)||[]).length;
  const canon=new Map(),variants=[];
  for(const g of groups.values()){
    const caseRank=v=>(/\p{L}/u.test(v)&&(v===v.toUpperCase()||v===v.toLowerCase())?1:0);
    const best=[...g.entries()].sort((x,y)=>caseRank(x[0])-caseRank(y[0])||y[1]-x[1]||nonAscii(y[0])-nonAscii(x[0])||y[0].length-x[0].length)[0][0];
    for(const v of g.keys())canon.set(v,best);
    if(g.size>1)variants.push({name:best,variants:[...g.keys()].filter(v=>v!==best)});
  }
  if(!variants.length)return{records,variants};
  const out=records.map(r=>{if(!r.au||!r.au.some(a=>canon.get(a)!==a))return r;
    return{...r,au:[...new Set(r.au.map(a=>canon.get(a)||a))]};});
  return{records:out,variants};
}

/* ═══ NAMES OF SOURCES, ORGANISATIONS AND DOCUMENT TYPES (0.996) ═══
   Shown with capital initials and the rest lower case when a database gives
   them in capitals only (WoS) or lower case only (OpenAlex types). Sources are
   one entry per journal: records are joined by ISSN (print and electronic ISSN
   of the same journal link up through records that carry both) and by the same
   name regardless of case, punctuation and "&"/"and". Proceedings and book
   chapters are not joined by ISSN, as a book series ISSN covers many titles. */
function normalizeIssn(x){const d=String(x||"").toUpperCase().replace(/[^0-9X]/g,"");return d.length===8?d.slice(0,4)+"-"+d.slice(4):"";}
function issnList(...xs){return[...new Set(xs.flat().flatMap(x=>String(x||"").split(/[;,|\s]+/)).map(normalizeIssn).filter(Boolean))];}
const SMALL_WORDS=new Set("a an and as at but by for from in into nor of on or per the to via with vs und der die das des für et de la le les du en y del della di och på av för i".split(" "));
const ACRONYMS=new Set("IEEE ACM BMJ BMC PLOS JAMA AI IT ICT USA US UK EU UN ACS AIP SPIE IFLA ASIS JASIST HIV AIDS COVID SARS DNA RNA GIS NLP OECD WHO ESG MDPI SAGE CEUR ASME ASCE IET IOP SIAM".split(" "));
const isOneCase=s=>/\p{L}/u.test(s)&&(s===s.toUpperCase()||s===s.toLowerCase());
// "JOURNAL OF THE AMERICAN SOCIETY" → "Journal of the American Society"; mixed case is kept as given
function niceCase(s){
  s=String(s||"").trim();if(!isOneCase(s))return s;
  return s.toLowerCase().replace(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu,(w,off)=>{
    const U=w.toUpperCase();if(ACRONYMS.has(U))return U;
    if(/^(ii|iii|iv|vi|vii|viii|ix|xi|xii)$/.test(w))return U;
    const before=s.slice(0,off);
    if(/\([^)]*$/.test(before)&&/^[a-z]{2,8}$/.test(w)&&!SMALL_WORDS.has(w))return U;   // acronyms in brackets: (DASA), (ICMIBI 2017)
    if(off>0&&SMALL_WORDS.has(w)&&!/[:.\-–—(\/]\s*$/.test(before))return w;
    if(off>0&&/['’]$/.test(before))return w;          // "women's", not "Women'S"
    return w[0].toUpperCase()+w.slice(1);});
}
// "article", "ARTICLE", "book-chapter" → "Article", "Book chapter"; each part of "Article; Early Access"
function sentenceCase(s){return String(s||"").split(";").map(p=>{p=p.trim().replace(/[-_]+/g," ").replace(/\s+/g," ").toLowerCase();return p?p[0].toUpperCase()+p.slice(1):"";}).filter(Boolean).join("; ");}
function nameKey(s){return stripDiacritics(String(s||"")).toLowerCase().replace(/&/g," and ").replace(/^\s*the\s+/,"").replace(/[^a-z0-9]+/g," ").trim();}
const caseRank=v=>isOneCase(v)?1:0;
// the most frequent variant written in mixed case, else the most frequent one in nice case
function bestVariant(m){const best=[...m.entries()].sort((x,y)=>caseRank(x[0])-caseRank(y[0])||y[1]-x[1]||y[0].length-x[0].length)[0][0];return niceCase(best);}
function canonicalizeSources(records){
  const parent=new Map();const add=x=>{if(!parent.has(x))parent.set(x,x);};
  const find=x=>{while(parent.get(x)!==x){parent.set(x,parent.get(parent.get(x)));x=parent.get(x);}return x;};
  const union=(a,b)=>{add(a);add(b);const ra=find(a),rb=find(b);if(ra!==rb)parent.set(rb,ra);};
  const noIssnLink=r=>/proceed|conference|book|chapter|meeting|congress|symposium/i.test(r.dt||"");
  // the records, and every database version of a merged record (so that "Sustainability (Switzerland)" from
  // Scopus and "SUSTAINABILITY" from WoS meet even when all their records were merged)
  const entries=records.flatMap(r=>[r,...(r._versions||[])]).filter(e=>e.so&&String(e.so).trim());
  for(const e of entries){const k="n:"+nameKey(e.so);add(k);if(!noIssnLink(e))for(const i of e.sn||[])union(k,"i:"+i);}
  const groups=new Map();
  for(const e of entries){const g=find("n:"+nameKey(e.so));if(!groups.has(g))groups.set(g,{names:new Map(),issn:new Set()});
    const G=groups.get(g);const nm=String(e.so).trim();G.names.set(nm,(G.names.get(nm)||0)+1);for(const i of e.sn||[])G.issn.add(i);}
  const canon=new Map(),variants=[],issnOf=new Map();
  for(const G of groups.values()){const best=bestVariant(G.names);for(const v of G.names.keys())canon.set(v,best);issnOf.set(best,[...G.issn].sort());
    const others=[...G.names.keys()].filter(v=>v!==best);if(others.length)variants.push({name:best,variants:others,issn:[...G.issn].sort()});}
  const out=records.map(r=>{const c=r.so&&canon.get(String(r.so).trim());return c&&c!==r.so?{...r,so:c}:r;});
  return{records:out,variants,issnOf};
}
function canonicalizeOrgs(records){
  const groups=new Map();const addName=n=>{const k=nameKey(n);if(!k)return;if(!groups.has(k))groups.set(k,new Map());const g=groups.get(k);g.set(n,(g.get(n)||0)+1);};
  for(const r of records){for(const o of r.c3||[])addName(o);for(const o of r.ot||[])if(o&&o.n)addName(o.n);}
  const canon=new Map();let nVar=0;
  for(const g of groups.values()){const best=bestVariant(g);for(const v of g.keys())canon.set(v,best);if(g.size>1||best!==[...g.keys()][0])nVar+=g.size-1;}
  const fix=n=>canon.get(n)||n;
  const out=records.map(r=>{const c3=(r.c3||[]).map(fix),ot=(r.ot||[]).map(o=>o&&o.n&&fix(o.n)!==o.n?{...o,n:fix(o.n)}:o);
    const ch=c3.some((x,i)=>x!==r.c3[i])||ot.some((x,i)=>x!==r.ot[i]);return ch?{...r,c3:[...new Set(c3)],ot}:r;});
  return{records:out,mergedVariants:nVar};
}
// OpenAlex gives ISO 639 codes ("en", "zh"); WoS and Scopus give names ("English")
const LANG_CODES={en:"English",zh:"Chinese",es:"Spanish",pt:"Portuguese",fr:"French",de:"German",ru:"Russian",ja:"Japanese",ko:"Korean",it:"Italian",
  fa:"Persian",ar:"Arabic",tr:"Turkish",pl:"Polish",nl:"Dutch",sv:"Swedish",no:"Norwegian",nb:"Norwegian",nn:"Norwegian",da:"Danish",fi:"Finnish",
  cs:"Czech",sk:"Slovak",hu:"Hungarian",ro:"Romanian",bg:"Bulgarian",hr:"Croatian",sr:"Serbian",sl:"Slovenian",uk:"Ukrainian",el:"Greek",he:"Hebrew",
  id:"Indonesian",ms:"Malay",th:"Thai",vi:"Vietnamese",hi:"Hindi",bn:"Bengali",ur:"Urdu",ca:"Catalan",eu:"Basque",gl:"Galician",lt:"Lithuanian",
  lv:"Latvian",et:"Estonian",is:"Icelandic",af:"Afrikaans",sw:"Swahili",ta:"Tamil",te:"Telugu",ka:"Georgian",hy:"Armenian",az:"Azerbaijani",
  kk:"Kazakh",mk:"Macedonian",sq:"Albanian",bs:"Bosnian",tl:"Tagalog",la:"Latin",eo:"Esperanto",cy:"Welsh",ga:"Irish",mn:"Mongolian"};
function languageName(l){l=String(l||"").trim();if(!l)return"";const c=l.toLowerCase().replace(/[-_].*$/,"");if(/^[a-z]{2}$/.test(c)&&LANG_CODES[c])return LANG_CODES[c];
  return l.split(";").map(x=>{x=x.trim();const k=x.toLowerCase();return LANG_CODES[k]||(isOneCase(x)?k.replace(/(^|[\s-])\p{L}/gu,m=>m.toUpperCase()):x);}).filter(Boolean).join("; ");}
function canonicalizeDocTypes(records){return records.map(r=>{const d=r.dt?sentenceCase(r.dt):r.dt,la=r.la?languageName(r.la):r.la;return d===r.dt&&la===r.la?r:{...r,dt:d,la};});}

/* ═══ AGGREGATOR ═══ */
function counter(items){const m=new Map();for(const x of items)m.set(x,(m.get(x)||0)+1);return[...m.entries()].sort((a,b)=>b[1]-a[1]);}
function aggregate(rawRecords){
  const ca=canonicalizeAuthors(rawRecords),authorVariants=ca.variants;
  const cs=canonicalizeSources(ca.records),sourceVariants=cs.variants;
  const records=canonicalizeDocTypes(canonicalizeOrgs(cs.records).records);
  const total=records.length,totalCitations=records.reduce((s,r)=>s+r.tc,0);
  const allAuthors=new Set(records.flatMap(r=>r.au)),allJournals=new Set(records.map(r=>r.so).filter(Boolean));
  const allKW=new Set(records.flatMap(r=>[...r.de,...r.id].map(k=>k.toLowerCase())));
  const years=records.map(r=>r.py).filter(y=>y>1900),pages=records.map(r=>r.pg).filter(p=>p>0);
  const srcCounts=counter(records.flatMap(r=>r._mergedFrom||[r._src]));
  const topAuthors=counter(records.flatMap(r=>r.au)).slice(0,25).map(([n,c])=>({name:n,count:c}));
  const topJournals=counter(records.map(r=>r.so).filter(Boolean)).slice(0,25).map(([n,c])=>({name:n,count:c}));
  const topWC=counter(records.flatMap(r=>r.wc)).slice(0,30).map(([n,c])=>({name:n,count:c}));
  const topSC=counter(records.flatMap(r=>r.sc)).slice(0,25).map(([n,c])=>({name:n,count:c}));
  const docTypes=counter(records.map(r=>r.dt).filter(Boolean)).slice(0,10).map(([n,c])=>({name:n,count:c}));
  const pubByYear=counter(years).sort((a,b)=>a[0]-b[0]).map(([year,count])=>({year,count}));
  const MM={JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
  const monthC=new Map();for(const r of records){const pd=(r.pd||"").toUpperCase();for(const[k,v]of Object.entries(MM)){if(pd.includes(k)){monthC.set(v,(monthC.get(v)||0)+1);break;}}}
  const pubByMonth=[...monthC.entries()].sort((a,b)=>a[0]-b[0]).map(([month,count])=>({month,count}));
  const oaC=new Map();for(const r of records){const s=oaStatus(r).status;oaC.set(s,(oaC.get(s)||0)+1);}
  const openAccess=[...oaC.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([n,c])=>({name:n,count:c}));
  const coC=new Map();for(const r of records)for(const c of r.coNorm)coC.set(c,(coC.get(c)||0)+1);
  const topCountries=[...coC.entries()].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([n,c])=>({name:n,count:c}));
  const orgC=new Map();for(const r of records){const seen=new Set();for(const o of r.c3){if(!seen.has(o)){orgC.set(o,(orgC.get(o)||0)+1);seen.add(o);}}}
  const topOrgs=[...orgC.entries()].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([n,c])=>({name:n,count:c}));
  const kwMap=new Map();for(const r of records)for(const k of[...r.de,...r.id]){const kl=k.toLowerCase();kwMap.set(kl,(kwMap.get(kl)||0)+1);}
  const topKeywords=[...kwMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,50).map(([n,c])=>({name:n,count:c}));
  const bins={"0":0,"1-5":0,"6-10":0,"11-20":0,"21-50":0,"50+":0};
  for(const r of records){if(r.tc===0)bins["0"]++;else if(r.tc<=5)bins["1-5"]++;else if(r.tc<=10)bins["6-10"]++;else if(r.tc<=20)bins["11-20"]++;else if(r.tc<=50)bins["21-50"]++;else bins["50+"]++;}
  const citeDist=Object.entries(bins).map(([bin,count])=>({bin,count}));
  const topPapers=[...records].sort((a,b)=>b.tc-a.tc).slice(0,15).map(r=>({ti:r.ti.slice(0,120),au:r.au[0]||"?",so:r.so,tc:r.tc,py:r.py,_src:r._src,di:r.di,ut:r.ut,fullTi:r.ti}));
  const cooc=new Map();for(const r of records){const kws=[...new Set(r.de.map(k=>k.toLowerCase()))].slice(0,8).sort();for(let i=0;i<kws.length;i++)for(let j=i+1;j<kws.length;j++){const key=kws[i]+"\0"+kws[j];cooc.set(key,(cooc.get(key)||0)+1);}}
  const topCooc=[...cooc.entries()].sort((a,b)=>b[1]-a[1]).slice(0,80);const netKWs=new Set();for(const[key]of topCooc){const[a,b]=key.split("\0");netKWs.add(a);netKWs.add(b);}
  const kwNetwork={nodes:[...netKWs].map(id=>({id,freq:kwMap.get(id)||1})),links:topCooc.map(([key,value])=>{const[source,target]=key.split("\0");return{source,target,value};})};
  const topAuSet=new Set(topAuthors.slice(0,30).map(a=>a.name));const auMap=new Map(topAuthors.map(a=>[a.name,a.count]));
  const coauth=new Map();for(const r of records){const aus=[...new Set(r.au.filter(a=>topAuSet.has(a)))].sort();for(let i=0;i<aus.length;i++)for(let j=i+1;j<aus.length;j++){const key=aus[i]+"\0"+aus[j];coauth.set(key,(coauth.get(key)||0)+1);}}
  const coauthLinks=[...coauth.entries()].sort((a,b)=>b[1]-a[1]).slice(0,60);const coauthNodes=new Set();for(const[key]of coauthLinks){const[a,b]=key.split("\0");coauthNodes.add(a);coauthNodes.add(b);}
  const coauthNetwork={nodes:[...coauthNodes].map(id=>({id,count:auMap.get(id)||1})),links:coauthLinks.map(([key,value])=>{const[source,target]=key.split("\0");return{source,target,value};})};
  const R=makeRefResolver(records);
  const histcite=buildLocalCitationData(records,R);
  const countryStats=(()=>{const lcs=new Map(histcite.papers.map(p=>[p.idx,p.lcs]));const m=new Map();
    records.forEach((r,i)=>{for(const c of new Set(r.coNorm)){if(!m.has(c))m.set(c,{name:c,count:0,tlcs:0,tgcs:0});const e=m.get(c);e.count++;e.tlcs+=lcs.get(i)||0;e.tgcs+=r.tc||0;}});
    return[...m.values()].sort((a,b)=>b.count-a.count);})();
  const citedRefs=buildCitedRefsList(records,R);
  return{summary:{total,totalCitations,totalAuthors:allAuthors.size,totalJournals:allJournals.size,avgCitations:total?+(totalCitations/total).toFixed(2):0,yearRange:years.length?`${Math.min(...years)}–${Math.max(...years)}`:"N/A",totalKeywords:allKW.size,avgPages:pages.length?+(pages.reduce((s,p)=>s+p,0)/pages.length).toFixed(1):0,totalCitedRefs:citedRefs.length},srcCounts:srcCounts.map(([n,c])=>({name:n,count:c})),topAuthors,topJournals,topWC,topSC,docTypes,pubByYear,pubByMonth,openAccess,topCountries,topOrgs,topKeywords,citeDist,topPapers,kwNetwork,coauthNetwork,histcite,citedRefs,records,countryStats,authorVariants,sourceVariants};
}

/* ═══ ZIP ═══ */
async function loadJSZip(){return JSZip;}   // bundled (MIT); no network access needed
async function readZip(file){const JSZip=await loadJSZip();const zip=await JSZip.loadAsync(file);const texts=[];for(const[name,entry]of Object.entries(zip.files)){if(!entry.dir&&/\.(txt|ciw|csv|json)$/i.test(name))texts.push({name:`${file.name}/${name.split("/").pop()}`,text:await entry.async("string")});}return texts;}

/* Editing actions (add / edit / remove / restore) are provided by App and
   reached from any view through this context. */
const EditCtx=createContext(null);


/* ═══ EXPORT IN WEB OF SCIENCE PLAIN-TEXT FORMAT ═══
   For VOSviewer and other tools that read WoS "Full Record and Cited
   References" files. Every record is written as a WoS record whatever its
   source. References that point at a record in the collection are written
   in one canonical form (first author, year, J9, volume, page, DOI), so the
   citing and the cited side agree and co-citation counts are not split. */
function wosAuthor(a){
  // "Garfield, E." / "Garfield E." / "Van Eck N.J." → "Garfield, E" / "Van Eck, NJ"
  a=String(a||"").trim().replace(/\s+/g," ");if(!a)return"";
  if(a.includes(",")){const[sur,...rest]=a.split(",");const ini=rest.join(" ").replace(/[.\s-]/g,"");return ini?`${sur.trim()}, ${ini}`:sur.trim();}
  const parts=a.split(" ");const last=parts[parts.length-1];
  if(parts.length>1&&/^([A-Z]\.?-?){1,4}$/.test(last))return`${parts.slice(0,-1).join(" ")}, ${last.replace(/[.-]/g,"")}`;
  return a;
}
const crAuthor=a=>wosAuthor(a).replace(/,\s*/," ");       // cited-reference form: "Garfield E"
const recJ9=r=>(r.j9||r.so||"").toUpperCase().replace(/\s+/g," ").trim();
const clean=v=>String(v??"").replace(/[\r\n]+/g," ").replace(/\s{2,}/g," ").trim();
function canonicalCR(r){
  const parts=[crAuthor(r.au&&r.au[0])||"[Anonymous]"];
  if(r.py)parts.push(String(r.py));
  const j=recJ9(r);if(j)parts.push(j);
  if(r.vl)parts.push(`V${r.vl}`);
  if(r.bp)parts.push(`P${r.bp}`);
  if(r.di)parts.push(`DOI ${r.di}`);
  return parts.join(", ");
}
// Scopus reference → WoS reference line
function scopusToCR(line){
  const meta=refMetaScopus(line);const doi=extractDoi(line);
  const ym=line.match(/\((\d{4})\)\s*$/);
  const parts=line.replace(/\((\d{4})\)\s*$/,"").split(", ").map(x=>x.trim()).filter(Boolean);
  // Tail of a Scopus reference: "Source, Vol, Issue, pp. X-Y" (issue/pages optional)
  const isNum=p=>/^[A-Za-z]?\d+[A-Za-z]?$/.test(p)||/^pp?\.\s*/i.test(p)||/^[A-Za-z]?\d+\s*[-–]\s*[A-Za-z]?\d+$/.test(p)||/^art\.?\s*(no\.?)?\s*/i.test(p);
  let end=parts.length;while(end>0&&isNum(parts[end-1]))end--;
  let source=meta.source;
  if(!source||isNum(source)||parts.lastIndexOf(source)<0)source=end>0?parts[end-1]:"";
  let si=parts.lastIndexOf(source);if(si<0)si=end-1;
  let vol="",page="";
  if(si>=0)for(const p of parts.slice(si+1)){
    const pm=p.match(/^pp?\.\s*([A-Za-z]?\d+)/i)||p.match(/^([A-Za-z]?\d+)\s*[-–]\s*[A-Za-z]?\d+$/)||p.match(/^art\.?\s*(?:no\.?)?\s*([A-Za-z]?\d+)/i);
    if(pm){if(!page)page=pm[1];continue;}
    if(!vol&&/^\d+[A-Za-z]?$/.test(p))vol=p;   // first bare number = volume; the next one is the issue
  }
  const out=[crAuthor(meta.author)||"[Anonymous]"];
  if(ym)out.push(ym[1]);
  if(source&&source!==meta.author)out.push(source.toUpperCase());
  if(vol)out.push(`V${vol}`);if(page)out.push(`P${page.toUpperCase()}`);if(doi)out.push(`DOI ${doi}`);
  return out.join(", ");
}
function recordCRLines(r,R,records){
  const out=[],seen=new Set();
  const push=(line,key)=>{const k=key||line.toLowerCase();if(!line||seen.has(k))return;seen.add(k);out.push(line);};
  const local=t=>push(canonicalCR(records[t]),`i${t}`);
  for(const id of r.crLocal||[]){const t=R.byId(id);if(t!=null)local(t);}
  for(const id of r.crOaIds||[]){
    const t=R.byOaId(id);if(t!=null){local(t);continue;}
    const m=_oaLookup[id];if(!m)continue;
    const a=(m.authorships||[])[0]?.author?.display_name||"";const doi=normalizeDoi(m.doi);
    const src=m.primary_location?.source?.display_name||"";
    push([crAuthor(a?formatAuthorName(a):"")||"[Anonymous]",m.publication_year||"",src.toUpperCase(),doi?`DOI ${doi}`:""].filter(Boolean).join(", "),doi?`d${doi}`:null);
  }
  for(const line of r.crRaw||[]){
    if(!line||!line.trim())continue;
    const res=R.line(line,r._src);
    if(res.idx!=null){local(res.idx);continue;}
    if(res.kind==="doi"){push(`[Anonymous], DOI ${res.doi}`,`d${res.doi}`);continue;}
    push(res.kind==="scopus"?scopusToCR(line):clean(line),res.doi?`d${res.doi}`:null);
  }
  return out;
}
function recordToWos(r,R,records){
  const L=[];
  const one=(tag,v)=>{v=clean(v);if(v)L.push(`${tag} ${v}`);};
  const many=(tag,arr)=>{const a=(arr||[]).map(clean).filter(Boolean);if(!a.length)return;L.push(`${tag} ${a[0]}`);for(const x of a.slice(1))L.push(`   ${x}`);};
  const dt=clean(r.dt).replace(/^\w/,c=>c.toUpperCase())||"Article";
  one("PT",/book/i.test(dt)&&!/article/i.test(dt)?"B":"J");
  many("AU",(r.au||[]).map(wosAuthor));
  many("AF",(r.af&&r.af.length?r.af:r.au||[]).map(a=>/,/.test(a)?a:wosAuthor(a)));
  one("TI",r.ti);
  one("SO",(r.so||"").toUpperCase());
  one("LA",r.la);
  one("DT",dt);
  one("DE",(r.de||[]).join("; "));
  one("ID",(r.id||[]).join("; "));
  one("AB",r.ab);
  // C1: last segment must be the country, as in WoS
  many("C1",(r.c1Full||[]).map(a=>{const seg=a.split(",").map(x=>x.trim()).filter(Boolean);if(!seg.length)return"";
    const n=normalizeCountry(seg[seg.length-1],true);if(n&&(n==="USA"||COUNTRY_BY_ALIAS.has(n.toLowerCase())))seg[seg.length-1]=n;
    return seg.join(", ")+".";}));
  one("C3",(r.c3||[]).join("; "));
  one("RP",r.rp);one("EM",r.em);
  const cr=recordCRLines(r,R,records);
  many("CR",cr);
  one("NR",String(cr.length));
  one("TC",String(r.tc||0));one("Z9",String(r.tc||0));
  one("PD",r.pd&&!/^\d{4}-\d{2}/.test(r.pd)?r.pd:"");
  one("PY",r.py?String(r.py):"");
  one("VL",r.vl);one("IS",r.is);one("BP",r.bp);one("EP",r.ep);
  one("DI",r.di);
  one("J9",recJ9(r));one("JI",recJ9(r));
  one("UT",/^WOS:/i.test(r.ut||"")?r.ut:`BIBLIOSCOPE:${r._id||""}`);
  L.push("ER");
  return L.join("\n");
}
function exportWos(records){
  records=canonicalizeAuthors(records).records;
  const R=makeRefResolver(records);
  const body=records.map(r=>recordToWos(r,R,records)).join("\n\n");
  const text="﻿FN Clarivate Analytics Web of Science\nVR 1.0\n"+body+"\n\nEF";
  const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`biblioscope-wos-${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);
  return text;
}

/* ═══ UI PRIMITIVES ═══ */
function StatCard({label,value,sub}){return(<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"18px 22px",minWidth:130,flex:1}}><div style={{fontSize:11,letterSpacing:1.5,textTransform:"uppercase",color:C.textDim,marginBottom:6,fontFamily:mono}}>{label}</div><div style={{fontSize:28,fontWeight:700,color:C.accent,lineHeight:1.1,fontFamily:"Georgia,'Times New Roman',serif"}}>{value}</div>{sub&&<div style={{fontSize:11,color:C.textDim,marginTop:4}}>{sub}</div>}</div>);}
function SectionTitle({children,icon}){return(<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>{icon&&<span style={{fontSize:16,opacity:.6}}>{icon}</span>}<h2 style={{fontSize:13,fontWeight:600,textTransform:"uppercase",letterSpacing:2,color:C.textDim,margin:0,fontFamily:mono}}>{children}</h2><div style={{flex:1,height:1,background:C.border}}/></div>);}
function Card({children,style}){return<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24,minWidth:0,boxSizing:"border-box",...style}}>{children}</div>;}
function SrcBadge({src}){return<span style={{fontSize:9,fontWeight:700,fontFamily:mono,padding:"2px 6px",borderRadius:3,background:`${SRC_COLORS[src]||C.textDim}22`,color:SRC_COLORS[src]||C.textDim,letterSpacing:.5,textTransform:"uppercase"}}>{src}</span>;}
const btnBase={border:"none",borderRadius:6,padding:"6px 14px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:mono,transition:"all .15s"};
function PillBtn({active,children,onClick,style:s,title}){return<button onClick={onClick} title={title} style={{...btnBase,background:active?C.accent:"transparent",color:active?C.onAccent:C.textDim,border:`1px solid ${active?C.accent:C.border}`,...s}}>{children}</button>;}

/* ═══ D3 CHARTS (compact) ═══ */
function HBarChart({data,maxItems=15,color=C.accent,labelWidth=180,maxChars=28}){const items=data.slice(0,maxItems);const maxVal=Math.max(...items.map(d=>d.count),1);return(<div style={{display:"flex",flexDirection:"column",gap:5}}>{items.map((d,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:labelWidth,fontSize:11,color:C.text,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}} title={d.name}>{d.name.length>maxChars?d.name.slice(0,maxChars-2)+"…":d.name}</div><div style={{flex:1,height:20,background:C.bg,borderRadius:3,overflow:"hidden"}}><div style={{width:`${(d.count/maxVal)*100}%`,height:"100%",background:`linear-gradient(90deg,${color}22,${color}88)`,borderRadius:3,borderRight:`2px solid ${color}`}}/></div><div style={{width:36,fontSize:11,color:C.textDim,textAlign:"right",fontFamily:mono}}>{d.count}</div></div>))}</div>);}
function useW(ref){const[w,setW]=useState(600);useEffect(()=>{if(!ref.current)return;const ro=new ResizeObserver(e=>{for(const x of e)setW(x.contentRect.width)});ro.observe(ref.current);setW(ref.current.clientWidth);return()=>ro.disconnect();},[ref]);return w;}
function Treemap({data}){const wr=useRef(),sr=useRef(),w=useW(wr),h=Math.max(280,w*.34);useEffect(()=>{if(!sr.current||!data.length)return;const svg=d3.select(sr.current);svg.selectAll("*").remove();const root=d3.hierarchy({children:data.slice(0,20)}).sum(d=>d.count).sort((a,b)=>b.value-a.value);d3.treemap().size([w,h]).padding(2).round(true)(root);const leaves=root.leaves();const color=d3.scaleOrdinal(PAL);const g=svg.selectAll("g").data(leaves).join("g").attr("transform",d=>`translate(${d.x0},${d.y0})`);g.append("rect").attr("width",d=>d.x1-d.x0).attr("height",d=>d.y1-d.y0).attr("rx",3).attr("fill",(d,i)=>color(i)).attr("opacity",.75).style("cursor","pointer").on("mouseenter",function(){d3.select(this).attr("opacity",.95)}).on("mouseleave",function(){d3.select(this).attr("opacity",.75)});g.append("clipPath").attr("id",(d,i)=>`tc${i}`).append("rect").attr("width",d=>d.x1-d.x0).attr("height",d=>d.y1-d.y0);g.append("text").attr("clip-path",(d,i)=>`url(#tc${i})`).selectAll("tspan").data(d=>{const w2=d.x1-d.x0,h2=d.y1-d.y0;if(w2<50||h2<28)return[];const n=d.data.name;const lines=[n.length>18&&w2<120?n.slice(0,16)+"…":n];if(h2>38)lines.push(String(d.data.count));return lines;}).join("tspan").attr("x",6).attr("y",(d,i)=>16+i*14).attr("fill","#000").attr("font-size",(d,i)=>i===0?10.5:10).attr("font-weight",(d,i)=>i===0?600:400).attr("opacity",(d,i)=>i===0?.85:.6).text(d=>d);},[data,w,h]);return<div ref={wr} style={{width:"100%"}}><svg ref={sr} width={w} height={h} style={{display:"block",maxWidth:"100%"}}/></div>;}
function ForceNetwork({network}){const wr=useRef(),sr=useRef(),simR=useRef(),w=useW(wr),h=Math.max(360,w*.42);useEffect(()=>{if(!sr.current||!network.nodes.length)return;const svg0=d3.select(sr.current);svg0.selectAll("*").remove();const svg=svg0.append("g");const zoomF=d3.zoom().scaleExtent([.3,6]).on("zoom",e=>svg.attr("transform",e.transform));svg0.call(zoomF).on("dblclick.zoom",()=>svg0.transition().duration(500).call(zoomF.transform,d3.zoomIdentity));svg0.append("text").attr("x",w-8).attr("y",16).attr("text-anchor","end").attr("fill",C.textDim).attr("font-size",9).attr("font-family",mono).attr("opacity",.5).text("scroll to zoom · drag to pan");const nodes=network.nodes.map(d=>({...d})),links=network.links.map(d=>({...d}));const maxF=Math.max(...nodes.map(n=>n.freq||n.count||1));const rS=d3.scaleSqrt().domain([1,maxF]).range([5,22]);const color=d3.scaleOrdinal(PAL);if(simR.current)simR.current.stop();const sim=d3.forceSimulation(nodes).force("link",d3.forceLink(links).id(d=>d.id).distance(70).strength(.4)).force("charge",d3.forceManyBody().strength(-120)).force("center",d3.forceCenter(w/2,h/2)).force("collision",d3.forceCollide().radius(d=>rS(d.freq||d.count||1)+4));simR.current=sim;const link=svg.append("g").selectAll("line").data(links).join("line").attr("stroke",C.border).attr("stroke-width",d=>Math.max(1,d.value)).attr("stroke-opacity",.5);const node=svg.append("g").selectAll("g").data(nodes).join("g").style("cursor","grab").call(d3.drag().on("start",(e,d)=>{if(!e.active)sim.alphaTarget(.3).restart();d.fx=d.x;d.fy=d.y}).on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));node.append("circle").attr("r",d=>rS(d.freq||d.count||1)).attr("fill",(d,i)=>d.cluster!=null?clusterColor(d.cluster):color(i%PAL.length)).attr("opacity",.8).attr("stroke",C.bg).attr("stroke-width",1.5);node.append("text").text(d=>d.id.length>20?d.id.slice(0,18)+"…":d.id).attr("text-anchor","middle").attr("dy",d=>-(rS(d.freq||d.count||1)+5)).attr("fill",C.textDim).attr("font-size",9).attr("pointer-events","none");sim.on("tick",()=>{link.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y).attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);node.attr("transform",d=>`translate(${d.x},${d.y})`);});return()=>sim.stop();},[network,w,h]);return<div ref={wr} style={{width:"100%"}}><svg ref={sr} width={w} height={h} style={{display:"block",maxWidth:"100%"}}/></div>;}
function MonthlyChart({data}){const wr=useRef(),sr=useRef(),w=useW(wr),h=190;const MN=["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];useEffect(()=>{if(!sr.current||!data.length)return;const svg=d3.select(sr.current);svg.selectAll("*").remove();const m={top:16,right:20,bottom:30,left:40},cw=w-m.left-m.right,ch=h-m.top-m.bottom;const g=svg.append("g").attr("transform",`translate(${m.left},${m.top})`);const x=d3.scaleLinear().domain([1,12]).range([0,cw]);const y=d3.scaleLinear().domain([0,d3.max(data,d=>d.count)*1.1]).range([ch,0]);const area=d3.area().x(d=>x(d.month)).y0(ch).y1(d=>y(d.count)).curve(d3.curveCatmullRom);const line=d3.line().x(d=>x(d.month)).y(d=>y(d.count)).curve(d3.curveCatmullRom);const grad=svg.append("defs").append("linearGradient").attr("id","aG").attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",1);grad.append("stop").attr("offset","0%").attr("stop-color",C.accent).attr("stop-opacity",.4);grad.append("stop").attr("offset","100%").attr("stop-color",C.accent).attr("stop-opacity",.02);g.append("path").datum(data).attr("d",area).attr("fill","url(#aG)");g.append("path").datum(data).attr("d",line).attr("fill","none").attr("stroke",C.accent).attr("stroke-width",2.5);g.selectAll("circle").data(data).join("circle").attr("cx",d=>x(d.month)).attr("cy",d=>y(d.count)).attr("r",4).attr("fill",C.accent).attr("stroke",C.bg).attr("stroke-width",2);g.append("g").attr("transform",`translate(0,${ch})`).call(d3.axisBottom(x).ticks(12).tickFormat(d=>MN[d]||"")).call(g2=>g2.select(".domain").attr("stroke",C.border)).call(g2=>g2.selectAll(".tick text").attr("fill",C.textDim).attr("font-size",10));},[data,w,h]);return<div ref={wr} style={{width:"100%"}}><svg ref={sr} width={w} height={h} style={{display:"block",maxWidth:"100%"}}/></div>;}
function YearChart({data}){const wr=useRef(),sr=useRef(),w=useW(wr),h=200;useEffect(()=>{if(!sr.current||!data.length)return;const svg=d3.select(sr.current);svg.selectAll("*").remove();
  // continuous year axis: years with no records get an empty slot instead of being skipped
  const lo=d3.min(data,d=>d.year),hi=d3.max(data,d=>d.year),cnt=new Map(data.map(d=>[d.year,d.count]));
  const rows=d3.range(lo,hi+1).map(y=>({year:y,count:cnt.get(y)||0}));
  const m={top:16,right:12,bottom:26,left:36},cw=w-m.left-m.right,ch=h-m.top-m.bottom;
  const g=svg.append("g").attr("transform",`translate(${m.left},${m.top})`);
  const x=d3.scaleBand().domain(rows.map(d=>d.year)).range([0,cw]).padding(.22);
  const y=d3.scaleLinear().domain([0,d3.max(rows,d=>d.count)*1.12]).nice().range([ch,0]);
  // light gridlines + y axis so magnitudes stay readable when bar labels are hidden
  g.append("g").call(d3.axisLeft(y).ticks(4).tickSize(-cw).tickFormat(d3.format("~s")))
    .call(a=>a.select(".domain").remove())
    .call(a=>a.selectAll(".tick line").attr("stroke",C.border).attr("stroke-opacity",.6))
    .call(a=>a.selectAll(".tick text").attr("fill",C.textDim).attr("font-size",9).attr("font-family",mono));
  const bars=g.selectAll("rect.bar").data(rows).join("rect").attr("class","bar").attr("x",d=>x(d.year)).attr("width",x.bandwidth())
    .attr("y",d=>y(d.count)).attr("height",d=>ch-y(d.count)).attr("rx",Math.min(3,x.bandwidth()/4)).attr("fill",C.teal).attr("opacity",.75);
  bars.append("title").text(d=>`${d.year}: ${d.count} publication${d.count===1?"":"s"}`);
  // value labels only when there is room for them (≈ 3 digits at 10px)
  const peak=d3.max(rows,d=>d.count);
  const showAll=x.bandwidth()>=22;
  g.selectAll("text.v").data(rows.filter(d=>d.count>0&&(showAll||d.count===peak))).join("text").attr("class","v")
    .attr("x",d=>x(d.year)+x.bandwidth()/2).attr("y",d=>y(d.count)-5).attr("text-anchor","middle")
    .attr("font-size",showAll?10:9.5).attr("fill",showAll?C.textDim:C.text).attr("font-family",mono).text(d=>d.count);
  // year labels: thin out to every n-th year so they never collide (≈ 32px per label)
  const every=Math.max(1,Math.ceil(32/x.step()));
  const nice=[1,2,5,10,20,25,50].find(n=>n>=every)||every;
  const ticks=rows.map(d=>d.year).filter(yr=>(yr-lo)%nice===0);
  g.append("g").attr("transform",`translate(0,${ch})`).call(d3.axisBottom(x).tickValues(ticks).tickSize(3).tickPadding(4))
    .call(a=>a.select(".domain").attr("stroke",C.border))
    .call(a=>a.selectAll(".tick line").attr("stroke",C.border))
    .call(a=>a.selectAll(".tick text").attr("fill",C.textDim).attr("font-size",9.5).attr("font-family",mono));
},[data,w,h]);return<div ref={wr} style={{width:"100%"}}><svg ref={sr} width={w} height={h} style={{display:"block",maxWidth:"100%"}}/></div>;}
function DonutChart({data,width:W=240,height:H=240}){const sr=useRef();useEffect(()=>{if(!sr.current)return;const svg=d3.select(sr.current);svg.selectAll("*").remove();const radius=Math.min(W,H)/2-10;const g=svg.append("g").attr("transform",`translate(${W/2},${H/2})`);const color=d3.scaleOrdinal(PAL);const pie=d3.pie().value(d=>d.count).sort(null).padAngle(.02);const arc=d3.arc().innerRadius(radius*.55).outerRadius(radius);g.selectAll("path").data(pie(data)).join("path").attr("d",arc).attr("fill",(d,i)=>color(i)).attr("opacity",.8).attr("stroke",C.card).attr("stroke-width",2);const total=d3.sum(data,d=>d.count);g.append("text").attr("text-anchor","middle").attr("dy",-4).attr("fill",C.textBright).attr("font-size",22).attr("font-weight",700).attr("font-family","Georgia,'Times New Roman',serif").text(total);},[data,W,H]);return<svg ref={sr} width={W} height={H}/>;}
function CitationHist({data}){const wr=useRef(),sr=useRef(),w=useW(wr),h=190;useEffect(()=>{if(!sr.current)return;const svg=d3.select(sr.current);svg.selectAll("*").remove();const m={top:10,right:10,bottom:28,left:36},cw=w-m.left-m.right,ch=h-m.top-m.bottom;const g=svg.append("g").attr("transform",`translate(${m.left},${m.top})`);const x=d3.scaleBand().domain(data.map(d=>d.bin)).range([0,cw]).padding(.25);const y=d3.scaleLinear().domain([0,d3.max(data,d=>d.count)*1.1]).range([ch,0]);g.selectAll("rect").data(data).join("rect").attr("x",d=>x(d.bin)).attr("width",x.bandwidth()).attr("y",d=>y(d.count)).attr("height",d=>ch-y(d.count)).attr("rx",3).attr("fill",C.teal).attr("opacity",.7);g.selectAll(".v").data(data).join("text").attr("x",d=>x(d.bin)+x.bandwidth()/2).attr("y",d=>y(d.count)-5).attr("text-anchor","middle").attr("font-size",10).attr("fill",C.textDim).attr("font-family",mono).text(d=>d.count);g.append("g").attr("transform",`translate(0,${ch})`).call(d3.axisBottom(x).tickSize(0)).call(g2=>g2.select(".domain").attr("stroke",C.border)).call(g2=>g2.selectAll(".tick text").attr("fill",C.textDim).attr("font-size",9));},[data,w,h]);return<div ref={wr} style={{width:"100%"}}><svg ref={sr} width={w} height={h} style={{display:"block",maxWidth:"100%"}}/></div>;}
function KeywordCloud({keywords}){const maxC=keywords[0]?.count||1;return(<div style={{display:"flex",flexWrap:"wrap",gap:"6px 8px",alignItems:"center",lineHeight:1.6}}>{keywords.slice(0,40).map((kw,i)=>{const size=10+(kw.count/maxC)*16,opacity=.4+(kw.count/maxC)*.6;return<span key={i} style={{fontSize:size,color:PAL[i%PAL.length],opacity,fontWeight:kw.count>maxC*.5?700:400,cursor:"default"}} title={`${kw.name}: ${kw.count}`}>{kw.name}</span>;})}</div>);}
function TopPapers({papers}){return(<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}><thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{["#","","Title","Author","Journal","Cited"].map((h,i)=><th key={i} style={{textAlign:i>=5?"right":"left",padding:"8px 6px",color:C.textDim,fontWeight:600,fontSize:10,letterSpacing:1,textTransform:"uppercase",width:i===1?30:undefined}}>{h}</th>)}</tr></thead><tbody>{papers.map((p,i)=>(<tr key={i} style={{borderBottom:`1px solid ${C.border}22`}}><td style={{padding:"7px 6px",color:C.accent,fontFamily:mono,fontWeight:700}}>{i+1}</td><td style={{padding:"7px 2px"}}><SrcBadge src={p._src}/></td><td style={{padding:"7px 6px",color:C.text,maxWidth:340,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={p.fullTi||p.ti}><ExtLink p={{...p,ti:p.fullTi||p.ti}} style={{marginRight:6}}/>{p.ti}</td><td style={{padding:"7px 6px",color:C.textDim,whiteSpace:"nowrap"}}>{p.au}</td><td style={{padding:"7px 6px",color:C.teal,fontSize:10,whiteSpace:"nowrap"}}>{p.so}</td><td style={{padding:"7px 6px",color:C.accent,textAlign:"right",fontWeight:700,fontFamily:mono}}>{p.tc}</td></tr>))}</tbody></table></div>);}

/* ═══ HISTCITE COMPONENTS (with zoom & aggregated flows) ═══ */
function buildAggregateFlow(papers,edges,getEntities,topN){const entityPapers=new Map();for(const p of papers){for(const e of getEntities(p)){if(!entityPapers.has(e))entityPapers.set(e,new Set());entityPapers.get(e).add(p.idx);}}const ranked=[...entityPapers.entries()].sort((a,b)=>b[1].size-a[1].size).slice(0,topN);const topSet=new Set(ranked.map(([e])=>e));const paperToEntities=new Map();for(const p of papers){const ents=getEntities(p).filter(e=>topSet.has(e));if(ents.length)paperToEntities.set(p.idx,ents);}const flowMap=new Map();for(const e of edges){const srcEnts=paperToEntities.get(e.source)||[];const tgtEnts=paperToEntities.get(e.target)||[];for(const s of srcEnts)for(const t of tgtEnts){if(s===t)continue;const key=s+"\0"+t;flowMap.set(key,(flowMap.get(key)||0)+1);}}return{nodes:ranked.map(([id,pSet])=>({id,count:pSet.size})),links:[...flowMap.entries()].map(([key,value])=>{const[source,target]=key.split("\0");return{source,target,value};}).sort((a,b)=>b.value-a.value)};}

function FlowNetwork({network,label,selected,onSelect}){const wr=useRef(),sr=useRef(),simR=useRef(),nodeR=useRef(),linkR=useRef(),selR=useRef(onSelect),w=useW(wr),h=Math.max(400,w*.45);selR.current=onSelect;useEffect(()=>{if(!sr.current)return;const svg=d3.select(sr.current);svg.selectAll("*").remove();if(!network.nodes.length||!network.links.length){svg.append("text").attr("x",w/2).attr("y",80).attr("text-anchor","middle").attr("fill",C.textDim).attr("font-size",13).text(`No ${label||"entity"}-level citation flows found.`);return;}const nodes=network.nodes.map(d=>({...d})),links=network.links.map(d=>({...d}));const maxCount=Math.max(...nodes.map(n=>n.count));const maxLink=Math.max(...links.map(l=>l.value));const rS=d3.scaleSqrt().domain([1,maxCount]).range([8,30]);const wS=d3.scaleLinear().domain([1,maxLink]).range([1.5,6]);const color=d3.scaleOrdinal(PAL);svg.append("defs").append("marker").attr("id","fah").attr("viewBox","0 -5 10 10").attr("refX",18).attr("refY",0).attr("markerWidth",5).attr("markerHeight",5).attr("orient","auto").append("path").attr("d","M0,-4L10,0L0,4").attr("fill",C.accent).attr("opacity",.5);const zoomG=svg.append("g");const zoom=d3.zoom().scaleExtent([.2,8]).on("zoom",e=>zoomG.attr("transform",e.transform));svg.call(zoom);svg.append("text").attr("x",w-8).attr("y",16).attr("text-anchor","end").attr("fill",C.textDim).attr("font-size",9).attr("font-family",mono).attr("opacity",.5).text("scroll to zoom · drag to pan");svg.on("dblclick.zoom",()=>svg.transition().duration(500).call(zoom.transform,d3.zoomIdentity));if(simR.current)simR.current.stop();const sim=d3.forceSimulation(nodes).force("link",d3.forceLink(links).id(d=>d.id).distance(100).strength(.3)).force("charge",d3.forceManyBody().strength(-200)).force("center",d3.forceCenter(w/2,h/2)).force("collision",d3.forceCollide().radius(d=>rS(d.count)+8));simR.current=sim;const link=zoomG.append("g").selectAll("line").data(links).join("line").attr("stroke",C.accent).attr("stroke-width",d=>wS(d.value)).attr("stroke-opacity",.3).attr("marker-end","url(#fah)");linkR.current=link;const pairKeys=new Set(links.map(l=>(l.source.id??l.source)+"\0"+(l.target.id??l.target)));links.forEach(l=>{l.rev=pairKeys.has((l.target.id??l.target)+"\0"+(l.source.id??l.source));});
const off=(d,k)=>{if(!d.rev)return 0;const dx=d.target.x-d.source.x,dy=d.target.y-d.source.y,L=Math.hypot(dx,dy)||1;return(k==="x"?-dy:dx)/L*6;};   // arrows in both directions are drawn 6 px to each side
const linkHit=zoomG.append("g").selectAll("line").data(links).join("line").attr("stroke","transparent").attr("stroke-width",10).style("cursor","pointer").on("click",(e,d)=>{e.stopPropagation();selR.current&&selR.current({link:[d.source.id,d.target.id]});});linkHit.append("title").text(d=>`${d.source.id} → ${d.target.id}: ${d.value} citation${d.value===1?"":"s"} – click to list them`);const edgeLabels=zoomG.append("g").selectAll("text").data(links).join("text").attr("pointer-events","none").attr("font-size",9).attr("fill",C.textDim).attr("font-family",mono).attr("text-anchor","middle").text(d=>d.value>1?d.value:"");const node=zoomG.append("g").selectAll("g").data(nodes).join("g").style("cursor","grab").call(d3.drag().on("start",(e,d)=>{if(!e.active)sim.alphaTarget(.3).restart();d.fx=d.x;d.fy=d.y}).on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null}));node.append("circle").attr("r",d=>rS(d.count)).attr("fill",(d,i)=>color(i%PAL.length)).attr("opacity",.8).attr("stroke",C.bg).attr("stroke-width",2);node.append("title").text(d=>`${d.id} (${d.count}) – click to list its citations`);node.on("click",(e,d)=>{e.stopPropagation();selR.current&&selR.current({node:d.id});});svg.on("click",()=>selR.current&&selR.current(null));nodeR.current=node;node.append("text").text(d=>d.id.length>22?d.id.slice(0,20)+"…":d.id).attr("text-anchor","middle").attr("dy",d=>-(rS(d.count)+6)).attr("fill",C.text).attr("font-size",10).attr("font-weight",600).attr("pointer-events","none");sim.on("tick",()=>{for(const L of [linkHit,link])L.attr("x1",d=>d.source.x+off(d,"x")).attr("y1",d=>d.source.y+off(d,"y")).attr("x2",d=>d.target.x+off(d,"x")).attr("y2",d=>d.target.y+off(d,"y"));edgeLabels.attr("x",d=>(d.source.x+d.target.x)/2+off(d,"x")*2.2).attr("y",d=>(d.source.y+d.target.y)/2+(d.rev?off(d,"y")*2.2:-6));node.attr("transform",d=>`translate(${d.x},${d.y})`);});return()=>sim.stop();},[network,w,h,label]);
useEffect(()=>{const sn=selected&&selected.node,sl=selected&&selected.link;
  if(nodeR.current)nodeR.current.select("circle").attr("stroke",d=>d.id===sn||(sl&&sl.includes(d.id))?C.textBright:C.bg).attr("stroke-width",d=>d.id===sn||(sl&&sl.includes(d.id))?3.5:2);
  if(linkR.current)linkR.current.attr("stroke-opacity",d=>{const on=sl?(d.source.id===sl[0]&&d.target.id===sl[1]):sn?(d.source.id===sn||d.target.id===sn):false;return on?.9:(selected?.12:.3);});
},[selected,network,w,h]);
return<div ref={wr} style={{width:"100%"}}><svg ref={sr} width={w} height={h} style={{display:"block",maxWidth:"100%"}}/></div>;}

// A record (or the records citing it) shown on top of the page, so the view underneath keeps its state
function RecordOverlay({view,setView,records,hc}){
  useEffect(()=>{const k=e=>{if(e.key==="Escape")setView(null);};window.addEventListener("keydown",k);const ov=document.body.style.overflow;document.body.style.overflow="hidden";
    return()=>{window.removeEventListener("keydown",k);document.body.style.overflow=ov;};},[setView]);
  const close=<button onClick={()=>setView(null)} title="Close (Esc)" style={{...btnBase,background:"transparent",border:`1px solid ${C.border}`,color:C.textDim}}>✕ Close</button>;
  return(<div onClick={()=>setView(null)} style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,.45)",display:"flex",justifyContent:"center",alignItems:"flex-start",overflowY:"auto",padding:"40px 16px"}}>
    <div onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" style={{width:"100%",maxWidth:1000,background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:16,boxShadow:"0 24px 64px rgba(0,0,0,.5)"}}>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>{close}</div>
      {view.idx!=null
        ?<RecordDetail idx={view.idx} records={records} hc={hc} onBack={()=>view.back?setView(view.back):setView(null)} onOpen={i=>setView({idx:i,back:view})}
            onCitedBy={i=>setView({citing:i,back:view})}/>
        :<div style={{display:"flex",flexDirection:"column",gap:16}}>
          {(view.back||!view.set)&&<button onClick={()=>setView(view.back||null)} style={{...btnBase,background:"transparent",border:`1px solid ${C.border}`,color:C.accent,alignSelf:"flex-start"}}>← Back</button>}
          {view.set?<Card><RecordsList records={records} indices={view.set.indices} hc={hc} onClickRecord={i=>setView({idx:i,back:view})} onClickLcs={i=>setView({citing:i,back:view})} title={view.set.title}/></Card>
            :<Card><RecordsList records={records} indices={citingIdx(hc,view.citing)} hc={hc} onClickRecord={i=>setView({idx:i,back:view})} onClickLcs={i=>setView({citing:i,back:view})} title={citingTitle(records,view.citing)}/></Card>}
        </div>}
    </div>
  </div>);
}

// Citations behind a node or a link of an aggregated citation flow: one row per citation (citing record → cited record)
function FlowCitationTable({sel,getEntities,papers,edges,records,label,hc,onOpenRecord}){
  const[dir,setDir]=useState("in");
  const[showAll,setShowAll]=useState(false);
  useEffect(()=>setShowAll(false),[sel,dir]);
  const byIdx=useMemo(()=>new Map(papers.map(p=>[p.idx,p])),[papers]);
  const isLink=!!sel.link,entity=sel.node;
  const rows=useMemo(()=>{
    const out=[];
    for(const e of edges){
      const src=byIdx.get(e.source),tgt=byIdx.get(e.target);if(!src||!tgt)continue;
      const se=getEntities(src),te=getEntities(tgt);
      const hit=isLink?(se.includes(sel.link[0])&&te.includes(sel.link[1])):(dir==="in"?te.includes(entity):se.includes(entity));
      if(!hit)continue;
      out.push({from:se,to:te,citing:e.source,cited:e.target,within:!isLink&&se.includes(entity)&&te.includes(entity)});
    }
    return out.sort((a,b)=>(records[b.citing]?.py||0)-(records[a.citing]?.py||0));
  },[sel,isLink,entity,dir,edges,byIdx,getEntities,records]);
  const nWithin=rows.filter(r=>r.within).length;
  const shown=showAll?rows:rows.slice(0,200);
  const hlFrom=new Set(isLink?[sel.link[0]]:[entity]),hlTo=new Set(isLink?[sel.link[1]]:[entity]);
  const pMap=byIdx;
  const recCell=i=>{const r=records[i];if(!r)return null;const pp=pMap.get(i)||{};return<div style={{lineHeight:1.4}}>
    <span style={{color:C.text}}>{(r.au[0]||"[Anonymous]")}, {r.py||"n.d."}</span> <ExtLink p={r}/>
    <div role="button" onClick={()=>onOpenRecord&&onOpenRecord(i)} title="Open the record in the collection (LCS, GCS, LCR, CR and references)"
      style={{color:C.textBright,fontSize:11,cursor:onOpenRecord?"pointer":"default",textDecoration:onOpenRecord?"underline":"none",textDecorationColor:`${C.teal}66`,textUnderlineOffset:3}}>{r.ti}</div>
    <div style={{color:C.textDim,fontSize:10}}>{r.so}</div>
    <div style={{fontFamily:mono,fontSize:9.5,color:C.textDim,marginTop:2}}>LCS <b style={{color:(pp.lcs||0)>0?C.accent:C.textDim}}>{pp.lcs||0}</b> · GCS <b>{r.tc||0}</b> · LCR <b style={{color:(pp.lcr||0)>0?C.teal:C.textDim}}>{pp.lcr||0}</b> · CR <b>{r.nr||0}</b></div></div>;};
  const ents=(arr,hl)=>arr.map((x,k)=><div key={k} style={{color:hl.has(x)?C.accent:C.text,fontWeight:hl.has(x)?700:400}}>{x}</div>);
  const th={padding:"8px 6px",textAlign:"left",color:C.textDim,fontSize:10,letterSpacing:.8,textTransform:"uppercase",fontWeight:600};
  const td={padding:"7px 6px",verticalAlign:"top",fontSize:11};
  const citingRecs=new Set(rows.map(r=>r.citing)).size,citedRecs=new Set(rows.map(r=>r.cited)).size;
  return(<div style={{marginTop:20}}>
    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
      <span style={{fontSize:12,color:C.textBright,fontWeight:700}}>{isLink?`${sel.link[0]} → ${sel.link[1]}`:entity}</span>
      {!isLink&&<><PillBtn active={dir==="in"} onClick={()=>setDir("in")} style={{fontSize:10}}>Cited by (incoming)</PillBtn>
      <PillBtn active={dir==="out"} onClick={()=>setDir("out")} style={{fontSize:10}}>Citing (outgoing)</PillBtn></>}
      <span style={{fontSize:11,color:C.textDim,fontFamily:mono}}>{rows.length} citation{rows.length===1?"":"s"} · {citingRecs} citing and {citedRecs} cited record{citedRecs===1?"":"s"}{!isLink&&nWithin?` · ${nWithin} within the ${label}`:""}</span>
    </div>
    <div style={{fontSize:10,color:C.textDim,marginBottom:8}}>Click a title to open the record. Each row is one citation between two records in the collection{isLink?`, from a record of ${sel.link[0]} to a record of ${sel.link[1]}`:""}.{!isLink?` Rows marked within link two records that both belong to ${entity}; they are not drawn as arrows in the network.`:""} Click a node or an arrow in the network to change the selection; click the background to clear it.</div>
    {rows.length===0?<div style={{color:C.textDim,fontSize:12,padding:12}}>No citations {isLink?"for this link":dir==="in"?"to":"from"} {isLink?"":`this ${label}`} within the collection.</div>:
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
      <thead><tr style={{borderBottom:`1px solid ${C.border}`}}><th style={{...th,width:24}}>#</th><th style={th}>From ({label})</th><th style={th}>To ({label})</th><th style={th}>Citing record</th><th style={th}>Cited record</th></tr></thead>
      <tbody>{shown.map((r,i)=><tr key={i} style={{borderBottom:`1px solid ${C.border}22`,background:r.within?`${C.bg}80`:"transparent"}}>
        <td style={{...td,color:C.textDim,fontFamily:mono,fontSize:10}}>{i+1}{r.within&&<div style={{fontSize:9}}>within</div>}</td>
        <td style={{...td,maxWidth:200}}>{ents(r.from,hlFrom)}</td><td style={{...td,maxWidth:200}}>{ents(r.to,hlTo)}</td>
        <td style={{...td,maxWidth:320}}>{recCell(r.citing)}</td><td style={{...td,maxWidth:320}}>{recCell(r.cited)}</td></tr>)}</tbody>
    </table></div>}
    {rows.length>200&&!showAll&&<button onClick={()=>setShowAll(true)} style={{...btnBase,marginTop:8,background:"transparent",border:`1px solid ${C.border}`,color:C.accent}}>Show all {rows.length}</button>}
  </div>);
}


/* ═══ DOI LOOKUP FOR CITED REFERENCES (Crossref, 0.91) ═══
   query.bibliographic often ranks a wrong article first for short references without a title,
   so every candidate is checked against first-author surname, year, volume and first page. */
const _doiLookupCache=new Map();
const _normName=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z]/g,"");
function refParts(ref){
  const t=ref.display||"";
  const surname=_normName(String(ref.author||t.split(",")[0]).split(/[ ,]/)[0]);
  const year=+ref.year||+((t.match(/\b(1[5-9]\d\d|20\d\d)\b/)||[])[1])||0;
  let vol=(t.match(/,\s*V(\d+)\b/)||[])[1]||"",page=(t.match(/,\s*P(\d+)\b/)||[])[1]||"";      // WoS: V31, P7
  if(!vol){const m=t.match(/,\s*(\d+)\s*(?:\(\d+\))?\s*,\s*(?:\d+\s*,\s*)?pp?\.\s*(\d+)/)||t.match(/,\s*(\d+)\s*(?:\(\d+\))?\s*,\s*(\d+)\s*(?:,|$)/);
    if(m){vol=m[1];page=page||m[2];}}                                              // Scopus: 46, 5, pp. 604-632
  const query=t.replace(/,?\s*(DOI\s*)+:?\s*\S+/ig,"").replace(/^[●\s]+/,"").slice(0,300);
  // words of the (often truncated) title or journal: everything after author and year, minus volume/page/DOI
  const words=query.split(",").slice(1).join(" ").replace(/\b(1[5-9]\d\d|20\d\d)\b|\bV\d\w*|\bP\d+\b|pp?\.\s*[\d-]+/g," ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split(/[^a-z]+/).filter(w=>w.length>=3);
  return{surname,year,vol,page,words,query};
}
async function findDoiForRef(ref){
  const key=ref.rawKey||ref.display;
  if(_doiLookupCache.has(key))return _doiLookupCache.get(key);
  const P=refParts(ref);
  const url="https://api.crossref.org/works?rows=5&select=DOI,title,author,issued,container-title,volume,page,score&query.bibliographic="+encodeURIComponent(P.query);
  const res=await fetch(url);if(!res.ok)throw new Error("Crossref "+res.status);
  const items=((await res.json()).message||{}).items||[];
  const cands=items.map(it=>{
    const fam=_normName((it.author||[])[0]?.family);const yr=((it.issued||{})["date-parts"]||[[0]])[0][0]||0;
    const fp=String(it.page||"").split(/[-–]/)[0];
    // share of the reference's title/journal words that begin a word in the candidate's title or journal (WoS truncates and abbreviates)
    const cw=`${(it.title||[]).join(" ")} ${(it["container-title"]||[]).join(" ")}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split(/[^a-z]+/).filter(Boolean);
    const wordShare=P.words.length?P.words.filter(w=>cw.some(c=>c.startsWith(w))).length/P.words.length:0;
    const checks={author:!!P.surname&&fam===P.surname,year:!!P.year&&yr===P.year,volume:!!P.vol&&String(it.volume||"")===P.vol,page:!!P.page&&fp===P.page,title:wordShare>=0.6};
    const n=Object.values(checks).filter(Boolean).length;
    // likely = first author and year, plus volume or page; without volume/page (typically books) the title/journal words must match
    const likely=checks.author&&checks.year&&(checks.volume||checks.page||checks.title);
    return{doi:String(it.DOI||"").toLowerCase(),title:(it.title||[])[0]||"",author:(it.author||[])[0]?.family||"",year:yr,source:(it["container-title"]||[])[0]||"",volume:it.volume||"",page:it.page||"",score:it.score||0,checks,n,likely};
  }).sort((a,b)=>(b.likely-a.likely)||(b.n-a.n)||(b.score-a.score));
  const out={likely:cands.find(c=>c.likely)||null,cands};
  _doiLookupCache.set(key,out);return out;
}
const scholarUrl=ref=>"https://scholar.google.com/scholar?q="+encodeURIComponent(refParts(ref).query);

// Links for one cited reference: DOI if known; otherwise Crossref lookup and a Google Scholar search
function RefLinks({ref,records,found,onFound}){
  const[own,setState]=useState(null);
  const state=own||found||null;   // own lookup, or the result of a page lookup   // null | "busy" | {likely,cands} | {error}
  const[open,setOpen]=useState(false);
  const stop=e=>e.stopPropagation();
  const lk={color:C.teal,textDecoration:"none",fontSize:10.5,whiteSpace:"nowrap",cursor:"pointer"};
  const doi=ref.doi||(ref.localIdx!=null?records[ref.localIdx]?.di:"")||"";
  const P0=refParts(ref);if(!P0.surname||!P0.year||/no title captured/i.test(ref.display||""))return null;
  if(doi)return<a href={"https://doi.org/"+doi} target="_blank" rel="noopener noreferrer" onClick={stop} title={`Open DOI ${doi}`} style={{...lk,marginLeft:6}}>↗ DOI</a>;
  const run=async e=>{stop(e);setState("busy");try{const r=await findDoiForRef(ref);setState(r);onFound(ref,r);if(!r.likely)setOpen(true);}catch(err){setState({error:"Lookup failed – it needs an internet connection."});}};
  const hit=state&&state.likely;
  return(<span onClick={stop} style={{marginLeft:6}}>
    {hit?<a href={"https://doi.org/"+hit.doi} target="_blank" rel="noopener noreferrer" title={`Found via Crossref (author, year${hit.checks.volume?", volume":""}${hit.checks.page?", page":""}${hit.checks.title?", title words":""} match): ${hit.title}`} style={{...lk,fontStyle:"italic"}}>↗ DOI (found)</a>
      :state==="busy"?<span style={{fontSize:10.5,color:C.textDim}}>looking up…</span>
      :state&&state.error?<span style={{fontSize:10.5,color:C.rose}}>{state.error}</span>
      :state&&state.cands?<span role="button" onClick={()=>setOpen(!open)} style={{...lk,color:C.textDim}} title="No candidate matched author and year; check the candidates">{state.cands.length?`? ${state.cands.length} candidates ${open?"▲":"▼"}`:"no match"}</span>
      :<span role="button" onClick={run} style={lk} title="Look up a DOI for this reference in Crossref">🔍 Find DOI</span>}
    <a href={scholarUrl(ref)} target="_blank" rel="noopener noreferrer" title="Search Google Scholar for this reference" style={{...lk,color:C.textDim,marginLeft:8}}>Scholar</a>
    {open&&state&&state.cands&&state.cands.length>0&&<div style={{marginTop:6,padding:"6px 8px",border:`1px solid ${C.border}`,borderRadius:6,background:C.bg,cursor:"default"}}>
      {state.cands.map(c=><div key={c.doi} style={{fontSize:10.5,color:C.text,marginBottom:4,lineHeight:1.4}}>
        <a href={"https://doi.org/"+c.doi} target="_blank" rel="noopener noreferrer" style={{color:C.teal,textDecoration:"none"}}>↗ {c.doi}</a>{" "}
        {c.author}, {c.year||"n.d."}, {c.title}{c.source?`, ${c.source}`:""}{c.volume?` ${c.volume}`:""}{c.page?`: ${c.page}`:""}
        <span style={{color:C.textDim}}> · match: {["author","year","volume","page","title"].filter(k=>c.checks[k]).join(", ")||"none"}</span>
      </div>)}
    </div>}
  </span>);
}

/* ═══ PAPER LINK (DOI → WoS → Scopus → OpenAlex → Google Scholar) ═══ */
function paperLinkKind(p){
  if((p.di||"").trim())return"DOI";
  const ut=String(p.ut||"").trim();
  if(/^WOS:/i.test(ut))return"Web of Science record";
  if(/^2-s2\.0-/i.test(ut))return"Scopus record";
  if(/^https?:\/\/openalex\.org\/W/i.test(ut))return"OpenAlex";
  return p.ti?"Google Scholar search":"no link";
}
function paperLink(p){
  const doi=(p.di||"").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i,"");
  if(doi)return"https://doi.org/"+doi.split("/").map(encodeURIComponent).join("/");
  const ut=String(p.ut||"").trim();
  if(/^WOS:/i.test(ut))return"https://www.webofscience.com/wos/woscc/full-record/"+encodeURIComponent(ut);
  if(/^2-s2\.0-/i.test(ut))return"https://www.scopus.com/record/display.uri?origin=resultslist&eid="+encodeURIComponent(ut);
  if(/^https?:\/\/openalex\.org\/W/i.test(ut))return ut;
  return p.ti?"https://scholar.google.com/scholar?q="+encodeURIComponent(p.ti):null;
}
// Small outgoing link (DOI → WoS → Scopus → OpenAlex → Google Scholar); does not trigger row clicks
function ExtLink({p,style}){const u=paperLink(p);if(!u)return null;
  return<a href={u} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} title={`Open ${paperLinkKind(p)} in a new tab`}
    style={{color:C.teal,textDecoration:"none",fontSize:11,fontWeight:400,whiteSpace:"nowrap",...style}}>↗ {paperLinkKind(p)==="DOI"?"DOI":paperLinkKind(p).replace(/ record$/,"").replace(/ search$/,"")}</a>;}
// Indices of the records in the collection that cite record idx
function citingIdx(hc,idx){const s=new Set();for(const e of hc.edges)if(e.target===idx)s.add(e.source);return[...s];}
function citingTitle(records,idx){const t=records[idx];return t?`Records in the collection citing: ${t.au[0]||"[Anonymous]"}, ${t.py||"n.d."}, ${t.ti}`:"Citing records";}
function openPaperLink(p){const u=paperLink(p);if(u)window.open(u,"_blank","noopener,noreferrer");}

function PaperHistoriograph({papers,edges,filterMode,topN,mainPath,rank,restrict,colorOf,sizeOf,info}){const filtered=useMemo(()=>{if(filterMode==="mainpath"&&mainPath){const S=new Set(mainPath.nodes.filter(i=>!restrict||restrict.has(i)));const A=new Map(mainPath.arcs.map(a=>[a.to+">"+a.from,a]));return{papers:papers.filter(p=>S.has(p.idx)),edges:edges.filter(e=>A.has(e.source+">"+e.target)).map(e=>({...e,mp:A.get(e.source+">"+e.target)}))};}const pool=restrict?papers.filter(p=>restrict.has(p.idx)):papers;let sorted;if(rank)sorted=[...pool].sort((a,b)=>(rank(b)-rank(a))||(b.lcs-a.lcs)||(b.gcs-a.gcs));else if(filterMode==="gcs")sorted=[...pool].sort((a,b)=>b.gcs-a.gcs);else if(filterMode==="lcs")sorted=[...pool].sort((a,b)=>b.lcs-a.lcs);else sorted=[...pool].sort((a,b)=>(b.lcs+b.lcr)-(a.lcs+a.lcr));const selected=new Set(sorted.slice(0,topN).map(p=>p.idx));return{papers:papers.filter(p=>selected.has(p.idx)),edges:edges.filter(e=>selected.has(e.source)&&selected.has(e.target))};},[papers,edges,filterMode,topN,mainPath,rank,restrict]);const wr=useRef(),sr=useRef(),w=useW(wr);const{papers:aP,edges:aE}=filtered;const activeIdx=new Set();for(const e of aE){activeIdx.add(e.source);activeIdx.add(e.target);}const h=Math.max(300,aP.length*22+120);useEffect(()=>{if(!sr.current)return;const svg=d3.select(sr.current);svg.selectAll("*").remove();if(!aP.length){svg.append("text").attr("x",w/2).attr("y",60).attr("text-anchor","middle").attr("fill",C.textDim).attr("font-size",13).text("No papers match the current filter.");return;}if(!aE.length){svg.append("text").attr("x",w/2).attr("y",60).attr("text-anchor","middle").attr("fill",C.textDim).attr("font-size",13).text(`${aP.length} papers selected but no local citation links.`);return;}const zoomG=svg.append("g");const zoom=d3.zoom().scaleExtent([.2,8]).on("zoom",e=>zoomG.attr("transform",e.transform));svg.call(zoom);svg.append("text").attr("x",w-8).attr("y",16).attr("text-anchor","end").attr("fill",C.textDim).attr("font-size",9).attr("font-family",mono).attr("opacity",.5).text("scroll to zoom · drag to pan");svg.on("dblclick.zoom",()=>svg.transition().duration(500).call(zoom.transform,d3.zoomIdentity));const m={top:30,right:40,bottom:30,left:60},cw=w-m.left-m.right,ch=h-m.top-m.bottom;const g=zoomG.append("g").attr("transform",`translate(${m.left},${m.top})`);const years=[...new Set(aP.map(p=>p.py))].sort();const yScale=d3.scalePoint().domain(years).range([0,ch]).padding(.5);const byYear=new Map();for(const p of aP){if(!byYear.has(p.py))byYear.set(p.py,[]);byYear.get(p.py).push(p);}const posMap=new Map();for(const[yr,ps]of byYear){ps.sort((a,b)=>b.lcs-a.lcs);const yy=yScale(yr);const spacing=Math.min(70,cw/(ps.length+1));const startX=(cw-spacing*(ps.length-1))/2;ps.forEach((p,i)=>posMap.set(p.idx,{x:startX+i*spacing,y:yy}));}for(const yr of years){g.append("text").attr("x",-10).attr("y",yScale(yr)+4).attr("text-anchor","end").attr("fill",C.textDim).attr("font-size",11).attr("font-family",mono).text(yr);g.append("line").attr("x1",0).attr("x2",cw).attr("y1",yScale(yr)).attr("y2",yScale(yr)).attr("stroke",C.border).attr("stroke-opacity",.3).attr("stroke-dasharray","3,3");}{const dm=svg.append("defs");dm.append("marker").attr("id","ahpm").attr("viewBox","0 -5 10 10").attr("refX",13).attr("refY",0).attr("markerUnits","userSpaceOnUse").attr("markerWidth",10).attr("markerHeight",10).attr("orient","auto").append("path").attr("d","M0,-4L10,0L0,4").attr("fill",C.accent).attr("opacity",.8);}svg.append("defs").append("marker").attr("id","ahp").attr("viewBox","0 -5 10 10").attr("refX",12).attr("refY",0).attr("markerWidth",6).attr("markerHeight",6).attr("orient","auto").append("path").attr("d","M0,-4L10,0L0,4").attr("fill",C.accent).attr("opacity",.6);const maxSpc=Math.max(1e-12,...aE.map(e=>e.mp?e.mp.spc:0));for(const e of aE){const s=posMap.get(e.source),t=posMap.get(e.target);if(!s||!t)continue;const dx=t.x-s.x;const cx1=s.x+dx*.3+(Math.abs(dx)<20?(dx>=0?30:-30):0);const ep=g.append("path").attr("d",`M${s.x},${s.y} Q${cx1},${s.y+(t.y-s.y)*.5} ${t.x},${t.y}`).attr("fill","none").attr("stroke",C.accent).attr("stroke-width",e.mp?1.5+4.5*e.mp.spc/maxSpc:1.5).attr("stroke-opacity",e.mp?.7:.4).attr("marker-end",e.mp?"url(#ahpm)":"url(#ahp)");if(e.mp)ep.append("title").text(`SPC ${e.mp.spc.toLocaleString("en")} (${(100*e.mp.norm).toFixed(1)} % of all source–sink paths)`);}const sv=p=>sizeOf?sizeOf(p):p.lcs;const maxLCS=Math.max(...aP.map(sv),1e-12);const rScale=d3.scaleSqrt().domain([0,maxLCS]).range([6,18]);const tt=svg.append("g").style("display","none");tt.append("rect").attr("rx",4).attr("fill",C.card).attr("stroke",C.border);const ttText=tt.append("text").attr("fill",C.text).attr("font-size",10);for(const p of aP){const pos=posMap.get(p.idx);if(!pos)continue;const r=rScale(sv(p));const inNet=activeIdx.has(p.idx);const ng=g.append("g").attr("transform",`translate(${pos.x},${pos.y})`).style("cursor","pointer");ng.append("circle").attr("r",r).attr("fill",colorOf?colorOf(p):inNet?(p.lcs>0?C.accent:C.teal):`${C.textDim}44`).attr("opacity",colorOf&&!inNet?.45:.8).attr("stroke",C.bg).attr("stroke-width",2);const label=p.au[0]?p.au[0].split(",")[0]:"?";ng.append("text").attr("y",r+14).attr("text-anchor","middle").attr("fill",C.textDim).attr("font-size",9).text(`${label} ${p.py}`);ng.on("click",()=>openPaperLink(p));ng.on("mouseenter",function(){d3.select(this).select("circle").attr("opacity",1).attr("stroke",C.accent);const lines=[p.au[0]||"?",p.ti.slice(0,50)+(p.ti.length>50?"…":""),`${p.so} (${p.py})`,`GCS:${p.gcs} LCS:${p.lcs} LCR:${p.lcr}`,...(info?[info(p)]:[]),`Click opens: ${paperLinkKind(p)}`];ttText.selectAll("tspan").remove();lines.forEach((l,i)=>ttText.append("tspan").attr("x",8).attr("dy",i===0?14:14).text(l).attr("font-weight",i===0?700:400).attr("fill",i===3?C.accent:C.text));const bb=ttText.node().getBBox();tt.select("rect").attr("width",bb.width+16).attr("height",bb.height+12);const zt=d3.zoomTransform(svg.node());tt.attr("transform",`translate(${Math.min(zt.applyX(pos.x+m.left)+20,w-bb.width-40)},${Math.min(zt.applyY(pos.y+m.top)-20,h-bb.height-20)})`).style("display",null);}).on("mouseleave",function(){d3.select(this).select("circle").attr("opacity",.8).attr("stroke",C.bg);tt.style("display","none");});}
  },[aP,aE,w,h,colorOf,sizeOf,info]);return<div ref={wr} style={{width:"100%",overflowX:"auto"}}><svg ref={sr} width={w} height={h} style={{display:"block",maxWidth:"100%"}}/></div>;}

function HistCitePanel({hc,records}){const[view,setView]=useState("papers");const[selEnt,setSelEnt]=useState(null);useEffect(()=>setSelEnt(null),[view]);const[recView,setRecView]=useState(null);
const affOf=useMemo(()=>{const a=new Map(),s=new Map();(records||[]).forEach((r,i)=>{a.set(i,recordUnitKeys(r,"affiliation"));s.set(i,recordUnitKeys(r,"affiliation_sub"));});return{a,s};},[records]);
const getters=useMemo(()=>({authors:p=>p.au.slice(0,3),journals:p=>p.so?[p.so]:[],countries:p=>p.coNorm||[],institutions:p=>affOf.a.get(p.idx)||[],institutions_sub:p=>affOf.s.get(p.idx)||[]}),[affOf]);const[filterMode,setFilterMode]=useState("lcs");const[topN,setTopN]=useState(30);const[mpMethod,setMpMethod]=useState("global");const[keyK,setKeyK]=useState(1);const mp=useMemo(()=>mainPathAnalysis(hc.papers,hc.edges,{method:mpMethod,keyRoutes:keyK}),[hc,mpMethod,keyK]);const cm=useMemo(()=>computeCitationMetrics(hc.papers,hc.edges),[hc]);const cmMap=useMemo(()=>new Map(cm.map(x=>[x.idx,x])),[cm]);
const[hcRes,setHcRes]=useState(1);const[hcMinCl,setHcMinCl]=useState(2);const[colorBy,setColorBy]=useState("cluster");const[sizeBy,setSizeBy]=useState("lcs");const[clFocus,setClFocus]=useState(null);
const hcClus=useMemo(()=>{const links=hc.edges.filter(e=>e.source!==e.target).map(e=>({source:e.source,target:e.target,w:1}));return clusterNetwork({nodes:hc.papers.map(p=>({id:p.idx,count:p.lcs+1})),links,layoutLinks:links},{resolution:hcRes,minSize:hcMinCl});},[hc,hcRes,hcMinCl]);
useEffect(()=>{setClFocus(null);},[hcClus]);
const HC_MEASURES=useMemo(()=>({gcs:{l:"GCS",f:p=>p.gcs},lcs:{l:"LCS",f:p=>p.lcs},linkage:{l:"LCS + LCR",f:p=>p.lcs+p.lcr},pagerank:{l:"PageRank",f:p=>cmMap.get(p.idx)?.pagerank||0,d:5},authority:{l:"Authority",f:p=>cmMap.get(p.idx)?.authority||0,d:3},spc:{l:"SPC",f:p=>mp.nodeSPC.get(p.idx)||0}}),[cmMap,mp]);
const rankKey=filterMode==="mainpath"?"spc":filterMode;const rankM=HC_MEASURES[rankKey]||HC_MEASURES.lcs;
const clusterOf=useCallback(i=>hcClus.byId.get(i)??-1,[hcClus]);
const restrict=useMemo(()=>clFocus==null?null:new Set(hc.papers.filter(p=>clusterOf(p.idx)===clFocus).map(p=>p.idx)),[clFocus,hc,clusterOf]);
const mpView=useMemo(()=>restrict?mainPathAnalysis(hc.papers.filter(p=>restrict.has(p.idx)),hc.edges.filter(e=>restrict.has(e.source)&&restrict.has(e.target)),{method:mpMethod,keyRoutes:keyK}):mp,[restrict,hc,mp,mpMethod,keyK]);
const colorOf=useMemo(()=>colorBy==="cluster"?(p=>clusterColor(clusterOf(p.idx))):null,[colorBy,clusterOf]);
const sizeOf=useMemo(()=>sizeBy==="lcs"?null:HC_MEASURES[sizeBy].f,[sizeBy,HC_MEASURES]);
const fmtM=(m,v)=>m.d?v.toFixed(m.d):v>=1e6?v.toExponential(2):Math.round(v*100)/100;
const info=useCallback(p=>{const c=clusterOf(p.idx);return`${c>=0?`Cluster ${c+1}`:"No cluster"} · ${rankM.l}: ${fmtM(rankM,rankM.f(p))}`;},[clusterOf,rankM]);
const clSummary=useMemo(()=>clusterSummaries(hc,records||[],hcClus,rankM.f),[hc,records,hcClus,rankM]);const maxN=Math.min(hc.papers.length,200);const authorFlow=useMemo(()=>buildAggregateFlow(hc.papers,hc.edges,getters.authors,topN),[hc,topN,getters]);const instFlow=useMemo(()=>buildAggregateFlow(hc.papers,hc.edges,getters.institutions,topN),[hc,topN,getters]);const instSubFlow=useMemo(()=>buildAggregateFlow(hc.papers,hc.edges,getters.institutions_sub,topN),[hc,topN,getters]);const journalFlow=useMemo(()=>buildAggregateFlow(hc.papers,hc.edges,p=>p.so?[p.so]:[],topN),[hc,topN]);const countryFlow=useMemo(()=>buildAggregateFlow(hc.papers,hc.edges,p=>p.coNorm||[],topN),[hc,topN]);const recsWithRefs=hc.papers.filter(p=>p.ncr>0).length;
  return(<div style={{display:"flex",flexDirection:"column",gap:24}}><div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{[{l:"Local Citations",v:hc.totalLCS,s:`${hc.papersWithLCS} cited locally`,c:C.accent},{l:"Local References",v:hc.totalLCR,s:`${hc.papersWithLCR} referencing locally`,c:C.teal},{l:"Citation Edges",v:hc.edges.length,s:"directed links",c:C.purple},{l:"Papers w/ Refs",v:recsWithRefs,s:`of ${hc.papers.length} total`,c:C.blue}].map((s,i)=>(<div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 20px",flex:1,minWidth:140}}><div style={{fontSize:10,color:C.textDim,textTransform:"uppercase",letterSpacing:1.5,fontFamily:mono,marginBottom:4}}>{s.l}</div><div style={{fontSize:24,fontWeight:700,color:s.c,fontFamily:"Georgia,'Times New Roman',serif"}}>{s.v}</div><div style={{fontSize:10,color:C.textDim,marginTop:2}}>{s.s}</div></div>))}</div>
    <Card><div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,flexWrap:"wrap"}}><span style={{fontSize:11,color:C.textDim,fontFamily:mono,textTransform:"uppercase",letterSpacing:1.5}}>View</span><div style={{display:"flex",gap:6}}>{[{id:"papers",l:"📄 Papers"},{id:"authors",l:"👤 Authors"},{id:"journals",l:"📚 Journals"},{id:"countries",l:"🌍 Countries"},{id:"institutions",l:"🏛️ Institutions"},{id:"institutions_sub",l:"🏢 Institutions with Subdivision"}].map(v=><PillBtn key={v.id} active={view===v.id} onClick={()=>setView(v.id)}>{v.l}</PillBtn>)}</div></div>
      {view==="papers"&&<div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16,flexWrap:"wrap"}}><span style={{fontSize:11,color:C.textDim,fontFamily:mono,textTransform:"uppercase",letterSpacing:1.5}}>Filter</span><div style={{display:"flex",gap:6}}>{[{id:"gcs",l:"Top GCS"},{id:"lcs",l:"Top LCS"},{id:"linkage",l:"Top Linked"},{id:"pagerank",l:"Top PageRank"},{id:"authority",l:"Top Authority"},{id:"spc",l:"Top SPC"},{id:"mainpath",l:"Main path"}].map(f=><PillBtn key={f.id} active={filterMode===f.id} onClick={()=>setFilterMode(f.id)}>{f.l}</PillBtn>)}</div>{filterMode!=="mainpath"&&<div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:11,color:C.textDim,fontFamily:mono}}>N =</span><input type="range" min={5} max={maxN} value={topN} onChange={e=>setTopN(+e.target.value)} style={{width:120,accentColor:C.accent}}/><span style={{fontSize:13,color:C.accent,fontWeight:700,fontFamily:mono,minWidth:30}}>{topN}</span></div>}{filterMode==="mainpath"&&<div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontSize:11,color:C.textDim,fontFamily:mono}}>Search</span><select value={mpMethod} onChange={e=>setMpMethod(e.target.value)} style={{background:C.card,color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 8px",fontSize:12,fontFamily:"inherit"}}><option value="global">Global (largest total SPC)</option><option value="local">Local forward (from the sources)</option><option value="key">Key-route (top SPC arcs)</option></select>{mpMethod==="key"&&<><span style={{fontSize:11,color:C.textDim,fontFamily:mono}}>Key routes</span><input type="number" min={1} max={20} value={keyK} onChange={e=>setKeyK(Math.min(20,Math.max(1,Math.round(+e.target.value||1))))} style={{width:56,background:C.card,color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 8px",fontSize:12}}/></>}</div>}</div>}
      {view!=="papers"&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}><span style={{fontSize:11,color:C.textDim,fontFamily:mono}}>Top N =</span><input type="range" min={5} max={50} value={Math.min(topN,50)} onChange={e=>setTopN(+e.target.value)} style={{width:120,accentColor:C.accent}}/><span style={{fontSize:13,color:C.accent,fontWeight:700,fontFamily:mono}}>{Math.min(topN,50)}</span></div>}
      {view==="papers"&&<div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16,flexWrap:"wrap",fontSize:11,color:C.textDim}}>
        <span style={{fontFamily:mono,textTransform:"uppercase",letterSpacing:1.5}}>Clusters</span>
        <label style={{display:"flex",alignItems:"center",gap:6}}>Resolution<input type="number" min={0.05} max={10} step={0.1} value={hcRes} onChange={e=>setHcRes(Math.min(10,Math.max(0.05,+e.target.value||1)))} style={{width:60,background:C.card,color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 6px",fontSize:12}}/></label>
        <label style={{display:"flex",alignItems:"center",gap:6}}>Min. size<input type="number" min={1} max={100} value={hcMinCl} onChange={e=>setHcMinCl(Math.min(100,Math.max(1,Math.round(+e.target.value||1))))} style={{width:56,background:C.card,color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 6px",fontSize:12}}/></label>
        <label style={{display:"flex",alignItems:"center",gap:6}}>Show<select value={clFocus==null?"":clFocus} onChange={e=>setClFocus(e.target.value===""?null:+e.target.value)} style={{background:C.card,color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 6px",fontSize:12}}><option value="">All clusters</option>{hcClus.clusters.map(c=><option key={c.id} value={c.id}>Cluster {c.id+1} ({c.size})</option>)}</select></label>
        <label style={{display:"flex",alignItems:"center",gap:6}}>Colour<select value={colorBy} onChange={e=>setColorBy(e.target.value)} style={{background:C.card,color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 6px",fontSize:12}}><option value="cluster">Clusters</option><option value="lcs">Cited locally or not (as before)</option></select></label>
        <label style={{display:"flex",alignItems:"center",gap:6}}>Node size<select value={sizeBy} onChange={e=>setSizeBy(e.target.value)} style={{background:C.card,color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 6px",fontSize:12}}>{["lcs","gcs","pagerank","authority","spc"].map(k=><option key={k} value={k}>{HC_MEASURES[k].l}</option>)}</select></label>
      </div>}
      <SectionTitle icon="📜">{view==="papers"?"Historiograph":({authors:"Authors",journals:"Journals",countries:"Countries",institutions:"Institutions",institutions_sub:"Institutions with Subdivision"}[view])+" Citation Flow"}</SectionTitle>
      {view!=="papers"&&<div style={{fontSize:10,color:C.textDim,marginBottom:8}}>Click a node or an arrow to list the citations behind it below the network.</div>}
      {view==="papers"&&filterMode==="mainpath"&&<div style={{fontSize:10.5,color:C.textDim,marginBottom:10,lineHeight:1.55}}>
        <div style={{color:C.text,marginBottom:4}}>Main path{clFocus!=null?` within cluster ${clFocus+1}`:""}: <b style={{color:C.accent}}>{mpView.nodes.length}</b> records and <b style={{color:C.accent}}>{mpView.arcs.length}</b> citations, from a citation network of {mpView.networkNodes} records with local links and {mpView.networkArcs} citations ({mpView.sources} sources, {mpView.sinks} sinks, {mpView.total>=1e6?mpView.total.toExponential(2):mpView.total.toLocaleString("en")} source–sink paths){mpView.dropped?` · ${mpView.dropped} citation${mpView.dropped===1?"":"s"} left out to break citation cycles`:""}.</div>
        Each citation is weighted by its search path count (SPC): the number of paths from a source (a record that cites no other record in the collection) to a sink (a record not cited within the collection) that run through it. The main path follows the heaviest citations and is read as the backbone of the field's development in this collection (Hummon &amp; Doreian 1989; for HistCite historiograms, Lucio-Arias &amp; Leydesdorff 2008). Global search keeps the source–sink path(s) with the largest total SPC; local forward search starts at the heaviest citation from a source and follows the heaviest citation onwards; key-route search starts at the heaviest citations anywhere and extends them both ways (Liu &amp; Lu 2012). Ties are all kept. Arrow width shows SPC; hover over an arrow for the value. The result depends on which records the collection contains.</div>}
      {view==="papers"&&<PaperHistoriograph papers={hc.papers} edges={hc.edges} filterMode={filterMode} topN={topN} mainPath={mpView} rank={filterMode==="mainpath"?null:rankM.f} restrict={restrict} colorOf={colorOf} sizeOf={sizeOf} info={info}/>}
      {view==="papers"&&<HistClusterLegend sum={clSummary} clus={hcClus} focus={clFocus} setFocus={setClFocus} rankM={rankM} fmtM={fmtM} onOpenRecord={i=>setRecView({idx:i})}/>}
      {view==="papers"&&<CitationMetricsTable hc={hc} records={records||[]} cm={cm} mp={mp} mainOn={filterMode==="mainpath"} onOpenRecord={i=>setRecView({idx:i})} clusterOf={clusterOf} restrict={restrict} focus={clFocus}/>}
      {view==="authors"&&<FlowNetwork network={authorFlow} label="author" selected={selEnt} onSelect={setSelEnt}/>}
      {view==="journals"&&<FlowNetwork network={journalFlow} label="journal" selected={selEnt} onSelect={setSelEnt}/>}
      {view==="countries"&&<FlowNetwork network={countryFlow} label="country" selected={selEnt} onSelect={setSelEnt}/>}
      {view==="institutions"&&<FlowNetwork network={instFlow} label="institution" selected={selEnt} onSelect={setSelEnt}/>}
      {view==="institutions_sub"&&<FlowNetwork network={instSubFlow} label="institution" selected={selEnt} onSelect={setSelEnt}/>}
      {recView&&<RecordOverlay view={recView} setView={setRecView} records={records||[]} hc={hc}/>}
      {view!=="papers"&&<FlowMetricsTable network={{authors:authorFlow,journals:journalFlow,countries:countryFlow,institutions:instFlow,institutions_sub:instSubFlow}[view]} label={{authors:"author",journals:"journal",countries:"country",institutions:"institution",institutions_sub:"institution"}[view]} sel={selEnt} onSelect={setSelEnt}/>}
      {view!=="papers"&&selEnt&&<FlowCitationTable sel={selEnt} getEntities={getters[view]} papers={hc.papers} edges={hc.edges} records={records||[]} hc={hc} onOpenRecord={i=>setRecView({idx:i})}
        label={{authors:"author",journals:"journal",countries:"country",institutions:"institution",institutions_sub:"institution"}[view]}/>}
    </Card></div>);
}

/* ═══ CITED REFS PANEL ═══ */
/* ═══ CHOROPLETH WORLD MAP ═══
   Geometry: world-atlas (Natural Earth 1:50m) + topojson-client, both from npm,
   loaded lazily so they are code-split out of the main bundle. */
let _worldPromise=null;
function loadWorld(){
  if(!_worldPromise)_worldPromise=Promise.all([import("world-atlas/countries-50m.json"),import("topojson-client")])
    .then(([w,tc])=>{const topo=w.default||w;const feat=(tc.feature||tc.default?.feature);
      const fc=feat(topo,topo.objects.countries);
      fc.features=fc.features.filter(f=>f.id!=="010");     // drop Antarctica
      return fc;})
    .catch(e=>{_worldPromise=null;throw e;});
  return _worldPromise;
}
function featureCountry(f){
  return(f.id&&COUNTRY_BY_NUM.get(String(f.id).padStart(3,"0"))?.name)
      ||COUNTRY_BY_ALIAS.get(String(f.properties?.name||"").toLowerCase())?.name||null;
}
function WorldMap({stats,fallback}){
  const wr=useRef(),sr=useRef(),w=useW(wr),h=Math.round(Math.max(260,w*0.52));
  const[geo,setGeo]=useState(null),[err,setErr]=useState(null),[hover,setHover]=useState(null);
  useEffect(()=>{let alive=true;loadWorld().then(g=>alive&&setGeo(g)).catch(e=>alive&&setErr(e));return()=>{alive=false;};},[]);
  const byName=useMemo(()=>new Map(stats.map(s=>[s.name,s])),[stats]);
  const maxV=Math.max(1,...stats.map(s=>s.count));
  // log scale: a handful of countries usually dominate
  const color=useMemo(()=>d3.scaleSequentialLog(d3.interpolateRgb("#3d3422","#f5d37a")).domain([1,Math.max(2,maxV)]),[maxV]);
  const unmapped=useMemo(()=>{
    if(!geo)return[];const on=new Set(geo.features.map(featureCountry).filter(Boolean));
    return stats.filter(s=>!on.has(s.name));
  },[geo,stats]);
  useEffect(()=>{
    if(!sr.current||!geo)return;
    const svg=d3.select(sr.current);svg.selectAll("*").remove();
    const proj=d3.geoNaturalEarth1().fitExtent([[4,4],[w-4,h-4]],geo);
    const path=d3.geoPath(proj);
    const g=svg.append("g");
    g.selectAll("path").data(geo.features).join("path")
      .attr("d",path).attr("vector-effect","non-scaling-stroke")
      .attr("fill",f=>{const s=byName.get(featureCountry(f));return s?color(s.count):"#1b2029";})
      .attr("stroke",C.bg).attr("stroke-width",0.5)
      .style("cursor",f=>byName.get(featureCountry(f))?"pointer":"default")
      .on("mousemove",function(e,f){
        const name=featureCountry(f)||f.properties?.name;const s=byName.get(featureCountry(f));
        const[x,y]=d3.pointer(e,wr.current);
        d3.select(this).attr("stroke",C.accent).attr("stroke-width",1.2).raise();
        setHover({x,y,name,s});
      })
      .on("mouseleave",function(){d3.select(this).attr("stroke",C.bg).attr("stroke-width",0.5);setHover(null);});
    const zoom=d3.zoom().scaleExtent([1,12]).translateExtent([[0,0],[w,h]]).on("zoom",e=>g.attr("transform",e.transform));
    svg.call(zoom).on("dblclick.zoom",()=>svg.transition().duration(500).call(zoom.transform,d3.zoomIdentity));
  },[geo,w,h,byName,color]);

  if(err)return(<div>
    <div style={{fontSize:11,color:C.textDim,marginBottom:10}}>Map geometry could not be loaded (it is downloaded when the map is first shown and needs an internet connection). Showing a ranked list instead.</div>
    {fallback}
  </div>);
  const legendTicks=[1,...[10,100,1000,10000].filter(v=>v<maxV),maxV];
  return(<div ref={wr} style={{width:"100%",position:"relative"}}>
    {!geo&&<div style={{height:h,display:"flex",alignItems:"center",justifyContent:"center",color:C.textDim,fontSize:12,fontFamily:mono}}>Loading map…</div>}
    <svg ref={sr} width={w} height={geo?h:0} style={{display:"block"}}/>
    {geo&&<div style={{position:"absolute",top:2,right:4,fontSize:9,color:C.textDim,fontFamily:mono,opacity:.6}}>scroll to zoom · drag to pan · double-click to reset</div>}
    {hover&&(<div style={{position:"absolute",left:Math.min(hover.x+14,w-180),top:Math.max(0,hover.y-56),pointerEvents:"none",
      background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 10px",fontSize:11,minWidth:150,boxShadow:"0 6px 18px rgba(0,0,0,.5)"}}>
      <div style={{color:C.textBright,fontWeight:700,marginBottom:4}}>{hover.name}</div>
      {hover.s?(<div style={{fontFamily:mono,fontSize:10,color:C.text,lineHeight:1.6}}>
        Recs <b style={{color:C.accent}}>{hover.s.count}</b> · TLCS <b>{hover.s.tlcs}</b> · TGCS <b>{hover.s.tgcs}</b></div>)
        :<div style={{fontSize:10,color:C.textDim}}>No records</div>}
    </div>)}
    {geo&&(<div style={{display:"flex",alignItems:"center",gap:10,marginTop:10,flexWrap:"wrap"}}>
      <span style={{fontSize:9.5,color:C.textDim,fontFamily:mono,textTransform:"uppercase",letterSpacing:1}}>Records</span>
      <div style={{position:"relative",width:180}}>
        <div style={{height:8,borderRadius:2,background:`linear-gradient(90deg,${[0,.25,.5,.75,1].map(t=>color(Math.exp(Math.log(Math.max(2,maxV))*t))).join(",")})`}}/>
        <div style={{position:"relative",height:12,marginTop:2}}>
          {legendTicks.map((v,i)=>{const t=Math.log(v)/Math.log(Math.max(2,maxV));return(
            <span key={i} style={{position:"absolute",left:`${t*100}%`,transform:"translateX(-50%)",fontSize:9,color:C.textDim,fontFamily:mono}}>{v}</span>);})}
        </div>
      </div>
      <span style={{fontSize:9.5,color:C.textDim,fontFamily:mono}}>log scale · {stats.length} countries</span>
      {unmapped.length>0&&<span title={unmapped.map(u=>`${u.name} (${u.count})`).join(", ")} style={{fontSize:9.5,color:C.textDim,marginLeft:"auto",cursor:"help"}}>
        Not on map: {unmapped.slice(0,4).map(u=>`${u.name} (${u.count})`).join(", ")}{unmapped.length>4?` +${unmapped.length-4}`:""}</span>}
    </div>)}
  </div>);
}

/* ═══ CITED REFS PANEL ═══ */
function CitedRefsPanel({D}){
  const citedRefs=D.citedRefs;
  const[page,setPage]=useState(0);const[filter,setFilter]=useState("");
  const[sortCol,setSortCol]=useState("recs");const[sortAsc,setSortAsc]=useState(false);
  const[localOnly,setLocalOnly]=useState(false);
  const[openId,setOpenId]=useState(null);
  const[citersOf,setCitersOf]=useState(null);   // {title, indices}: records citing a reference or a record
  const[found,setFound]=useState({});           // rawKey → Crossref lookup result {likely,cands} (this session)
  const[batch,setBatch]=useState(null);         // {done,total,hits} while looking up a page
  const onFound=(ref,hit)=>setFound(f=>({...f,[ref.rawKey||ref.display]:hit}));
  const PP=50;
  const filtered=useMemo(()=>{
    let list=citedRefs;
    if(localOnly)list=list.filter(r=>r.isLocal);
    if(filter){const q=filter.toLowerCase();list=list.filter(r=>r.display.toLowerCase().includes(q));}
    return list;
  },[citedRefs,filter,localOnly]);
  const sorted=useMemo(()=>{
    // strip leading punctuation ("-Jones", "¿Qué…") and treat [Anonymous] as missing
    const txt=v=>String(v||"").toLowerCase().replace(/^\[?anonymous\]?\s*/,"").replace(/^[^a-z0-9\u00c0-\u024f]+/,"");
    const key={author:r=>txt(r.author),year:r=>r.year||0,journal:r=>txt(r.source),recs:r=>r.count}[sortCol];
    const empty=r=>{const v=key(r);return v===""||v===0;};
    return[...filtered].sort((a,b)=>{
      // entries lacking the sort field always go to the bottom, whatever the direction
      const ea=empty(a),eb=empty(b);if(ea!==eb)return ea?1:-1;
      const va=key(a),vb=key(b);
      let c=typeof va==="string"?va.localeCompare(vb,undefined,{sensitivity:"base"}):va-vb;
      if(c===0)c=b.count-a.count;
      return sortAsc?c:-c;
    });
  },[filtered,sortCol,sortAsc]);
  useEffect(()=>setPage(0),[filter,localOnly,sortCol,sortAsc]);
  const pageCount=Math.max(1,Math.ceil(sorted.length/PP));const pageData=sorted.slice(page*PP,(page+1)*PP);
  const lookupPage=async()=>{
    const todo=pageData.filter(r=>!r.doi&&!(r.localIdx!=null&&D.records[r.localIdx]?.di)&&!found[r.rawKey||r.display]);
    let done=0,hits=0;setBatch({done,total:todo.length,hits});
    for(let i=0;i<todo.length;i+=2){                 // two requests at a time
      await Promise.all(todo.slice(i,i+2).map(async r=>{try{const res=await findDoiForRef(r);if(res.likely)hits++;onFound(r,res);}catch(e){}done++;}));
      setBatch({done,total:todo.length,hits});
    }
    setTimeout(()=>setBatch(null),6000);
  };
  const handleSort=k=>{if(sortCol===k)setSortAsc(!sortAsc);else{setSortCol(k);setSortAsc(k==="author"||k==="journal");}};
  const arrow=k=>sortCol===k?(sortAsc?" ▲":" ▼"):"";
  const lnk=k=>({cursor:"pointer",userSelect:"none",color:sortCol===k?C.accent:C.textDim,fontWeight:sortCol===k?700:600});
  const nLocal=useMemo(()=>citedRefs.filter(r=>r.isLocal).length,[citedRefs]);

  const openIdx=openId!=null?D.records.findIndex(r=>r._id===openId):-1;
  const showCitingRecord=i=>{setCitersOf({title:citingTitle(D.records,i),indices:citingIdx(D.histcite,i)});setOpenId(null);};
  if(openIdx>=0)return<RecordDetail idx={openIdx} records={D.records} hc={D.histcite} onBack={()=>setOpenId(null)} onOpen={i=>setOpenId(D.records[i]._id)} onCitedBy={showCitingRecord}/>;
  if(citersOf)return(<div style={{display:"flex",flexDirection:"column",gap:16}}>
    <button onClick={()=>setCitersOf(null)} style={{...btnBase,background:"transparent",border:`1px solid ${C.border}`,color:C.accent,alignSelf:"flex-start"}}>← Back to cited references</button>
    <Card><RecordsList records={D.records} indices={citersOf.indices} hc={D.histcite} onClickRecord={i=>setOpenId(D.records[i]._id)} onClickLcs={showCitingRecord} title={citersOf.title}/></Card>
  </div>);

  return(<div style={{display:"flex",flexDirection:"column",gap:24}}>
    <Card style={{padding:"16px 20px"}}><div style={{fontSize:12,color:C.text,lineHeight:1.7}}>
      <span style={{fontWeight:700,color:C.accent}}>{citedRefs.length.toLocaleString()}</span> unique cited references,
      of which <span style={{fontWeight:700,color:C.teal}}>{nLocal.toLocaleString()}</span> are records in this collection
      (<span style={{color:C.teal}}>●</span> — click to open the record). Click a number under <i>Recs</i> to see the records that cite the reference.
      References without a DOI can be looked up in Crossref (<i>🔍 Find DOI</i>); a DOI is marked <i>found</i> only when first author and year, and volume or page, match. Found DOIs are kept for this session and are not yet used in the analyses.</div></Card>
    <Card><SectionTitle icon="📖">Cited Reference List</SectionTitle>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <input type="text" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter by author, title, journal, DOI…" style={{flex:1,maxWidth:400,minWidth:200,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 12px",fontSize:12,color:C.text,outline:"none"}}/>
        {filter&&<PillBtn onClick={()=>setFilter("")}>Clear</PillBtn>}
        <PillBtn active={localOnly} onClick={()=>setLocalOnly(!localOnly)} style={{fontSize:10}}>● In collection only</PillBtn>
        <PillBtn onClick={lookupPage} style={{fontSize:10}} title="Look up DOIs in Crossref for the references on this page that lack one">{batch?`🔍 ${batch.done}/${batch.total} · ${batch.hits} found`:"🔍 Find DOIs on this page"}</PillBtn>
        <span style={{fontSize:11,color:C.textDim,fontFamily:mono,marginLeft:"auto"}}>{filtered.length.toLocaleString()} refs</span>
      </div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
        <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
          <th style={{width:44,padding:"8px 6px",textAlign:"center",color:C.textDim,fontWeight:600,fontSize:10}}>#</th>
          <th style={{padding:"8px 6px",textAlign:"left",fontSize:10,letterSpacing:.8,textTransform:"uppercase",fontWeight:600}}>
            <span style={lnk("author")} onClick={()=>handleSort("author")} title="Sort by first author">Author{arrow("author")}</span>
            <span style={{color:C.border,margin:"0 6px"}}>/</span>
            <span style={lnk("year")} onClick={()=>handleSort("year")} title="Sort by year">Year{arrow("year")}</span>
            <span style={{color:C.border,margin:"0 6px"}}>/</span>
            <span style={lnk("journal")} onClick={()=>handleSort("journal")} title="Sort by journal or source">Journal{arrow("journal")}</span>
          </th>
          <th onClick={()=>handleSort("recs")} title="Number of records in the collection citing this reference"
            style={{width:60,padding:"8px 6px",textAlign:"right",fontWeight:600,fontSize:10,letterSpacing:.8,textTransform:"uppercase",cursor:"pointer",userSelect:"none",color:sortCol==="recs"?C.accent:C.textDim}}>Recs{arrow("recs")}</th>
        </tr></thead>
        <tbody>{pageData.map((ref,i)=>{
          const local=ref.localIdx!=null;
          return(<tr key={page*PP+i} onClick={local?()=>setOpenId(D.records[ref.localIdx]._id):undefined}
            title={local?"Open this record":undefined}
            style={{borderBottom:`1px solid ${C.border}15`,background:i%2===0?"transparent":`${C.bg}80`,cursor:local?"pointer":"default"}}
            onMouseEnter={local?e=>e.currentTarget.style.background=`${C.teal}12`:undefined}
            onMouseLeave={local?e=>e.currentTarget.style.background=i%2===0?"transparent":`${C.bg}80`:undefined}>
            <td style={{padding:"7px 6px",textAlign:"center",color:C.textDim,fontFamily:mono,fontSize:10}}>{page*PP+i+1}</td>
            <td style={{padding:"7px 6px",fontSize:11.5,lineHeight:1.5,color:local?C.textBright:C.text}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:6}}>
                {local&&<span style={{color:C.teal,fontSize:8,marginTop:4,flexShrink:0}}>●</span>}
                <span><span style={local?{textDecoration:"underline",textDecorationColor:`${C.teal}66`,textUnderlineOffset:3}:undefined}>{ref.display}</span>
                  <RefLinks key={ref.rawKey||ref.display} ref={ref} records={D.records} found={found[ref.rawKey||ref.display]} onFound={onFound}/></span>
              </div></td>
            <td style={{padding:"7px 6px",textAlign:"right",color:C.accent,fontWeight:700,fontFamily:mono,fontSize:12}}>
              <span role="button" title="Show the records in the collection that cite this reference" onClick={e=>{e.stopPropagation();setCitersOf({title:`Records citing: ${ref.display}`,indices:[...ref.citers]});}}
                style={{cursor:"pointer",textDecoration:"underline",textDecorationColor:`${C.accent}88`,textUnderlineOffset:3,padding:"2px 4px",margin:"-2px -4px"}}>{ref.count}</span></td>
          </tr>);})}</tbody></table></div>
      <Paginator page={page} pageCount={pageCount} setPage={setPage}/>
    </Card></div>);
}

/* ═══════════════════════════════════════════════════════════════════════════
   COLLECTION PANEL — HistCite-style browsable collection
   Sub-views: Records, Authors, Journals, Years, DocTypes, Languages,
              Affiliations, Affiliations w/ Subdivisions, Countries
   + Record detail view + drill-down from entity → filtered records
   ═══════════════════════════════════════════════════════════════════════════ */

// Build entity stats: for each entity, count Recs, sum TLCS, sum TGCS
function buildEntityStats(records, hc, getEntities){
  const lcsMap=new Map();for(const p of hc.papers)lcsMap.set(p.idx,p.lcs);
  const map=new Map();
  for(let i=0;i<records.length;i++){const r=records[i];const lcs=lcsMap.get(i)||0;
    for(const e of getEntities(r)){if(!e)continue;if(!map.has(e))map.set(e,{name:e,recs:0,tlcs:0,tgcs:0});const entry=map.get(e);entry.recs++;entry.tlcs+=lcs;entry.tgcs+=r.tc;}}
  return[...map.values()].sort((a,b)=>b.recs-a.recs);
}

// Paginator
function Paginator({page,pageCount,setPage}){
  if(pageCount<=1)return null;
  return(<div style={{display:"flex",justifyContent:"center",gap:6,marginTop:16,alignItems:"center"}}>
    <PillBtn onClick={()=>setPage(0)} active={false}>«</PillBtn>
    <PillBtn onClick={()=>setPage(Math.max(0,page-1))} active={false}>‹</PillBtn>
    <span style={{fontSize:11,color:C.textDim,fontFamily:mono,padding:"6px 8px"}}>{page+1} / {pageCount}</span>
    <PillBtn onClick={()=>setPage(Math.min(pageCount-1,page+1))} active={false}>›</PillBtn>
    <PillBtn onClick={()=>setPage(pageCount-1)} active={false}>»</PillBtn>
  </div>);
}

// Entity table (Authors, Journals, Countries, etc.)
function EntityTable({data,label,onClickRow,nameNumeric=false}){
  const[sortCol,setSortCol]=useState("recs");const[sortAsc,setSortAsc]=useState(false);const[page,setPage]=useState(0);const PP=30;
  const sorted=useMemo(()=>[...data].sort((a,b)=>{
    if(sortCol==="name"){
      if(nameNumeric){const na=parseFloat(a.name)||0,nb=parseFloat(b.name)||0;return sortAsc?na-nb:nb-na;}
      const cmp=String(a.name).localeCompare(String(b.name),undefined,{sensitivity:"base",numeric:true});
      return sortAsc?cmp:-cmp;
    }
    return sortAsc?a[sortCol]-b[sortCol]:b[sortCol]-a[sortCol];
  }),[data,sortCol,sortAsc,nameNumeric]);
  const pageCount=Math.ceil(sorted.length/PP);const pageData=sorted.slice(page*PP,(page+1)*PP);
  const handleSort=k=>{if(sortCol===k)setSortAsc(!sortAsc);else{setSortCol(k);setSortAsc(k==="name"&&!nameNumeric);}setPage(0);};
  const arrow=k=>sortCol===k?(sortAsc?" ▲":" ▼"):"";
  const thS=k=>({padding:"8px 6px",textAlign:k==="name"?"left":"right",color:sortCol===k?C.accent:C.textDim,fontWeight:600,fontSize:10,letterSpacing:.8,textTransform:"uppercase",cursor:"pointer",userSelect:"none",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"});
  return(<div>
    <div style={{fontSize:11,color:C.textDim,marginBottom:12,fontFamily:mono}}>{label} ({data.length.toLocaleString()})</div>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}><thead><tr>
      <th style={{...thS("#"),width:40,textAlign:"center",cursor:"default",color:C.textDim}}>#</th>
      <th style={thS("name")} onClick={()=>handleSort("name")} title={`Sort by ${label}`}>{label}{arrow("name")}</th>
      <th style={thS("recs")} onClick={()=>handleSort("recs")}>Recs{arrow("recs")}</th>
      <th style={thS("tlcs")} onClick={()=>handleSort("tlcs")}>TLCS{arrow("tlcs")}</th>
      <th style={thS("tgcs")} onClick={()=>handleSort("tgcs")}>TGCS{arrow("tgcs")}</th>
    </tr></thead><tbody>{pageData.map((d,i)=>(
      <tr key={d.name+i} style={{borderBottom:`1px solid ${C.border}15`,background:i%2===0?"transparent":`${C.bg}80`,cursor:"pointer"}} onClick={()=>onClickRow(d.name)}
        onMouseEnter={e=>e.currentTarget.style.background=`${C.accent}0a`} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":`${C.bg}80`}>
        <td style={{padding:"7px 6px",textAlign:"center",color:C.textDim,fontFamily:mono,fontSize:10}}>{page*PP+i+1}</td>
        <td style={{padding:"7px 6px",color:C.teal,fontWeight:500,maxWidth:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={d.name}>{d.name}</td>
        <td style={{padding:"7px 6px",textAlign:"right",color:C.accent,fontWeight:700,fontFamily:mono}}>{d.recs}</td>
        <td style={{padding:"7px 6px",textAlign:"right",color:C.textBright,fontFamily:mono}}>{d.tlcs}</td>
        <td style={{padding:"7px 6px",textAlign:"right",color:C.textDim,fontFamily:mono}}>{d.tgcs}</td>
      </tr>))}</tbody></table></div>
    <Paginator page={page} pageCount={pageCount} setPage={setPage}/>
  </div>);
}

// Month lookup for sorting within a publication year
const MONTH_IDX={JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
function monthOf(pd){
  if(!pd)return 0;
  const s=String(pd).toUpperCase();
  for(const[k,v]of Object.entries(MONTH_IDX))if(s.includes(k))return v;
  const m=s.match(/^(\d{4})-(\d{2})/);          // ISO date (OpenAlex)
  if(m)return parseInt(m[2])||0;
  return 0;
}
function firstAuthorKey(r){
  const a=(r.au&&r.au[0])||"";
  return a.toLowerCase();
}

// Records list (used both as main list and as drill-down from entities)
function RecordsList({records,indices,hc,onClickRecord,onClickLcs,title}){
  const[page,setPage]=useState(0);const PP=20;
  const[sortCol,setSortCol]=useState("date");const[sortAsc,setSortAsc]=useState(true);
  const lcsMap=useMemo(()=>{const m=new Map();for(const p of hc.papers)m.set(p.idx,p);return m;},[hc]);

  const sorted=useMemo(()=>{
    const idxs=indices?[...indices]:records.map((_,i)=>i);
    const val=(i)=>{
      const r=records[i],p=lcsMap.get(i);
      switch(sortCol){
        case "date":    return r.py*100+monthOf(r.pd);
        case "author":  return firstAuthorKey(r);
        case "journal": return (r.so||"").toLowerCase();
        case "lcs":     return p?.lcs||0;
        case "gcs":     return r.tc||0;
        case "lcr":     return p?.lcr||0;
        case "cr":      return r.nr||0;
        default:        return 0;
      }
    };
    idxs.sort((a,b)=>{
      const va=val(a),vb=val(b);
      let cmp;
      if(typeof va==="string")cmp=va.localeCompare(vb,undefined,{sensitivity:"base"});
      else cmp=va-vb;
      if(cmp===0)cmp=records[a].py-records[b].py;   // stable secondary key
      return sortAsc?cmp:-cmp;
    });
    return idxs;
  },[records,indices,lcsMap,sortCol,sortAsc]);

  const pageCount=Math.ceil(sorted.length/PP);const pageData=sorted.slice(page*PP,(page+1)*PP);
  const handleSort=k=>{
    if(sortCol===k)setSortAsc(!sortAsc);
    // Text columns open ascending (A→Z); numeric columns open descending (high→low)
    else{setSortCol(k);setSortAsc(k==="date"||k==="author"||k==="journal");}
    setPage(0);
  };
  const arrow=k=>sortCol===k?(sortAsc?" ▲":" ▼"):"";
  // Inline sort links inside the combined header cell
  const lnk=k=>({cursor:"pointer",userSelect:"none",color:sortCol===k?C.accent:C.textDim,fontWeight:sortCol===k?700:600});
  const thNum=k=>({width:44,padding:"8px 6px",fontSize:10,textAlign:"right",cursor:"pointer",userSelect:"none",
    color:sortCol===k?C.accent:(k==="lcs"?C.accent:k==="lcr"?C.teal:C.textDim),
    opacity:sortCol===k?1:.75,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",whiteSpace:"nowrap"});

  const showYearGroups=sortCol==="date";
  let lastYear=null;
  const rows=[];
  pageData.forEach((idx,i)=>{
    const r=records[idx];const p=lcsMap.get(idx);const lcs=p?.lcs||0;const lcr=p?.lcr||0;
    if(showYearGroups&&r.py!==lastYear){
      lastYear=r.py;
      rows.push(<tr key={`yr-${r.py}-${i}`}><td colSpan={6} style={{padding:"10px 6px 4px",fontWeight:700,fontSize:12,color:C.textBright,borderBottom:`1px solid ${C.border}44`}}>{r.py||"n.d."}</td></tr>);
    }
    rows.push(
      <tr key={`r-${idx}`} style={{borderBottom:`1px solid ${C.border}10`,cursor:"pointer"}}
        onClick={()=>onClickRecord(idx)} onMouseEnter={e=>e.currentTarget.style.background=`${C.accent}08`} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <td style={{padding:"6px",textAlign:"center",color:C.textDim,fontFamily:mono,fontSize:10,verticalAlign:"top"}}>{page*PP+i+1}</td>
        <td style={{padding:"6px",verticalAlign:"top"}}>
          <div style={{color:C.text,fontWeight:500,fontSize:11.5}}>{r.au.join("; ")}</div>
          <div style={{color:C.textBright,fontWeight:700,fontSize:12,margin:"2px 0"}}>{r.ti} <ExtLink p={r} style={{marginLeft:4}}/></div>
          <div style={{color:C.textDim,fontSize:11}}>{r.so}{r.pd?`. ${r.pd}`:(r.py?`. ${r.py}`:"")}{r.vl?`; ${r.vl}`:""}{r.is?` (${r.is})`:""}{r.bp?`: ${r.bp}`:""}{r.ep&&r.ep!==r.bp?`-${r.ep}`:""}</div>
        </td>
        <td style={{padding:"6px",textAlign:"right",color:lcs>0?C.accent:C.textDim,fontWeight:lcs>0?700:400,fontFamily:mono,verticalAlign:"top"}}>{lcs>0&&onClickLcs
          ?<span role="button" title="Show the records in the collection that cite this record" onClick={e=>{e.stopPropagation();onClickLcs(idx);}}
            style={{cursor:"pointer",textDecoration:"underline",textDecorationColor:`${C.accent}88`,textUnderlineOffset:3,padding:"2px 4px",margin:"-2px -4px"}}>{lcs}</span>
          :lcs}</td>
        <td style={{padding:"6px",textAlign:"right",color:C.textDim,fontFamily:mono,verticalAlign:"top"}}>{r.tc}</td>
        <td style={{padding:"6px",textAlign:"right",color:lcr>0?C.teal:C.textDim,fontWeight:lcr>0?700:400,fontFamily:mono,verticalAlign:"top"}}>{lcr}</td>
        <td style={{padding:"6px",textAlign:"right",color:C.textDim,fontFamily:mono,verticalAlign:"top"}}>{r.nr}</td>
      </tr>);
  });

  return(<div>
    {title&&<div style={{fontSize:11,color:C.textDim,marginBottom:12,fontFamily:mono}}>{title} ({(indices?indices.length:records.length).toLocaleString()} records)</div>}
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}><thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
      <th style={{width:30,padding:"8px 6px",color:C.textDim,fontSize:10,textAlign:"center"}}>#</th>
      <th style={{padding:"8px 6px",fontSize:10,textAlign:"left",letterSpacing:.8,textTransform:"uppercase",fontWeight:600}}>
        <span style={lnk("date")} onClick={()=>handleSort("date")} title="Sort by publication date">Date{arrow("date")}</span>
        <span style={{color:C.border,margin:"0 6px"}}>/</span>
        <span style={lnk("author")} onClick={()=>handleSort("author")} title="Sort by first author">Author{arrow("author")}</span>
        <span style={{color:C.border,margin:"0 6px"}}>/</span>
        <span style={lnk("journal")} onClick={()=>handleSort("journal")} title="Sort by journal">Journal{arrow("journal")}</span>
      </th>
      <th style={thNum("lcs")} onClick={()=>handleSort("lcs")} title="Local Citation Score">LCS{arrow("lcs")}</th>
      <th style={thNum("gcs")} onClick={()=>handleSort("gcs")} title="Global Citation Score">GCS{arrow("gcs")}</th>
      <th style={thNum("lcr")} onClick={()=>handleSort("lcr")} title="Local Cited References">LCR{arrow("lcr")}</th>
      <th style={thNum("cr")} onClick={()=>handleSort("cr")} title="Cited References">CR{arrow("cr")}</th>
    </tr></thead><tbody>{rows}</tbody></table></div>
    <Paginator page={page} pageCount={pageCount} setPage={setPage}/>
  </div>);
}

// Single record detail view
function RecordDetail({idx,records,hc,onBack,onOpen,onCitedBy}){
  const ed=useContext(EditCtx);
  const R=useMemo(()=>makeRefResolver(records),[records]);
  const[confirmRemove,setConfirmRemove]=useState(false);
  const r=records[idx];
  if(!r)return<Card><div style={{color:C.textDim,fontSize:12}}>This record is no longer in the collection. <button onClick={onBack} style={{...btnBase,background:"transparent",border:`1px solid ${C.border}`,color:C.accent,marginLeft:8}}>← Back</button></div></Card>;
  const p=hc.papers.find(pp=>pp.idx===idx);
  const lcs=p?.lcs||0;const lcr=p?.lcr||0;
  const F=({label,children})=>children?<div style={{marginBottom:8}}><span style={{fontWeight:700,color:C.textBright,fontSize:12}}>{label}:</span>{" "}<span style={{color:C.text,fontSize:12}}>{children}</span></div>:null;
  // A cited reference row; teal + clickable when it points at a record in the collection
  const RefRow=({text,target})=>{
    const local=target!=null&&target!==idx&&onOpen;
    return<div onClick={local?()=>onOpen(target):undefined} title={local?"Open this record":undefined}
      style={{color:local?C.textBright:C.textDim,fontSize:11,lineHeight:1.5,marginBottom:2,cursor:local?"pointer":"default",display:"flex",gap:6}}>
      {target!=null&&target!==idx?<span style={{color:C.teal,fontSize:8,marginTop:4}}>●</span>:<span style={{width:8}}/>}
      <span style={local?{textDecoration:"underline",textDecorationColor:`${C.teal}66`,textUnderlineOffset:3}:undefined}>{text}</span></div>;
  };
  const localLabel=i=>{const t=records[i];return`${t.au[0]||"[Anonymous]"}, ${t.py||"n.d."}, ${t.ti}${t.so?", "+t.so:""}`;};
  const linked=(r.crLocal||[]).map(id=>R.byId(id)).filter(t=>t!=null);
  const nRefs=(r.crRaw||[]).length+(r.crOaIds||[]).length+linked.length;
  const small={...btnBase,background:"transparent",border:`1px solid ${C.border}`,fontSize:11,padding:"6px 12px"};
  return(<div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
      <button onClick={onBack} style={{...small,color:C.accent}}>← Back to list</button>
      <ExtLink p={r} style={{fontSize:12,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 12px"}}/>
      {ed&&<div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
        {!confirmRemove?<>
          <button onClick={()=>ed.editRecord(r._id)} style={{...small,color:C.textBright,borderColor:C.accent}}>✎ Edit</button>
          <button onClick={()=>setConfirmRemove(true)} style={{...small,color:C.rose}}>🗑 Remove</button>
        </>:<>
          <span style={{fontSize:11,color:C.text}}>Remove this record? It can be restored from <i>Removed</i>.</span>
          <button onClick={()=>{setConfirmRemove(false);ed.removeRecord(r._id);onBack();}} style={{...small,color:C.onAccent,background:C.rose,borderColor:C.rose}}>Remove</button>
          <button onClick={()=>setConfirmRemove(false)} style={{...small,color:C.textDim}}>Cancel</button>
        </>}
      </div>}
    </div>
    <Card>
      <div style={{fontSize:10,color:C.textDim,fontFamily:mono,marginBottom:12,display:"flex",gap:8,alignItems:"center"}}>
        Record {idx+1} {srcSort(srcsOf(r)).map(s=><SrcBadge key={s} src={s}/>)}
        {r._manual&&<span style={{color:SRC_COLORS.manual}}>· added manually</span>}
        {r._edited&&<span style={{color:C.purple}}>· edited</span>}
      </div>
      <F label="Author(s)">{(r.af&&r.af.length?r.af:r.au).join("; ")}</F>
      <div style={{marginBottom:8}}><span style={{fontWeight:700,color:C.textBright,fontSize:12}}>Title: </span><span style={{color:C.accent,fontSize:13,fontWeight:700}}>{r.ti}</span></div>
      <F label="Source">{r.so}{r.vl?` ${r.vl}`:""}{r.is?` (${r.is})`:""}{r.bp?`: ${r.bp}`:""}{r.ep&&r.ep!==r.bp?`-${r.ep}`:""}</F>
      <F label="Date">{r.pd||r.py}</F>
      <F label="Document Type">{r.dt}</F>
      {r.di&&<F label="DOI">{r.di}</F>}
      {r.la&&<F label="Language">{r.la}</F>}
      <div style={{display:"flex",gap:24,margin:"12px 0",padding:"10px 0",borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}}>
        {[{l:"LCR",v:lcr,c:C.teal},{l:"CR",v:r.nr,c:C.textDim},{l:"LCS",v:lcs,c:C.accent},{l:"GCS",v:r.tc,c:C.textDim}].map(m=>(
          <div key={m.l}><span style={{fontSize:10,color:C.textDim,fontFamily:mono}}>{m.l}: </span>{m.l==="LCS"&&m.v>0&&onCitedBy
            ?<span role="button" onClick={()=>onCitedBy(idx)} title="Show the records in the collection that cite this record"
              style={{fontSize:14,fontWeight:700,color:m.c,fontFamily:mono,cursor:"pointer",textDecoration:"underline",textDecorationColor:`${C.accent}88`,textUnderlineOffset:3}}>{m.v}</span>
            :<span style={{fontSize:14,fontWeight:700,color:m.v>0?m.c:C.textDim,fontFamily:mono}}>{m.v}</span>}</div>
        ))}
      </div>
      {r.c1Full?.length>0&&<F label="Address">{r.c1Full.join("; ")}</F>}
      {r.rp&&<F label="Reprint">{r.rp}</F>}
      {r.em&&<F label="E-mail">{r.em}</F>}
      {r.de?.length>0&&<F label="Author Keywords">{r.de.join("; ")}</F>}
      {r.id?.length>0&&<F label="KeyWords Plus">{r.id.join("; ")}</F>}
      <F label="Open access">{(()=>{const o=oaStatus(r);return o.status+(o.green?" (also green)":"");})()}</F>
      {r.fu?.length>0&&<F label="Funding">{r.fu.map(f=>f.n+(f.g&&f.g.length?` [${f.g.join(", ")}]`:"")).join("; ")}</F>}
      {r.sdg?.length>0&&<F label="SDGs (OpenAlex)">{r.sdg.map(x=>sdgLabel(x.id)+(x.s!=null?` (${x.s})`:"")).join("; ")}</F>}
      {r.ind&&Object.keys(r.ind).some(k=>["fwci","pctl","rcr","bipInfluenceClass"].includes(k))&&<F label="Open indicators">{[
        typeof r.ind.fwci==="number"&&`FWCI ${r.ind.fwci.toFixed(2)} (OpenAlex)`,typeof r.ind.pctl==="number"&&`citation percentile ${r.ind.pctl}${r.ind.top1?" · top 1 %":r.ind.top10?" · top 10 %":""}`,
        typeof r.ind.rcr==="number"&&`RCR ${r.ind.rcr.toFixed(2)}${r.ind.rcrProv?" (provisional)":""} (iCite)`,r.ind.bipInfluenceClass&&`BIP! influence ${r.ind.bipInfluenceClass}, popularity ${r.ind.bipPopularityClass||"–"}, impulse ${r.ind.bipImpulseClass||"–"} (OpenAIRE)`,
        r.ind.views!=null&&`${r.ind.views} views, ${r.ind.downloads??0} downloads (OpenAIRE usage counts)`].filter(Boolean).join(" · ")}</F>}
      <RecordProvenance r={r}/>
      {r.ab&&<div style={{marginBottom:8,marginTop:10}}><span style={{fontWeight:700,color:C.textBright,fontSize:12}}>Abstract: </span><span style={{color:C.text,fontSize:12,lineHeight:1.6}}>{r.ab}</span></div>}
      {nRefs>0&&<div style={{marginTop:12}}>
        <div style={{fontWeight:700,color:C.textBright,fontSize:12,marginBottom:6}}>Cited References ({nRefs}): <span style={{fontWeight:400,color:C.textDim,fontSize:10.5}}><span style={{color:C.teal}}>●</span> in this collection</span></div>
        {linked.map(t=><RefRow key={"l"+t} target={t} text={localLabel(t)}/>)}
        {(r.crRaw||[]).map((cr,i)=>{const res=R.line(cr,r._src);return<RefRow key={"c"+i} target={res.idx} text={res.kind==="doi"&&res.idx!=null?localLabel(res.idx):cr}/>;})}
        {(r.crOaIds||[]).map((id,i)=>{const meta=_oaLookup[id];const t=R.byOaId(id);
          const text=meta?`${formatAuthorName((meta.authorships||[])[0]?.author?.display_name||"")}, ${meta.publication_year||"n.d."}, ${meta.display_name||""}`:(t!=null?localLabel(t):id);
          return<RefRow key={"o"+i} target={t} text={text}/>;})}
      </div>}
    </Card>
  </div>);
}

// Main Collection Panel
function CollectionPanel({D,focus,onFocusDone}){
  const records=D.records;const hc=D.histcite;
  const ed=useContext(EditCtx);
  const[subView,setSubView]=useState("records");
  const[filterEntity,setFilterEntity]=useState(null); // {type, value}
  const[selectedId,setSelectedId]=useState(null);     // record _id (stable across edits)
  const idToIdx=useMemo(()=>new Map(records.map((r,i)=>[r._id,i])),[records]);
  const selIdx=selectedId!=null&&idToIdx.has(selectedId)?idToIdx.get(selectedId):null;

  // jump to a record (e.g. one that was just added)
  useEffect(()=>{if(focus&&focus.id){setSelectedId(focus.id);setFilterEntity(null);onFocusDone&&onFocusDone();}},[focus]);
  // the selected record was removed → back to the list
  useEffect(()=>{if(selectedId!=null&&!idToIdx.has(selectedId))setSelectedId(null);},[idToIdx,selectedId]);
  useEffect(()=>{if(subView==="removed"&&!(ed?.removed?.length))setSubView("records");},[ed?.removed?.length,subView]);

  const authorStats=useMemo(()=>buildEntityStats(records,hc,r=>r.au),[records,hc]);
  const journalStats=useMemo(()=>buildEntityStats(records,hc,r=>r.so?[r.so]:[]),[records,hc]);
  const yearStats=useMemo(()=>buildEntityStats(records,hc,r=>r.py?[String(r.py)]:[]),[records,hc]);
  const dtStats=useMemo(()=>buildEntityStats(records,hc,r=>r.dt?[r.dt]:[]),[records,hc]);
  const langStats=useMemo(()=>buildEntityStats(records,hc,r=>r.la?[r.la]:[]),[records,hc]);
  const affilStats=useMemo(()=>buildEntityStats(records,hc,r=>r.c3),[records,hc]);
  const affilSubStats=useMemo(()=>buildEntityStats(records,hc,r=>r.c1Full),[records,hc]);
  const countryStats=useMemo(()=>buildEntityStats(records,hc,r=>r.coNorm),[records,hc]);

  // drill-down: global indices of the records connected to the clicked entity
  const filteredIdx=useMemo(()=>{
    if(!filterEntity)return null;
    const{type,value}=filterEntity;
    const out=[];
    records.forEach((r,i)=>{
      const hit=type==="author"?r.au.includes(value):type==="journal"?r.so===value:type==="year"?String(r.py)===value
        :type==="doctype"?r.dt===value:type==="language"?r.la===value:type==="affiliation"?r.c3.includes(value)
        :type==="affiliation_sub"?r.c1Full.includes(value):type==="country"?r.coNorm.includes(value):false;
      if(hit)out.push(i);
    });
    return type==="citedby"?citingIdx(hc,value):out;
  },[filterEntity,records,hc]);

  const openIdx=i=>setSelectedId(records[i]?._id??null);
  const handleEntityClick=(type,value)=>{setFilterEntity({type,value});setSelectedId(null);};
  const showCiting=i=>handleEntityClick("citedby",i);

  if(selIdx!=null)return<RecordDetail idx={selIdx} records={records} hc={hc} onBack={()=>setSelectedId(null)} onOpen={openIdx} onCitedBy={showCiting}/>;

  if(filterEntity&&filteredIdx){
    return(<div style={{display:"flex",flexDirection:"column",gap:16}}>
      <button onClick={()=>setFilterEntity(null)} style={{...btnBase,background:"transparent",border:`1px solid ${C.border}`,color:C.accent,alignSelf:"flex-start"}}>← Back to {subView}</button>
      <Card><RecordsList records={records} indices={filteredIdx} hc={hc} onClickRecord={openIdx} onClickLcs={showCiting}
        title={filterEntity.type==="citedby"?citingTitle(records,filterEntity.value):`${filterEntity.type}: ${filterEntity.value}`}/></Card>
    </div>);
  }

  const SUB_VIEWS=[
    {id:"records",label:"Records",icon:"📄"},
    {id:"authors",label:"Authors",icon:"👤"},
    {id:"journals",label:"Journals",icon:"📚"},
    {id:"years",label:"Yearly Output",icon:"📅"},
    {id:"doctypes",label:"Document Type",icon:"📰"},
    {id:"languages",label:"Language",icon:"🌐"},
    {id:"affiliations",label:"Affiliations",icon:"🏛️"},
    {id:"affiliations_sub",label:"Affil. w/ Subdiv.",icon:"🏢"},
    {id:"countries",label:"Country",icon:"🌍"},
  ];
  const nRemoved=ed?.removed?.length||0;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        {SUB_VIEWS.map(v=><PillBtn key={v.id} active={subView===v.id} onClick={()=>{setSubView(v.id);setFilterEntity(null);setSelectedId(null);}} style={{fontSize:10,padding:"5px 10px"}}>{v.icon} {v.label}</PillBtn>)}
        {nRemoved>0&&<PillBtn active={subView==="removed"} onClick={()=>{setSubView("removed");setFilterEntity(null);setSelectedId(null);}} style={{fontSize:10,padding:"5px 10px",color:subView==="removed"?undefined:C.rose}}>🗑 Removed ({nRemoved})</PillBtn>}
        {ed&&<button onClick={()=>ed.addRecord()} style={{...btnBase,marginLeft:"auto",background:C.accent,color:C.onAccent,fontSize:11,padding:"6px 14px"}}>+ Add record</button>}
      </div>

      <Card>
        {subView==="records"&&<RecordsList records={records} hc={hc} onClickRecord={openIdx} onClickLcs={showCiting} title="All Records"/>}
        {subView==="authors"&&<EntityTable data={authorStats} label="Author" onClickRow={v=>handleEntityClick("author",v)}/>}
        {subView==="journals"&&<EntityTable data={journalStats} label="Journal" onClickRow={v=>handleEntityClick("journal",v)}/>}
        {subView==="years"&&<EntityTable data={yearStats} label="Publication Year" nameNumeric onClickRow={v=>handleEntityClick("year",v)}/>}
        {subView==="doctypes"&&<EntityTable data={dtStats} label="Document Type" onClickRow={v=>handleEntityClick("doctype",v)}/>}
        {subView==="languages"&&<EntityTable data={langStats} label="Language" onClickRow={v=>handleEntityClick("language",v)}/>}
        {subView==="affiliations"&&<EntityTable data={affilStats} label="Institution" onClickRow={v=>handleEntityClick("affiliation",v)}/>}
        {subView==="affiliations_sub"&&<EntityTable data={affilSubStats} label="Institution with Subdivision" onClickRow={v=>handleEntityClick("affiliation_sub",v)}/>}
        {subView==="countries"&&<EntityTable data={countryStats} label="Country" onClickRow={v=>handleEntityClick("country",v)}/>}
        {subView==="removed"&&<RemovedList/>}
      </Card>
    </div>
  );
}

function RemovedList(){
  const ed=useContext(EditCtx);
  const items=ed?.removed||[];
  const small={...btnBase,background:"transparent",border:`1px solid ${C.border}`,fontSize:10.5,padding:"5px 10px"};
  return(<div>
    <div style={{fontSize:11,color:C.textDim,marginBottom:12,fontFamily:mono}}>Removed records ({items.length}) — excluded from every analysis and from Export until restored</div>
    {items.map(({rec,at})=>(
      <div key={rec._id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 4px",borderBottom:`1px solid ${C.border}22`}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,color:C.textBright,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={rec.ti}>{rec.ti||"(untitled)"}</div>
          <div style={{fontSize:11,color:C.textDim}}>{rec.au.slice(0,3).join("; ")}{rec.au.length>3?" et al.":""} · {rec.py||"n.d."} · {rec.so} <span style={{fontFamily:mono,fontSize:9.5,marginLeft:6}}>removed {new Date(at).toLocaleString()}</span></div>
        </div>
        <SrcBadge src={rec._src}/>
        <button onClick={()=>ed.restoreRecord(rec._id)} style={{...small,color:C.teal,borderColor:C.teal}}>↺ Restore</button>
        <button onClick={()=>ed.purgeRecord(rec._id)} title="Delete permanently" style={{...small,color:C.rose}}>Delete</button>
      </div>))}
  </div>);
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPARISON PANEL — two entities side by side
   Dimensions: organization · country · author · year interval
   Side A is rendered in accent (gold), side B in teal, consistently throughout.
   ═══════════════════════════════════════════════════════════════════════════ */
let CMP_A,CMP_B;_themeHooks.push(()=>{CMP_A=C.accent;CMP_B=C.teal;});_themeHooks[_themeHooks.length-1]();

// ── Cited-reference metadata extraction ────────────────────────────────
function refMetaWos(line){
  const parts=line.split(",").map(s=>s.trim());
  const author=parts[0]||"";
  let source=parts.length>2?parts[2]:"";
  if(/^V\d+/i.test(source)||/^[Pp]\w+$/.test(source)||/^DOI/i.test(source))source="";
  return{author,source};
}
function refMetaScopus(line){
  let s=line.trim().replace(/\((\d{4})\)\s*$/,"").replace(/[,\s]+$/,"");
  const parts=s.split(", ").map(x=>x.trim()).filter(Boolean);
  const author=((parts[0]||"").split(";")[0]||"").trim();
  let source="";
  for(let i=parts.length-1;i>=1;i--){
    const p=parts[i];
    if(/^\d+$/.test(p))continue;
    if(/^(pp?\.?\s*)?\d+([-\u2013]\d+)?$/i.test(p))continue;
    if(/^\d+\s*\(\d+\)$/.test(p))continue;
    source=p;break;
  }
  if(parts.length<=2)source="";
  return{author,source};
}
// Returns [{author, source}] for one record's cited references
function recordRefMeta(r){
  if(r.crOaIds&&r.crOaIds.length){
    return r.crOaIds.map(id=>{
      const m=_oaLookup[id];
      if(!m)return{author:"",source:""};
      const a=(m.authorships||[])[0]?.author?.display_name||"";
      return{author:a?formatAuthorName(a):"",source:m.primary_location?.source?.display_name||""};
    });
  }
  if(!r.crRaw||!r.crRaw.length)return[];
  const isScopus=r._src==="scopus";
  return r.crRaw.map(l=>isScopus?refMetaScopus(l):refMetaWos(l));
}

// ── Small presentational helpers ───────────────────────────────────────
function DeltaStat({label,a,b,fmt=(v)=>v.toLocaleString(),dfmt,unit="",note}){
  const d=a-b;const pct=b?((a-b)/b*100):(a?100:0);
  return(
    <div style={{flex:1,minWidth:120,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px"}}>
      <div style={{fontSize:9.5,color:C.textDim,textTransform:"uppercase",letterSpacing:1.4,fontFamily:mono,marginBottom:6}}>{label}</div>
      <div style={{display:"flex",alignItems:"baseline",gap:8}}>
        <span style={{fontSize:19,fontWeight:700,color:CMP_A,fontFamily:"Georgia,'Times New Roman',serif"}}>{fmt(a)}</span>
        <span style={{fontSize:11,color:C.border}}>vs</span>
        <span style={{fontSize:19,fontWeight:700,color:CMP_B,fontFamily:"Georgia,'Times New Roman',serif"}}>{fmt(b)}</span>
      </div>
      <div style={{fontSize:10,color:d===0?C.textDim:(d>0?CMP_A:CMP_B),fontFamily:mono,marginTop:3}}>
        {Math.abs(d)<1e-9?"equal":`${d>0?"+":""}${(dfmt||fmt)(d)}${unit}${b?`  (${pct>0?"+":""}${pct.toFixed(0)}%)`:""}`}
      </div>
      {note&&<div style={{fontSize:9.5,color:C.textDim,marginTop:3}}>{note}</div>}
    </div>
  );
}

// Overlaid dual-series year chart
function DualYearChart({seriesA,seriesB,labelA,labelB,share=false}){
  const wr=useRef(),sr=useRef(),w=useW(wr),h=220;
  useEffect(()=>{
    if(!sr.current)return;const svg=d3.select(sr.current);svg.selectAll("*").remove();
    const years=[...new Set([...seriesA.map(d=>d.year),...seriesB.map(d=>d.year)])].sort((a,b)=>a-b);
    if(!years.length){svg.append("text").attr("x",w/2).attr("y",60).attr("text-anchor","middle").attr("fill",C.textDim).attr("font-size",12).text("No publication years to compare.");return;}
    const tA=seriesA.reduce((s,d)=>s+d.count,0)||1,tB=seriesB.reduce((s,d)=>s+d.count,0)||1;
    const mA=new Map(seriesA.map(d=>[d.year,share?100*d.count/tA:d.count])),mB=new Map(seriesB.map(d=>[d.year,share?100*d.count/tB:d.count]));
    const A=years.map(y=>({year:y,count:mA.get(y)||0})),B=years.map(y=>({year:y,count:mB.get(y)||0}));
    const m={top:14,right:16,bottom:28,left:38},cw=Math.max(10,w-m.left-m.right),ch=h-m.top-m.bottom;
    const g=svg.append("g").attr("transform",`translate(${m.left},${m.top})`);
    const x=d3.scalePoint().domain(years).range([0,cw]).padding(.5);
    const maxV=Math.max(1,d3.max([...A,...B],d=>d.count));
    const y=d3.scaleLinear().domain([0,maxV*1.12]).range([ch,0]);
    g.append("g").call(d3.axisLeft(y).ticks(4).tickSize(-cw).tickFormat(v=>share?v+" %":v))
      .call(s=>s.select(".domain").remove())
      .call(s=>s.selectAll(".tick line").attr("stroke",C.border).attr("stroke-opacity",.25))
      .call(s=>s.selectAll(".tick text").attr("fill",C.textDim).attr("font-size",9));
    const defs=svg.append("defs");
    [["gA",CMP_A],["gB",CMP_B]].forEach(([id,col])=>{
      const gr=defs.append("linearGradient").attr("id",id).attr("x1",0).attr("y1",0).attr("x2",0).attr("y2",1);
      gr.append("stop").attr("offset","0%").attr("stop-color",col).attr("stop-opacity",.35);
      gr.append("stop").attr("offset","100%").attr("stop-color",col).attr("stop-opacity",.02);
    });
    const area=d3.area().x(d=>x(d.year)).y0(ch).y1(d=>y(d.count)).curve(d3.curveMonotoneX);
    const line=d3.line().x(d=>x(d.year)).y(d=>y(d.count)).curve(d3.curveMonotoneX);
    [[A,CMP_A,"url(#gA)"],[B,CMP_B,"url(#gB)"]].forEach(([S,col,fill])=>{
      g.append("path").datum(S).attr("d",area).attr("fill",fill);
      g.append("path").datum(S).attr("d",line).attr("fill","none").attr("stroke",col).attr("stroke-width",2.2);
      g.selectAll(null).data(S).join("circle").attr("cx",d=>x(d.year)).attr("cy",d=>y(d.count)).attr("r",3)
        .attr("fill",col).attr("stroke",C.bg).attr("stroke-width",1.5)
        .append("title").text(d=>`${d.year}: ${share?d.count.toFixed(1)+" % of the side's publications":d.count+" publications"}`);
    });
    const step=Math.ceil(years.length/12);
    g.append("g").attr("transform",`translate(0,${ch})`)
      .call(d3.axisBottom(x).tickValues(years.filter((_,i)=>i%step===0)).tickSize(0))
      .call(s=>s.select(".domain").attr("stroke",C.border))
      .call(s=>s.selectAll(".tick text").attr("fill",C.textDim).attr("font-size",9));
  },[seriesA,seriesB,w,h,share]);
  return(<div ref={wr} style={{width:"100%"}}>
    <div style={{display:"flex",gap:16,justifyContent:"flex-end",marginBottom:4,fontSize:10,fontFamily:mono}}>
      <span style={{color:CMP_A}}>● {labelA}</span><span style={{color:CMP_B}}>● {labelB}</span>
    </div>
    <svg ref={sr} width={w} height={h} style={{display:"block",maxWidth:"100%"}}/>
  </div>);
}

// Diverging "tornado" chart: A extends left, B extends right from a centre axis
const fmtShare=v=>v===0?"":v<10?v.toFixed(1)+" %":Math.round(v)+" %";
function DivergingBars({items,labelA,labelB,maxItems=16,share=false}){
  const show=v=>share?fmtShare(v):(v||"");
  const rows=items.slice(0,maxItems);
  const maxV=Math.max(1,...rows.map(r=>Math.max(r.a,r.b)));
  if(!rows.length)return<div style={{color:C.textDim,fontSize:12,padding:16,textAlign:"center"}}>No shared or distinguishing terms found.</div>;
  return(
    <div>
      <div style={{display:"flex",fontSize:10,fontFamily:mono,color:C.textDim,marginBottom:8}}>
        <div style={{flex:1,textAlign:"right",color:CMP_A}}>◀ {labelA}</div>
        <div style={{width:190}}/>
        <div style={{flex:1,color:CMP_B}}>{labelB} ▶</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        {rows.map((r,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center"}}>
            <div style={{flex:1,display:"flex",justifyContent:"flex-end",alignItems:"center",gap:6}}>
              <span style={{fontSize:10,color:r.a?CMP_A:C.border,fontFamily:mono,minWidth:22,textAlign:"right"}}>{show(r.a)}</span>
              <div style={{width:`${(r.a/maxV)*100}%`,height:15,background:`linear-gradient(270deg,${CMP_A}cc,${CMP_A}44)`,borderRadius:"3px 0 0 3px",minWidth:r.a?3:0}}/>
            </div>
            <div style={{width:190,textAlign:"center",fontSize:10.5,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",padding:"0 8px"}} title={r.name}>{r.name}</div>
            <div style={{flex:1,display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:`${(r.b/maxV)*100}%`,height:15,background:`linear-gradient(90deg,${CMP_B}cc,${CMP_B}44)`,borderRadius:"0 3px 3px 0",minWidth:r.b?3:0}}/>
              <span style={{fontSize:10,color:r.b?CMP_B:C.border,fontFamily:mono,minWidth:22}}>{show(r.b)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Two ranked lists side by side; items present in both are marked
function RankedPair({listA,listB,labelA,labelB,title,maxItems=12,share=false,denomA=0,denomB=0,denomLabel=""}){
  const setB=new Set(listB.slice(0,maxItems*3).map(d=>d.name.toLowerCase()));
  const setA=new Set(listA.slice(0,maxItems*3).map(d=>d.name.toLowerCase()));
  const col=(list,other,color,label,den)=>{
    const val=d=>share?(den?100*d.count/den:0):d.count;
    const mx=Math.max(1e-9,...list.slice(0,maxItems).map(val));
    return(
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:10,fontFamily:mono,color,marginBottom:8,textTransform:"uppercase",letterSpacing:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</div>
        {list.length?list.slice(0,maxItems).map((d,i)=>{
          const shared=other.has(d.name.toLowerCase());
          return(
            <div key={i} style={{marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}>
                <span style={{color:C.textDim,fontFamily:mono,fontSize:9,minWidth:16}}>{i+1}</span>
                {shared&&<span title="also present on the other side" style={{color:C.purple,fontSize:8}}>●</span>}
                <span style={{color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}} title={d.name}>{d.name}</span>
                <span style={{color,fontFamily:mono,fontWeight:700,fontSize:10}} title={share?`${d.count} of ${den}`:undefined}>{share?fmtShare(val(d))||"0 %":d.count}</span>
              </div>
              <div style={{height:3,background:C.bg,borderRadius:2,marginTop:2,marginLeft:22,overflow:"hidden"}}>
                <div style={{width:`${(val(d)/mx)*100}%`,height:"100%",background:color,opacity:.55,borderRadius:2}}/>
              </div>
            </div>);
        }):<div style={{color:C.textDim,fontSize:11,padding:8}}>No data.</div>}
      </div>);
  };
  return(
    <div>
      <SectionTitle>{title}</SectionTitle>
      {share&&denomLabel&&<div style={{fontSize:10,color:C.textDim,margin:"-4px 0 10px"}}>Share of {denomLabel} on each side.</div>}
      <div style={{display:"flex",gap:28}}>
        {col(listA,setB,CMP_A,labelA,denomA)}
        <div style={{width:1,background:C.border}}/>
        {col(listB,setA,CMP_B,labelB,denomB)}
      </div>
    </div>
  );
}

// Searchable entity combobox
function EntityPicker({options,value,onChange,color,placeholder}){
  const[open,setOpen]=useState(false);const[q,setQ]=useState("");
  const wrapRef=useRef();
  useEffect(()=>{
    const h=e=>{if(wrapRef.current&&!wrapRef.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  const filtered=useMemo(()=>{
    const s=q.trim().toLowerCase();
    return(s?options.filter(o=>o.name.toLowerCase().includes(s)):options).slice(0,200);
  },[options,q]);
  return(
    <div ref={wrapRef} style={{position:"relative"}}>
      <button onClick={()=>{setOpen(!open);setQ("");}} style={{
        width:"100%",textAlign:"left",background:C.bg,border:`1px solid ${value?color:C.border}`,borderRadius:8,
        padding:"10px 12px",fontSize:12,color:value?C.textBright:C.textDim,cursor:"pointer",fontFamily:"inherit",
        display:"flex",alignItems:"center",gap:8}}>
        <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value||placeholder}</span>
        <span style={{color:C.textDim,fontSize:10}}>{open?"▲":"▼"}</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:50,background:C.card,
          border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,.5)",maxHeight:300,display:"flex",flexDirection:"column"}}>
          <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Type to search…"
            style={{background:C.bg,border:"none",borderBottom:`1px solid ${C.border}`,borderRadius:"8px 8px 0 0",
              padding:"9px 12px",fontSize:12,color:C.text,outline:"none",fontFamily:"inherit"}}/>
          <div style={{overflowY:"auto"}}>
            {filtered.length?filtered.map((o,i)=>(
              <div key={i} onClick={()=>{onChange(o.name);setOpen(false);}} style={{
                padding:"7px 12px",fontSize:11.5,cursor:"pointer",display:"flex",gap:8,alignItems:"center",
                background:o.name===value?`${color}18`:"transparent",color:o.name===value?color:C.text}}
                onMouseEnter={e=>e.currentTarget.style.background=`${color}12`}
                onMouseLeave={e=>e.currentTarget.style.background=o.name===value?`${color}18`:"transparent"}>
                <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.name}</span>
                <span style={{fontFamily:mono,fontSize:9.5,color:C.textDim}}>{o.count}</span>
              </div>
            )):<div style={{padding:"12px",fontSize:11,color:C.textDim,textAlign:"center"}}>No matches.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function YearRangePicker({minY,maxY,from,to,onChange,color}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,background:C.bg,border:`1px solid ${color}`,borderRadius:8,padding:"8px 12px"}}>
      <input type="number" value={from} min={minY} max={maxY} onChange={e=>onChange(+e.target.value,to)}
        style={{width:66,background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 7px",fontSize:12,color:C.textBright,fontFamily:mono,outline:"none"}}/>
      <span style={{color:C.textDim,fontSize:11}}>→</span>
      <input type="number" value={to} min={minY} max={maxY} onChange={e=>onChange(from,+e.target.value)}
        style={{width:66,background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 7px",fontSize:12,color:C.textBright,fontFamily:mono,outline:"none"}}/>
      <span style={{fontSize:10,color:C.textDim,fontFamily:mono,marginLeft:"auto"}}>{Math.max(0,to-from+1)} yr</span>
    </div>
  );
}

function ComparisonPanel({D}){
  const records=D.records,hc=D.histcite;
  const[dim,setDim]=useState("organization");
  const[mode,setMode]=useState("count");const share=mode==="share";
  const[selA,setSelA]=useState(null),[selB,setSelB]=useState(null);
  const years=useMemo(()=>records.map(r=>r.py).filter(y=>y>1900),[records]);
  const minY=years.length?Math.min(...years):2000,maxY=years.length?Math.max(...years):2024;
  const mid=Math.floor((minY+maxY)/2);
  const[rangeA,setRangeA]=useState([minY,mid]),[rangeB,setRangeB]=useState([mid+1,maxY]);

  const lcsMap=useMemo(()=>{const m=new Map();for(const p of hc.papers)m.set(p.idx,p.lcs||0);return m;},[hc]);
  // Affiliation with subdivision: organisation + department parsed from the address, as in Networks
  const affSub=useMemo(()=>{const m=new Map();for(const r of records)m.set(r,recordUnitKeys(r,"affiliation_sub"));return m;},[records]);
  const sectorOvr=useOverrides("sector"),funderOvr=useOverrides("funder");
  const fCanon=useMemo(()=>buildFunderCanon(records),[records]);
  const accessor=useMemo(()=>({
    organization:r=>r.c3,affiliation_sub:r=>affSub.get(r)||[],country:r=>r.coNorm,author:r=>r.au,
    oa:r=>[oaStatus(r).status],sector:r=>[...new Set(recordOrgs(r,sectorOvr).map(o=>o.s))],
    funder:r=>[...new Set((r.fu||[]).map(f=>fCanon.name(f.n)))],
    funder_type:r=>[...new Set((r.fu||[]).map(f=>funderOvr[fCanon.key(f.n)]||funderTypeRule(fCanon.name(f.n))))],
    sdg:r=>(r.sdg||[]).map(x=>sdgLabel(x.id)),
  }[dim]),[dim,affSub,sectorOvr,funderOvr,fCanon]);

  // Option lists for the pickers
  const options=useMemo(()=>{
    if(dim==="year")return[];
    const m=new Map();
    for(const r of records){const seen=new Set();for(const e of accessor(r)||[]){if(!e||seen.has(e))continue;seen.add(e);m.set(e,(m.get(e)||0)+1);}}
    return[...m.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
  },[records,accessor,dim]);

  // Reset selections when the dimension changes
  useEffect(()=>{
    if(dim==="year")return;
    setSelA(options[0]?.name??null);setSelB(options[1]?.name??null);
  },[dim,options]);

  const membersOf=useCallback((sel,range)=>{
    if(dim==="year"){const[f,t]=range;return records.map((r,i)=>[r,i]).filter(([r])=>r.py>=f&&r.py<=t).map(([,i])=>i);}
    if(!sel)return[];
    return records.map((r,i)=>[r,i]).filter(([r])=>(accessor(r)||[]).includes(sel)).map(([,i])=>i);
  },[records,accessor,dim]);

  const idxA=useMemo(()=>membersOf(selA,rangeA),[membersOf,selA,rangeA]);
  const idxB=useMemo(()=>membersOf(selB,rangeB),[membersOf,selB,rangeB]);

  const refCanon=useMemo(()=>{const au=[],so=[];
    for(const r of records)for(const m of recordRefMeta(r)){if(m.author)au.push(m.author);if(m.source)so.push(m.source);}
    return{au:makeNameCanon(au,"author"),so:makeNameCanon(so,"source")};},[records]);
  const profile=useCallback(idxs=>{
    const recs=idxs.map(i=>records[i]);
    const cnt=arr=>{const m=new Map();for(const x of arr)if(x)m.set(x,(m.get(x)||0)+1);return[...m.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);};
    const yrMap=new Map();for(const r of recs)if(r.py)yrMap.set(r.py,(yrMap.get(r.py)||0)+1);
    const citedAu=[],citedSo=[];
    for(const r of recs)for(const m of recordRefMeta(r)){const a=refCanon.au.name(m.author),so=refCanon.so.name(m.source);if(a)citedAu.push(a);if(so)citedSo.push(so);}
    return{
      n:recs.length,
      citations:recs.reduce((s,r)=>s+(r.tc||0),0),
      lcs:idxs.reduce((s,i)=>s+(lcsMap.get(i)||0),0),
      authors:new Set(recs.flatMap(r=>r.au)).size,
      journals:new Set(recs.map(r=>r.so).filter(Boolean)).size,
      refs:recs.reduce((s,r)=>s+(r.nr||0),0),
      byYear:[...yrMap.entries()].sort((a,b)=>a[0]-b[0]).map(([year,count])=>({year,count})),
      keywords:cnt(recs.flatMap(r=>[...(r.de||[]),...(r.id||[])].map(k=>k.toLowerCase()))),
      sources:cnt(recs.map(r=>r.so)),
      citedAuthors:cnt(citedAu),
      citedSources:cnt(citedSo),
      citedAuN:citedAu.length,citedSoN:citedSo.length,
    };
  },[records,lcsMap,refCanon]);

  const A=useMemo(()=>profile(idxA),[profile,idxA]);
  const B=useMemo(()=>profile(idxB),[profile,idxB]);

  const labelA=dim==="year"?`${rangeA[0]}–${rangeA[1]}`:(selA||"Side A");
  const labelB=dim==="year"?`${rangeB[0]}–${rangeB[1]}`:(selB||"Side B");

  // Merge two frequency lists into diverging rows, ranked by combined weight
  const divergingRows=useMemo(()=>{
    const ma=new Map(A.keywords.map(d=>[d.name,d.count])),mb=new Map(B.keywords.map(d=>[d.name,d.count]));
    const names=new Set([...ma.keys()].slice(0,60).concat([...mb.keys()].slice(0,60)));
    const va=n=>share?(A.n?100*(ma.get(n)||0)/A.n:0):(ma.get(n)||0),vb=n=>share?(B.n?100*(mb.get(n)||0)/B.n:0):(mb.get(n)||0);
    return[...names].map(n=>({name:n,a:va(n),b:vb(n)}))
      .sort((x,y)=>(y.a+y.b)-(x.a+x.b));
  },[A,B,share]);

  const jaccard=useMemo(()=>{
    const sa=new Set(A.keywords.slice(0,50).map(d=>d.name)),sb=new Set(B.keywords.slice(0,50).map(d=>d.name));
    if(!sa.size&&!sb.size)return 0;
    let inter=0;for(const x of sa)if(sb.has(x))inter++;
    return inter/(sa.size+sb.size-inter);
  },[A,B]);

  const DIMS=[{id:"organization",l:"🏛️ Organizations",p:"organization"},{id:"affiliation_sub",l:"🏢 Affiliations with Subdivision",p:"affiliation with subdivision"},{id:"country",l:"🌍 Countries",p:"country"},{id:"author",l:"👤 Authors",p:"author"},{id:"oa",l:"🔓 Open access",p:"open access status"},{id:"sector",l:"🏷️ Sectors",p:"sector"},{id:"funder",l:"💰 Funders",p:"funder"},{id:"funder_type",l:"💰 Funder types",p:"funder type"},{id:"sdg",l:"🌐 SDGs",p:"SDG"},{id:"year",l:"📅 Year intervals",p:"years"}];
  const dimPh=`Select ${(DIMS.find(d=>d.id===dim)||{}).p||dim}…`;
  const ready=dim==="year"?(idxA.length||idxB.length):(selA&&selB);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Dimension switch */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:10,color:C.textDim,fontFamily:mono,textTransform:"uppercase",letterSpacing:1.5,marginRight:4}}>Compare</span>
        {DIMS.map(d=><PillBtn key={d.id} active={dim===d.id} onClick={()=>setDim(d.id)} style={{fontSize:10,padding:"5px 12px"}}>{d.l}</PillBtn>)}
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:C.textDim,fontFamily:mono,textTransform:"uppercase",letterSpacing:1.5,marginRight:4}}>Show</span>
        <PillBtn active={!share} onClick={()=>setMode("count")} style={{fontSize:10,padding:"5px 12px"}}>Numbers</PillBtn>
        <PillBtn active={share} onClick={()=>setMode("share")} style={{fontSize:10,padding:"5px 12px"}}>Shares</PillBtn>
        <span style={{fontSize:10.5,color:C.textDim,marginLeft:8}}>{share?"Each side relative to its own size: shares of its publications (or cited references), and averages per publication. Use this when the sides differ in size.":"Counts as they are. Larger sides have larger numbers."}</span>
      </div>

      {/* Selector row */}
      <Card style={{padding:"18px 22px"}}>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 44px minmax(0,1fr)",gap:14,alignItems:"center"}}>
          <div>
            <div style={{fontSize:9.5,color:CMP_A,fontFamily:mono,textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>Side A</div>
            {dim==="year"
              ?<YearRangePicker minY={minY} maxY={maxY} from={rangeA[0]} to={rangeA[1]} onChange={(f,t)=>setRangeA([f,t])} color={CMP_A}/>
              :<EntityPicker options={options} value={selA} onChange={setSelA} color={CMP_A} placeholder={dimPh}/>}
          </div>
          <button title="Swap sides" onClick={()=>{if(dim==="year"){const t=rangeA;setRangeA(rangeB);setRangeB(t);}else{const t=selA;setSelA(selB);setSelB(t);}}}
            style={{...btnBase,background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,padding:"9px 0",fontSize:14,alignSelf:"end"}}>⇄</button>
          <div>
            <div style={{fontSize:9.5,color:CMP_B,fontFamily:mono,textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>Side B</div>
            {dim==="year"
              ?<YearRangePicker minY={minY} maxY={maxY} from={rangeB[0]} to={rangeB[1]} onChange={(f,t)=>setRangeB([f,t])} color={CMP_B}/>
              :<EntityPicker options={options} value={selB} onChange={setSelB} color={CMP_B} placeholder={dimPh}/>}
          </div>
        </div>
      </Card>

      {!ready&&<Card><div style={{color:C.textDim,fontSize:12,textAlign:"center",padding:24}}>Select an item on each side to build the comparison.</div></Card>}

      {ready&&(<>
        {/* 1. Numeric strip */}
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {!share?<>
          <DeltaStat label="Publications" a={A.n} b={B.n}/>
          <DeltaStat label="Citations (GCS)" a={A.citations} b={B.citations}/>
          <DeltaStat label="Local citations" a={A.lcs} b={B.lcs}/>
          <DeltaStat label="Distinct authors" a={A.authors} b={B.authors}/>
          <DeltaStat label="Distinct journals" a={A.journals} b={B.journals}/>
          <DeltaStat label="Cited references" a={A.refs} b={B.refs}/>
          </>:(()=>{const N=records.length||1,per=(x,n)=>n?x/n:0,f1=v=>(Math.round(v*10)/10).toLocaleString("en"),fp=v=>`${(Math.round(v*10)/10).toLocaleString("en")} %`;
            return<>
          <DeltaStat label="Share of collection" a={100*A.n/N} b={100*B.n/N} fmt={fp} dfmt={v=>`${(Math.round(v*10)/10).toLocaleString("en")} percentage points`} note={`${A.n} and ${B.n} of ${records.length}`}/>
          <DeltaStat label="Citations per publication" a={per(A.citations,A.n)} b={per(B.citations,B.n)} fmt={f1}/>
          <DeltaStat label="Local citations per publ." a={per(A.lcs,A.n)} b={per(B.lcs,B.n)} fmt={f1}/>
          <DeltaStat label="Authors per publication" a={per(A.authors,A.n)} b={per(B.authors,B.n)} fmt={f1} note="Distinct authors / publications"/>
          <DeltaStat label="Journals per publication" a={per(A.journals,A.n)} b={per(B.journals,B.n)} fmt={v=>v.toFixed(2)} note="Distinct journals / publications"/>
          <DeltaStat label="References per publication" a={per(A.refs,A.n)} b={per(B.refs,B.n)} fmt={f1}/>
          </>;})()}
        </div>

        {/* 2. Temporal shape */}
        <Card>
          <SectionTitle icon="📅">Publications by year</SectionTitle>
          {share&&<div style={{fontSize:10.5,color:C.textDim,margin:"-4px 0 8px"}}>Share of each side's publications per year.</div>}
          <DualYearChart seriesA={A.byYear} seriesB={B.byYear} labelA={labelA} labelB={labelB} share={share}/>
        </Card>

        {/* 3. Keyword asymmetry */}
        <Card>
          <SectionTitle icon="💬">Keyword profile</SectionTitle>
          <p style={{fontSize:11,color:C.textDim,margin:"0 0 14px"}}>
            {share?"Share of each side's publications that have the term (author keywords and KeyWords Plus); terms ranked by the sum of the two shares.":"Terms ranked by combined frequency."} Bars extend from the centre — left for {labelA}, right for {labelB}.
            Keyword overlap (Jaccard, top 50): <b style={{color:C.purple}}>{(jaccard*100).toFixed(0)}%</b>
          </p>
          <DivergingBars items={divergingRows} labelA={labelA} labelB={labelB} share={share}/>
        </Card>

        {/* 4. Ranked lists */}
        <Card><RankedPair title="Publication sources" listA={A.sources} listB={B.sources} labelA={labelA} labelB={labelB} share={share} denomA={A.n} denomB={B.n} denomLabel="publications"/></Card>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:20}}>
          <Card><RankedPair title="Most cited authors" listA={A.citedAuthors} listB={B.citedAuthors} labelA={labelA} labelB={labelB} maxItems={10} share={share} denomA={A.citedAuN} denomB={B.citedAuN} denomLabel="cited references with an author"/></Card>
          <Card><RankedPair title="Most cited sources" listA={A.citedSources} listB={B.citedSources} labelA={labelA} labelB={labelB} maxItems={10} share={share} denomA={A.citedSoN} denomB={B.citedSoN} denomLabel="cited references with a source"/></Card>
        </div>
        <div style={{fontSize:10,color:C.textDim,textAlign:"center",fontFamily:mono}}>
          <span style={{color:C.purple}}>●</span> marks an item appearing on both sides
        </div>
      </>)}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   RECORD EDITOR — add a new record or edit an existing one
   References can be entered three ways, all of which feed LCS/LCR, the
   historiograph and Cited Refs once saved:
     1. linked records picked from the collection  (stored as crLocal ids)
     2. free-text lines, WoS style                 (stored in crRaw)
     3. bare DOIs, one per line                    (stored in crRaw as "DOI …")
   ═══════════════════════════════════════════════════════════════════════════ */
function linesOf(s){return String(s||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);}
function normalizeRefLine(l){const m=l.match(/^\s*(?:doi[:\s]*|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,}\/\S+?)[.,;]?\s*$/i);return m?`DOI ${m[1]}`:l;}
function countriesFromAffiliations(lines){
  const out=[];
  for(const l of lines){const seg=l.split(",").map(x=>x.trim()).filter(Boolean);const last=(seg[seg.length-1]||"").replace(/\d+/g,"").trim();
    const n=normalizeCountry(last);if(n&&(n==="USA"||COUNTRY_BY_ALIAS.has(n.toLowerCase())))out.push(n);}
  return[...new Set(out)];
}
function recordToForm(r){return{ti:r.ti||"",au:(r.au||[]).join("\n"),py:r.py?String(r.py):"",pd:r.pd||"",so:r.so||"",j9:r.j9||"",
  vl:r.vl||"",is:r.is||"",bp:r.bp||"",ep:r.ep||"",di:r.di||"",dt:r.dt||"",la:r.la||"",tc:String(r.tc||0),
  de:(r.de||[]).join("; "),kw:(r.id||[]).join("; "),ab:r.ab||"",aff:(r.c1Full||[]).join("\n"),refs:(r.crRaw||[]).join("\n"),crLocal:[...(r.crLocal||[])]};}
function formToRecord(f,base,R){
  const au=linesOf(f.au);const affLines=linesOf(f.aff);
  const crRaw=linesOf(f.refs).map(normalizeRefLine);
  const bp=f.bp.trim(),ep=f.ep.trim();
  const rec={...(base||emptyRecord()),
    ti:f.ti.trim(),au,af:base&&f.au===(base.au||[]).join("\n")?base.af:au,
    py:parseInt(f.py)||0,pd:f.pd.trim(),so:f.so.trim(),j9:f.j9.trim().toUpperCase(),vl:f.vl.trim(),is:f.is.trim(),bp,ep,
    pg:/^\d+$/.test(bp)&&/^\d+$/.test(ep)?Math.max(0,+ep-+bp+1):(base?.pg||0),
    di:normalizeDoi(f.di),dt:f.dt.trim(),la:f.la.trim(),tc:Math.max(0,parseInt(f.tc)||0),
    de:f.de.split(";").map(x=>x.trim()).filter(Boolean),id:f.kw.split(";").map(x=>x.trim()).filter(Boolean),
    ab:f.ab.trim(),crRaw,crLocal:[...new Set(f.crLocal)]};
  if(!base||f.aff!==(base.c1Full||[]).join("\n")){        // only re-derive what the user touched
    rec.c1Full=affLines;rec.c3=[...new Set(affLines.map(institutionFromAffiliation).filter(Boolean))];
    rec.coNorm=countriesFromAffiliations(affLines);rec.co=rec.coNorm;
  }
  // CR = distinct references across all channels (a link and a DOI line to the same record count once)
  const seen=new Set();
  for(const l of rec.crRaw){const x=R.line(l,rec._src);seen.add(x.idx!=null?`i${x.idx}`:x.doi?`d${x.doi}`:`l${l.toLowerCase()}`);}
  for(const id of rec.crOaIds||[]){const t=R.byOaId(id);seen.add(t!=null?`i${t}`:`o${id}`);}
  for(const id of rec.crLocal){const t=R.byId(id);seen.add(t!=null?`i${t}`:`x${id}`);}
  rec.nr=seen.size;
  if(base)rec._edited=true;else{rec._id=uid("m");rec._src="manual";rec._manual=true;rec._mergedFrom=["manual"];}
  return rec;
}

/* ═══ DOI → REFERENCE LOOKUP ═══
   Bare DOIs typed or pasted into a record's reference list are turned into
   WoS-style reference lines. A DOI that belongs to a record in the collection
   is written from that record; others are looked up in Crossref, then OpenAlex.
   Both services allow requests straight from the browser. */
const _doiCache=new Map();
function bareDoi(line){const m=String(line||"").match(/^\s*(?:doi[:\s]*|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,}\/\S+?)[.,;]?\s*$/i);return m?m[1].toLowerCase():null;}
function initialsOf(given){return String(given||"").split(/[\s.]+/).filter(Boolean).map(p=>p.split("-").map(x=>x.charAt(0).toUpperCase()).join("")).join("");}
function crLineFrom({author,year,source,vol,page,doi}){
  return[author||"[Anonymous]",year,source&&source.toUpperCase().replace(/[,.]/g,"").replace(/\s+/g," ").trim(),vol&&`V${vol}`,page&&`P${String(page).toUpperCase()}`,doi&&`DOI ${doi}`].filter(Boolean).join(", ");
}
async function fetchJson(url,signal){const r=await fetch(url,{signal,headers:{Accept:"application/json"}});if(!r.ok)throw new Error(String(r.status));return r.json();}
async function lookupDoi(doi,signal){
  if(_doiCache.has(doi))return _doiCache.get(doi);
  let line=null;
  try{
    const{message:m}=await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`,signal);
    const a=(m.author||[]).find(x=>x.sequence==="first")||(m.author||[])[0];
    const author=a?(a.family?`${a.family} ${initialsOf(a.given)}`.trim():a.name||""):"";
    const dp=(m.issued||m["published-print"]||m["published-online"]||{})["date-parts"];
    line=crLineFrom({author,year:dp&&dp[0]&&dp[0][0],source:(m["short-container-title"]||[])[0]||(m["container-title"]||[])[0]||"",
      vol:m.volume,page:(m.page||"").split(/[-–]/)[0]||m["article-number"],doi});
  }catch(e){if(e.name==="AbortError")throw e;}
  if(!line)try{
    const m=await fetchJson(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`,signal);
    const name=(m.authorships||[])[0]?.author?.display_name||"";
    const b=m.biblio||{};
    line=crLineFrom({author:name?crAuthor(formatAuthorName(name)):"",year:m.publication_year,source:m.primary_location?.source?.display_name||"",vol:b.volume,page:b.first_page,doi});
  }catch(e){if(e.name==="AbortError")throw e;}
  _doiCache.set(doi,line);
  return line;
}

const inputStyle={width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",fontSize:12,color:C.textBright,fontFamily:"system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",outline:"none"};
_themeHooks.push(()=>Object.assign(inputStyle,{background:C.bg,border:`1px solid ${C.border}`,color:C.textBright}));
function Field({label,hint,span=1,children}){
  return(<label style={{display:"block",gridColumn:`span ${span}`,minWidth:0}}>
    <div style={{fontSize:9.5,color:C.textDim,fontFamily:mono,textTransform:"uppercase",letterSpacing:1.2,marginBottom:4}}>{label}</div>
    {children}
    {hint&&<div style={{fontSize:10,color:C.textDim,marginTop:3,lineHeight:1.4}}>{hint}</div>}
  </label>);
}
function EditorSection({title,children}){return(<div style={{marginTop:22}}>
  <div style={{fontSize:10.5,color:C.accent,fontFamily:mono,textTransform:"uppercase",letterSpacing:1.6,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${C.border}`}}>{title}</div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12}}>{children}</div></div>);}

function RecordEditor({base,records,onSave,onCancel}){
  const[f,setF]=useState(()=>recordToForm(base||emptyRecord()));
  const[q,setQ]=useState("");const[tried,setTried]=useState(false);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const R=useMemo(()=>makeRefResolver(records),[records]);
  const idToIdx=useMemo(()=>new Map(records.map((r,i)=>[r._id,i])),[records]);
  const titleIdx=useMemo(()=>{const m=new Map();records.forEach((r,i)=>{const t=normalizeTitle(r.ti);if(t.length>=25&&!m.has(t))m.set(t,i);});return m;},[records]);
  const selfIdx=base&&idToIdx.has(base._id)?idToIdx.get(base._id):-1;
  const src=base?._src||"manual";
  const opts=useMemo(()=>{const uniq=k=>[...new Set(records.map(r=>r[k]).filter(Boolean))].sort().slice(0,400);return{so:uniq("so"),dt:uniq("dt"),la:uniq("la")};},[records]);

  useEffect(()=>{const h=e=>{if(e.key==="Escape")onCancel();};window.addEventListener("keydown",h);
    const ov=document.body.style.overflow;document.body.style.overflow="hidden";
    return()=>{window.removeEventListener("keydown",h);document.body.style.overflow=ov;};},[onCancel]);

  // live preview of how typed references resolve against the collection
  const refPreview=useMemo(()=>linesOf(f.refs).map(l=>{const res=R.line(normalizeRefLine(l),src);
    return{line:l,idx:res.idx!=null&&res.idx!==selfIdx?res.idx:null};}),[f.refs,R,selfIdx,src]);
  const matched=refPreview.filter(p=>p.idx!=null);
  const pick=useMemo(()=>{const s=q.trim().toLowerCase();if(s.length<2)return[];const out=[];
    for(let i=0;i<records.length&&out.length<8;i++){const r=records[i];if(i===selfIdx||f.crLocal.includes(r._id))continue;
      if(`${r.ti} ${r.au.join(" ")} ${r.py} ${r.so} ${r.di}`.toLowerCase().includes(s))out.push(i);}
    return out;},[q,records,f.crLocal,selfIdx]);
  // auto-convert bare DOIs in the reference list
  const[doiState,setDoiState]=useState({busy:0,done:0,failed:[]});
  const tried_=useRef(new Set());const[retry,setRetry]=useState(0);
  useEffect(()=>{
    const dois=[...new Set(linesOf(f.refs).map(bareDoi).filter(d=>d&&!tried_.current.has(d)))];
    if(!dois.length)return;
    const ctl=new AbortController();
    const t=setTimeout(async()=>{
      setDoiState(s=>({...s,busy:dois.length}));
      const results=new Map();let next=0;
      const work=async()=>{while(next<dois.length){const d=dois[next++];
        const j=R.byDoi(d);
        let line=null;
        if(j!=null&&j!==selfIdx)line=canonicalCR(records[j]);
        else{try{line=await lookupDoi(d,ctl.signal);}catch(e){if(e.name==="AbortError")return;}}
        results.set(d,line);}};
      await Promise.all([work(),work(),work(),work()]);
      if(ctl.signal.aborted)return;
      for(const d of results.keys())tried_.current.add(d);
      setF(p=>({...p,refs:p.refs.split(/\r?\n/).map(l=>{const d=bareDoi(l);return d&&results.get(d)?results.get(d):l;}).join("\n")}));
      const failed=[...results].filter(([,v])=>!v).map(([d])=>d);
      setDoiState(s=>({busy:0,done:s.done+results.size-failed.length,failed:[...new Set([...s.failed.filter(x=>!results.has(x)),...failed])]}));
    },500);
    return()=>{clearTimeout(t);ctl.abort();setDoiState(s=>s.busy?{...s,busy:0}:s);};
  },[f.refs,R,records,selfIdx,retry]);
  const retryDois=()=>{for(const d of doiState.failed){tried_.current.delete(d);_doiCache.delete(d);}setDoiState(s=>({...s,failed:[]}));setRetry(n=>n+1);};

  const derived=useMemo(()=>{const L=linesOf(f.aff);return{inst:[...new Set(L.map(institutionFromAffiliation).filter(Boolean))],co:countriesFromAffiliations(L)};},[f.aff]);

  const yr=parseInt(f.py);
  const errors=[];
  if(!f.ti.trim())errors.push("A title is required.");
  if(!linesOf(f.au).length)errors.push("At least one author is required.");
  if(!(yr>=1600&&yr<=new Date().getFullYear()+1))errors.push("Publication year must be a four-digit year.");
  if(f.tc&&!/^\d+$/.test(f.tc.trim()))errors.push("Times cited (GCS) must be a whole number.");
  const warnings=[];
  const d=normalizeDoi(f.di);
  if(d){const j=records.findIndex(r=>r.di===d);if(j>=0&&j!==selfIdx)warnings.push(`Another record already has this DOI: “${records[j].ti.slice(0,90)}”`);}
  const nt=normalizeTitle(f.ti);
  if(nt.length>=25&&titleIdx.has(nt)&&titleIdx.get(nt)!==selfIdx){const j=titleIdx.get(nt);warnings.push(`A record with the same title already exists (${records[j].au[0]||"?"}, ${records[j].py}).`);}

  const save=()=>{setTried(true);if(errors.length)return;onSave(formToRecord(f,base,R));};
  const lbl=i=>{const r=records[i];return`${r.au[0]||"[Anonymous]"} (${r.py||"n.d."}) ${r.ti}`;};
  const small={...btnBase,background:"transparent",border:`1px solid ${C.border}`,fontSize:11,padding:"6px 12px"};

  return(<div onMouseDown={e=>{if(e.target===e.currentTarget)onCancel();}}
    style={{position:"fixed",inset:0,background:"rgba(5,7,10,.72)",zIndex:1000,display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"32px 16px",overflowY:"auto"}}>
    <div role="dialog" aria-modal="true" style={{width:"100%",maxWidth:900,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:"0 24px 64px rgba(0,0,0,.6)"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"18px 24px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontFamily:"Georgia,'Times New Roman',serif",fontSize:20,fontWeight:700,color:C.textBright}}>{base?"Edit record":"Add record"}</div>
        {base&&<SrcBadge src={base._src}/>}
        <button onClick={onCancel} title="Close (Esc)" style={{...small,marginLeft:"auto",color:C.textDim}}>✕</button>
      </div>
      <div style={{padding:"4px 24px 24px"}}>
        <EditorSection title="Bibliographic data">
          <Field label="Title *" span={4}><input style={inputStyle} value={f.ti} onChange={set("ti")} autoFocus/></Field>
          <Field label="Authors *" span={2} hint="One per line, e.g. Garfield, E"><textarea style={{...inputStyle,minHeight:92,resize:"vertical"}} value={f.au} onChange={set("au")}/></Field>
          <Field label="Source / journal" span={2}><input style={inputStyle} value={f.so} onChange={set("so")} list="bs-so"/><datalist id="bs-so">{opts.so.map(o=><option key={o} value={o}/>)}</datalist>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,marginTop:10}}>
              <Field label="Journal abbrev. (J9)" hint="Lets WoS-style references match this record"><input style={inputStyle} value={f.j9} onChange={set("j9")}/></Field>
              <Field label="Document type"><input style={inputStyle} value={f.dt} onChange={set("dt")} list="bs-dt"/><datalist id="bs-dt">{opts.dt.map(o=><option key={o} value={o}/>)}</datalist></Field>
            </div></Field>
          <Field label="Year *"><input style={inputStyle} value={f.py} onChange={set("py")} inputMode="numeric"/></Field>
          <Field label="Date" hint="e.g. 2021 MAR"><input style={inputStyle} value={f.pd} onChange={set("pd")}/></Field>
          <Field label="Volume"><input style={inputStyle} value={f.vl} onChange={set("vl")}/></Field>
          <Field label="Issue"><input style={inputStyle} value={f.is} onChange={set("is")}/></Field>
          <Field label="Start page"><input style={inputStyle} value={f.bp} onChange={set("bp")}/></Field>
          <Field label="End page"><input style={inputStyle} value={f.ep} onChange={set("ep")}/></Field>
          <Field label="Language"><input style={inputStyle} value={f.la} onChange={set("la")} list="bs-la"/><datalist id="bs-la">{opts.la.map(o=><option key={o} value={o}/>)}</datalist></Field>
          <Field label="Times cited (GCS)" hint="Global count from the database"><input style={inputStyle} value={f.tc} onChange={set("tc")} inputMode="numeric"/></Field>
          <Field label="DOI" span={4}><input style={inputStyle} value={f.di} onChange={set("di")} placeholder="10.xxxx/…"/></Field>
        </EditorSection>

        <EditorSection title="Affiliations & subject">
          <Field label="Addresses" span={4} hint="One affiliation per line, ending with the country: Department, Institution, City, Country">
            <textarea style={{...inputStyle,minHeight:70,resize:"vertical"}} value={f.aff} onChange={set("aff")}/>
            {(derived.inst.length>0||derived.co.length>0)&&<div style={{fontSize:10.5,color:C.textDim,marginTop:4}}>
              Institutions: <span style={{color:C.text}}>{derived.inst.join("; ")||"—"}</span> · Countries: <span style={{color:C.text}}>{derived.co.join("; ")||"—"}</span></div>}
          </Field>
          <Field label="Author keywords" span={2} hint="Separated by semicolons"><input style={inputStyle} value={f.de} onChange={set("de")}/></Field>
          <Field label="Index terms / KeyWords Plus" span={2} hint="Separated by semicolons"><input style={inputStyle} value={f.kw} onChange={set("kw")}/></Field>
          <Field label="Abstract" span={4}><textarea style={{...inputStyle,minHeight:80,resize:"vertical"}} value={f.ab} onChange={set("ab")}/></Field>
        </EditorSection>

        <EditorSection title="Cited references">
          <Field label="Link records in this collection" span={4} hint="Search by title, author, year, journal or DOI. Linked records count directly towards LCS / LCR.">
            <input style={inputStyle} value={q} onChange={e=>setQ(e.target.value)} placeholder="Type at least two characters…"/>
            {pick.length>0&&<div style={{border:`1px solid ${C.border}`,borderRadius:6,marginTop:4,background:C.bg,maxHeight:220,overflowY:"auto"}}>
              {pick.map(i=><div key={records[i]._id} onMouseDown={e=>{e.preventDefault();setF(p=>({...p,crLocal:[...p.crLocal,records[i]._id]}));setQ("");}}
                style={{padding:"7px 10px",fontSize:11.5,color:C.text,cursor:"pointer",borderBottom:`1px solid ${C.border}33`}}
                onMouseEnter={e=>e.currentTarget.style.background=`${C.teal}14`} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span style={{color:C.teal}}>＋</span> {lbl(i)}</div>)}
            </div>}
            {f.crLocal.length>0&&<div style={{display:"flex",flexDirection:"column",gap:4,marginTop:8}}>
              {f.crLocal.map(id=>{const i=idToIdx.get(id);return(
                <div key={id} style={{display:"flex",alignItems:"center",gap:8,fontSize:11.5,background:`${C.teal}12`,border:`1px solid ${C.teal}44`,borderRadius:6,padding:"5px 8px"}}>
                  <span style={{color:C.teal,fontSize:8}}>●</span>
                  <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:i!=null?C.textBright:C.textDim}}>{i!=null?lbl(i):"(record no longer in the collection)"}</span>
                  <button onClick={e=>{e.preventDefault();setF(p=>({...p,crLocal:p.crLocal.filter(x=>x!==id)}));}} title="Remove link" style={{...small,padding:"2px 8px",color:C.textDim}}>✕</button>
                </div>);})}
            </div>}
          </Field>
          <Field label="Reference list" span={4} hint={<>One reference per line — WoS style (<code>Garfield E, 2009, J INFORMETR, V3, P173, DOI 10.1016/j.joi.2009.03.009</code>), Scopus style, or just a DOI. Pasted DOIs are completed automatically (from the collection, Crossref or OpenAlex). Works outside the collection are kept for Cited Refs.</>}>
            <textarea style={{...inputStyle,minHeight:120,resize:"vertical",fontFamily:mono,fontSize:11}} value={f.refs} onChange={set("refs")} spellCheck={false}/>
            {(doiState.busy>0||doiState.done>0||doiState.failed.length>0)&&<div style={{fontSize:10.5,marginTop:4,color:C.textDim}}>
              {doiState.busy>0?<span style={{color:C.accent}}>⟳ Looking up {doiState.busy} DOI{doiState.busy===1?"":"s"}…</span>
                :doiState.done>0&&<span style={{color:C.teal}}>✓ {doiState.done} DOI{doiState.done===1?"":"s"} completed</span>}
              {doiState.failed.length>0&&<span style={{color:C.rose}}>{" · "}{doiState.failed.length} not found (kept as DOI lines){" "}
                <button onClick={e=>{e.preventDefault();retryDois();}} style={{...small,padding:"1px 8px",fontSize:10,color:C.rose,borderColor:`${C.rose}66`}}>Retry</button></span>}
            </div>}
            {refPreview.length>0&&<div style={{fontSize:10.5,color:C.textDim,marginTop:4}}>
              {refPreview.length} line{refPreview.length===1?"":"s"} · <span style={{color:matched.length?C.teal:C.textDim}}>{matched.length} {matched.length===1?"matches":"match"} a record in this collection</span>
              {matched.slice(0,5).map((m,k)=><div key={k} style={{color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><span style={{color:C.teal}}>●</span> {lbl(m.idx)}</div>)}
              {matched.length>5&&<div>…and {matched.length-5} more</div>}
            </div>}
          </Field>
          {(base?.crOaIds?.length>0)&&<div style={{gridColumn:"span 4",fontSize:10.5,color:C.textDim}}>This record also carries {base.crOaIds.length} OpenAlex references from the import; they are kept unchanged.</div>}
        </EditorSection>

        {(tried&&errors.length>0)&&<div style={{marginTop:18,padding:"10px 12px",border:`1px solid ${C.rose}66`,background:`${C.rose}12`,borderRadius:6,fontSize:11.5,color:C.rose}}>{errors.map((e,i)=><div key={i}>{e}</div>)}</div>}
        {warnings.length>0&&<div style={{marginTop:12,padding:"10px 12px",border:`1px solid ${C.accent}55`,background:`${C.accent}10`,borderRadius:6,fontSize:11.5,color:C.accent}}>{warnings.map((w,i)=><div key={i}>⚠ {w}</div>)}</div>}

        <div style={{display:"flex",alignItems:"center",gap:10,marginTop:22}}>
          <span style={{fontSize:10.5,color:C.textDim}}>Saving recomputes all statistics, LCS/LCR and the historiograph.</span>
          <button onClick={onCancel} style={{...small,marginLeft:"auto",color:C.textDim}}>Cancel</button>
          <button onClick={save} style={{...btnBase,background:C.accent,color:C.onAccent,fontSize:12,padding:"8px 18px"}}>{base?"Save changes":"Add record"}</button>
        </div>
      </div>
    </div>
  </div>);
}

/* ═══ UPLOAD SCREEN ═══ */
function UploadScreen({onData,saved,onResume,onDiscard}){
  const[dragging,setDragging]=useState(false);const[status,setStatus]=useState(null);const[progress,setProgress]=useState(0);
  const[dedupMode,setDedupMode]=useState("balanced");
  const fileRef=useRef(),folderRef=useRef();
  const processFiles=useCallback(async(fileList)=>{
    setStatus({msg:"Reading files…",type:"info"});setProgress(10);let allTexts=[];
    try{const files=Array.from(fileList);
      for(const zf of files.filter(f=>/\.zip$/i.test(f.name))){setStatus({msg:`Extracting ${zf.name}…`,type:"info"});allTexts.push(...await readZip(zf));}
      const others=files.filter(f=>/\.(txt|ciw|csv|json)$/i.test(f.name));
      for(let i=0;i<others.length;i++){setProgress(10+Math.round(i/others.length*40));allTexts.push({name:others[i].name,text:await others[i].text()});}
      if(!allTexts.length){setStatus({msg:"No supported files found.",type:"error"});setProgress(0);return;}
      setStatus({msg:`Detecting sources & parsing…`,type:"info"});setProgress(55);
      _oaLookup={};
      let allRecs=[];const srcLog={wos:0,scopus:0,openalex:0,biblioscope:0,unknown:0};const fileLog=[];
      for(const{name,text:t}of allTexts){const src=detectSource(t);if(!src){srcLog.unknown++;fileLog.push({name,src:null,n:0});continue;}
        let recs=parseFileText(t);const key=src==="openalex_json"||src==="openalex_csv"?"openalex":src;
        if(src!=="biblioscope")recs=recs.map(r=>({...r,_file:name}));
        const enrich=recs.length&&recs.every(r=>r._enrich);
        fileLog.push({name,src:key,n:recs.length,format:src,enrich});srcLog[key]+=recs.length;allRecs.push(...recs);}
      if(!allRecs.length){setStatus({msg:"No valid records found.",type:"error"});setProgress(0);return;}
      setStatus({msg:`Matching duplicates…`,type:"info"});setProgress(70);
      const dedup=deduplicateRecords(allRecs,dedupMode);
      allRecs=dedup.records;const deduped=dedup.stats.removed;const es=dedup.stats;
      if(es.enrichInput){srcLog.openalex-=es.enrichInput;}
      const enrMsg=es.enrichInput?` · ${es.enriched} enriched with open indicators${es.enrichUnmatched?` (${es.enrichUnmatched} augmenter record${es.enrichUnmatched===1?"":"s"} without a match)`:""}`:"";
      if(es.enrichInput&&!allRecs.length){setStatus({msg:"The Open Sources Augmenter file only adds indicators: load it together with the Web of Science or Scopus files it was made from.",type:"error"});setProgress(0);return;}
      setStatus({msg:`Aggregating ${allRecs.length} records…`,type:"info"});setProgress(85);
      setProgress(100);
      const srcSummary=Object.entries(srcLog).filter(([,c])=>c>0).map(([s,c])=>`${c} ${SRC_LABELS[s]||s}`).join(", ");
      setStatus({msg:`Done! ${allRecs.length} records: ${srcSummary}${deduped?` · ${deduped} duplicate${deduped>1?"s":""} merged`:""}${enrMsg}`,type:"info"});
      setTimeout(()=>onData({records:allRecs,dedupStats:dedup.stats,files:allTexts.length,fileLog}),400);
    }catch(e){console.error(e);setStatus({msg:`Error: ${e.message}`,type:"error"});setProgress(0);}
  },[onData,dedupMode]);
  const handleDrop=useCallback(e=>{e.preventDefault();setDragging(false);if(e.dataTransfer.files.length)processFiles(e.dataTransfer.files);},[processFiles]);
  return(
    <div style={{background:C.bg,color:C.text,minHeight:"100vh",fontFamily:"system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40}}>
      <h1 style={{fontSize:48,fontWeight:900,margin:0,fontFamily:"Georgia,'Times New Roman',serif",color:C.textBright}}>Biblio<span style={{color:C.accent}}>Scope</span><span style={{fontSize:11,fontWeight:400,fontFamily:mono,color:C.textDim,marginLeft:10,letterSpacing:1}}>v0.996</span></h1>
      <p style={{color:C.textDim,fontSize:14,marginTop:12,marginBottom:40,textAlign:"center",maxWidth:520,lineHeight:1.6}}>Bibliometric dashboard with local citation analysis and historiographs.<br/>Import from <span style={{color:SRC_COLORS.wos}}>Web of Science</span>, <span style={{color:SRC_COLORS.scopus}}>Scopus</span>, and <span style={{color:SRC_COLORS.openalex}}>OpenAlex</span> — or mix them.</p>
      {saved&&<div style={{width:"100%",maxWidth:560,marginBottom:20,background:C.card,border:`1px solid ${C.teal}55`,borderRadius:12,padding:"16px 20px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:220}}>
          <div style={{fontSize:13,color:C.textBright,fontWeight:600}}>Continue your saved collection</div>
          <div style={{fontSize:11,color:C.textDim,marginTop:3,fontFamily:mono}}>{(saved.count||0).toLocaleString()} records{saved.edits?` · ${saved.edits} added/edited`:""}{saved.removed?` · ${saved.removed} removed`:""} · saved {new Date(saved.savedAt).toLocaleString()}</div>
        </div>
        <button onClick={onResume} style={{background:C.teal,color:C.onAccent,border:"none",borderRadius:8,padding:"9px 18px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:mono}}>Resume</button>
        <button onClick={onDiscard} style={{background:"transparent",color:C.textDim,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 14px",fontSize:11,cursor:"pointer",fontFamily:mono}}>Discard</button>
        <div style={{width:"100%",fontSize:10,color:C.textDim}}>Loading new files below replaces the saved collection.</div>
      </div>}
      <div onDrop={handleDrop} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} style={{width:"100%",maxWidth:560,border:`2px dashed ${dragging?C.accent:C.border}`,borderRadius:16,padding:"48px 32px",background:dragging?`${C.accent}08`:C.card,transition:"all .25s",display:"flex",flexDirection:"column",alignItems:"center",gap:20}}>
        <div style={{fontSize:48,opacity:.4}}>{progress>0&&progress<100?"⏳":"📂"}</div>
        <div style={{textAlign:"center"}}><div style={{fontSize:15,color:C.textBright,fontWeight:600,marginBottom:6}}>Drop files here</div><div style={{fontSize:12,color:C.textDim}}>WoS (.txt/.ciw) · Scopus (.csv) · OpenAlex (.json/.csv) · or .zip</div></div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
          <input ref={fileRef} type="file" accept=".txt,.ciw,.csv,.json,.zip" multiple style={{display:"none"}} onChange={e=>{if(e.target.files.length)processFiles(e.target.files);}}/>
          <button onClick={()=>fileRef.current?.click()} style={{background:C.accent,color:C.onAccent,border:"none",borderRadius:8,padding:"10px 24px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:mono}}>Select Files</button>
          <input ref={folderRef} type="file" webkitdirectory="true" style={{display:"none"}} onChange={e=>{if(e.target.files.length)processFiles(e.target.files);}}/>
          <button onClick={()=>folderRef.current?.click()} style={{background:"transparent",color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"10px 24px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:mono}}>Select Folder</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,paddingTop:4,borderTop:`1px solid ${C.border}`,width:"100%"}}>
          <div style={{fontSize:10,color:C.textDim,fontFamily:mono,textTransform:"uppercase",letterSpacing:1.5,marginTop:8}}>Duplicate matching</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
            {[{id:"doi",l:"DOI only",d:"Most conservative — matches identical DOIs only"},
              {id:"balanced",l:"Balanced",d:"DOI + exact title, confirmed by shared author or year"},
              {id:"fuzzy",l:"Fuzzy",d:"Also matches near-identical titles (Dice ≥ 0.92)"}].map(m=>(
              <PillBtn key={m.id} active={dedupMode===m.id} onClick={()=>setDedupMode(m.id)} style={{fontSize:10,padding:"5px 12px"}}>{m.l}</PillBtn>
            ))}
          </div>
          <div style={{fontSize:10,color:C.textDim,textAlign:"center",maxWidth:400,lineHeight:1.5}}>
            {dedupMode==="doi"&&"Matches records sharing an identical DOI. Publications without a DOI are never merged."}
            {dedupMode==="balanced"&&"Matches by DOI, plus identical normalised titles confirmed by a shared author surname or a publication year within ±2."}
            {dedupMode==="fuzzy"&&"As Balanced, plus near-identical titles (Dice ≥ 0.92). Catches typographic and translation variants; slightly higher false-positive risk."}
          </div>
        </div>
        {progress>0&&<div style={{width:"100%",maxWidth:400}}><div style={{height:6,background:C.bg,borderRadius:3,overflow:"hidden"}}><div style={{width:`${progress}%`,height:"100%",borderRadius:3,background:`linear-gradient(90deg,${C.accent},${C.teal})`,transition:"width .4s"}}/></div></div>}
        {status&&<div style={{fontSize:12,fontFamily:mono,color:status.type==="error"?C.rose:C.teal,textAlign:"center"}}>{status.msg}</div>}
      </div>
      <div style={{marginTop:32,maxWidth:560,fontSize:11,color:C.textDim,lineHeight:1.7,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 22px"}}>
        <div style={{fontWeight:700,color:C.text,marginBottom:8,fontSize:12}}>Supported sources & formats</div>
        <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:150}}><div style={{color:SRC_COLORS.wos,fontWeight:700,marginBottom:4}}>Web of Science</div><div>Plain Text (Full Record and Cited References)</div></div>
          <div style={{flex:1,minWidth:150}}><div style={{color:SRC_COLORS.scopus,fontWeight:700,marginBottom:4}}>Scopus</div><div>CSV with References checked</div></div>
          <div style={{flex:1,minWidth:150}}><div style={{color:SRC_COLORS.openalex,fontWeight:700,marginBottom:4}}>OpenAlex</div><div>Augmented JSON (preferred) or CSV</div></div>
        </div>
        <div style={{marginTop:10,color:C.teal,fontSize:10}}>Files from different sources can be mixed — duplicates removed by DOI. A collection saved with <b>Export</b> can be loaded here too, alone or together with new files.</div>
      </div>
    </div>
  );
}

/* ═══ DASHBOARD ═══ */
const TABS=[
  {id:"overview",label:"Overview"},
  {id:"preview",label:"Preview"},
  {id:"collection",label:"Collection"},
  {id:"journals",label:"Sources & Authors"},
  {id:"subjects",label:"Subject Map"},
  {id:"keywords",label:"Keywords"},
  {id:"network",label:"Networks"},
  {id:"histcite",label:"Historiograph"},
  {id:"papers",label:"Top Papers"},
  {id:"citedrefs",label:"Cited Refs"},
  {id:"comparison",label:"Comparison"},
  {id:"indicators",label:"Indicators"},
];

function SourceBadges({srcCounts,onClick}){if(!srcCounts||!srcCounts.length)return null;return(<div style={{display:"flex",gap:12,alignItems:"center"}}>{srcCounts.map(({name,count})=>(<span key={name} role="button" onClick={()=>onClick&&onClick(name)} title={`List the ${count} records from ${SRC_LABELS[name]||name} (a merged record counts for each of its databases)`} style={{fontSize:11,fontFamily:mono,color:SRC_COLORS[name]||C.textDim,cursor:onClick?"pointer":"default",textDecoration:onClick?"underline":"none",textDecorationColor:`${SRC_COLORS[name]||C.textDim}55`,textUnderlineOffset:3}}><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:SRC_COLORS[name]||C.textDim,marginRight:4,opacity:.7}}/>{count} {SRC_LABELS[name]||name}</span>))}</div>);}

/* ═══ NETWORK ANALYSES (0.5) ═══
   Four analyses share one builder. Thresholds work like VOSviewer's: a node is
   kept only if it has at least minDocs documents and minCites citations.
   Co-citation nodes are counted by citing documents in the collection. */
const NET_ANALYSES=[
  {id:"coupling",label:"Bibliographic coupling",units:["article","author","journal","affiliation","affiliation_sub"]},
  {id:"cocitation",label:"Co-citation",units:["article","author","journal"]},
  {id:"coauthorship",label:"Co-authorship",units:["article","author","journal","affiliation","affiliation_sub"]},
  {id:"keywords",label:"Keyword co-occurrence",units:["keyword"]},
];
const NET_UNITS={article:"Document",author:"Author",journal:"Source",affiliation:"Affiliation",affiliation_sub:"Affiliation with subdivision",keyword:"Keyword"};

// Heuristic: "Univ Borås, Dept X, Borås, Sweden" (WoS, organisation first) or
// "Dept X, Univ Borås, Borås, Sweden" (Scopus, department first). City and country are dropped.
function parseAffiliation(a,src){
  // postal codes standing alone ("100081") would otherwise be read as the city
  const p=String(a||"").replace(/^\[.*?\]\s*/,"").split(",").map(x=>x.trim()).filter(x=>x&&!/^[\d\s-]+$/.test(x));
  if(!p.length)return{org:"",sub:""};
  const core=p.length>=3?p.slice(0,-2):p.slice(0,-1);
  if(!core.length)return{org:p[0],sub:""};
  if(src==="scopus")return{org:core[core.length-1],sub:core.length>1?core[0]:""};
  return{org:core[0],sub:core[1]||""};
}
function recordUnitKeys(r,unit){
  switch(unit){
    case "author":return[...new Set(r.au||[])].filter(Boolean);
    case "journal":return r.so?[r.so]:[];
    case "affiliation":return[...new Set((r.c1Full||[]).map(a=>parseAffiliation(a,r._src).org).filter(Boolean))];
    case "affiliation_sub":return[...new Set((r.c1Full||[]).map(a=>{const p=parseAffiliation(a,r._src);return p.sub?`${p.org}, ${p.sub}`:"";}).filter(Boolean))];
    case "keyword":return[...new Set([...(r.de||[]),...(r.id||[])].map(k=>k.toLowerCase().trim()).filter(Boolean))];
    default:return[];
  }
}
const nvArticleLabel=r=>`${((r.au&&r.au[0])||"?").split(",")[0]} ${r.py||"n.d."}`;
const nvRefKey=ref=>ref.localIdx!=null?`local:${ref.localIdx}`:(ref.doi?`doi:${ref.doi}`:ref.rawKey);

function buildAnalysisNetwork({records,citedRefs,analysis,unit,minDocs,minCites,maxNodes}){
  const nodes=new Map();          // key → {docs:Set<record idx>, cites, label}
  const addNode=(key,label,idx,cites)=>{
    let n=nodes.get(key);if(!n){n={docs:new Set(),cites:0,label:label||key};nodes.set(key,n);}
    n.docs.add(idx);n.cites+=cites||0;
  };
  // pairsFn(keep) returns Map("a\0b" → weight) using only nodes in keep
  let pairsFn=()=>new Map();

  if(analysis==="cocitation"){
    const canon=unit==="article"?null:makeNameCanon(citedRefs.flatMap(r=>Array(r.citers.size).fill(unit==="author"?r.author:r.source)),unit==="author"?"author":"source");
    const groupOf=ref=>unit==="article"?nvRefKey(ref):canon.key(unit==="author"?ref.author:ref.source);
    const citerGroups=new Map();   // citing record → Set(group)
    for(const ref of citedRefs){
      const g=groupOf(ref);if(!g)continue;
      const cites=(unit==="article"&&ref.localIdx!=null&&records[ref.localIdx])?records[ref.localIdx].tc||0:0;
      let n=nodes.get(g);
      if(!n){n={docs:new Set(),cites:0,label:unit==="article"?(ref.display||g):canon.label(g)};nodes.set(g,n);}
      for(const c of ref.citers){n.docs.add(c);if(!citerGroups.has(c))citerGroups.set(c,new Set());citerGroups.get(c).add(g);}
      n.cites=Math.max(n.cites,cites);
    }
    pairsFn=keep=>{const m=new Map();
      for(const set of citerGroups.values()){const arr=[...set].filter(g=>keep.has(g));
        for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){const k=arr[i]<arr[j]?arr[i]+"\0"+arr[j]:arr[j]+"\0"+arr[i];m.set(k,(m.get(k)||0)+1);}}
      return m;};
  }
  else if(analysis==="coupling"){
    const refsOf=records.map(()=>new Set());
    for(const ref of citedRefs){const k=nvRefKey(ref);for(const c of ref.citers)refsOf[c].add(k);}
    const ents=new Map();          // entity → Set(record idx)
    records.forEach((r,i)=>{
      const keys=unit==="article"?[String(i)]:recordUnitKeys(r,unit);
      for(const k of keys){if(!ents.has(k))ents.set(k,new Set());ents.get(k).add(i);}
    });
    const refToEnt=new Map();
    for(const [k,recs] of ents){
      const refs=new Set();for(const i of recs)for(const r of refsOf[i])refs.add(r);
      for(const r of refs){if(!refToEnt.has(r))refToEnt.set(r,[]);refToEnt.get(r).push(k);}
      let cites=0;for(const i of recs)cites+=records[i].tc||0;
      nodes.set(k,{docs:recs,cites,label:unit==="article"?nvArticleLabel(records[+k]):k});
    }
    pairsFn=keep=>{const m=new Map();
      for(const list0 of refToEnt.values()){const list=list0.filter(k=>keep.has(k));
        for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const k=list[i]<list[j]?list[i]+"\0"+list[j]:list[j]+"\0"+list[i];m.set(k,(m.get(k)||0)+1);}}
      return m;};
  }
  else if(analysis==="coauthorship"&&(unit==="article"||unit==="journal")){
    // articles (or journals) that share at least one author; weight = number of shared authors
    const authorRecs=new Map();
    records.forEach((r,i)=>{for(const a of new Set(r.au||[])){if(!authorRecs.has(a))authorRecs.set(a,[]);authorRecs.get(a).push(i);}});
    records.forEach((r,i)=>{const key=unit==="article"?String(i):r.so;if(!key)return;
      addNode(key,unit==="article"?nvArticleLabel(r):key,i,r.tc);});
    pairsFn=keep=>{const m=new Map();
      for(const recs of authorRecs.values()){
        const items=(unit==="article"?recs.map(String):[...new Set(recs.map(i=>records[i].so).filter(Boolean))]).filter(k=>keep.has(k));
        for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const k=items[i]<items[j]?items[i]+"\0"+items[j]:items[j]+"\0"+items[i];m.set(k,(m.get(k)||0)+1);}}
      return m;};
  }
  else{
    // entities on the same record: co-authorship (authors, affiliations) or keyword co-occurrence
    records.forEach((r,i)=>{for(const k of recordUnitKeys(r,unit))addNode(k,k,i,r.tc);});
    pairsFn=keep=>{const m=new Map();
      records.forEach(r=>{const list=recordUnitKeys(r,unit).filter(k=>keep.has(k));
        for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const k=list[i]<list[j]?list[i]+"\0"+list[j]:list[j]+"\0"+list[i];m.set(k,(m.get(k)||0)+1);}});
      return m;};
  }

  const all=[...nodes.entries()].map(([k,n])=>({k,label:n.label,docs:n.docs.size,cites:n.cites}));
  const passing=all.filter(n=>n.docs>=minDocs&&n.cites>=minCites)
    .sort((a,b)=>b.docs-a.docs||b.cites-a.cites||String(a.label).localeCompare(String(b.label)));
  const kept=passing.slice(0,maxNodes);
  const keep=new Set(kept.map(n=>n.k));
  const pairs=pairsFn(keep);
  const allEdges=[...pairs.entries()].filter(([k,w])=>w>0).sort((a,b)=>b[1]-a[1]);
  const edges=allEdges.slice(0,1500);   // drawn; the layout uses allEdges
  const maxW=allEdges.length?allEdges[0][1]:1;
  const idOf=new Map(),used=new Map();
  for(const n of kept){const base=String(n.label);const c=used.get(base)||0;used.set(base,c+1);idOf.set(n.k,c?`${base} (${c+1})`:base);}
  const network={
    nodes:kept.map(n=>({id:idOf.get(n.k),freq:n.docs,count:n.docs})),
    links:edges.map(([k,w])=>{const[a,b]=k.split("\0");return{source:idOf.get(a),target:idOf.get(b),value:1+5*w/maxW,w};}),
    layoutLinks:allEdges.map(([k,w])=>{const[a,b]=k.split("\0");return{source:idOf.get(a),target:idOf.get(b),w};}),
  };
  return{network,candidates:all.length,total:passing.length,shown:kept.length,edges:edges.length,allEdges:allEdges.length};
}

/* ═══ LAYOUTS (0.6) ═══
   ForceAtlas2: Jacomy et al. 2014 force model (degree-weighted repulsion,
   LinLog attraction, gravity), with a cooling step length instead of Gephi's
   adaptive speed. VOS: minimises Σ s_ij·|x_i − x_j|² under a normalisation
   constraint, which is solved in closed form by the two smallest non-trivial
   eigenvectors of the graph Laplacian (power iteration). Positions are returned
   normalised to [-1, 1]. */
function layoutRng(seed){let s=(seed>>>0)||1;return()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};}

function layoutForceAtlas2(N,E,opt){
  const att=opt.attr,rp=opt.rep,kg=opt.grav;
  const rnd=layoutRng(12345+N);
  const X=new Float64Array(N),Y=new Float64Array(N),FX=new Float64Array(N),FY=new Float64Array(N);
  const deg=new Float64Array(N);
  for(const e of E){deg[e.s]+=1;deg[e.t]+=1;}
  const mass=deg.map(d=>d+1);
  for(let i=0;i<N;i++){X[i]=(rnd()-.5)*400;Y[i]=(rnd()-.5)*400;}
  const kr=20*rp,cap=12,iters=N>300?350:500;
  for(let it=0;it<iters;it++){
    FX.fill(0);FY.fill(0);
    for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){
      const dx=X[i]-X[j],dy=Y[i]-Y[j];const d2=Math.max(dx*dx+dy*dy,1e-4);
      const f=kr*mass[i]*mass[j]/d2;
      FX[i]+=dx*f;FY[i]+=dy*f;FX[j]-=dx*f;FY[j]-=dy*f;
    }
    for(const e of E){
      const dx=X[e.t]-X[e.s],dy=Y[e.t]-Y[e.s];const d=Math.sqrt(dx*dx+dy*dy)||1e-2;
      const f=att*e.w*Math.log(1+d)/d;
      FX[e.s]+=dx*f;FY[e.s]+=dy*f;FX[e.t]-=dx*f;FY[e.t]-=dy*f;
    }
    for(let i=0;i<N;i++){
      const d=Math.sqrt(X[i]*X[i]+Y[i]*Y[i])||1e-2;
      FX[i]-=X[i]/d*kg*mass[i];FY[i]-=Y[i]/d*kg*mass[i];
    }
    const cool=1-it/iters;
    for(let i=0;i<N;i++){
      const fm=Math.sqrt(FX[i]*FX[i]+FY[i]*FY[i])||1e-9;
      const step=Math.min(fm,cap*(0.1+0.9*cool))/fm;
      X[i]+=FX[i]*step;Y[i]+=FY[i]*step;
    }
  }
  const P=[];for(let i=0;i<N;i++)P.push([X[i],Y[i]]);
  return P;
}

function layoutVOS(N,E,opt){
  // VOS layout as in VOSviewer (CWTS networkanalysis, VOSLayoutAlgorithm): minimise
  //   V = Σ_links s_ij·f(d_ij,a) − Σ_pairs f(d_ij,r),  f(d,p)=d^p/p (p≠0), ln d (p=0), a > r.
  // s_ij is the association strength 2m·c_ij/(k_i·k_j) (Van Eck & Waltman 2009) or the raw count.
  // Optimised node by node with normalised gradient steps (step 1 → 0.001, reduction 0.75).
  const a=opt.vosA??2,r=opt.vosR??1;
  const rnd=layoutRng(777+N);
  const k=new Float64Array(N);let m=0;
  for(const e of E){k[e.s]+=e.w;k[e.t]+=e.w;m+=e.w;}
  const active=[];for(let i=0;i<N;i++)if(k[i]>0)active.push(i);
  const P=Array.from({length:N},()=>[0,0]);
  const M=active.length;
  const pos=new Int32Array(N).fill(-1);active.forEach((n,i)=>pos[n]=i);
  if(M>=2){
    const nb=Array.from({length:M},()=>[]);
    let sumS=0;
    for(const e of E){const i=pos[e.s],j=pos[e.t];if(i<0||j<0)continue;
      const s=opt.norm==="none"?e.w:2*m*e.w/(k[e.s]*k[e.t]);
      nb[i].push([j,s]);nb[j].push([i,s]);sumS+=s;}
    // scaling s only rescales the map (a > r), so scale to a mean of 1 per node pair
    const sc=(M*(M-1)/2)/sumS;
    for(const l of nb)for(const x of l)x[1]*=sc;
    // components: union–find. Without links between components the repulsion pushes them
    // apart without limit, so a small attraction between all pairs is added (VOSviewer's edgeWeightIncrement)
    const par=Int32Array.from({length:M},(_,i)=>i);const fnd=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;};
    nb.forEach((l,i)=>l.forEach(([j])=>{par[fnd(i)]=fnd(j);}));
    let comps=0;for(let i=0;i<M;i++)if(fnd(i)===i)comps++;
    const eps=comps>1?0.01:0;
    const pw=(d,p)=>p===2?d*d:Math.pow(d,p);
    const f=(d,p)=>p===0?Math.log(d):pw(d,p)/p;
    const quality=(X,Y)=>{let q=0;
      for(let i=0;i<M;i++){
        for(const [j,s] of nb[i])if(j>i){const d=Math.max(1e-9,Math.hypot(X[i]-X[j],Y[i]-Y[j]));q+=s*f(d,a);}
        for(let j=i+1;j<M;j++){const d=Math.max(1e-9,Math.hypot(X[i]-X[j],Y[i]-Y[j]));q-=f(d,r);if(eps)q+=eps*f(d,a);}
      }return q;};
    const run=(X,Y)=>{
      let step=1,q=quality(X,Y),nImp=0;
      const maxIt=M>300?250:M>150?500:1000;
      const order=Int32Array.from({length:M},(_,i)=>i);
      for(let it=0;it<maxIt&&step>=0.001;it++){
        for(let i=M-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=order[i];order[i]=order[j];order[j]=t;}
        for(const i of order){
          let gx=0,gy=0;
          for(const [j,s] of nb[i]){const dx=X[i]-X[j],dy=Y[i]-Y[j];const d=Math.max(1e-9,Math.hypot(dx,dy));const c=s*pw(d,a-2);gx+=c*dx;gy+=c*dy;}
          for(let j=0;j<M;j++){if(j===i)continue;const dx=X[i]-X[j],dy=Y[i]-Y[j];const d=Math.max(1e-9,Math.hypot(dx,dy));
            let c=-pw(d,r-2);if(eps)c+=eps*pw(d,a-2);gx+=c*dx;gy+=c*dy;}
          const g=Math.hypot(gx,gy);if(g>0){X[i]-=step*gx/g;Y[i]-=step*gy/g;}
        }
        const nq=quality(X,Y);
        if(nq<q){nImp++;if(nImp>=5){step/=0.75;nImp=0;}}else{step*=0.75;nImp=0;}
        q=nq;
      }
      return q;};
    const starts=M<=150?4:M<=300?2:1;
    let best=null,bestQ=Infinity;
    for(let st=0;st<starts;st++){
      const X=new Float64Array(M),Y=new Float64Array(M);
      for(let i=0;i<M;i++){X[i]=(rnd()-.5)*2;Y[i]=(rnd()-.5)*2;}
      const q=run(X,Y);
      if(q<bestQ){bestQ=q;best=[X,Y];}
    }
    let cx=0,cy=0;for(let i=0;i<M;i++){cx+=best[0][i];cy+=best[1][i];}cx/=M;cy/=M;
    active.forEach((n,i)=>{P[n]=[best[0][i]-cx,best[1][i]-cy];});
  }
  let mx=1e-9;for(const i of active)mx=Math.max(mx,Math.abs(P[i][0]),Math.abs(P[i][1]));
  for(const i of active)P[i]=[P[i][0]/mx,P[i][1]/mx];
  const iso=[];for(let i=0;i<N;i++)if(k[i]===0)iso.push(i);
  iso.forEach((n,j)=>{const ang=2*Math.PI*j/Math.max(1,iso.length);P[n]=[1.1*Math.cos(ang),1.1*Math.sin(ang)];});
  return P;
}

function layoutStress(N,E){
  // Stress majorisation (SMACOF): positions minimise Σ w_ij (|x_i−x_j| − d_ij)² with d_ij the
  // shortest-path distance in the network and w_ij = 1/d_ij². Disconnected pairs get maxD+1.
  const adj=Array.from({length:N},()=>[]);
  for(const e of E){adj[e.s].push(e.t);adj[e.t].push(e.s);}
  const D=new Float64Array(N*N).fill(-1);
  let maxD=0;
  const hop=new Int32Array(N),queue=new Int32Array(N);
  for(let s=0;s<N;s++){
    hop.fill(-1);hop[s]=0;let qh=0,qt=0;queue[qt++]=s;
    while(qh<qt){const u=queue[qh++];for(const v of adj[u])if(hop[v]<0){hop[v]=hop[u]+1;queue[qt++]=v;}}
    for(let v=0;v<N;v++)if(hop[v]>=0){D[s*N+v]=hop[v];if(hop[v]>maxD)maxD=hop[v];}
  }
  const far=maxD+1;
  const rnd=layoutRng(4242+N);
  const X=new Float64Array(N),Y=new Float64Array(N);
  for(let i=0;i<N;i++){const a=2*Math.PI*i/Math.max(1,N)+rnd()*0.01;X[i]=Math.cos(a);Y[i]=Math.sin(a);}
  const NX=new Float64Array(N),NY=new Float64Array(N);
  for(let it=0;it<300;it++){
    for(let i=0;i<N;i++){
      let sx=0,sy=0,sw=0;
      for(let j=0;j<N;j++){
        if(j===i)continue;
        let d=D[i*N+j];if(d<0)d=far;
        const w=1/(d*d);
        const dx=X[i]-X[j],dy=Y[i]-Y[j];const len=Math.sqrt(dx*dx+dy*dy)||1e-6;
        sx+=w*(X[j]+d*dx/len);sy+=w*(Y[j]+d*dy/len);sw+=w;
      }
      NX[i]=sw?sx/sw:X[i];NY[i]=sw?sy/sw:Y[i];
    }
    X.set(NX);Y.set(NY);
  }
  return Array.from({length:N},(_,i)=>[X[i],Y[i]]);
}

/* ═══ CLUSTERING (0.8) ═══
   VOSviewer-style clustering: maximise Σ_ij δ(c_i,c_j)(s_ij − γ) with s_ij the association strength.
   With s_ij = 2m·c_ij/(k_i·k_j) this equals modularity with resolution γ, which is optimised here with
   the Louvain method (local moving + aggregation), several random starts. Clusters smaller than the
   minimum size are merged into the cluster they are most strongly linked to; isolated nodes stay unclustered. */
const CLUSTER_PAL=["#e15759","#59a14f","#4e79a7","#edc948","#b07aa1","#76b7b2","#f28e2b","#9c755f","#ff9da7","#86bc86","#a0cbe8","#d4a6c8","#bab0ac","#8cd17d"];
function clusterColor(c){return c<0?"#6b7280":CLUSTER_PAL[c%CLUSTER_PAL.length];}

function louvain(N,adj,k,m2,gamma,rnd){
  // adj: array of Map(j → w) (no self loops at level 0); returns community index per node
  let level={N,adj,self:new Float64Array(N),k:Float64Array.from(k)};
  let member=Int32Array.from({length:N},(_,i)=>i);
  for(let pass=0;pass<20;pass++){
    const {N:n,adj:A,self,k:K}=level;
    const com=Int32Array.from({length:n},(_,i)=>i);
    const tot=Float64Array.from(K);
    let moved=true,any=false,rounds=0;
    const order=Int32Array.from({length:n},(_,i)=>i);
    while(moved&&rounds<50){
      moved=false;rounds++;
      for(let i=n-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=order[i];order[i]=order[j];order[j]=t;}
      for(const i of order){
        const ci=com[i];const wc=new Map();
        for(const [j,w] of A[i]){const cj=com[j];wc.set(cj,(wc.get(cj)||0)+w);}
        tot[ci]-=K[i];
        let best=ci,bestG=(wc.get(ci)||0)-gamma*K[i]*tot[ci]/m2;
        for(const [c,w] of wc){if(c===ci)continue;const g=w-gamma*K[i]*tot[c]/m2;if(g>bestG+1e-12){bestG=g;best=c;}}
        tot[best]+=K[i];
        if(best!==ci){com[i]=best;moved=true;any=true;}
      }
    }
    // renumber and project to original nodes
    const map=new Map();let nc=0;for(let i=0;i<n;i++){if(!map.has(com[i]))map.set(com[i],nc++);com[i]=map.get(com[i]);}
    for(let i=0;i<N;i++)member[i]=com[member[i]];
    if(!any||nc===n)break;
    // aggregate
    const nAdj=Array.from({length:nc},()=>new Map());const nSelf=new Float64Array(nc);const nK=new Float64Array(nc);
    for(let i=0;i<n;i++){const ci=com[i];nK[ci]+=K[i];nSelf[ci]+=self[i];
      for(const [j,w] of A[i]){const cj=com[j];if(ci===cj)nSelf[ci]+=w;else nAdj[ci].set(cj,(nAdj[ci].get(cj)||0)+w);}}
    level={N:nc,adj:nAdj,self:nSelf,k:nK};
  }
  return member;
}

function clusterNetwork(network,{resolution=1,minSize=1,starts=10}={}){
  const nodes=network.nodes,N=nodes.length;
  const idx=new Map(nodes.map((n,i)=>[n.id,i]));
  const adj=Array.from({length:N},()=>new Map());const k=new Float64Array(N);
  for(const l of (network.layoutLinks||network.links)){const s=idx.get(l.source),t=idx.get(l.target);if(s==null||t==null||s===t)continue;
    const w=l.w??l.value??1;adj[s].set(t,(adj[s].get(t)||0)+w);adj[t].set(s,(adj[t].get(s)||0)+w);k[s]+=w;k[t]+=w;}
  const m2=k.reduce((a,b)=>a+b,0);
  const assign=new Int32Array(N).fill(-1);
  if(m2>0){
    const rnd=layoutRng(9001+N);
    const quality=c=>{const inn=new Map(),tot=new Map();
      for(let i=0;i<N;i++){tot.set(c[i],(tot.get(c[i])||0)+k[i]);for(const [j,w] of adj[i])if(c[j]===c[i])inn.set(c[i],(inn.get(c[i])||0)+w);}
      let q=0;for(const [cc,t] of tot)q+=(inn.get(cc)||0)/m2-resolution*(t/m2)*(t/m2);return q;};
    let best=null,bestQ=-Infinity;
    for(let s=0;s<starts;s++){const c=louvain(N,adj,k,m2,resolution,rnd);const q=quality(c);if(q>bestQ){bestQ=q;best=c;}}
    for(let i=0;i<N;i++)if(k[i]>0)assign[i]=best[i];
    // merge clusters below the minimum size into the cluster with the strongest normalised link
    for(let guard=0;guard<N;guard++){
      const size=new Map(),kc=new Map();
      for(let i=0;i<N;i++)if(assign[i]>=0){size.set(assign[i],(size.get(assign[i])||0)+1);kc.set(assign[i],(kc.get(assign[i])||0)+k[i]);}
      const small=[...size].filter(([c,n])=>n<minSize).sort((a,b)=>a[1]-b[1]);
      if(!small.length)break;
      const c0=small[0][0];const link=new Map();
      for(let i=0;i<N;i++)if(assign[i]===c0)for(const [j,w] of adj[i]){const cj=assign[j];if(cj>=0&&cj!==c0)link.set(cj,(link.get(cj)||0)+w);}
      let target=-1,bw=0;for(const [c,w] of link){const v=w/kc.get(c);if(v>bw){bw=v;target=c;}}
      for(let i=0;i<N;i++)if(assign[i]===c0)assign[i]=target;   // −1 if no links: left unclustered
    }
  }
  // number clusters by size, largest first
  const size=new Map();for(let i=0;i<N;i++)if(assign[i]>=0)size.set(assign[i],(size.get(assign[i])||0)+1);
  const order=[...size].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);const ren=new Map(order.map((c,i)=>[c,i]));
  const byId=new Map();const info=order.map((c,i)=>({id:i,size:size.get(c),members:[]}));
  nodes.forEach((n,i)=>{const c=assign[i]>=0?ren.get(assign[i]):-1;byId.set(n.id,c);if(c>=0)info[c].members.push(n);});
  info.forEach(c=>c.members.sort((a,b)=>(b.freq||b.count||1)-(a.freq||a.count||1)));
  const unclustered=nodes.filter(n=>byId.get(n.id)<0).length;
  return{byId,clusters:info,unclustered};
}

function layoutNetwork(network,method,opt){
  const N=network.nodes.length;
  const idx=new Map(network.nodes.map((n,i)=>[n.id,i]));
  // raw link counts (w) over all links; ForceAtlas2 gets them rescaled to 1–6 as in 0.6
  const L=network.layoutLinks||network.links;
  const E=L.map(l=>({s:idx.get(l.source),t:idx.get(l.target),w:l.w??l.value??1})).filter(e=>e.s!=null&&e.t!=null&&e.s!==e.t);
  const maxW=E.reduce((m,e)=>Math.max(m,e.w),1);
  const P=method==="stress"?layoutStress(N,E):method==="vos"?layoutVOS(N,E,opt):layoutForceAtlas2(N,E.map(e=>({...e,w:1+5*e.w/maxW})),opt);
  let m=1e-9;for(const [x,y] of P)m=Math.max(m,Math.abs(x),Math.abs(y));
  return{nodes:network.nodes.map((n,i)=>({...n,x:P[i][0]/m,y:P[i][1]/m})),links:network.links};
}

// Renders network positions (x, y in [-1, 1]) with zoom and pan. Nodes can be dragged, selected and nudged.
// Positions are drawn in a separate effect so the zoom state survives while a node is dragged.
function StaticNetwork({network,w,h,overrides,selected,onMove,onSelect,clusters,scale=1,labelSize=9,sizeVal=null}){
  const sr=useRef(),linkSel=useRef(),nodeSel=useRef(),posRef=useRef(new Map());
  const moveRef=useRef(onMove),selRef=useRef(onSelect);
  moveRef.current=onMove;selRef.current=onSelect;
  const sc=Math.min(w,h)*0.44;
  const pos=useMemo(()=>network.nodes.map(n=>{const o=overrides[n.id];return o?{...n,x:o.x,y:o.y}:n;}),[network,overrides]);

  useEffect(()=>{
    if(!sr.current)return;
    const svg0=d3.select(sr.current);svg0.selectAll("*").remove();
    if(!network.nodes.length)return;
    const g=svg0.append("g");
    const zoomF=d3.zoom().scaleExtent([.3,8]).on("zoom",e=>g.attr("transform",e.transform));
    svg0.call(zoomF).on("dblclick.zoom",()=>svg0.transition().duration(500).call(zoomF.transform,d3.zoomIdentity));
    svg0.on("click",()=>selRef.current(null));
    svg0.append("text").attr("x",w-8).attr("y",16).attr("text-anchor","end").attr("fill",C.textDim).attr("font-size",9).attr("font-family",mono).attr("opacity",.5).text("scroll to zoom · drag background to pan · drag node to move");
    const maxF=Math.max(...network.nodes.map(n=>n.freq||n.count||1));
    const rS=nodeRadiusScale(maxF);
    const color=d3.scaleOrdinal(PAL);
    linkSel.current=g.append("g").selectAll("line").data(network.links).join("line")
      .attr("stroke",C.border).attr("stroke-width",d=>Math.max(.5,d.value/2)).attr("stroke-opacity",.5);
    const nodeG=g.append("g").selectAll("g").data(network.nodes).join("g").style("cursor","move")
      .call(d3.drag()
        .on("start",(e,d)=>{d.__sx=e.x;d.__sy=e.y;const p=posRef.current.get(d.id)||d;d.__bx=p.x;d.__by=p.y;selRef.current(d.id);})
        .on("drag",(e,d)=>{moveRef.current(d.id,d.__bx+(e.x-d.__sx)/sc,d.__by+(e.y-d.__sy)/sc);}))
      .on("click",(e,d)=>{e.stopPropagation();selRef.current(d.id);});
    nodeG.append("circle").attr("opacity",.85).attr("stroke",C.bg).attr("stroke-width",1.5);
    nodeG.append("title").text(d=>`${d.id} (${d.freq||d.count||1})`);
    nodeG.append("text").text(d=>d.id.length>22?d.id.slice(0,20)+"…":d.id).attr("text-anchor","middle").attr("fill",C.text).attr("pointer-events","none");
    nodeSel.current=nodeG;
  },[network,w,h]);

  // Size, label size and cluster colours are set separately so the zoom is kept when they change
  useEffect(()=>{
    if(!nodeSel.current||!linkSel.current)return;
    const rF=nodeRadiusFn(network.nodes,sizeVal);
    const cl=id=>clusters?clusters.get(id):undefined;
    nodeSel.current.select("circle").attr("r",d=>rF(d)*scale).attr("fill",d=>{const c=cl(d.id);return c==null?C.textDim:clusterColor(c);});
    nodeSel.current.select("text").attr("font-size",labelSize).attr("dy",d=>-(rF(d)*scale+3));
    linkSel.current.attr("stroke",d=>{const a=cl(d.source);return a!=null&&a>=0&&a===cl(d.target)?clusterColor(a):C.border;})
      .attr("stroke-opacity",d=>{const a=cl(d.source);return a!=null&&a>=0&&a===cl(d.target)?.4:.3;});
  },[network,w,h,clusters,scale,labelSize,sizeVal]);

  useEffect(()=>{
    if(!sr.current||!nodeSel.current||!linkSel.current)return;
    const P=new Map(pos.map(n=>[n.id,n]));
    posRef.current=P;
    const X=x=>w/2+x*sc,Y=y=>h/2+y*sc;
    linkSel.current
      .attr("x1",d=>X(P.get(d.source).x)).attr("y1",d=>Y(P.get(d.source).y))
      .attr("x2",d=>X(P.get(d.target).x)).attr("y2",d=>Y(P.get(d.target).y));
    nodeSel.current.attr("transform",d=>{const p=P.get(d.id);return `translate(${X(p.x)},${Y(p.y)})`;})
      .select("circle").attr("stroke",d=>d.id===selected?C.accent:C.bg).attr("stroke-width",d=>d.id===selected?3:1.5);
  },[pos,selected,w,h,sc]);

  return <svg ref={sr} width={w} height={h} style={{display:"block",maxWidth:"100%"}}/>;
}

// Radius scale shared by drawing and overlap removal
function nodeRadiusScale(maxF){return d3.scaleSqrt().domain([1,Math.max(1,maxF)]).range([4,18]);}

// Keep the largest connected component, all connected components, or every node (incl. nodes without links)
function filterComponents(network,mode){
  const ids=network.nodes.map(n=>n.id),idx=new Map(ids.map((id,i)=>[id,i]));
  const par=Int32Array.from(ids,(_,i)=>i);const f=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;};
  const deg=new Int32Array(ids.length);
  for(const l of (network.layoutLinks||network.links)){const a=idx.get(l.source),b=idx.get(l.target);if(a==null||b==null||a===b)continue;par[f(a)]=f(b);deg[a]++;deg[b]++;}
  const size=new Map();ids.forEach((_,i)=>{if(deg[i]){const r=f(i);size.set(r,(size.get(r)||0)+1);}});
  const isolates=ids.filter((_,i)=>!deg[i]).length;
  let mainRoot=-1,mainSize=0;for(const[r,n]of size)if(n>mainSize){mainSize=n;mainRoot=r;}
  const info={components:size.size,isolates,main:mainSize,total:ids.length};
  if(mode==="full")return{network,info};
  const keep=new Set(ids.filter((_,i)=>deg[i]&&(mode==="all"||f(i)===mainRoot)));
  const L=arr=>arr&&arr.filter(l=>keep.has(l.source)&&keep.has(l.target));
  return{network:{...network,nodes:network.nodes.filter(n=>keep.has(n.id)),links:L(network.links),layoutLinks:L(network.layoutLinks)},info};
}
// Push overlapping circles apart. k (0–1) sets how much of each overlap is removed; k=1 removes it fully.
function reduceOverlap(nodes,k,sc,radius){
  const P=nodes.map(n=>({id:n.id,x:n.x*sc,y:n.y*sc,r:radius(n)+3}));
  for(let it=0;it<200;it++){
    let moved=false;
    for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){
      const a=P[i],b=P[j],need=(a.r+b.r)*k;
      let dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy);
      if(d>=need-0.01)continue;
      if(d<1e-6){const ang=((i*7+j*13)%360)*Math.PI/180;dx=Math.cos(ang);dy=Math.sin(ang);d=1;}
      const push=(need-d)/2,ux=dx/d,uy=dy/d;
      a.x-=ux*push;a.y-=uy*push;b.x+=ux*push;b.y+=uy*push;moved=true;
    }
    if(!moved)break;
  }
  const out={};P.forEach(p=>{out[p.id]={x:p.x/sc,y:p.y/sc};});return out;
}

/* ═══ SOCIAL NETWORK ANALYSIS METRICS ═══
   Undirected metrics for the maps in Networks and directed metrics for the local citation network.
   Weights are raw link strengths (counts). Where a path length is needed, the weighted variant uses
   distance = 1 / link strength, so that strong links are short. */

function _heapPush(h,item){h.push(item);let i=h.length-1;while(i>0){const p=(i-1)>>1;if(h[p][0]<=h[i][0])break;[h[p],h[i]]=[h[i],h[p]];i=p;}}
function _heapPop(h){const top=h[0],last=h.pop();if(h.length){h[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<h.length&&h[l][0]<h[m][0])m=l;if(r<h.length&&h[r][0]<h[m][0])m=r;if(m===i)break;[h[m],h[i]]=[h[i],h[m]];i=m;}}return top;}

// Single-source shortest paths in Brandes' form: order of settled nodes, number of shortest paths, predecessors, distances
function _sssp(s,adj,weighted){
  const N=adj.length,dist=new Float64Array(N).fill(Infinity),sigma=new Float64Array(N),pred=Array.from({length:N},()=>[]),order=[];
  dist[s]=0;sigma[s]=1;
  if(!weighted){
    const q=[s];
    for(let qi=0;qi<q.length;qi++){const v=q[qi];order.push(v);
      for(const [u] of adj[v]){if(dist[u]===Infinity){dist[u]=dist[v]+1;q.push(u);}
        if(dist[u]===dist[v]+1){sigma[u]+=sigma[v];pred[u].push(v);}}}
  }else{
    const h=[[0,s,s]],done=new Uint8Array(N),EPS=1e-12;
    while(h.length){const [d,v,from]=_heapPop(h);if(done[v])continue;done[v]=1;order.push(v);
      for(const [u,w] of adj[v]){const nd=d+1/w;
        if(nd<dist[u]-EPS){dist[u]=nd;sigma[u]=sigma[v];pred[u]=[v];_heapPush(h,[nd,u,v]);}
        else if(Math.abs(nd-dist[u])<=EPS&&!done[u]){sigma[u]+=sigma[v];pred[u].push(v);}}}
  }
  return{order,sigma,pred,dist};
}

// ids: node ids; links: [{source,target,w}] (undirected; parallel links are summed)
// opts.weighted: path-based metrics (betweenness, closeness) use distance 1/w
// opts.clusters: Map id → cluster (−1 = none) for modularity
function computeNetworkMetrics(ids,links,{weighted=false,clusters=null}={}){
  const N=ids.length,idx=new Map(ids.map((id,i)=>[id,i]));
  const adjM=Array.from({length:N},()=>new Map());
  for(const l of links){const a=idx.get(l.source),b=idx.get(l.target);if(a==null||b==null||a===b)continue;
    const w=l.w??l.value??1;adjM[a].set(b,(adjM[a].get(b)||0)+w);adjM[b].set(a,(adjM[b].get(a)||0)+w);}
  const adj=adjM.map(m=>[...m]);
  const deg=adj.map(a=>a.length),str=adj.map(a=>a.reduce((s,[,w])=>s+w,0));
  let M=0,W=0;for(let i=0;i<N;i++){M+=deg[i];W+=str[i];}M/=2;W/=2;

  // components
  const comp=new Int32Array(N).fill(-1);let nComp=0;const compSize=[];
  for(let i=0;i<N;i++){if(comp[i]>=0)continue;const st=[i];comp[i]=nComp;let n=0;
    while(st.length){const v=st.pop();n++;for(const [u] of adj[v])if(comp[u]<0){comp[u]=nComp;st.push(u);}}
    compSize.push(n);nComp++;}
  const isolates=deg.filter(d=>d===0).length;
  const giant=compSize.length?Math.max(...compSize):0;

  // Brandes betweenness, harmonic closeness and (hop) distance statistics in one pass
  const bc=new Float64Array(N),harm=new Float64Array(N);
  let diam=0,sumD=0,nPairs=0;
  for(let s=0;s<N;s++){
    if(!deg[s])continue;
    const {order,sigma,pred,dist}=_sssp(s,adj,weighted);
    const delta=new Float64Array(N);
    for(let k=order.length-1;k>=0;k--){const w=order[k];for(const v of pred[w])delta[v]+=sigma[v]/sigma[w]*(1+delta[w]);if(w!==s)bc[w]+=delta[w];}
    for(const v of order)if(v!==s)harm[s]+=1/dist[v];
    // diameter and average path length are always counted in steps (links), as in Gephi
    const hop=weighted?_sssp(s,adj,false).dist:dist;
    for(const v of order)if(v!==s&&hop[v]<Infinity){sumD+=hop[v];nPairs++;if(hop[v]>diam)diam=hop[v];}
  }
  const bNorm=N>2?2/((N-1)*(N-2)):0;           // undirected: each pair counted twice above
  const betweenness=Array.from(bc,b=>b/2*bNorm);
  const closeness=Array.from(harm,h=>N>1?h/(N-1):0);

  // local clustering coefficient (unweighted, Watts–Strogatz); nodes with degree < 2 get 0
  const nb=adj.map(a=>new Set(a.map(([u])=>u)));
  const cc=new Array(N).fill(0);let tri=0,trip=0;
  for(let i=0;i<N;i++){const k=deg[i];if(k<2)continue;const L=[...nb[i]];let t=0;
    for(let a=0;a<k;a++)for(let b=a+1;b<k;b++)if(nb[L[a]].has(L[b]))t++;
    cc[i]=2*t/(k*(k-1));tri+=t;trip+=k*(k-1)/2;}
  const avgCC=N?cc.reduce((a,b)=>a+b,0)/N:0;
  const transitivity=trip?tri/trip:0;

  // eigenvector centrality: power iteration on (A + I), which has the same leading eigenvector as A and also converges on bipartite graphs
  const wOf=w=>weighted?w:1;
  let x=new Float64Array(N).fill(1);
  for(let it=0;it<1000;it++){const y=new Float64Array(N);
    for(let i=0;i<N;i++){let s=x[i];for(const [u,w] of adj[i])s+=wOf(w)*x[u];y[i]=s;}
    let n=0;for(let i=0;i<N;i++)n+=y[i]*y[i];n=Math.sqrt(n)||1;let diff=0;
    for(let i=0;i<N;i++){y[i]/=n;diff+=Math.abs(y[i]-x[i]);}x=y;if(diff<N*1e-10)break;}
  let mx=0;for(let i=0;i<N;i++)mx=Math.max(mx,x[i]);
  const eigen=Array.from(x,v=>M&&mx?v/mx:0);

  // PageRank (undirected, damping 0.85); transitions follow link strength when weighted; nodes without links jump at random
  const d=0.85;let pr=new Float64Array(N).fill(1/N);
  const sw=adj.map(a=>a.reduce((s,[,w])=>s+wOf(w),0));
  for(let it=0;it<200;it++){const nx=new Float64Array(N);let dang=0;
    for(let i=0;i<N;i++){if(!sw[i]){dang+=pr[i];continue;}for(const [u,w] of adj[i])nx[u]+=d*pr[i]*wOf(w)/sw[i];}
    let diff=0;for(let i=0;i<N;i++){nx[i]+=(1-d)/N+d*dang/N;diff+=Math.abs(nx[i]-pr[i]);}pr=nx;if(diff<1e-12)break;}

  // modularity (Newman, resolution 1, weighted) of the given clustering
  let Q=null;
  if(clusters&&W>0){const inn=new Map(),tot=new Map();
    for(let i=0;i<N;i++){const c=clusters.get(ids[i]);if(c==null||c<0)continue;tot.set(c,(tot.get(c)||0)+str[i]);
      for(const [u,w] of adj[i])if(clusters.get(ids[u])===c)inn.set(c,(inn.get(c)||0)+w);}
    Q=0;for(const [c,t] of tot)Q+=(inn.get(c)||0)/(2*W)-(t/(2*W))**2;}

  const nodes=ids.map((id,i)=>({id,degree:deg[i],strength:str[i],betweenness:betweenness[i],closeness:closeness[i],
    eigenvector:eigen[i],pagerank:pr[i],clustering:cc[i],component:comp[i]}));
  return{nodes,summary:{nodes:N,links:M,totalStrength:W,density:N>1?2*M/(N*(N-1)):0,avgDegree:N?2*M/N:0,avgStrength:N?2*W/N:0,
    components:nComp-isolates,isolates,giant,diameter:diam,avgPath:nPairs?sumD/nPairs:0,avgClustering:avgCC,transitivity,modularity:Q,weighted}};
}

/* ── Directed metrics for the local citation network ──
   papers: [{idx,py,...}]; edges: [{source: citing idx, target: cited idx}] */
function computeCitationMetrics(papers,edges){
  const N=papers.length,pos=new Map(papers.map((p,i)=>[p.idx,i]));
  const out=Array.from({length:N},()=>[]),inn=Array.from({length:N},()=>[]);
  const seen=new Set();
  for(const e of edges){const a=pos.get(e.source),b=pos.get(e.target);if(a==null||b==null||a===b)continue;const k=a*N+b;if(seen.has(k))continue;seen.add(k);out[a].push(b);inn[b].push(a);}
  // PageRank in the citing → cited direction (prestige flows to cited records); records citing nothing locally jump at random
  const d=0.85;let pr=new Float64Array(N).fill(1/N);
  for(let it=0;it<300;it++){const nx=new Float64Array(N);let dang=0;
    for(let i=0;i<N;i++){if(!out[i].length){dang+=pr[i];continue;}const s=d*pr[i]/out[i].length;for(const j of out[i])nx[j]+=s;}
    let diff=0;for(let i=0;i<N;i++){nx[i]+=(1-d)/N+d*dang/N;diff+=Math.abs(nx[i]-pr[i]);}pr=nx;if(diff<1e-13)break;}
  // HITS: authorities are cited by good hubs; hubs cite good authorities
  let hub=new Float64Array(N).fill(1),auth=new Float64Array(N).fill(1);
  for(let it=0;it<500;it++){const na=new Float64Array(N),nh=new Float64Array(N);
    for(let i=0;i<N;i++)for(const j of out[i])na[j]+=hub[i];
    for(let i=0;i<N;i++)for(const j of out[i])nh[i]+=na[j];
    const nrm=v=>{let s=0;for(const x of v)s+=x*x;s=Math.sqrt(s)||1;for(let i=0;i<v.length;i++)v[i]/=s;};nrm(na);nrm(nh);
    let diff=0;for(let i=0;i<N;i++)diff+=Math.abs(na[i]-auth[i])+Math.abs(nh[i]-hub[i]);auth=na;hub=nh;if(diff<1e-12)break;}
  const mA=Math.max(...auth,0)||1,mH=Math.max(...hub,0)||1;
  return papers.map((p,i)=>({idx:p.idx,inDeg:inn[i].length,outDeg:out[i].length,pagerank:pr[i],authority:auth[i]/mA,hub:hub[i]/mH}));
}

/* ── Main path analysis (Hummon & Doreian 1989; SPC weights after Batagelj 2003; key-route after Liu & Lu 2012) ──
   Arcs run in the direction of knowledge flow, from the cited to the citing record.
   Cycles (e.g. records of the same year citing each other) are broken: within a strongly connected component
   only arcs from the earlier record (year, then position in the collection) to the later are kept. */
function mainPathAnalysis(papers,edges,{method="global",keyRoutes=1}={}){
  const byIdx=new Map(papers.map(p=>[p.idx,p]));
  const linked=new Set();const arcs0=[];const seen=new Set();
  for(const e of edges){if(e.source===e.target||!byIdx.has(e.source)||!byIdx.has(e.target))continue;
    const k=e.target+">"+e.source;if(seen.has(k))continue;seen.add(k);arcs0.push([e.target,e.source]);linked.add(e.source);linked.add(e.target);}
  const ids=[...linked],N=ids.length,pos=new Map(ids.map((id,i)=>[id,i]));
  const A=arcs0.map(([u,v])=>[pos.get(u),pos.get(v)]);
  const succ0=Array.from({length:N},()=>[]);for(const [u,v] of A)succ0[u].push(v);
  // Tarjan (iterative) for strongly connected components
  const index=new Int32Array(N).fill(-1),low=new Int32Array(N),onSt=new Uint8Array(N),scc=new Int32Array(N).fill(-1),st=[];let ix=0,nS=0;
  for(let r=0;r<N;r++){if(index[r]>=0)continue;const cs=[[r,0]];index[r]=low[r]=ix++;st.push(r);onSt[r]=1;
    while(cs.length){const fr=cs[cs.length-1],v=fr[0];
      if(fr[1]<succ0[v].length){const w=succ0[v][fr[1]++];if(index[w]<0){index[w]=low[w]=ix++;st.push(w);onSt[w]=1;cs.push([w,0]);}else if(onSt[w])low[v]=Math.min(low[v],index[w]);}
      else{cs.pop();if(cs.length){const p=cs[cs.length-1][0];low[p]=Math.min(low[p],low[v]);}
        if(low[v]===index[v]){let w;do{w=st.pop();onSt[w]=0;scc[w]=nS;}while(w!==v);nS++;}}}}
  const key=i=>{const p=byIdx.get(ids[i]);return[(+p.py)||0,ids[i]];};
  const earlier=(a,b)=>{const ka=key(a),kb=key(b);return ka[0]<kb[0]||(ka[0]===kb[0]&&ka[1]<kb[1]);};
  let dropped=0;const arcs=[];
  for(const [u,v] of A){if(scc[u]===scc[v]&&!earlier(u,v)){dropped++;continue;}arcs.push([u,v]);}
  const succ=Array.from({length:N},()=>[]),pred=Array.from({length:N},()=>[]);
  arcs.forEach(([u,v],a)=>{succ[u].push([v,a]);pred[v].push([u,a]);});
  // topological order (Kahn)
  const indeg=pred.map(p=>p.length),topo=[];const q=[];for(let i=0;i<N;i++)if(!indeg[i])q.push(i);
  while(q.length){const v=q.shift();topo.push(v);for(const [u] of succ[v])if(--indeg[u]===0)q.push(u);}
  // search path counts: paths from any source to v (nMinus) and from v to any sink (nPlus)
  const nMinus=new Float64Array(N),nPlus=new Float64Array(N);
  for(const v of topo)nMinus[v]=pred[v].length?pred[v].reduce((s,[u])=>s+nMinus[u],0):1;
  for(let k=topo.length-1;k>=0;k--){const v=topo[k];nPlus[v]=succ[v].length?succ[v].reduce((s,[u])=>s+nPlus[u],0):1;}
  const spc=arcs.map(([u,v])=>nMinus[u]*nPlus[v]);
  const total=topo.reduce((s,v)=>s+(succ[v].length?0:nMinus[v]),0)||1;   // all source–sink paths
  const sources=topo.filter(v=>!pred[v].length),sinks=topo.filter(v=>!succ[v].length);
  const onArc=new Set(),EPS=1e-9;
  const maxOf=list=>list.reduce((m,[,a])=>Math.max(m,spc[a]),-Infinity);
  // local search forward from node v: follow the outgoing arc(s) with the highest SPC until a sink (ties are all followed)
  const forward=start=>{let front=[...start];const vis=new Set();
    while(front.length){const nf=[];for(const v of front){if(vis.has(v))continue;vis.add(v);if(!succ[v].length)continue;
      const m=maxOf(succ[v]);for(const [u,a] of succ[v])if(spc[a]>=m*(1-EPS)){onArc.add(a);nf.push(u);}}front=nf;}};
  const backward=start=>{let front=[...start];const vis=new Set();
    while(front.length){const nf=[];for(const v of front){if(vis.has(v))continue;vis.add(v);if(!pred[v].length)continue;
      const m=maxOf(pred[v]);for(const [u,a] of pred[v])if(spc[a]>=m*(1-EPS)){onArc.add(a);nf.push(u);}}front=nf;}};
  if(arcs.length){
    if(method==="local"){
      // start with the highest-SPC arc(s) leaving a source
      const startArcs=sources.flatMap(s=>succ[s]);const m=maxOf(startArcs);const heads=[];
      for(const [u,a] of startArcs)if(spc[a]>=m*(1-EPS)){onArc.add(a);heads.push(u);}
      forward(heads);
    }else if(method==="key"){
      // key-route: the k arcs with the highest SPC, each extended forward and backward by local search
      const order=arcs.map((_,a)=>a).sort((a,b)=>spc[b]-spc[a]);
      const cut=spc[order[Math.min(keyRoutes,order.length)-1]];
      for(const a of order){if(spc[a]<cut*(1-EPS))break;onArc.add(a);forward([arcs[a][1]]);backward([arcs[a][0]]);}
    }else{
      // global: the source–sink path(s) with the largest sum of SPC
      const best=new Float64Array(N).fill(-Infinity);
      for(let k=topo.length-1;k>=0;k--){const v=topo[k];best[v]=succ[v].length?Math.max(...succ[v].map(([u,a])=>spc[a]+best[u])):0;}
      const top=Math.max(...sources.map(s=>best[s]));
      const tol=x=>Math.abs(x)*1e-9+1e-9;
      let front=sources.filter(s=>best[s]>=top-tol(top));const vis=new Set();
      while(front.length){const nf=[];for(const v of front){if(vis.has(v))continue;vis.add(v);
        for(const [u,a] of succ[v])if(spc[a]+best[u]>=best[v]-tol(best[v])){onArc.add(a);nf.push(u);}}front=nf;}
    }
  }
  const pathArcs=[...onArc].map(a=>({from:ids[arcs[a][0]],to:ids[arcs[a][1]],spc:spc[a],norm:spc[a]/total}));
  const pathNodes=new Set();for(const a of pathArcs){pathNodes.add(a.from);pathNodes.add(a.to);}
  const nodeSPC=new Map(ids.map((id,i)=>[id,nMinus[i]*nPlus[i]]));   // source–sink paths through the record
  return{arcs:pathArcs,nodes:[...pathNodes],nodeSPC,total,sources:sources.length,sinks:sinks.length,
    networkNodes:N,networkArcs:arcs.length,dropped,
    arcSPC:new Map(arcs.map(([u,v],a)=>[ids[v]+">"+ids[u],spc[a]]))};   // keyed citing>cited, as in hc.edges
}


/* ── Directed, weighted metrics for an aggregated citation flow (authors, journals, countries, institutions) ──
   network: {nodes:[{id,count}], links:[{source: citing entity, target: cited entity, value}]} */
function computeFlowMetrics(network){
  const ids=network.nodes.map(n=>n.id),N=ids.length,pos=new Map(ids.map((id,i)=>[id,i]));
  const out=Array.from({length:N},()=>[]);const cin=new Float64Array(N),cout=new Float64Array(N),din=new Int32Array(N),dout=new Int32Array(N);
  for(const l of network.links){const a=pos.get(l.source?.id??l.source),b=pos.get(l.target?.id??l.target);if(a==null||b==null||a===b)continue;
    out[a].push([b,l.value]);cout[a]+=l.value;cin[b]+=l.value;dout[a]++;din[b]++;}
  const d=0.85;let pr=new Float64Array(N).fill(1/N);
  for(let it=0;it<300;it++){const nx=new Float64Array(N);let dang=0;
    for(let i=0;i<N;i++){if(!cout[i]){dang+=pr[i];continue;}for(const [j,w] of out[i])nx[j]+=d*pr[i]*w/cout[i];}
    let diff=0;for(let i=0;i<N;i++){nx[i]+=(1-d)/N+d*dang/N;diff+=Math.abs(nx[i]-pr[i]);}pr=nx;if(diff<1e-13)break;}
  return network.nodes.map((n,i)=>({id:n.id,records:n.count,citedBy:cin[i],citing:cout[i],inDeg:din[i],outDeg:dout[i],pagerank:pr[i]}));
}


function downloadCsv(name,header,rows){
  const esc=v=>{const s=v==null?"":String(v);return /[",;\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
  const text="﻿"+[header,...rows].map(r=>r.map(esc).join(",")).join("\r\n");
  const blob=new Blob([text],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);
}
const fmtNum=(v,f)=>v==null||Number.isNaN(v)?"–":f?v.toFixed(f):(Math.round(v*100)/100).toLocaleString("en");
const _sortRows=(rows,k,desc)=>[...rows].sort((a,b)=>{const x=a[k],y=b[k];const c=typeof x==="string"?x.localeCompare(y):(x-y);return desc?-c:c;});

// Sortable metric table shared by Networks and the Historiograph
function MetricTable({cols,rows,rowKey,first,sortInit,selectedKey,onRowClick,csvName,csvExtra,limit=50}){
  const[sort,setSort]=useState(sortInit);const[showAll,setShowAll]=useState(false);
  const sorted=useMemo(()=>_sortRows(rows,sort.k,sort.desc),[rows,sort]);
  let shown=showAll?sorted:sorted.slice(0,limit);
  const rank=new Map(sorted.map((r,i)=>[rowKey(r),i+1]));
  const selRow=selectedKey!=null&&!shown.some(r=>rowKey(r)===selectedKey)?sorted.find(r=>rowKey(r)===selectedKey):null;
  if(selRow)shown=[selRow,...shown];
  const th={padding:"7px 6px",textAlign:"right",color:C.textDim,fontSize:9.5,letterSpacing:.6,textTransform:"uppercase",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",userSelect:"none"};
  const td={padding:"5px 6px",fontSize:11,textAlign:"right",fontFamily:mono,whiteSpace:"nowrap"};
  const head=c=><th key={c.k} title={c.t} style={{...th,color:sort.k===c.k?C.accent:C.textDim}} onClick={()=>setSort(s=>({k:c.k,desc:s.k===c.k?!s.desc:c.k!=="name"}))}>{c.l}{sort.k===c.k?(sort.desc?" ▾":" ▴"):""}</th>;
  return(<div>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
      <thead><tr style={{borderBottom:`1px solid ${C.border}`}}><th style={{...th,cursor:"default",width:28}}>#</th>
        <th style={{...th,textAlign:"left",color:sort.k===first.k?C.accent:C.textDim}} onClick={()=>setSort(s=>({k:first.k,desc:s.k===first.k?!s.desc:false}))}>{first.l}{sort.k===first.k?(sort.desc?" ▾":" ▴"):""}</th>
        {cols.map(head)}</tr></thead>
      <tbody>{shown.map((r,i)=>{const key=rowKey(r),on=key===selectedKey;return<tr key={key+"|"+i} onClick={onRowClick?()=>onRowClick(r):undefined}
        style={{borderBottom:`1px solid ${C.border}22`,cursor:onRowClick?"pointer":"default",background:on?`${C.accent}22`:"transparent"}}>
        <td style={{...td,color:C.textDim,fontSize:10}}>{rank.get(key)}</td>
        <td style={{...td,textAlign:"left",fontFamily:"inherit",whiteSpace:"normal",minWidth:180,maxWidth:380,color:on?C.accent:C.text}}>{first.render(r)}</td>
        {cols.map(c=><td key={c.k} style={{...td,color:sort.k===c.k?C.textBright:C.text}}>{c.render?c.render(r):fmtNum(r[c.k],c.f)}</td>)}</tr>;})}</tbody>
    </table></div>
    <div style={{display:"flex",gap:10,alignItems:"center",marginTop:8,flexWrap:"wrap",fontSize:11,color:C.textDim}}>
      {rows.length>limit&&<PillBtn active={showAll} onClick={()=>setShowAll(v=>!v)} style={{fontSize:10}}>{showAll?`Show top ${limit}`:`Show all ${rows.length}`}</PillBtn>}
      <PillBtn onClick={()=>downloadCsv(csvName,[first.csv||first.l,...cols.map(c=>c.csv||c.l),...(csvExtra?csvExtra.header:[])],sorted.map(r=>[first.csvVal?first.csvVal(r):r[first.k],...cols.map(c=>c.csvVal?c.csvVal(r):r[c.k]),...(csvExtra?csvExtra.row(r):[])]))} style={{fontSize:10}}>⤓ CSV ({rows.length} rows)</PillBtn>
    </div>
  </div>);
}

const SNA_COLS=[
  {k:"degree",l:"Degree",t:"Number of nodes the node is linked to"},
  {k:"strength",l:"Wtd degree",csv:"Weighted degree",t:"Weighted degree: the sum of the strengths of the node's links (VOSviewer: total link strength)"},
  {k:"betweenness",l:"Betweenness",f:4,t:"Share of the shortest paths between all other pairs of nodes that pass through the node (normalised, 0–1)"},
  {k:"closeness",l:"Closeness",f:4,t:"Harmonic closeness: the mean of 1/distance to every other node; unreachable nodes count as 0, so it can be used with several components. Between 0 and 1 when links are unweighted; with link strength the distances are shorter than 1 and values above 1 occur"},
  {k:"eigenvector",l:"Eigenvector",f:4,t:"High when the node is linked to nodes that are themselves central; the highest value is 1"},
  {k:"pagerank",l:"PageRank",f:5,t:"Share of time a random walk along the links spends at the node (damping 0.85); sums to 1"},
  {k:"clustering",l:"Clust. coeff.",csv:"Clustering coefficient",f:3,t:"Local clustering coefficient: share of the node's pairs of neighbours that are linked to each other (unweighted)"},
];
const SNA_SIZE_OPTS=[["docs","Documents / occurrences"],...SNA_COLS.map(c=>[c.k,c.csv||c.l])];

function NetworkStats({m,clusters,sel,onSelect,pathW,setPathW,nodeLabel,fileTag}){
  const s=m.summary;
  const items=[
    ["Nodes",s.nodes.toLocaleString("en"),"Nodes in the map as shown (see Show)"],
    ["Links",s.links.toLocaleString("en"),"All links between the nodes, including links not drawn"],
    ["Density",fmtNum(s.density,4),"Links as a share of all possible links"],
    ["Avg. degree",fmtNum(s.avgDegree,2),"Mean number of links per node"],
    ["Avg. weighted degree",fmtNum(s.avgStrength,2),"Mean total link strength per node"],
    ["Components",`${s.components}${s.isolates?` + ${s.isolates} unlinked`:""}`,"Connected components with at least one link; nodes without links are counted separately"],
    ["Largest component",`${s.giant} (${Math.round(100*s.giant/Math.max(1,s.nodes))} %)`,"Nodes in the largest connected component"],
    ["Diameter",String(s.diameter),"Longest shortest path, in links, between two connected nodes"],
    ["Avg. path length",fmtNum(s.avgPath,2),"Mean shortest path, in links, over all connected pairs"],
    ["Avg. clustering coeff.",fmtNum(s.avgClustering,3),"Mean of the local clustering coefficients; nodes with fewer than two links count as 0"],
    ["Transitivity",fmtNum(s.transitivity,3),"Global clustering: closed triplets as a share of all connected triplets"],
    ["Modularity Q",s.modularity==null?"–":fmtNum(s.modularity,3),"Newman's modularity (weighted, resolution 1) of the clusters shown in the map"],
  ];
  const rows=useMemo(()=>m.nodes.map(n=>({...n,name:n.id,cluster:clusters?clusters.get(n.id)??-1:-1})),[m,clusters]);
  const clCell=r=>r.cluster>=0?<span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:4,background:clusterColor(r.cluster),display:"inline-block"}}/>{r.cluster+1}</span>:"–";
  const cols=[{k:"cluster",l:"Cluster",t:"Cluster in the map",render:clCell,csvVal:r=>r.cluster>=0?r.cluster+1:""},...SNA_COLS];
  return(<div style={{marginTop:22}}>
    <SectionTitle icon="📐">Network statistics</SectionTitle>
    <div style={{display:"flex",gap:16,alignItems:"flex-end",flexWrap:"wrap",marginBottom:12}}>
      <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:10,color:C.textDim,letterSpacing:1,textTransform:"uppercase"}}>Link weights
        <select value={pathW} onChange={e=>setPathW(e.target.value)} style={{background:C.card,color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 8px",fontSize:12,fontFamily:"inherit"}}>
          <option value="unweighted">Ignore (every link counts 1)</option><option value="weighted">Use link strength</option></select></label>
      <div style={{fontSize:10,color:C.textDim,maxWidth:640,lineHeight:1.5}}>Applies to betweenness, closeness, eigenvector and PageRank. With link strength, a strong link is a short distance (distance = 1 / link strength) and carries more of the random walk. Weighted degree, modularity and the clusters always use link strength; diameter and path length are counted in links.</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8,marginBottom:14}}>
      {items.map(([l,v,t])=><div key={l} title={t} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px"}}>
        <div style={{fontSize:9,color:C.textDim,textTransform:"uppercase",letterSpacing:1,fontFamily:mono}}>{l}</div>
        <div style={{fontSize:16,color:C.textBright,fontWeight:700,marginTop:2,fontFamily:mono}}>{v}</div></div>)}
    </div>
    <div style={{fontSize:10,color:C.textDim,marginBottom:8,lineHeight:1.5}}>Click a row to select the node in the map; a node selected in the map is highlighted here. Hover over a column heading for a definition. The values describe the structure of this map only: they change with the analysis, unit, thresholds, the maximum number of nodes and what is shown, and they are exploratory, not measures of quality or performance.</div>
    <MetricTable cols={cols} rows={rows} rowKey={r=>r.id} first={{k:"name",l:nodeLabel||"Node",render:r=>r.id}}
      sortInit={{k:"strength",desc:true}} selectedKey={sel} onRowClick={r=>onSelect(r.id)} csvName={`biblioscope-network-metrics-${fileTag}.csv`}
      csvExtra={{header:["Component","Link weights"],row:r=>[r.component+1,s.weighted?"link strength":"unweighted"]}}/>
  </div>);
}

// Node radius: documents/occurrences (as before) or a chosen metric
function nodeRadiusFn(nodes,sizeVal){
  if(!sizeVal){const maxF=Math.max(1,...nodes.map(n=>n.freq||n.count||1));const rS=nodeRadiusScale(maxF);return n=>rS(n.freq||n.count||1);}
  let mx=0;for(const v of sizeVal.values())mx=Math.max(mx,v);
  const s=d3.scaleSqrt().domain([0,mx||1]).range([3,20]);return n=>s(sizeVal.get(n.id)||0);
}

/* ── Historiograph: directed metrics and main path ── */
// Direct-citation clusters in the historiograph: size, years, characteristic keywords and key records
function clusterSummaries(hc,records,clus,rankF){
  const N=Math.max(1,records.length),df=new Map(),form=new Map();
  const kws=i=>{const r=records[i];if(!r)return[];const seen=new Set();for(const k of [...(r.de||[]),...(r.id||[])]){const t=String(k).trim();const l=t.toLowerCase();if(!l||seen.has(l))continue;seen.add(l);if(!form.has(l))form.set(l,new Map());form.get(l).set(t,(form.get(l).get(t)||0)+1);}return[...seen];};
  const kwOf=new Map(hc.papers.map(p=>[p.idx,kws(p.idx)]));
  for(const ks of kwOf.values())for(const k of ks)df.set(k,(df.get(k)||0)+1);
  const byIdx=new Map(hc.papers.map(p=>[p.idx,p]));
  return clus.clusters.map(c=>{
    const ps=c.members.map(m=>byIdx.get(m.id)).filter(Boolean);
    const tf=new Map();for(const p of ps)for(const k of kwOf.get(p.idx)||[])tf.set(k,(tf.get(k)||0)+1);
    const minTf=ps.length>=4?2:1;
    const terms=[...tf].filter(([,n])=>n>=minTf).map(([k,n])=>[k,n*Math.log(N/(df.get(k)||1))+n*1e-6]).sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([k])=>[...form.get(k)].sort((a,b)=>b[1]-a[1]||(/[a-z]/.test(b[0])-/[a-z]/.test(a[0])))[0][0]);
    const ys=ps.map(p=>+p.py).filter(Boolean);
    const set=new Set(ps.map(p=>p.idx));let inner=0,outer=0;
    for(const e of hc.edges){const a=set.has(e.source),b=set.has(e.target);if(a&&b)inner++;else if(b)outer++;}
    const top=[...ps].sort((a,b)=>(rankF(b)-rankF(a))||(b.lcs-a.lcs)).slice(0,3);
    return{id:c.id,size:ps.length,y0:ys.length?Math.min(...ys):null,y1:ys.length?Math.max(...ys):null,terms,top,inner,outer};
  });
}
function HistClusterLegend({sum,clus,focus,setFocus,rankM,fmtM,onOpenRecord}){
  if(!sum.length)return<div style={{fontSize:11,color:C.textDim,marginTop:10}}>No clusters: the records have no citations between them.</div>;
  return(<div style={{marginTop:14}}>
    <div style={{fontSize:11,color:C.textDim,marginBottom:8,lineHeight:1.5}}>{sum.length} cluster{sum.length===1?"":"s"} in the direct citation network{clus.unclustered?` · ${clus.unclustered} record${clus.unclustered===1?"":"s"} without local citations (grey)`:""}. Records are clustered by who cites whom within the collection (all records, not only those drawn), with the same method as in Networks. Terms are the cluster's most characteristic keywords; key records are ranked by <b>{rankM.l}</b>. Click a cluster to show only that cluster; click a title to open the record.</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(330px,1fr))",gap:10}}>
      {sum.map(c=>{const on=focus===c.id;return<div key={c.id} onClick={()=>setFocus(on?null:c.id)} style={{border:`1px solid ${on?clusterColor(c.id):C.border}`,background:on?`${clusterColor(c.id)}18`:C.bg,borderRadius:8,padding:"8px 10px",cursor:"pointer",opacity:focus!=null&&!on?.55:1}}>
        <div style={{display:"flex",alignItems:"baseline",gap:6,fontSize:11}}>
          <span style={{width:10,height:10,borderRadius:5,background:clusterColor(c.id),display:"inline-block",flex:"none"}}/>
          <b style={{color:C.textBright,whiteSpace:"nowrap"}}>Cluster {c.id+1}</b><span style={{color:C.textDim}}>{c.size} records · {c.y0===c.y1?c.y0:`${c.y0}–${c.y1}`} · {c.inner} internal citations, {c.outer} from other clusters</span></div>
        {c.terms.length>0&&<div style={{fontSize:10.5,color:C.teal,margin:"4px 0 2px"}}>{c.terms.join(" · ")}</div>}
        {c.top.map(p=><div key={p.idx} style={{fontSize:10.5,lineHeight:1.4,marginTop:3,display:"flex",gap:6}}>
          <span style={{fontFamily:mono,color:C.accent,flex:"none",minWidth:46,textAlign:"right"}}>{fmtM(rankM,rankM.f(p))}</span>
          <span style={{minWidth:0}}><span style={{color:C.text}}>{(p.au[0]||"[Anonymous]").split(",")[0]} {p.py}</span>{" "}
            <span role="button" onClick={e=>{e.stopPropagation();onOpenRecord(p.idx);}} style={{color:C.textBright,textDecoration:"underline",textDecorationColor:`${C.teal}66`,textUnderlineOffset:3}}>{p.ti.length>80?p.ti.slice(0,78)+"…":p.ti}</span></span></div>)}
      </div>;})}
    </div>
  </div>);
}

function CitationMetricsTable({hc,records,cm,mp,mainOn,onOpenRecord,clusterOf,restrict,focus}){
  const[filter,setFilter]=useState(mainOn?"main":"linked");
  useEffect(()=>{setFilter(mainOn?"main":"linked");},[mainOn]);
  const onPath=useMemo(()=>new Set(mp?mp.nodes:[]),[mp]);
  const rows=useMemo(()=>{const byIdx=new Map(hc.papers.map(p=>[p.idx,p]));
    return cm.map(x=>{const p=byIdx.get(x.idx)||{},r=records[x.idx]||{};const spc=mp?mp.nodeSPC.get(x.idx)||0:0;
      return{...x,cluster:clusterOf?clusterOf(x.idx):-1,name:`${(p.au&&p.au[0])||"[Anonymous]"} ${p.py||""}`,py:+p.py||0,gcs:p.gcs||0,spc,spcShare:mp&&mp.total?spc/mp.total:0,main:onPath.has(x.idx)?1:0,ti:r.ti||p.ti||"",so:r.so||p.so||"",r};})
      .filter(r=>(!restrict||restrict.has(r.idx))&&(filter==="all"||(filter==="main"?r.main:(r.inDeg+r.outDeg>0))));},[cm,hc,records,mp,onPath,filter,clusterOf,restrict]);
  const first={k:"name",l:"Record",csv:"Record",render:r=><div style={{lineHeight:1.35}}>
      <span>{r.name}</span> <ExtLink p={r.r}/>
      <div role="button" onClick={e=>{e.stopPropagation();onOpenRecord(r.idx);}} title="Open the record in the collection"
        style={{fontSize:10.5,color:C.textBright,textDecoration:"underline",textDecorationColor:`${C.teal}66`,textUnderlineOffset:3,cursor:"pointer"}}>{r.ti.length>110?r.ti.slice(0,108)+"…":r.ti}</div>
      <div style={{fontSize:9.5,color:C.textDim}}>{r.so}</div></div>};
  const cols=[
    {k:"py",l:"Year",render:r=>r.py||"–"},
    {k:"cluster",l:"Cluster",t:"Cluster in the direct citation network",render:r=>r.cluster>=0?<span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:4,background:clusterColor(r.cluster),display:"inline-block"}}/>{r.cluster+1}</span>:"–",csvVal:r=>r.cluster>=0?r.cluster+1:""},
    {k:"inDeg",l:"LCS (in)",csv:"LCS (in-degree)",t:"In-degree: records in the collection that cite this record"},
    {k:"outDeg",l:"LCR (out)",csv:"LCR (out-degree)",t:"Out-degree: records in the collection that this record cites"},
    {k:"gcs",l:"GCS",t:"Global citation score from the database"},
    {k:"pagerank",l:"PageRank",f:5,t:"PageRank along the citations, from citing to cited record (damping 0.85): high for records cited by records that are themselves cited"},
    {k:"authority",l:"Authority",f:3,t:"HITS authority (highest = 1): cited by records that cite many central records"},
    {k:"hub",l:"Hub",f:3,t:"HITS hub (highest = 1): cites many records with high authority, e.g. reviews"},
    {k:"spc",l:"SPC",t:"Search path count through the record: the number of paths from a source to a sink in the citation network that pass through it",render:r=>r.spc>=1e6?r.spc.toExponential(2):fmtNum(r.spc)},
    {k:"spcShare",l:"SPC share",f:3,csv:"SPC share of all paths",t:"SPC as a share of all source–sink paths"},
    {k:"main",l:"Main path",t:"On the main path computed with the current method",render:r=>r.main?<span style={{color:C.accent}}>●</span>:""},
  ];
  return(<div style={{marginTop:22}}>
    <SectionTitle icon="📐">Record metrics in the local citation network</SectionTitle>
    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
      <span style={{fontSize:11,color:C.textDim,fontFamily:mono,textTransform:"uppercase",letterSpacing:1.5,marginRight:6}}>Records</span>
      {mainOn&&<PillBtn active={filter==="main"} onClick={()=>setFilter("main")} style={{fontSize:10}}>On the main path</PillBtn>}
      <PillBtn active={filter==="linked"} onClick={()=>setFilter("linked")} style={{fontSize:10}}>With local links</PillBtn>
      <PillBtn active={filter==="all"} onClick={()=>setFilter("all")} style={{fontSize:10}}>All</PillBtn>
      <span style={{fontSize:11,color:C.textDim,fontFamily:mono,marginLeft:6}}>{rows.length} record{rows.length===1?"":"s"}{focus!=null?` in cluster ${focus+1}`:""}</span>
    </div>
    <div style={{fontSize:10,color:C.textDim,marginBottom:8,lineHeight:1.5}}>Computed over all records in the collection and all citations between them, not only those drawn above. Click a title to open the record. The values depend on what the collection contains; they describe positions in this citation network and are not measures of quality.</div>
    <MetricTable key={mainOn?"main":"all"} cols={cols} rows={rows} rowKey={r=>r.idx} first={first} sortInit={mainOn?{k:"py",desc:false}:{k:"pagerank",desc:true}}
      csvName={`biblioscope-record-metrics.csv`} csvExtra={{header:["Title","Source","DOI"],row:r=>[r.ti,r.so,r.r.di||""]}}/>
  </div>);
}

function FlowMetricsTable({network,label,sel,onSelect}){
  const rows=useMemo(()=>computeFlowMetrics(network).map(r=>({...r,name:r.id})),[network]);
  if(!network.nodes.length)return null;
  const L=label.charAt(0).toUpperCase()+label.slice(1),an=/^[aeiou]/i.test(label)?"an":"a";
  const cols=[
    {k:"records",l:"Records",t:`Records of the ${label} in the collection`},
    {k:"citedBy",l:"Cited (in)",csv:"Citations received",t:`Weighted in-degree: the sum of the arrow values into the ${label}`},
    {k:"citing",l:"Citing (out)",csv:"Citations given",t:`Weighted out-degree: the sum of the arrow values out of the ${label}`},
    {k:"inDeg",l:"In-degree",t:`Number of ${label}s shown that cite this ${label}`},
    {k:"outDeg",l:"Out-degree",t:`Number of ${label}s shown that this ${label} cites`},
    {k:"pagerank",l:"PageRank",f:5,t:"Weighted PageRank along the citation flow, from citing to cited (damping 0.85)"},
  ];
  return(<div style={{marginTop:22}}>
    <SectionTitle icon="📐">{L} metrics in the citation flow</SectionTitle>
    <div style={{fontSize:10,color:C.textDim,marginBottom:8,lineHeight:1.5}}>Based on the {network.nodes.length} {label}s in the network above and the citations between them; citations within {an} {label} are not counted. A citation from a record with several {label}s counts once for each of them, as the arrow values do. Click a row to select the {label} and list its citations below.</div>
    <MetricTable cols={cols} rows={rows} rowKey={r=>r.id} first={{k:"name",l:L,render:r=>r.id}} sortInit={{k:"citedBy",desc:true}}
      selectedKey={sel&&sel.node} onRowClick={r=>onSelect({node:r.id})} csvName={`biblioscope-${label}-flow-metrics.csv`}/>
  </div>);
}


// Stacked bars per year (counts), with share labels on hover
function StackedYearBars({rows,keys,colors,height=180,onPick}){
  const ref=useRef(null);const[w,setW]=useState(700);
  useEffect(()=>{const el=ref.current;if(!el)return;const ro=new ResizeObserver(()=>setW(Math.max(320,el.clientWidth)));ro.observe(el);return()=>ro.disconnect();},[]);
  if(!rows.length)return null;
  const pad={l:34,r:8,t:8,b:22},iw=w-pad.l-pad.r,ih=height-pad.t-pad.b;
  const max=Math.max(1,...rows.map(r=>keys.reduce((s,k)=>s+(r.c[k]||0),0)));
  const bw=iw/rows.length;
  return(<div ref={ref} style={{width:"100%"}}><svg width={w} height={height} style={{display:"block"}}>
    {[0,.5,1].map(f=><g key={f}><line x1={pad.l} x2={w-pad.r} y1={pad.t+ih*(1-f)} y2={pad.t+ih*(1-f)} stroke={C.border}/><text x={pad.l-6} y={pad.t+ih*(1-f)+3} textAnchor="end" fontSize={9} fill={C.textDim} fontFamily={mono}>{Math.round(max*f)}</text></g>)}
    {rows.map((r,i)=>{let y=pad.t+ih;const tot=keys.reduce((s,k)=>s+(r.c[k]||0),0);return<g key={r.y}>
      {keys.map(k=>{const v=r.c[k]||0;if(!v)return null;const h=ih*v/max;y-=h;return<rect key={k} x={pad.l+i*bw+bw*.12} y={y} width={bw*.76} height={h} fill={colors[k]} style={{cursor:onPick?"pointer":"default"}} onClick={onPick?()=>onPick(r,k):undefined}><title>{`${r.y} · ${k}: ${v} of ${tot} (${Math.round(100*v/tot)} %)${onPick?" · click to list":""}`}</title></rect>;})}
      {(rows.length<=30||i%Math.ceil(rows.length/20)===0)&&<text x={pad.l+i*bw+bw/2} y={height-6} textAnchor="middle" fontSize={9} fill={C.textDim} fontFamily={mono}>{rows.length>14?String(r.y).slice(2):r.y}</text>}
    </g>;})}
  </svg></div>);
}
function ShareBars({items,total,colorOf,label="records",onClick,sel}){
  const mx=Math.max(1,...items.map(d=>d.count));
  return(<div style={{display:"flex",flexDirection:"column",gap:5}}>{items.map(d=><div key={d.name} onClick={onClick?()=>onClick(d):undefined} title={onClick?"Click to list the records":undefined} style={{cursor:onClick?"pointer":"default",opacity:sel&&sel!==d.name?.55:1}}>
    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2,gap:10}}><span style={{color:C.text}}>{d.name}</span><span style={{fontFamily:mono,color:C.textDim,whiteSpace:"nowrap"}}>{d.count} {label} · {total?Math.round(100*d.count/total):0} %</span></div>
    <div style={{height:7,background:C.bg,borderRadius:4}}><div style={{width:`${100*d.count/mx}%`,height:"100%",borderRadius:4,background:colorOf(d.name)}}/></div></div>)}</div>);
}
const Legend=({keys,colors})=><div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:10.5,color:C.textDim,marginTop:6}}>{keys.map(k=><span key={k} style={{display:"inline-flex",alignItems:"center",gap:5}}><span style={{width:9,height:9,borderRadius:2,background:colors[k]}}/>{k}</span>)}</div>;
const Note=({children})=><div style={{fontSize:10.5,color:C.textDim,lineHeight:1.55,margin:"6px 0 10px"}}>{children}</div>;
const Stat=({l,v,t,onClick})=><div title={onClick?`${t?t+" · ":""}click to list the records`:t} onClick={onClick} style={{background:C.bg,border:`1px solid ${onClick?C.accent+"55":C.border}`,borderRadius:8,padding:"8px 12px",minWidth:120,cursor:onClick?"pointer":"default"}}><div style={{fontSize:9,color:C.textDim,textTransform:"uppercase",letterSpacing:1,fontFamily:mono}}>{l}</div><div style={{fontSize:17,color:C.textBright,fontWeight:700,fontFamily:mono,marginTop:2}}>{v}</div></div>;
const pct=(a,b)=>b?`${Math.round(100*a/b)} %`:"–";

function IndicatorsPanel({D}){
  const records=D.records;const N=records.length;
  const sectorOvr=useOverrides("sector"),funderOvr=useOverrides("funder");
  const hc=D.histcite;const lcs=useMemo(()=>new Map(hc.papers.map(p=>[p.idx,p.lcs||0])),[hc]);
  const years=useMemo(()=>[...new Set(records.map(r=>r.py).filter(y=>y>1900))].sort((a,b)=>a-b),[records]);
  const byYear=(fn)=>{const idx=new Map(years.map((y,i)=>[y,i]));const rows=years.map(y=>({y,c:{},ix:{}}));records.forEach((r,i)=>{const j=idx.get(r.py);if(j==null)return;for(const k of fn(r,i)){rows[j].c[k]=(rows[j].c[k]||0)+1;(rows[j].ix[k]=rows[j].ix[k]||[]).push(i);}});return rows;};
  const[recView,setRecView]=useState(null);
  const openSet=(title,indices)=>{if(indices&&indices.length)setRecView({set:{title:`${title} · ${indices.length} record${indices.length===1?"":"s"}`,indices}});};
  const where=f=>records.map((r,i)=>f(r,i)?i:-1).filter(i=>i>=0);
  const pickYear=label=>(r,k)=>openSet(`${label}: ${k}, ${r.y}`,r.ix[k]);

  // ── per-record derived values ──
  const oa=useMemo(()=>records.map(oaStatus),[records]);
  const orgs=useMemo(()=>records.map(r=>recordOrgs(r,sectorOvr)),[records,sectorOvr]);
  const canon=useMemo(()=>buildFunderCanon(records),[records]);
  const fundersOf=useMemo(()=>records.map(r=>[...new Set((r.fu||[]).map(f=>canon.name(f.n)))]),[records,canon]);
  const ftype=useCallback(n=>funderOvr[canon.key(n)]||funderTypeRule(n),[funderOvr,canon]);
  const hasFundInfo=r=>(r.fu&&r.fu.length)||r.fx;
  const sdgOf=r=>[...new Set((r.sdg||[]).map(x=>x.id))];
  const sdgCovered=records.filter(r=>r._sdgKnown||(r.sdg&&r.sdg.length)).length;
  const sdgAny=records.filter(r=>r.sdg&&r.sdg.length).length;
  const sdgKnownN=records.filter(r=>r._sdgKnown).length;

  // ── Open access ──
  const oaCounts=OA_STATUSES.map(s=>{const ix=where((r,i)=>oa[i].status===s);return{name:s,count:ix.length,ix};}).filter(d=>d.count);
  const oaAny=oa.filter(o=>o.any).length,oaGreenAlso=oa.filter(o=>o.green).length;
  const oaYear=useMemo(()=>byYear((r)=>[oaStatus(r).status]),[records,years]);

  // ── Sectors ──
  const secStats=useMemo(()=>{const rec=new Map(),addr=new Map(),alone=new Map(),orgCount=new Map(),how=new Map();
    const ixs=new Map();orgs.forEach((list,i)=>{const ss=new Set(list.map(o=>o.s));for(const s of ss){rec.set(s,(rec.get(s)||0)+1);(ixs.get(s)||ixs.set(s,[]).get(s)).push(i);if(ss.size===1)alone.set(s,(alone.get(s)||0)+1);}
      for(const o of list){addr.set(o.s,(addr.get(o.s)||0)+1);const k=o.s+"\u0001"+o.n;orgCount.set(k,(orgCount.get(k)||0)+1);how.set(o.how,(how.get(o.how)||0)+1);}});
    const top=s=>[...orgCount].filter(([k])=>k.startsWith(s+"\u0001")).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,n])=>`${k.split("\u0001")[1]} (${n})`).join("; ");
    const rows=SECTORS.filter(s=>rec.get(s)).map(s=>({name:s,ix:ixs.get(s),records:rec.get(s),share:rec.get(s)/N,alone:alone.get(s)||0,cross:(rec.get(s)-(alone.get(s)||0)),orgs:addr.get(s),top:top(s)}));
    return{rows,how};},[orgs,N]);
  const withAff=orgs.filter(l=>l.length).length;
  const nonAcad=orgs.filter(l=>l.some(o=>o.s!=="Higher education"&&o.s!=="Unclassified")).length;
  const pairs=useMemo(()=>{const m=new Map();orgs.forEach((l,x)=>{const ss=[...new Set(l.map(o=>o.s))].filter(s=>s!=="Unclassified").sort();for(let i=0;i<ss.length;i++)for(let j=i+1;j<ss.length;j++){const k=ss[i]+" – "+ss[j];(m.get(k)||m.set(k,[]).get(k)).push(x);}});return[...m].sort((a,b)=>b[1].length-a[1].length).slice(0,10).map(([name,ix])=>({name,count:ix.length,ix}));},[orgs]);
  const unclassifiedOrgs=useMemo(()=>{const m=new Map();orgs.forEach(l=>{for(const o of l)if(o.s==="Unclassified"||o.how==="manual")m.set(o.n,{n:o.n,s:o.s,c:(m.get(o.n)?.c||0)+1});});return[...m.values()].sort((a,b)=>b.c-a.c);},[orgs]);
  const secYear=useMemo(()=>byYear((r,i)=>[...new Set(orgs[i].map(o=>o.s))]),[records,orgs,years]);

  // ── Funders ──
  const funded=records.filter((r,i)=>fundersOf[i].length||r.fx).length;
  const fundRows=useMemo(()=>{const m=new Map();records.forEach((r,i)=>{for(const n of fundersOf[i]){const k=canon.key(n);if(!m.has(k))m.set(k,{name:n,key:k,records:0,ix:[],grants:new Set(),variants:new Set()});const e=m.get(k);e.records++;e.ix.push(i);}
      for(const f of r.fu||[]){const e=m.get(canon.key(f.n));if(e){e.variants.add(f.n);(f.g||[]).forEach(g=>e.grants.add(g));}}});
    return[...m.values()].map(e=>({...e,type:ftype(e.name),grants:e.grants.size,variants:e.variants.size,share:e.records/N}));},[records,fundersOf,canon,ftype,N]);
  const typeRows=useMemo(()=>FUNDER_TYPES.map(t=>{const ix=records.map((r,i)=>fundersOf[i].some(n=>ftype(n)===t)?i:-1).filter(i=>i>=0);return{name:t,funders:fundRows.filter(f=>f.type===t).length,records:ix.length,ix,share:ix.length/N};}).filter(r=>r.funders),[records,fundersOf,fundRows,ftype,N]);
  const fundYear=useMemo(()=>byYear(r=>[hasFundInfo(r)?"Funding acknowledged":"No funding information"]),[records,years]);

  // ── Citation indicators by group ──
  const[grp,setGrp]=useState("oa");
  const GROUPS={oa:{l:"Open access status",f:(r,i)=>[oa[i].status]},anyoa:{l:"Open access (any)",f:(r,i)=>[oa[i].any?"Open access":"Not open access"]},
    sector:{l:"Sector (any author)",f:(r,i)=>[...new Set(orgs[i].map(o=>o.s))]},
    xsec:{l:"Cross-sector collaboration",f:(r,i)=>{const ss=new Set(orgs[i].map(o=>o.s).filter(s=>s!=="Unclassified"));return[!orgs[i].length?"No affiliation":ss.size>1?"Several sectors":ss.has("Higher education")?"Higher education only":"One other sector"];}},
    funded:{l:"Funding acknowledged",f:(r,i)=>[fundersOf[i].length||r.fx?"Funded":"No funding information"]},
    ftype:{l:"Funder type",f:(r,i)=>{const t=[...new Set(fundersOf[i].map(ftype))];return t.length?t:["No funding information"];}},
    sdg:{l:"SDG (OpenAlex)",f:(r)=>{const s=sdgOf(r);return s.length?s.map(sdgLabel):[r._sdgKnown?"No SDG":"No SDG information"];}},
    src:{l:"Source database",f:(r)=>[...(r._mergedFrom||[r._src])].map(s=>({wos:"Web of Science",scopus:"Scopus",openalex:"OpenAlex",manual:"Manual"}[s]||s))},
  };
  const grpRows=useMemo(()=>{const g=GROUPS[grp];const m=new Map();records.forEach((r,i)=>{for(const k of g.f(r,i)){if(!m.has(k))m.set(k,[]);m.get(k).push(i);}});
    return[...m].map(([name,ix])=>{const _ix=ix;const tc=ix.map(i=>records[i].tc||0);const fw=ix.map(i=>records[i].ind?.fwci).filter(v=>typeof v==="number");const t10=ix.filter(i=>records[i].ind&&typeof records[i].ind.top10==="boolean");
      const rcr=ix.map(i=>records[i].ind?.rcr).filter(v=>typeof v==="number");
      return{name,records:ix.length,share:ix.length/N,medTc:median(tc),meanTc:tc.reduce((a,b)=>a+b,0)/ix.length,uncited:ix.filter(i=>!(records[i].tc>0)).length/ix.length,
        lcs:median(ix.map(i=>lcs.get(i)||0)),fwN:fw.length,medFw:median(fw),meanFw:fw.length?fw.reduce((a,b)=>a+b,0)/fw.length:null,
        top10:t10.length?t10.filter(i=>records[i].ind.top10).length/t10.length:null,t10N:t10.length,rcrN:rcr.length,medRcr:median(rcr),ix:_ix};});},[grp,records,oa,orgs,fundersOf,ftype,lcs,N]);
  const fwCov=records.filter(r=>typeof r.ind?.fwci==="number").length,rcrCov=records.filter(r=>typeof r.ind?.rcr==="number").length;
  const fmt=(v,d=2)=>v==null?"–":(Math.round(v*10**d)/10**d).toLocaleString("en");
  const sel={background:C.card,color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 8px",fontSize:12,fontFamily:"inherit"};

  return(<div style={{display:"flex",flexDirection:"column",gap:24}}>
    <Card><SectionTitle icon="🧾">Indicators: coverage</SectionTitle>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <Stat l="Records" v={N.toLocaleString("en")} onClick={()=>openSet("All records",where(()=>true))}/>
        <Stat l="With affiliation" v={pct(withAff,N)} t={`${withAff} records`} onClick={()=>openSet("Records with affiliation",where((r,i)=>orgs[i].length))}/>
        <Stat l="Funding acknowledged" v={pct(funded,N)} t={`${funded} records`} onClick={()=>openSet("Funding acknowledged",where((r,i)=>fundersOf[i].length||r.fx))}/>
        <Stat l="Open access (any)" v={pct(oaAny,N)} t={`${oaAny} records`} onClick={()=>openSet("Open access (any)",where((r,i)=>oa[i].any))}/>
        <Stat l="SDG information" v={pct(sdgCovered,N)} t={`${sdgCovered} records come from OpenAlex or were augmented`} onClick={()=>openSet("Records with SDG information",where(r=>r._sdgKnown||(r.sdg&&r.sdg.length)))}/>
        <Stat l="FWCI (OpenAlex)" v={pct(fwCov,N)} t={`${fwCov} records`} onClick={()=>openSet("Records with OpenAlex FWCI",where(r=>typeof r.ind?.fwci==="number"))}/>
        <Stat l="RCR (iCite)" v={pct(rcrCov,N)} t={`${rcrCov} records`} onClick={()=>openSet("Records with RCR",where(r=>typeof r.ind?.rcr==="number"))}/>
      </div>
      <Note>Click any figure, bar, bar segment or table row in this tab to list its records; click a record to open it. Each indicator is computed only from what the source records contain. Web of Science and Scopus exports contain funding and open access, but no SDGs, field-normalised indicators or organisation types; OpenAlex records contain all of these. Records from Web of Science or Scopus can be given these values with the Open Sources Augmenter (load its output together with the original files). The indicators describe the collection; they are not measures of quality.</Note>
    </Card>

    <Card><SectionTitle icon="🔓">Open access</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1.4fr)",gap:24}}>
        <div><ShareBars items={oaCounts} total={N} colorOf={k=>OA_COLORS[k]} onClick={d=>openSet(`Open access: ${d.name}`,d.ix)}/>
          <Note>{pct(oaAny,N)} open access; <span role="button" onClick={()=>openSet("Also a green copy",where((r,i)=>oa[i].green))} style={{color:C.accent,cursor:"pointer",textDecoration:"underline"}}>{oaGreenAlso}</span> of the gold, hybrid, bronze or diamond records also have a green (repository) copy. One status per record, after Unpaywall's order: diamond, gold, hybrid, bronze, green. The sources use different labels (Web of Science "gold", "Green Submitted"; Scopus "Gold Open Access", "Hybrid Gold Open Access"; OpenAlex "gold", "diamond", "closed"), which are mapped to these. Diamond (no fees) is only given by OpenAlex. Records without an open access value in Web of Science or Scopus count as closed.</Note></div>
        <div><StackedYearBars rows={oaYear} keys={OA_STATUSES} colors={OA_COLORS} onPick={pickYear("Open access")}/><Legend keys={OA_STATUSES.filter(k=>oaCounts.some(d=>d.name===k))} colors={OA_COLORS}/></div>
      </div>
    </Card>

    <Card><SectionTitle icon="🌐">Agenda 2030: Sustainable Development Goals</SectionTitle>
      {sdgCovered===0?<Note>No record in the collection has SDG information. Web of Science and Scopus exports do not include SDGs; OpenAlex records do. Use the Open Sources Augmenter to add OpenAlex SDGs to Web of Science and Scopus records by DOI.</Note>:<>
      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:24}}>
        <div><ShareBars items={SDG_NAMES.map((n,i)=>{const ix=where(r=>sdgOf(r).includes(i+1));return{name:sdgLabel(i+1),count:ix.length,ix};}).filter(d=>d.count)} total={sdgCovered} colorOf={k=>SDG_COLORS[+k.split(" ")[1]-1]} onClick={d=>openSet(d.name,d.ix)}/></div>
        <div><StackedYearBars rows={byYear(r=>(r._sdgKnown||(r.sdg&&r.sdg.length))?[sdgOf(r).length?"At least one SDG":"No SDG"]:["No SDG information"])} keys={["At least one SDG","No SDG","No SDG information"]} colors={{"At least one SDG":"#19486A","No SDG":"#7b8494","No SDG information":"#3a404c"}} onPick={pickYear("SDGs")}/>
          <Legend keys={["At least one SDG","No SDG","No SDG information"]} colors={{"At least one SDG":"#19486A","No SDG":"#7b8494","No SDG information":"#3a404c"}}/></div>
      </div>
      <Note><span role="button" onClick={()=>openSet("At least one SDG",where(r=>r.sdg&&r.sdg.length))} style={{color:C.accent,cursor:"pointer",textDecoration:"underline"}}>{sdgAny}</span> of {sdgCovered} records with SDG information are assigned at least one goal ({pct(sdgAny,sdgCovered)}); shares are of the records with SDG information. The SDGs are OpenAlex's automatic classification of title and abstract, with a score per goal (only goals above OpenAlex's threshold are listed). Different SDG classifications (OpenAlex, Elsevier, Clarivate, Aurora) disagree considerably, so the counts show what this classifier finds, not whether the research contributes to the goals.</Note></>}
    </Card>

    <Card><SectionTitle icon="🏷️">Sectors of the authors' organisations</SectionTitle>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
        <Stat l="Records with affiliation" v={withAff.toLocaleString("en")} onClick={()=>openSet("Records with affiliation",where((r,i)=>orgs[i].length))}/>
        <Stat l="With non-university actor" v={pct(nonAcad,withAff)} t={`${nonAcad} records with at least one organisation outside higher education (unclassified not counted)`} onClick={()=>openSet("With an organisation outside higher education",where((r,i)=>orgs[i].some(o=>o.s!=="Higher education"&&o.s!=="Unclassified")))}/>
        <Stat l="Classified by ROR" v={(secStats.how.get("ROR (OpenAlex)")||0).toLocaleString("en")} t="Organisations typed by ROR through OpenAlex"/>
        <Stat l="Classified by name" v={(secStats.how.get("name rule")||0).toLocaleString("en")} t="Organisations classified from words in the name or address"/>
      </div>
      <MetricTable rows={secStats.rows} rowKey={r=>r.name} onRowClick={r=>openSet(`Sector: ${r.name}`,r.ix)} first={{k:"name",l:"Sector",render:r=><span style={{display:"inline-flex",alignItems:"center",gap:6}}><span style={{width:9,height:9,borderRadius:2,background:SECTOR_COLORS[r.name]}}/>{r.name}</span>}}
        sortInit={{k:"records",desc:true}} csvName="biblioscope-sectors.csv" cols={[
        {k:"records",l:"Records",t:"Records with at least one organisation in the sector"},{k:"share",l:"Share",render:r=>pct(r.records,N),csvVal:r=>r.share.toFixed(4)},
        {k:"alone",l:"Only this sector",t:"Records where all organisations are in this sector"},{k:"cross",l:"With other sectors",t:"Records that also have organisations in other sectors"},
        {k:"orgs",l:"Organisation mentions"},{k:"top",l:"Largest organisations",render:r=><span style={{fontFamily:"inherit",fontSize:10.5,color:C.textDim,whiteSpace:"normal"}}>{r.top}</span>}]}/>
      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1.3fr)",gap:24,marginTop:16}}>
        <div><div style={{fontSize:11,color:C.textDim,fontFamily:mono,textTransform:"uppercase",letterSpacing:1.2,marginBottom:8}}>Cross-sector co-publication</div>
          {pairs.length?<ShareBars items={pairs} total={N} colorOf={()=>C.teal} onClick={d=>openSet(d.name,d.ix)}/>:<Note>No records combine sectors.</Note>}</div>
        <div><StackedYearBars rows={secYear} keys={SECTORS} colors={SECTOR_COLORS} onPick={pickYear("Sector")}/><Legend keys={SECTORS.filter(s=>secStats.rows.some(r=>r.name===s))} colors={SECTOR_COLORS}/></div>
      </div>
      <Note>Organisations from OpenAlex records are typed by ROR (education, facility, healthcare, government, company, nonprofit). Web of Science and Scopus addresses are classified by words in the organisation name (Univ, Hosp, Minist, Acad Sci, Co Ltd, Foundation …), which is approximate: university hospitals, academies of sciences and public research institutes fall between categories. A record counts once per sector. "Independent" is only found when an address says so (e.g. "Independent researcher"); a missing address is not counted as independent.</Note>
      {unclassifiedOrgs.length>0&&<details><summary style={{cursor:"pointer",fontSize:11.5,color:C.accent}}>Unclassified or manually set organisations ({unclassifiedOrgs.length}) – set the sector by hand</summary>
        <div style={{maxHeight:300,overflowY:"auto",marginTop:8}}>{unclassifiedOrgs.slice(0,200).map(o=><div key={o.n} style={{display:"flex",gap:10,alignItems:"center",fontSize:11,padding:"3px 0",borderBottom:`1px solid ${C.border}22`}}>
          <span role="button" onClick={()=>openSet(o.n,where((r,i)=>orgs[i].some(x=>x.n===o.n)))} style={{flex:1,color:C.text,cursor:"pointer"}} title="List the records">{o.n} <span style={{color:C.textDim}}>({o.c})</span></span>
          <select value={sectorOvr[o.n.toLowerCase()]||""} onChange={e=>setOverride("sector",o.n.toLowerCase(),e.target.value)} style={{...sel,fontSize:11,padding:"2px 6px"}}><option value="">Unclassified (rule)</option>{SECTORS.filter(s=>s!=="Unclassified").map(s=><option key={s}>{s}</option>)}</select></div>)}</div>
        <Note>Manual choices are kept in this browser and apply to all collections.</Note></details>}
    </Card>

    <Card><SectionTitle icon="💰">Funders</SectionTitle>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
        <Stat l="Funding acknowledged" v={pct(funded,N)} t={`${funded} of ${N} records name a funder or have a funding text`} onClick={()=>openSet("Funding acknowledged",where((r,i)=>fundersOf[i].length||r.fx))}/>
        <Stat l="Distinct funders" v={fundRows.length.toLocaleString("en")} t="After merging spelling variants and acronyms"/>
        <Stat l="Funder mentions" v={records.reduce((s,r)=>s+(r.fu||[]).length,0).toLocaleString("en")}/>
        <Stat l="Grant numbers" v={records.reduce((s,r)=>s+(r.fu||[]).reduce((t,f)=>t+(f.g||[]).length,0),0).toLocaleString("en")}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1.2fr)",gap:24}}>
        <div><div style={{fontSize:11,color:C.textDim,fontFamily:mono,textTransform:"uppercase",letterSpacing:1.2,marginBottom:8}}>Funder types</div>
          <ShareBars items={typeRows.map(t=>({name:t.name,count:t.records,ix:t.ix}))} total={N} colorOf={()=>C.accent} onClick={d=>openSet(`Funder type: ${d.name}`,d.ix)}/>
          <div style={{fontSize:10.5,color:C.textDim,marginTop:6}}>{typeRows.map(t=>`${t.name}: ${t.funders} funder${t.funders===1?"":"s"}`).join(" · ")}</div></div>
        <div><StackedYearBars rows={fundYear} keys={["Funding acknowledged","No funding information"]} colors={{"Funding acknowledged":C.accent,"No funding information":"#3a404c"}} onPick={pickYear("Funding")}/>
          <Legend keys={["Funding acknowledged","No funding information"]} colors={{"Funding acknowledged":C.accent,"No funding information":"#3a404c"}}/></div>
      </div>
      <Note>Funders are taken from Web of Science (FU), Scopus (Funding Details) and OpenAlex (funders, awards). Spelling variants are merged (case, punctuation, "&amp;"/"and", "R&amp;D", acronyms that Scopus gives next to the name, and a short list of known aliases such as NSFC). Funder type is not in any export: it is assigned from the name (national, ministry, council, provincial and municipal programmes → government; foundation, trust, charity without public marks → private; university and hospital funds → university/research organisation), with a short list of known funders. Check the types in the table and correct them where needed. Absence of funding information does not mean the research was unfunded: acknowledgements are not always indexed, particularly before 2008 (Web of Science) and in the social sciences and humanities.</Note>
      <MetricTable rows={fundRows} rowKey={r=>r.key} onRowClick={r=>openSet(`Funder: ${r.name}`,r.ix)} first={{k:"name",l:"Funder",render:r=><span>{r.name}{r.variants>1&&<span style={{color:C.textDim,fontSize:10}} title="Spellings merged"> · {r.variants} spellings</span>}</span>}}
        sortInit={{k:"records",desc:true}} limit={25} csvName="biblioscope-funders.csv" cols={[
        {k:"type",l:"Type",render:r=><select value={funderOvr[r.key]||r.type} onClick={e=>e.stopPropagation()} onChange={e=>setOverride("funder",r.key,e.target.value===funderTypeRule(r.name)?"":e.target.value)} style={{...sel,fontSize:10.5,padding:"2px 4px",color:funderOvr[r.key]?C.accent:C.text}}>{FUNDER_TYPES.map(t=><option key={t}>{t}</option>)}</select>,csvVal:r=>r.type},
        {k:"records",l:"Records"},{k:"share",l:"Share",render:r=>pct(r.records,N),csvVal:r=>r.share.toFixed(4)},{k:"grants",l:"Grant nos.",t:"Distinct grant numbers"}]}/>
    </Card>

    <Card><SectionTitle icon="📈">Citation indicators by group</SectionTitle>
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
        <span style={{fontSize:11,color:C.textDim,fontFamily:mono,textTransform:"uppercase",letterSpacing:1.2}}>Group by</span>
        <select value={grp} onChange={e=>setGrp(e.target.value)} style={sel}>{Object.entries(GROUPS).map(([k,g])=><option key={k} value={k}>{g.l}</option>)}</select>
      </div>
      <MetricTable key={grp} rows={grpRows} rowKey={r=>r.name} onRowClick={r=>openSet(`${GROUPS[grp].l}: ${r.name}`,r.ix)} first={{k:"name",l:GROUPS[grp].l,render:r=>r.name}} sortInit={{k:"records",desc:true}} csvName={`biblioscope-indicators-by-${grp}.csv`} cols={[
        {k:"records",l:"Records"},{k:"share",l:"Share",render:r=>pct(r.records,N),csvVal:r=>r.share.toFixed(4)},
        {k:"medTc",l:"Median cit.",t:"Median of the citation counts given by the databases (the highest count when a record comes from several databases)",render:r=>fmt(r.medTc,1)},
        {k:"meanTc",l:"Mean cit.",render:r=>fmt(r.meanTc,1)},{k:"uncited",l:"Uncited",render:r=>pct(r.uncited*r.records,r.records),csvVal:r=>r.uncited.toFixed(4)},
        {k:"lcs",l:"Median LCS",t:"Median local citation score (citations from the collection)",render:r=>fmt(r.lcs,1)},
        {k:"fwN",l:"FWCI n",t:"Records with an OpenAlex FWCI"},{k:"medFw",l:"Median FWCI",t:"Median OpenAlex field-weighted citation impact (1 = world average for the subfield, year and type)",render:r=>fmt(r.medFw)},
        {k:"meanFw",l:"Mean FWCI",t:"Mean OpenAlex FWCI; sensitive to single highly cited records",render:r=>fmt(r.meanFw)},
        {k:"top10",l:"Top 10 %",t:"Share of records (with OpenAlex percentiles) among the 10 % most cited of their subfield, year and type",render:r=>r.top10==null?"–":pct(r.top10*r.t10N,r.t10N),csvVal:r=>r.top10==null?"":r.top10.toFixed(4)},
        {k:"medRcr",l:"Median RCR",t:"Median relative citation ratio from NIH iCite (PubMed records only)",render:r=>r.rcrN?`${fmt(r.medRcr)} (${r.rcrN})`:"–"}]}/>
      <Note>Click a row to list its records. A record belongs to every group it qualifies for (e.g. several sectors or funder types), so groups overlap. Raw citation counts are not comparable across fields and years; prefer the median FWCI, the share in the top 10 % and RCR, and look at their coverage (n). FWCI and percentiles are OpenAlex's, computed against OpenAlex's own database, and are typically higher than those in SciVal or InCites. Small groups give unstable values.</Note>
    </Card>
    {recView&&<RecordOverlay view={recView} setView={setRecView} records={records} hc={hc}/>}
  </div>);
}

function NetworkPanel({records}){
  const[analysis,setAnalysis]=useState("coupling");
  const[unit,setUnit]=useState("article");
  const[minDocs,setMinDocs]=useState(1);
  const[minCites,setMinCites]=useState(0);
  const[maxNodes,setMaxNodes]=useState(150);
  const[layout,setLayout]=useState("fa2");
  const[attr,setAttr]=useState(1);
  const[rep,setRep]=useState(1);
  const[grav,setGrav]=useState(0.05);
  const[vosA,setVosA]=useState(2);
  const[vosR,setVosR]=useState(1);
  const[norm,setNorm]=useState("assoc");
  const[res,setRes]=useState(1);          // clustering resolution
  const[minCl,setMinCl]=useState(1);      // minimum cluster size
  const[scale,setScale]=useState(1);      // node size factor
  const[labelSize,setLabelSize]=useState(10);
  const[over,setOver]=useState({});     // manual positions in normalised coordinates, by node id
  const[comp,setComp]=useState("main");  // main | all | full
  const[ovK,setOvK]=useState(0);         // overlap removal 0–1
  const ovKd=useDeferredValue(ovK);
  const[sel,setSel]=useState(null);     // selected node id
  const[pathW,setPathW]=useState("unweighted");  // SNA: use link strength in path metrics
  const[sizeBy,setSizeBy]=useState("docs");      // node size: documents or a metric
  const[full,setFull]=useState(false);
  const[vh,setVh]=useState(typeof window!=="undefined"?window.innerHeight:800);
  const cardRef=useRef(),wr=useRef();
  const w=useW(wr);
  useEffect(()=>{const f=()=>setVh(window.innerHeight);window.addEventListener("resize",f);return()=>window.removeEventListener("resize",f);},[]);
  useEffect(()=>{const f=()=>{if(!document.fullscreenElement)setFull(false);};document.addEventListener("fullscreenchange",f);return()=>document.removeEventListener("fullscreenchange",f);},[]);
  useEffect(()=>{if(!full)return;const k=e=>{if(e.key==="Escape"&&!document.fullscreenElement)setFull(false);};window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k);},[full]);
  const toggleFull=()=>{
    if(document.fullscreenElement){document.exitFullscreen().catch(()=>{});setFull(false);return;}
    if(full){setFull(false);return;}
    const el=cardRef.current;
    if(el&&el.requestFullscreen){el.requestFullscreen().then(()=>setFull(true)).catch(()=>setFull(true));}
    else setFull(true);
  };
  const meta=NET_ANALYSES.find(a=>a.id===analysis)||NET_ANALYSES[0];
  const effUnit=meta.units.includes(unit)?unit:meta.units[0];
  const prepared=useMemo(()=>{const canon=canonicalizeAuthors(records).records;return{records:canon,citedRefs:buildCitedRefsList(canon)};},[records]);
  const result=useMemo(()=>buildAnalysisNetwork({...prepared,analysis,unit:effUnit,minDocs,minCites,maxNodes}),[prepared,analysis,effUnit,minDocs,minCites,maxNodes]);
  const filt=useMemo(()=>filterComponents(result.network,comp),[result,comp]);
  const net=filt.network;
  const laid=useMemo(()=>layout==="d3"?null:layoutNetwork(net,layout,{attr,rep,grav,vosA,vosR,norm}),[net,layout,attr,rep,grav,vosA,vosR,norm]);
  const clus=useMemo(()=>clusterNetwork(net,{resolution:res,minSize:minCl}),[net,res,minCl]);
  const netC=useMemo(()=>({...net,nodes:net.nodes.map(n=>({...n,cluster:clus.byId.get(n.id)}))}),[net,clus]);
  const sna=useMemo(()=>computeNetworkMetrics(net.nodes.map(n=>n.id),net.layoutLinks||net.links,{weighted:pathW==="weighted",clusters:clus.byId}),[net,pathW,clus]);
  const sizeVal=useMemo(()=>sizeBy==="docs"?null:new Map(sna.nodes.map(n=>[n.id,n[sizeBy]])),[sna,sizeBy]);
  // Manual positions belong to one analysis and layout; they are cleared when either changes
  useEffect(()=>{setOver({});setSel(null);},[laid]);
  const graphH=full?Math.max(400,vh-260):Math.max(420,Math.round((w||800)*0.62));
  const sc=Math.min(w||800,graphH)*0.44;
  const base=useMemo(()=>laid?laid.nodes.map(n=>over[n.id]?{...n,x:over[n.id].x,y:over[n.id].y}:n):[],[laid,over]);
  // positions drawn: layout + manual moves, then the chosen share of overlap removed
  const disp=useMemo(()=>{
    if(!base.length||ovKd<=0)return over;
    const rF=nodeRadiusFn(base,sizeVal);
    return reduceOverlap(base,ovKd,sc,n=>rF(n)*scale);
  },[base,ovKd,sc,scale,over,sizeVal]);
  const shown=useMemo(()=>laid?laid.nodes.map(n=>disp[n.id]?{...n,x:disp[n.id].x,y:disp[n.id].y}:n):[],[laid,disp]);
  const hasSliders=layout==="fa2";
  const manual=layout!=="d3";

  // Arrow keys nudge the selected node: 2 px, or 10 px with Shift, converted to the unzoomed graph scale
  const dispRef=useRef(disp);dispRef.current=disp;
  useEffect(()=>{
    if(!sel||!laid)return;
    const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    const laidMap=new Map(laid.nodes.map(n=>[n.id,n]));
    const k=e=>{
      if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
      const dd=dirs[e.key];if(!dd)return;
      e.preventDefault();
      const step=(e.shiftKey?10:2)/sc;
      setOver(o=>{const b=dispRef.current[sel]||o[sel]||laidMap.get(sel);if(!b)return o;return{...o,[sel]:{x:b.x+dd[0]*step,y:b.y+dd[1]*step}};});
    };
    window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k);
  },[sel,laid,sc]);


  const selStyle={background:C.card,color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 8px",fontSize:12,fontFamily:"inherit"};
  const btnStyle={...selStyle,cursor:"pointer"};
  const numStyle={...selStyle,width:80};
  const field=(t,el)=><label style={{display:"flex",flexDirection:"column",gap:4,fontSize:10,color:C.textDim,letterSpacing:1,textTransform:"uppercase"}}>{t}{el}</label>;
  const slider=(t,v,set,min,max,step)=>field(`${t} ${v.toFixed(2)}`,<input type="range" min={min} max={max} step={step} value={v} onChange={e=>set(+e.target.value)} style={{width:150,accentColor:C.accent}}/>);
  const help=analysis==="cocitation"
    ? "Min. documents = number of citing records in the collection. Min. citations applies to the document level only (local citations)."
    : analysis==="coupling"
    ? "Min. documents = number of records behind the node. Min. citations = sum of the records' citations. Link strength = number of shared references."
    : "Min. documents = number of records behind the node. Min. citations = sum of the records' citations. Link strength = number of shared records.";
  const layoutHelp=layout==="fa2"
    ? "Attraction pulls linked nodes together. Repulsion pushes all nodes apart. Gravity pulls towards the center."
    : layout==="vos"
    ? "VOS-inspired layout: the same quality function as VOSviewer, independent implementation. Attraction must be greater than repulsion; VOSviewer recommends 2 and 1 (alternatives: 2 and 0, 1 and 0). Association strength is VOSviewer's default normalization."
    : layout==="stress"
    ? "Stress majorization: distances on screen follow the shortest paths in the network. No settings."
    : "The default layout of versions 0.4 and 0.5 (d3-force). Layout settings, node and label size and manual moves do not apply here.";
  return(<div ref={cardRef} style={full?{position:"fixed",inset:0,zIndex:1000,background:C.bg,overflow:"auto",padding:16,boxSizing:"border-box"}:undefined}>
    <Card style={full?{minHeight:"100%",boxSizing:"border-box"}:undefined}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <SectionTitle icon="🕸️">Networks</SectionTitle>
        <button onClick={toggleFull} style={{...btnStyle,marginBottom:16}}>{full?"⤡ Exit full screen (Esc)":"⛶ Full screen"}</button>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:16,alignItems:"flex-end",marginBottom:10}}>
        {field("Analysis",<select value={analysis} onChange={e=>setAnalysis(e.target.value)} style={selStyle}>{NET_ANALYSES.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select>)}
        {field("Unit",<select value={effUnit} onChange={e=>setUnit(e.target.value)} style={selStyle}>{meta.units.map(u=><option key={u} value={u}>{NET_UNITS[u]}</option>)}</select>)}
        {field("Min. documents",<input type="number" min={1} value={minDocs} onChange={e=>setMinDocs(Math.max(1,+e.target.value||1))} style={numStyle}/>)}
        {field("Min. citations",<input type="number" min={0} value={minCites} onChange={e=>setMinCites(Math.max(0,+e.target.value||0))} style={numStyle}/>)}
        {field("Max. nodes",<input type="number" min={10} max={500} value={maxNodes} onChange={e=>setMaxNodes(Math.min(500,Math.max(10,+e.target.value||150)))} style={numStyle}/>)}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:16,alignItems:"flex-end",marginBottom:10}}>
        {field("Show",<select value={comp} onChange={e=>setComp(e.target.value)} style={selStyle} title="Nodes without links are placed on a ring around the network when all nodes are shown">
          <option value="main">Main component</option><option value="all">All components</option><option value="full">All nodes (incl. unlinked)</option></select>)}
        {field("Layout",<select value={layout} onChange={e=>setLayout(e.target.value)} style={selStyle}><option value="fa2">ForceAtlas2</option><option value="vos">VOS-inspired</option><option value="stress">Stress majorization</option><option value="d3">Force (classic)</option></select>)}
        {hasSliders&&slider("Attraction",attr,setAttr,0.1,5,0.1)}
        {hasSliders&&slider("Repulsion",rep,setRep,0.1,5,0.1)}
        {layout==="fa2"&&slider("Gravity",grav,setGrav,0,0.5,0.01)}
        {layout==="vos"&&field("Normalization",<select value={norm} onChange={e=>setNorm(e.target.value)} style={selStyle}><option value="assoc">Association strength</option><option value="none">None</option></select>)}
        {layout==="vos"&&field("Attraction",<select value={vosA} onChange={e=>{const v=+e.target.value;setVosA(v);if(vosR>=v)setVosR(v-1);}} style={selStyle}>{[-1,0,1,2].map(v=><option key={v} value={v}>{v}</option>)}</select>)}
        {layout==="vos"&&field("Repulsion",<select value={vosR} onChange={e=>setVosR(+e.target.value)} style={selStyle}>{[-2,-1,0,1].filter(v=>v<vosA).map(v=><option key={v} value={v}>{v}</option>)}</select>)}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:16,alignItems:"flex-end",marginBottom:10}}>
        {field("Cluster resolution",<input type="number" min={0.05} max={10} step={0.1} value={res} onChange={e=>setRes(Math.min(10,Math.max(0.05,+e.target.value||1)))} style={numStyle}/>)}
        {field("Min. cluster size",<input type="number" min={1} max={100} value={minCl} onChange={e=>setMinCl(Math.min(100,Math.max(1,Math.round(+e.target.value||1))))} style={numStyle}/>)}
        {field("Node size by",<select value={sizeBy} onChange={e=>setSizeBy(e.target.value)} style={selStyle} title="Documents/occurrences as before, or one of the metrics under Network statistics">{SNA_SIZE_OPTS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>)}
        {slider("Node size",scale,setScale,0.3,4,0.1)}
        {field(`Label size ${labelSize} px`,<input type="range" min={6} max={24} step={1} value={labelSize} onChange={e=>setLabelSize(+e.target.value)} style={{width:150,accentColor:C.accent}}/>)}
      </div>
      {manual&&<div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",marginBottom:10}}>
        {field(`Remove overlap ${Math.round(ovK*100)} %`,<input type="range" min={0} max={1} step={0.05} value={ovK} onChange={e=>setOvK(+e.target.value)} title="0 % = layout as computed; 100 % = no circles overlap" style={{width:150,accentColor:C.accent}}/>)}
        <button onClick={()=>{setOver({});setOvK(0);}} disabled={!Object.keys(over).length&&!ovK} style={btnStyle}>Reset positions</button>
        <span style={{fontSize:10,color:C.textDim}}>{sel?`Selected: ${sel} · arrow keys move it 2 px (Shift: 10 px)`:"Drag a node to move it. Click a node to select it, then use the arrow keys."}</span>
      </div>}
      <div style={{fontSize:11,color:C.textDim,marginBottom:6}}>
        {result.total} of {result.candidates} nodes meet the thresholds · {result.shown} selected ({filt.info.components} connected component{filt.info.components===1?"":"s"}, largest {filt.info.main} nodes; {filt.info.isolates} without links) · showing {net.nodes.length} nodes and {net.links.length} links{(net.layoutLinks||[]).length>net.links.length?` (the layout uses all ${(net.layoutLinks||[]).length})`:""}
      </div>
      <div style={{fontSize:10,color:C.textDim,opacity:.8,marginBottom:4}}>{help}</div>
      <div style={{fontSize:10,color:C.textDim,opacity:.8,marginBottom:12}}>{layoutHelp} Colors show clusters (VOSviewer's clustering principle; a higher resolution gives more and smaller clusters). Manual positions are reset when the analysis, thresholds, layout or layout settings change.</div>
      <div ref={wr} style={{width:"100%"}}>
        {net.nodes.length
          ?(layout==="d3"?<ForceNetwork network={netC}/>:<StaticNetwork network={laid} w={w} h={graphH} overrides={disp} selected={sel} onMove={(id,x,y)=>setOver(o=>({...o,[id]:{x,y}}))} onSelect={setSel} clusters={clus.byId} scale={scale} labelSize={labelSize} sizeVal={sizeVal}/>)
          :<div style={{color:C.textDim,padding:20}}>No nodes meet the thresholds.</div>}
      </div>
      {net.nodes.length>0&&<div style={{marginTop:12,fontSize:11,color:C.textDim}}>
        <div style={{marginBottom:6}}>{clus.clusters.length} cluster{clus.clusters.length===1?"":"s"}{clus.unclustered?` · ${clus.unclustered} unlinked node${clus.unclustered===1?"":"s"} (gray)`:""}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"4px 16px"}}>
          {clus.clusters.slice(0,30).map(c=><div key={c.id} style={{display:"flex",gap:6,alignItems:"baseline"}}>
            <span style={{width:10,height:10,borderRadius:5,background:clusterColor(c.id),flex:"none",display:"inline-block"}}/>
            <span style={{color:C.text,whiteSpace:"nowrap"}}>Cluster {c.id+1}</span><span style={{whiteSpace:"nowrap"}}>({c.size})</span>
            <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={c.members.map(m=>m.id).join("; ")}>{c.members.slice(0,3).map(m=>m.id).join(" · ")}</span>
          </div>)}
        </div>
        {clus.clusters.length>30&&<div style={{marginTop:4}}>… and {clus.clusters.length-30} more clusters.</div>}
      </div>}
      {net.nodes.length>0&&<NetworkStats m={sna} clusters={clus.byId} sel={sel} onSelect={id=>setSel(s=>s===id?null:id)} pathW={pathW} setPathW={setPathW}
        nodeLabel={NET_UNITS[effUnit]} fileTag={`${analysis}-${effUnit}`}/>}
    </Card>
  </div>);
}


/* ═══ SOURCES, FILES AND MERGED RECORDS (0.994) ═══ */
const srcsOf=r=>[...new Set(r._mergedFrom||[r._src])];
const SRC_ORDER=["wos","scopus","openalex","manual"];
const srcSort=a=>[...a].sort((x,y)=>(SRC_ORDER.indexOf(x)+99)%99-(SRC_ORDER.indexOf(y)+99)%99);
function SourcesPanel({D,fileLog,openSet}){
  const ed=useContext(EditCtx);const prefs=ed?.mergePrefs||{};
  const recs=D.records;const ds=D.dedupStats;
  const link=(n,title,ix,color)=>n>0?<span role="button" onClick={()=>openSet(title,ix)} title="List these records"
    style={{color:color||C.accent,fontWeight:700,cursor:"pointer",textDecoration:"underline",textDecorationColor:`${color||C.accent}66`,textUnderlineOffset:3,fontFamily:mono}}>{n.toLocaleString()}</span>:<span style={{color:C.textDim,fontFamily:mono}}>0</span>;
  const{bySrc,combos,merged}=useMemo(()=>{
    const bySrc=new Map(),combos=new Map(),merged=[];
    recs.forEach((r,i)=>{const ss=srcSort(srcsOf(r));for(const s of ss){if(!bySrc.has(s))bySrc.set(s,{all:[],only:[]});bySrc.get(s).all.push(i);if(ss.length===1)bySrc.get(s).only.push(i);}
      const k=ss.join("+");if(!combos.has(k))combos.set(k,{ss,ix:[]});combos.get(k).ix.push(i);if(r._versions)merged.push(i);});
    return{bySrc:srcSort([...bySrc.keys()]).map(s=>({s,...bySrc.get(s)})),combos:[...combos.values()].sort((a,b)=>b.ix.length-a.ix.length),merged};
  },[recs]);
  const groups=useMemo(()=>FIELD_GROUPS.map(g=>({g,diff:merged.filter(i=>groupDiffers(recs[i],g)),
    srcs:srcSort([...new Set(merged.flatMap(i=>recs[i]._versions.filter(v=>!groupEmpty(v,g)).map(v=>v.src)))]),
    own:merged.filter(i=>recs[i]._pick&&recs[i]._pick[g.k]).length})),[recs,merged]);
  const name=s=><span style={{color:SRC_COLORS[s]||C.textDim,fontWeight:600}}>{SRC_LABELS[s]||s}</span>;
  const th={textAlign:"left",fontSize:10,fontFamily:mono,textTransform:"uppercase",letterSpacing:1,color:C.textDim,padding:"4px 10px 6px 0",fontWeight:500};
  const td={padding:"5px 10px 5px 0",fontSize:12,borderTop:`1px solid ${C.border}`,verticalAlign:"top"};
  const files=fileLog||[];
  return(<Card>
    <SectionTitle icon="🗂️">Sources, files and merged records</SectionTitle>
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:28}}>
      <div>
        <table style={{borderCollapse:"collapse",width:"100%"}}><thead><tr><th style={th}>Database</th><th style={th}>Records</th><th style={th}>Only here</th><th style={th}>Also elsewhere</th></tr></thead>
          <tbody>{bySrc.map(({s,all,only})=><tr key={s}>
            <td style={td}><span role="button" onClick={()=>openSet(`Records from ${SRC_LABELS[s]||s}`,all)} style={{cursor:"pointer",textDecoration:"underline",textDecorationColor:`${SRC_COLORS[s]||C.textDim}66`,textUnderlineOffset:3}}>{name(s)}</span></td>
            <td style={td}>{link(all.length,`Records from ${SRC_LABELS[s]||s}`,all,SRC_COLORS[s])}</td>
            <td style={td}>{link(only.length,`Only in ${SRC_LABELS[s]||s}`,only,SRC_COLORS[s])}</td>
            <td style={td}>{link(all.length-only.length,`In ${SRC_LABELS[s]||s} and another database`,all.filter(i=>srcsOf(recs[i]).length>1),SRC_COLORS[s])}</td></tr>)}</tbody></table>
        {combos.length>1&&<div style={{marginTop:14}}>
          <div style={{...th,padding:"0 0 6px"}}>Combinations</div>
          {combos.map(c=><div key={c.ss.join("+")} style={{display:"flex",gap:10,fontSize:12,padding:"3px 0"}}>
            <span style={{flex:1}}>{c.ss.map((s,k)=><span key={s}>{k?" + ":""}{name(s)}</span>)}{c.ss.length===1?<span style={{color:C.textDim}}> only</span>:null}</span>
            {link(c.ix.length,c.ss.map(s=>SRC_LABELS[s]||s).join(" + ")+(c.ss.length===1?" only":""),c.ix)}</div>)}
        </div>}
      </div>
      <div>
        <div style={{...th,padding:"0 0 6px"}}>Files read ({files.length||"–"})</div>
        {files.length?files.map((f,k)=><div key={k} style={{display:"flex",gap:10,fontSize:11.5,padding:"3px 0",borderTop:k?`1px solid ${C.border}`:"none"}}>
          <span style={{flex:1,fontFamily:mono,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={f.name}>{f.name}</span>
          <span style={{whiteSpace:"nowrap"}}>{f.src?(f.enrich?<span style={{color:C.textDim}}>open indicators (Augmenter)</span>:f.src==="biblioscope"?<span style={{color:C.textDim}}>BiblioScope collection</span>:name(f.src)):<span style={{color:C.rose}}>not recognised</span>}</span>
          <span style={{fontFamily:mono,color:C.textDim,minWidth:70,textAlign:"right"}}>{f.n.toLocaleString()} rec.</span></div>)
          :<Note>File names are recorded from version 0.994; load the files again to see them here.</Note>}
        {ds&&<div style={{marginTop:12,fontSize:11.5,color:C.text,lineHeight:1.6}}>
          {ds.input.toLocaleString()} records read, <b style={{color:C.accent}}>{(ds.removed||0).toLocaleString()}</b> duplicate{ds.removed===1?"":"s"} merged
          {" "}→ {recs.length.toLocaleString()} records.{ds.enrichInput?<> Open indicators from the Augmenter added to {(ds.enriched||0).toLocaleString()} records.</>:null}
          <div style={{color:C.textDim,fontFamily:mono,fontSize:10.5}}>Matches{ds.enrichInput?" (including Augmenter records)":""}: {[ds.byDoi&&`DOI ${ds.byDoi}`,ds.byTitle&&`title ${ds.byTitle}`,ds.byFuzzy&&`fuzzy title ${ds.byFuzzy}`].filter(Boolean).join(" · ")||"none"}{ds.rejectedNoCorroboration?<span title="Title or DOI matched but no shared author or nearby year — left unmerged"> · rejected {ds.rejectedNoCorroboration}</span>:null}</div></div>}
      </div>
    </div>
    {merged.length>0&&<div style={{marginTop:22}}>
      <div style={{fontSize:12,color:C.text,marginBottom:6}}><b>{link(merged.length,"Merged records",merged)}</b> records are merged from more than one record. Open one to see what each database holds and to choose per record.</div>
      <Note>Automatic: for each field the most complete value, with Web of Science before Scopus before OpenAlex when they are equally complete; keywords, subject categories and organisations are combined from all versions. Choosing a database takes that database's value for every merged record that has it; records without it keep the automatic value. Cited references are not switched (their format and matching depend on the database).</Note>
      <table style={{borderCollapse:"collapse",width:"100%"}}><thead><tr><th style={th}>Fields</th><th style={th}>Databases differ</th><th style={th}>Take from</th><th style={th}>Own choice</th></tr></thead>
        <tbody>{groups.map(({g,diff,srcs,own})=><tr key={g.k}>
          <td style={td}>{g.l}{g.note&&<div style={{fontSize:10,color:C.textDim}}>{g.note}</div>}</td>
          <td style={td}>{g.cmp?link(diff.length,`Merged records where the databases differ: ${g.l.toLowerCase()}`,diff):<span style={{color:C.textDim,fontSize:10.5}}>not compared</span>}</td>
          <td style={td}><select value={prefs[g.k]||"auto"} onChange={e=>ed&&ed.setMergePref(g.k,e.target.value)} disabled={!ed||srcs.length<1}
            style={{background:C.bg,color:C.text,border:`1px solid ${prefs[g.k]?C.accent:C.border}`,borderRadius:5,fontSize:11,padding:"3px 6px",fontFamily:mono}}>
            <option value="auto">Automatic</option>{srcs.map(s=><option key={s} value={s}>{SRC_LABELS[s]||s}</option>)}</select></td>
          <td style={td}>{own?link(own,`Records with their own choice: ${g.l.toLowerCase()}`,merged.filter(i=>recs[i]._pick&&recs[i]._pick[g.k])):<span style={{color:C.textDim,fontFamily:mono}}>–</span>}</td></tr>)}</tbody></table>
    </div>}
  </Card>);
}

/* ═══ PROVENANCE OF ONE RECORD ═══ */
function RecordProvenance({r}){
  const ed=useContext(EditCtx);const prefs=ed?.mergePrefs||{};
  const[open,setOpen]=useState(false);
  if(!r._versions)return<div style={{fontSize:11,color:C.textDim,marginTop:10}}>From {SRC_LABELS[r._src]||r._src}{r._file?<> · file <span style={{fontFamily:mono}}>{r._file}</span></>:null}; not merged with another record.</div>;
  const vs=r._versions;const nDiff=FIELD_GROUPS.filter(g=>groupDiffers(r,g)).length;
  const small={...btnBase,background:"transparent",border:`1px solid ${C.border}`,fontSize:10,padding:"2px 8px"};
  return(<div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <span style={{fontWeight:700,color:C.textBright,fontSize:12}}>Merged from {vs.length} records:</span>
      {vs.map((v,i)=><span key={i} style={{fontSize:11}}><span style={{color:SRC_COLORS[v.src]||C.textDim,fontWeight:600}}>{versionLabel(r,i)}</span>{v.file?<span style={{fontFamily:mono,color:C.textDim}}> ({v.file})</span>:null}</span>)}
      <button onClick={()=>setOpen(o=>!o)} style={{...small,color:C.accent,marginLeft:"auto"}}>{open?"Hide":"Show"} what each database holds{nDiff?` · ${nDiff} field group${nDiff===1?"":"s"} differ`:""}</button>
    </div>
    {open&&<div style={{marginTop:10,overflowX:"auto"}}>
      <table style={{borderCollapse:"collapse",width:"100%",fontSize:11}}>
        <thead><tr><th style={{textAlign:"left",padding:"4px 8px 4px 0",color:C.textDim,fontWeight:500,fontFamily:mono,fontSize:10,width:130}}>Fields</th>
          {vs.map((v,i)=><th key={i} style={{textAlign:"left",padding:"4px 8px",color:SRC_COLORS[v.src]||C.textDim,fontFamily:mono,fontSize:10}}>{versionLabel(r,i)}</th>)}
          <th style={{textAlign:"left",padding:"4px 8px",color:C.textDim,fontFamily:mono,fontSize:10}}>Automatic</th></tr></thead>
        <tbody>{FIELD_GROUPS.map(g=>{const ch=groupChoice(r,g,prefs);const own=r._pick&&r._pick[g.k];const differs=groupDiffers(r,g);
          const cell=(o,key,active,onUse,empty)=><td key={key} style={{padding:"6px 8px",verticalAlign:"top",borderTop:`1px solid ${C.border}`,background:active?`${C.accent}14`:"transparent",outline:active?`1px solid ${C.accent}55`:"none",maxWidth:260}}>
            <div style={{color:empty?C.textDim:C.text,lineHeight:1.45,wordBreak:"break-word"}}>{empty?"—":groupText(o,g)}</div>
            {active?<div style={{fontSize:9.5,color:C.accent,fontFamily:mono,marginTop:3}}>✓ in use</div>
              :(!empty&&ed&&<button onClick={onUse} style={{...small,marginTop:4,color:C.textBright}}>Use</button>)}</td>;
          return<tr key={g.k}>
            <td style={{padding:"6px 8px 6px 0",verticalAlign:"top",borderTop:`1px solid ${C.border}`,color:C.textBright}}>{g.l}
              {differs&&<div style={{fontSize:9.5,color:C.rose,fontFamily:mono}}>differ</div>}
              {own&&<div style={{fontSize:9.5,color:C.purple,fontFamily:mono}}>{own==="edit"?"edited":"own choice"} · <span role="button" onClick={()=>ed&&ed.setPick(r._id,g.k,null)} style={{cursor:"pointer",textDecoration:"underline"}}>reset</span></div>}</td>
            {vs.map((v,i)=>cell(v,i,ch==="v"+i,()=>ed.setPick(r._id,g.k,"v"+i),groupEmpty(v,g)))}
            {cell(ch==="edit"?(r._edit||r._auto):r._auto,"a",ch==="auto"||ch==="edit",()=>ed.setPick(r._id,g.k,"auto"),groupEmpty(r._auto,g))}
          </tr>;})}
          <tr><td style={{padding:"6px 8px 6px 0",borderTop:`1px solid ${C.border}`,color:C.textBright}}>Cited references</td>
            {vs.map((v,i)=><td key={i} style={{padding:"6px 8px",borderTop:`1px solid ${C.border}`,color:C.text,fontFamily:mono}}>{v.nr||0}</td>)}
            <td style={{padding:"6px 8px",borderTop:`1px solid ${C.border}`,color:C.textDim}}>{r.nr||0} · the longest list is used</td></tr>
        </tbody></table>
      <Note>"Use" takes that version for this record only; the choice is saved with the collection and recomputes all statistics. The choice for the whole collection is made in the Preview tab.</Note>
    </div>}
  </div>);
}

function SourceVariantsCard({variants}){
  const[all,setAll]=useState(false);if(!variants||!variants.length)return null;
  const rows=[...variants].sort((a,b)=>b.variants.length-a.variants.length||a.name.localeCompare(b.name));const shown=all?rows:rows.slice(0,15);
  return<Card><SectionTitle icon="🔗">Source names merged</SectionTitle>
    <Note>Records are joined into one source by ISSN (print and electronic) and by the same name regardless of case and punctuation; proceedings and book chapters only by name. The name shown is the most frequent one written in mixed case, otherwise the capitalised form.</Note>
    <table style={{borderCollapse:"collapse",width:"100%",fontSize:11.5}}><thead><tr>{["Shown as","ISSN","Also written as"].map(h=><th key={h} style={{textAlign:"left",fontSize:10,fontFamily:mono,color:C.textDim,fontWeight:500,padding:"4px 10px 6px 0",textTransform:"uppercase",letterSpacing:1}}>{h}</th>)}</tr></thead>
      <tbody>{shown.map((v,k)=><tr key={k}><td style={{padding:"5px 10px 5px 0",borderTop:`1px solid ${C.border}`,color:C.textBright}}>{v.name}</td>
        <td style={{padding:"5px 10px 5px 0",borderTop:`1px solid ${C.border}`,fontFamily:mono,color:C.textDim,whiteSpace:"nowrap"}}>{v.issn.join(", ")||"–"}</td>
        <td style={{padding:"5px 0",borderTop:`1px solid ${C.border}`,color:C.text}}>{v.variants.join(" · ")}</td></tr>)}</tbody></table>
    {rows.length>15&&<button onClick={()=>setAll(a=>!a)} style={{...btnBase,background:"transparent",border:`1px solid ${C.border}`,color:C.accent,marginTop:10}}>{all?"Show fewer":`Show all ${rows.length}`}</button>}
  </Card>;
}
function Dashboard({records,D,fileCount,fileLog,onReset,tab,setTab,focus,onFocusDone,saveState,onExport,onExportWos,themeBtn}){
  const recordCount=D.summary.total;
  const[recView,setRecView]=useState(null);
  const openSet=(title,indices)=>{if(indices&&indices.length)setRecView({set:{title:`${title} · ${indices.length} record${indices.length===1?"":"s"}`,indices}});};
  const[exportOpen,setExportOpen]=useState(false);
  useEffect(()=>{if(!exportOpen)return;const h=()=>setExportOpen(false);const t=setTimeout(()=>window.addEventListener("click",h),0);return()=>{clearTimeout(t);window.removeEventListener("click",h);};},[exportOpen]);const hasMultiYear=D.pubByYear.length>1;const hc=D.histcite;
  return(
    <div style={{background:C.bg,color:C.text,minHeight:"100vh",fontFamily:"system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"}}>
      <div style={{padding:"32px 36px 20px",borderBottom:`1px solid ${C.border}`,background:`linear-gradient(180deg,${C.cardHover} 0%,${C.bg} 100%)`}}>
        <div style={{display:"flex",alignItems:"baseline",gap:16,flexWrap:"wrap"}}>
          <h1 style={{fontSize:32,fontWeight:900,margin:0,fontFamily:"Georgia,'Times New Roman',serif",color:C.textBright}}>Biblio<span style={{color:C.accent}}>Scope</span><span style={{fontSize:11,fontWeight:400,fontFamily:mono,color:C.textDim,marginLeft:10,letterSpacing:1}}>v0.996</span></h1>
          <span style={{fontSize:11,color:C.textDim,fontFamily:mono}}>{recordCount.toLocaleString()} records · {fileCount} file{fileCount>1?"s":""} · {D.summary.yearRange}</span>
          <SourceBadges srcCounts={D.srcCounts} onClick={s=>openSet(`Records from ${SRC_LABELS[s]||s}`,D.records.map((r,i)=>srcsOf(r).includes(s)?i:-1).filter(i=>i>=0))}/>
          <span style={{marginLeft:"auto",fontSize:10,fontFamily:mono,color:saveState==="error"?C.rose:C.textDim}} title="The collection, including your additions, edits and removals, is kept in this browser">
            {saveState==="saving"?"Saving…":saveState==="saved"?"✓ Saved in this browser":saveState==="error"?"Not saved — browser storage unavailable":""}</span>
          <div style={{position:"relative"}}>
            <button onClick={()=>setExportOpen(o=>!o)} style={{background:"transparent",color:C.accent,border:`1px solid ${C.accent}66`,borderRadius:6,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:mono}}>⤓ Export ▾</button>
            {exportOpen&&<div style={{position:"absolute",right:0,top:"calc(100% + 6px)",zIndex:60,width:320,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 12px 32px rgba(0,0,0,.55)",overflow:"hidden"}}>
              {[{l:"BiblioScope collection (.json)",d:"Everything, including your links and edits — load it here again to continue working.",fn:onExport},
                {l:"Web of Science format (.txt)",d:"For VOSviewer and other tools that read WoS plain-text files. All sources written as WoS records.",fn:onExportWos}].map((o,i)=>(
                <button key={i} onClick={()=>{setExportOpen(false);o.fn();}} style={{display:"block",width:"100%",textAlign:"left",background:"transparent",border:"none",borderTop:i?`1px solid ${C.border}`:"none",padding:"11px 14px",cursor:"pointer"}}
                  onMouseEnter={e=>e.currentTarget.style.background=`${C.accent}10`} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{fontSize:12,color:C.textBright,fontWeight:600}}>{o.l}</div>
                  <div style={{fontSize:10.5,color:C.textDim,marginTop:3,lineHeight:1.45}}>{o.d}</div>
                </button>))}
            </div>}
          </div>
          {themeBtn}
          <button onClick={onReset} style={{background:"transparent",color:C.textDim,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:mono}}>↩ New Upload</button>
        </div>
        <div style={{display:"flex",gap:12,marginTop:22,flexWrap:"wrap"}}>
          <StatCard label="Publications" value={D.summary.total.toLocaleString()}/><StatCard label="Total Citations" value={D.summary.totalCitations.toLocaleString()} sub={`${D.summary.avgCitations} avg/paper`}/><StatCard label="Authors" value={D.summary.totalAuthors.toLocaleString()} sub={D.authorVariants?.length?`${D.authorVariants.reduce((s,v)=>s+v.variants.length,0).toLocaleString()} spelling variants merged`:undefined}/><StatCard label="Journals" value={D.summary.totalJournals} sub={D.sourceVariants?.length?`${D.sourceVariants.reduce((s,v)=>s+v.variants.length,0).toLocaleString()} name variants merged`:undefined}/><StatCard label="Cited Refs" value={(D.summary.totalCitedRefs||0).toLocaleString()}/><StatCard label="Local Links" value={hc.edges.length}/>
        </div>
        <div style={{display:"flex",gap:0,marginTop:22,flexWrap:"wrap",overflowX:"auto"}}>
          {TABS.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?C.card:"transparent",color:tab===t.id?C.accent:C.textDim,border:tab===t.id?`1px solid ${C.border}`:"1px solid transparent",borderBottom:tab===t.id?`1px solid ${C.card}`:"1px solid transparent",borderRadius:"8px 8px 0 0",padding:"10px 14px",fontSize:11,fontWeight:600,cursor:"pointer",letterSpacing:.3,fontFamily:mono,transition:"all .2s",whiteSpace:"nowrap"}}>{t.label}</button>))}
        </div>
      </div>
      <div style={{padding:"28px 36px 48px",maxWidth:1200,margin:"0 auto"}}>
        {tab==="overview"&&(<div style={{display:"flex",flexDirection:"column",gap:24}}>
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:24}}>{hasMultiYear?<Card><SectionTitle icon="📅">Publications by Year</SectionTitle><YearChart data={D.pubByYear}/></Card>:null}<Card><SectionTitle icon="📊">Citation Distribution</SectionTitle><CitationHist data={D.citeDist}/></Card></div>
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:24}}><Card><SectionTitle icon="🌍">Publications by Country</SectionTitle><WorldMap stats={D.countryStats} fallback={<HBarChart data={D.topCountries.slice(0,15)} color={C.teal} labelWidth={120}/>}/></Card><Card><SectionTitle icon="📰">Document Types</SectionTitle><div style={{display:"flex",gap:20,alignItems:"center"}}><DonutChart data={D.docTypes} width={200} height={200}/><div style={{display:"flex",flexDirection:"column",gap:6}}>{D.docTypes.map((d,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}><div style={{width:10,height:10,borderRadius:2,background:PAL[i],opacity:.8}}/><span style={{color:C.text}}>{d.name}</span><span style={{color:C.textDim,fontFamily:mono,marginLeft:"auto"}}>{d.count}</span></div>))}</div></div></Card></div>
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:24}}><Card><SectionTitle icon="🏛️">Top Institutions</SectionTitle><HBarChart data={D.topOrgs.slice(0,15)} color={C.purple} labelWidth={230} maxChars={36}/></Card><Card><SectionTitle icon="🔓">Open Access</SectionTitle><div style={{display:"flex",flexDirection:"column",gap:8}}>{D.openAccess.map((d,i)=>{const mx=D.openAccess[0]?.count||1;return(<div key={i}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}><span style={{color:C.text}}>{d.name}</span><span style={{color:C.textDim,fontFamily:mono}}>{d.count}</span></div><div style={{height:8,background:C.bg,borderRadius:4,overflow:"hidden"}}><div style={{width:`${(d.count/mx)*100}%`,height:"100%",borderRadius:4,background:PAL[i],opacity:.7}}/></div></div>);})}</div></Card></div>
        </div>)}

        {tab==="preview"&&<SourcesPanel D={D} fileLog={fileLog} openSet={openSet}/>}
        {tab==="collection"&&<CollectionPanel D={D} focus={focus} onFocusDone={onFocusDone}/>}

        {tab==="journals"&&(<div style={{display:"flex",flexDirection:"column",gap:24}}><div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:24}}><Card><SectionTitle icon="📚">Top Journals</SectionTitle><HBarChart data={D.topJournals} maxItems={20} color={C.accent} labelWidth={200}/></Card><Card><SectionTitle icon="👤">Most Prolific Authors</SectionTitle><HBarChart data={D.topAuthors} maxItems={20} color={C.teal} labelWidth={140}/></Card><Card style={{gridColumn:"1/-1"}}><SectionTitle icon="🏛️">Top Organizations</SectionTitle><HBarChart data={D.topOrgs} maxItems={20} color={C.purple} labelWidth={200}/></Card></div><SourceVariantsCard variants={D.sourceVariants}/></div>)}
        {tab==="subjects"&&(<div style={{display:"flex",flexDirection:"column",gap:24}}><Card><SectionTitle icon="🗺️">Categories / Topics — Treemap</SectionTitle><Treemap data={D.topWC}/></Card><Card><SectionTitle icon="🔬">Research Areas</SectionTitle><HBarChart data={D.topSC} maxItems={20} color={C.green} labelWidth={220}/></Card></div>)}
        {tab==="keywords"&&(<div style={{display:"flex",flexDirection:"column",gap:24}}><Card><SectionTitle icon="💬">Keyword Cloud</SectionTitle><KeywordCloud keywords={D.topKeywords}/></Card><Card><SectionTitle icon="🔑">Top Keywords</SectionTitle><HBarChart data={D.topKeywords.slice(0,30)} maxItems={30} color={C.orange} labelWidth={180}/></Card></div>)}
        {tab==="network"&&<NetworkPanel records={D.records}/>}
        {tab==="histcite"&&<HistCitePanel hc={hc} records={D.records}/>}
        {tab==="papers"&&(<Card><SectionTitle icon="🏆">Most Cited Publications</SectionTitle><TopPapers papers={D.topPapers}/></Card>)}
        {tab==="citedrefs"&&<CitedRefsPanel D={D}/>}
        {tab==="comparison"&&<ComparisonPanel D={D}/>}
        {tab==="indicators"&&<IndicatorsPanel D={D}/>}
      </div>
      <div style={{textAlign:"center",padding:"24px 36px",borderTop:`1px solid ${C.border}`,fontSize:10,color:C.textDim,fontFamily:mono}}>BiblioScope · Web of Science + Scopus + OpenAlex · {recordCount.toLocaleString()} records</div>
      {recView&&<RecordOverlay view={recView} setView={setRecView} records={D.records} hc={hc}/>}
    </div>
  );
}

/* ═══ APP ═══ */
export default function App(){
  const[records,setRecords]=useState(null);
  const[removed,setRemoved]=useState([]);           // [{rec, index, at}]
  const[meta,setMeta]=useState({files:0,dedupStats:null});
  const[tab,setTab]=useState("overview");
  const[theme,setThemeState]=useState(savedTheme);
  const toggleTheme=()=>{const t=theme==="light"?"dark":"light";const prev={...C};applyTheme(t);recolorCharts(prev,C);try{localStorage.setItem("biblioscope-theme",t);}catch(e){}setThemeState(t);};
  const[editing,setEditing]=useState(null);         // {base: record|null}
  const[focus,setFocus]=useState(null);             // {id}
  const[toast,setToast]=useState(null);             // {msg, action?}
  const[saveState,setSaveState]=useState("");
  const[saved,setSaved]=useState(null);             // summary of the stored collection
  const recordsRef=useRef(records);recordsRef.current=records;
  const metaRef=useRef(meta);metaRef.current=meta;
  const removedRef=useRef(removed);removedRef.current=removed;

  // Every change to the record set recomputes all statistics
  const D=useMemo(()=>records?{...aggregate(records),dedupStats:meta.dedupStats}:null,[records,meta.dedupStats]);

  const refreshSaved=useCallback(()=>{idbGet("meta").then(m=>setSaved(m||null)).catch(()=>setSaved(null));},[]);
  useEffect(()=>{refreshSaved();},[refreshSaved]);

  // Autosave (debounced) to IndexedDB
  useEffect(()=>{
    if(!records)return;
    setSaveState("saving");
    const t=setTimeout(async()=>{
      try{
        const savedAt=Date.now();
        await idbSet("session",{records,removed,meta,savedAt});
        await idbSet("meta",{savedAt,count:records.length,removed:removed.length,edits:records.filter(r=>r._manual||r._edited).length,files:meta.files});
        setSaveState("saved");
      }catch(e){console.warn(e);setSaveState("error");}
    },700);
    return()=>clearTimeout(t);
  },[records,removed,meta]);

  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),7000);return()=>clearTimeout(t);},[toast]);

  const handleData=useCallback(({records:recs,dedupStats,files,fileLog})=>{
    setRecords(ensureIds(recs));setRemoved([]);setMeta({files,dedupStats,fileLog:fileLog||[],mergePrefs:{}});setTab("overview");
    idbSet("oaLookup",_oaLookup).catch(()=>{});
  },[]);
  const handleResume=useCallback(async()=>{
    try{
      const[sess,lookup]=await Promise.all([idbGet("session"),idbGet("oaLookup")]);
      if(!sess||!sess.records)throw new Error("No saved collection found");
      _oaLookup=lookup||{};
      setRecords(ensureIds(sess.records));setRemoved(sess.removed||[]);setMeta(sess.meta||{files:0,dedupStats:null});setTab("overview");
    }catch(e){setToast({msg:`Could not resume: ${e.message}`});}
  },[]);
  const handleDiscard=useCallback(async()=>{
    await Promise.all(["session","meta","oaLookup"].map(k=>idbDel(k).catch(()=>{})));setSaved(null);
  },[]);
  const handleReset=useCallback(()=>{setRecords(null);setEditing(null);setToast(null);setSaveState("");refreshSaved();},[refreshSaved]);

  // ── editing actions ─────────────────────────────────────────────────
  const restoreRecord=useCallback(id=>{
    const e=removedRef.current.find(x=>x.rec._id===id);if(!e)return;
    setRemoved(rm=>rm.filter(x=>x.rec._id!==id));
    setRecords(rs=>{const a=[...rs];a.splice(Math.min(e.index,a.length),0,e.rec);return a;});
    setToast({msg:"Record restored — statistics recomputed"});
  },[]);
  const edit=useMemo(()=>({
    removed,
    addRecord:()=>setEditing({base:null}),
    editRecord:id=>{const r=(recordsRef.current||[]).find(x=>x._id===id);if(r)setEditing({base:r});},
    removeRecord:id=>{
      const rs=recordsRef.current||[];const index=rs.findIndex(x=>x._id===id);if(index<0)return;
      const rec=rs[index];
      setRecords(rs.filter(x=>x._id!==id));
      setRemoved(rm=>[{rec,index,at:Date.now()},...rm]);
      setToast({msg:"Record removed — statistics recomputed",action:{label:"Undo",fn:()=>restoreRecord(id)}});
    },
    restoreRecord,
    purgeRecord:id=>setRemoved(rm=>rm.filter(x=>x.rec._id!==id)),
    mergePrefs:meta.mergePrefs||{},
    // which database a group of fields is taken from, for all merged records
    setMergePref:(g,src)=>{const mp={...(metaRef.current.mergePrefs||{})};if(!src||src==="auto")delete mp[g];else mp[g]=src;
      setMeta(m=>({...m,mergePrefs:mp}));setRecords(rs=>rs.map(r=>r._versions?applyFieldChoice(r,mp):r));
      setToast({msg:"Merged records updated — statistics recomputed"});},
    // … or for one record; choice null follows the collection setting
    setPick:(id,g,choice)=>{setRecords(rs=>rs.map(r=>{if(r._id!==id)return r;const pk={...(r._pick||{})};if(choice==null)delete pk[g];else pk[g]=choice;
      return applyFieldChoice({...r,_pick:pk},metaRef.current.mergePrefs);}));setToast({msg:"Record updated — statistics recomputed"});},
  }),[removed,restoreRecord,meta.mergePrefs]);

  const saveRecord=useCallback(rec=>{
    const isNew=!editing?.base;
    // an edit of a merged record is kept as its own choice, so a later database choice does not overwrite it
    if(!isNew&&rec._versions){const b=editing.base;const changed=FIELD_GROUPS.filter(g=>g.f.some(f=>JSON.stringify(rec[f])!==JSON.stringify(b[f])));
      if(changed.length){rec={...rec,_edit:{...(rec._edit||{}),...snapshotFields(rec)},_pick:{...(rec._pick||{})}};for(const g of changed)rec._pick[g.k]="edit";}}
    setRecords(rs=>isNew?[...rs,rec]:rs.map(r=>r._id===rec._id?rec:r));
    setEditing(null);
    if(isNew){setTab("collection");setFocus({id:rec._id});}
    setToast({msg:isNew?"Record added — statistics recomputed":"Changes saved — statistics recomputed"});
  },[editing]);

  const themeBtn=<button onClick={toggleTheme} title={theme==="light"?"Switch to the dark interface":"Switch to the light interface"}
    style={{background:"transparent",color:C.textDim,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 12px",fontSize:11,cursor:"pointer",fontFamily:mono}}>{theme==="light"?"☾ Dark":"☀ Light"}</button>;
  if(!D)return<div><div style={{position:"fixed",top:12,right:16,zIndex:10}}>{themeBtn}</div><UploadScreen onData={handleData} saved={saved} onResume={handleResume} onDiscard={handleDiscard}/></div>;
  return(<EditCtx.Provider value={edit}>
    <Dashboard themeBtn={themeBtn} records={records} D={D} fileCount={meta.files} fileLog={meta.fileLog} onReset={handleReset} tab={tab} setTab={setTab}
      focus={focus} onFocusDone={()=>setFocus(null)} saveState={saveState} onExport={()=>exportCollection(records)}
      onExportWos={()=>{exportWos(records);setToast({msg:`Exported ${records.length.toLocaleString()} records in Web of Science format`});}}/>
    <footer style={{maxWidth:1200,margin:"0 auto",padding:"8px 36px 40px"}}>
      <details style={{fontSize:11,color:C.textDim,lineHeight:1.6}}>
        <summary style={{cursor:"pointer",color:C.text,fontSize:12,letterSpacing:.5}}>License and acknowledgements</summary>
        <div style={{marginTop:10,display:"grid",gap:8}}>
          <div>BiblioScope is free software under the <a href="https://opensource.org/license/mit" target="_blank" rel="noreferrer" style={{color:C.accent}}>MIT license</a>. See the files LICENSE and CITATION.cff in the source folder.</div>
          <div>Built on the following open-source libraries:</div>
          <ul style={{margin:0,paddingLeft:18}}>
            <li>d3 (ISC), Mike Bostock and contributors. Used for charts, zooming and dragging nodes.</li>
            <li>React and React DOM (MIT), Meta Platforms, Inc. and contributors.</li>
            <li>JSZip (MIT or GPL-3.0, used here under MIT), Stuart Knightley and contributors, with pako (MIT). Used to read .zip files.</li>
            <li>topojson-client (ISC) and world-atlas (ISC). Map data from Natural Earth, public domain.</li>
          </ul>
          <div>Layout and clustering algorithms:</div>
          <ul style={{margin:0,paddingLeft:18}}>
            <li>ForceAtlas2: Jacomy, M., Venturini, T., Heymann, S. &amp; Bastian, M. (2014). PLOS ONE 9(6): e98679.</li>
            <li>VOS layout: van Eck, N. J., Waltman, L., Dekker, R. &amp; van den Berg, J. (2010). JASIST, 61(12), 2405–2416; van Eck, N. J. &amp; Waltman, L. (2010). Scientometrics, 84(2), 523–538. Quality function and default values as in CWTS networkanalysis (MIT).</li>
            <li>Association strength: van Eck, N. J. &amp; Waltman, L. (2009). How to normalize cooccurrence data? JASIST, 60(8), 1635–1651.</li>
            <li>Clustering: Waltman, L., van Eck, N. J. &amp; Noyons, E. C. M. (2010). A unified approach to mapping and clustering of bibliometric networks. Journal of Informetrics, 4(4), 629–635; optimized with the Louvain method: Blondel, V. D., Guillaume, J.-L., Lambiotte, R. &amp; Lefebvre, E. (2008). J. Stat. Mech., P10008.</li>
            <li>Stress majorization: Gansner, E. R., Koren, Y. &amp; North, S. (2004). Graph drawing by stress majorization. GD 2004, LNCS 3383.</li>
          </ul>
        </div>
      </details>
    </footer>
    {editing&&<RecordEditor base={editing.base} records={records} onSave={saveRecord} onCancel={()=>setEditing(null)}/>}
    {toast&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:1100,background:C.card,border:`1px solid ${C.border}`,
      borderRadius:8,padding:"10px 16px",display:"flex",alignItems:"center",gap:14,boxShadow:"0 10px 30px rgba(0,0,0,.5)",fontSize:12,color:C.textBright}}>
      {toast.msg}
      {toast.action&&<button onClick={()=>{toast.action.fn();setToast(null);}} style={{...btnBase,background:"transparent",border:`1px solid ${C.accent}`,color:C.accent,padding:"4px 10px"}}>{toast.action.label}</button>}
      <button onClick={()=>setToast(null)} style={{background:"transparent",border:"none",color:C.textDim,cursor:"pointer",fontSize:13}}>✕</button>
    </div>}
  </EditCtx.Provider>);
}
