# BiblioScope 0.995 – teknisk dokumentation

Datum: 2026-11-26. Ersätter dokumentationen för 0.7–0.98. Licens: MIT (se `LICENSE`). Citering: se `CITATION.cff`.

Dokumentet beskriver hur version 0.995 är uppbyggd och hur nätverksanalyserna och layouterna är definierade. Ändringar version för version finns i `biblioscope_utv/CHANGELOG_TODO.md`. Användarmanualer finns i `docs/BiblioScope_manual_sv.md` och `docs/BiblioScope_manual_en.md`.

## 1. Filer

| Fil | Innehåll |
|---|---|
| `src/App.jsx` | Hela applikationen (React). Källan till alla byggen. |
| `src/main.jsx`, `src/index.css` | Startpunkt och tom stilfil. |
| `biblioscope_utv/biblioscope0995.html` | Fristående byggd version, en enda HTML-fil (ca 690 kB). |
| `biblioscope_utv/OA-augment_dev/open-sources-augmenter.html` | Open Sources Augmenter 2.1 (fristående, ersätter `openalex-augmenter.html`, som ligger kvar). |
| `biblioscope_utv/biblioscope03.html` … `0994.html` | Tidigare versioner, oförändrade. |
| `backup/` | Säkerhetskopior av `App.jsx` före 0.4, 0.4 och 0.5. |
| `LICENSE`, `CITATION.cff` | Licens (MIT) och citeringsuppgifter. |
| `package.json`, `vite.config.js`, `dist/` | Vite-projektet. `dist/` är ett äldre bygge och är inte uppdaterat till 0.7. |

## 2. Bygga

**Fristående HTML-fil (så som 0.4–0.9 byggts).** `src/main.jsx` buntas med esbuild (ESM, minifierad, mål ES2022) och JavaScript-koden läggs in i en `<script type="module">` i en minimal HTML-sida. Två beroenden ersätts vid buntningen:

- `world-atlas/countries-50m.json` hämtas vid körning, i tur och ordning från jsdelivr, unpkg och (1:110m) jsdelivr. Utan internet visas en rangordnad landlista.
- `topojson-client` ersätts av en liten egen funktion `feature()` som avkodar TopoJSON.

JSZip (MIT eller GPL-3.0, här använd under MIT) buntas in från npm, så zip-filer kan läsas utan nätverk. Typsnitten är systemtypsnitt (Georgia, system-ui, ui-monospace); inga externa typsnitt laddas. Världskartan är därmed det enda som kräver internet.

`</script` i den buntade koden måste skrivas som `<\/script` för att inte avsluta skriptblocket.

**Vite.** `npm install` och `npm run build` i projektmappen ger ett bygge i `dist/` med samma källkod. Det har inte körts för 0.7–0.9. Kör `npm install` först, eftersom jszip lagts till i `package.json` i 0.82.

## 3. Data

Inläsning sker från Web of Science (Plain Text, `.txt`/`.ciw`), Scopus (`.csv`), OpenAlex (`.json`/`.csv`), en sparad BiblioScope-samling (`.json`) eller `.zip` med sådana filer. Alla källor översätts till en gemensam postmodell med bland annat `au` (författare), `so` (källa), `py` (år), `tc` (citeringar i databasen, GCS), `de` (författarnyckelord), `id` (indextermer), `c1Full` (adresser), `crRaw` (referenser), `di` (DOI) och `_src` (källa).

- **Dubbletter** matchas med ett av tre lägen: *DOI only*, *Balanced* (DOI eller identisk normaliserad titel bekräftad av gemensamt efternamn eller år inom ±2) och *Fuzzy* (som Balanced plus nästan identiska titlar, Dice ≥ 0,92).
- **Författarharmonisering** (sedan 0.3): namnjämförelse utan hänsyn till skiftläge, skiljetecken och diakritiska tecken. Den normalt skrivna varianten visas.
- **Lokala citeringar.** Referenserna matchas mot posterna i samlingen. LCS är antalet poster i samlingen som citerar en post, LCR antalet av postens referenser som finns i samlingen.
- **Sparande.** Samlingen sparas automatiskt i webbläsarens IndexedDB, per webbläsare och adress.
- **CSV-parsern** (rättad i 0.7) lade tidigare till en tom post när filen slutade med radbrytning.

## 4. Nätverksanalyser (fliken Networks)

`buildAnalysisNetwork()` bygger nätverket. Noder filtreras med gränsvärden och sorteras efter antal dokument och därefter citeringar. De `Max noder` första behålls.

| Analys | Länk mellan två noder | Enheter |
|---|---|---|
| Bibliografisk koppling | antal gemensamma referenser | artikel, författare, tidskrift, affiliation, affiliation med subdivision |
| Co-citering | antal poster i samlingen som citerar båda | artikel (citerad referens), författare, tidskrift |
| Co-authorship | antal gemensamma poster; på artikel- och tidskriftsnivå antal delade författare | artikel, författare, tidskrift, affiliation, affiliation med subdivision |
| Samförekomst av nyckelord | antal poster där båda förekommer | nyckelord |

Gränsvärden: *Min. dokument* (antal poster bakom noden; för co-citering antal citerande poster), *Min. citeringar* (summa av GCS; för co-citering lokala citeringar på artikelnivå) och *Max noder* (10–500).

Från 0.7 används alla länkar i layouten (`network.layoutLinks`, råa antal). Bara de 1500 starkaste ritas (`network.links`, linjebredd 1–6).

Affiliationer tolkas heuristiskt: Web of Science antas ha organisationen först i adressen, Scopus avdelningen först.

## 5. Layouter

Alla layouter utom d3-force returnerar koordinater som normaliseras till [−1, 1] och ritas av `StaticNetwork`.

### 5.1 ForceAtlas2 (`layoutForceAtlas2`)

Efter Jacomy m.fl. (2014). Repulsion k_r(deg_i+1)(deg_j+1)/d, LinLog-attraktion w·ln(1+d), gravitation mot origo proportionell mot deg+1. Länkvikterna skalas om till 1–6. Exakt O(N²)-beräkning (ingen Barnes–Hut), 350–500 iterationer med avtagande steglängd i stället för Gephis adaptiva hastighet. Reglage: Attraktion, Repulsion, Gravitation.

### 5.2 VOS-inspirerad (`layoutVOS`)

Samma kvalitetsfunktion som VOSviewer (CWTS `networkanalysis`, klassen `VOSLayoutAlgorithm`), egen implementering:

V = Σ_länkar s_ij · f(d_ij, a) − Σ_alla par f(d_ij, r), där f(d, p) = d^p / p om p ≠ 0 och ln d om p = 0. Kräver a > r.

- **Normalisering:** association strength s_ij = 2m·c_ij / (k_i·k_j), där c_ij är länkens råa antal, k_i nodens totala länkstyrka och m summan av alla länkvikter (Van Eck & Waltman 2009). Alternativt ingen normalisering. Vikterna skalas så att medelvikten per nodpar blir 1. Det påverkar bara skalan, inte formen, eftersom a > r.
- **Parametrar:** attraktion a ∈ {−1, 0, 1, 2}, repulsion r ∈ {−2, −1, 0, 1}, r < a. Standard 2 och 1.
- **Optimering:** nod för nod i slumpmässig ordning, steg längs normaliserad negativ gradient. Steglängd från 1 till 0,001: minskas med faktorn 0,75 när V inte minskar och ökas efter fem förbättringar i rad. Högst 1000/500/250 varv beroende på storlek. 4, 2 eller 1 slumpmässiga starter (≤150, ≤300, större), den med lägst V behålls.
- **Frånkopplade komponenter:** om nätverket har flera komponenter läggs attraktionen 0,01·f(d, a) till för alla par (motsvarar VOSviewers `edgeWeightIncrement`). Noder utan länkar placeras i en ring utanför.
- **Prestanda och test:** syntetiska nätverk med planterade kluster ger avstånd inom kluster på cirka 15 % av avstånden mellan kluster. Beräkningstid 0,4 s (150 noder), 1,6 s (300), 3,3 s (500). Beräkningen sker i huvudtråden.

Skillnader mot VOSviewer: annan optimeringsdetalj, egna startpunkter, egen hantering av komponenter. Kartorna blir därför inte identiska med VOSviewers.

### 5.3 Stress-majorisering (`layoutStress`)

Efter Gansner, Koren och North (2004). Minimerar Σ w_ij(‖x_i − x_j‖ − d_ij)², där d_ij är kortaste vägen i antal steg och w_ij = 1/d_ij². Par utan förbindelse får avståndet maxD + 1. 300 varv av den lokala uppdateringsregeln (Jacobi-variant), start på en cirkel. Länkvikter används inte. Inga reglage.

### 5.4 Force (nuvarande) (`ForceNetwork`)

d3-force från 0.4–0.5: länkkraft, laddning −120, centrering, kollision. Simuleras löpande. Stöder inte manuell flytt via panelens knappar (noder kan dras men återgår).

## 6. Navigering mellan poster (0.9)

- **Citerande poster.** `citingIdx(hc, idx)` ger de poster i samlingen som citerar post `idx` (ur `histcite.edges`). Används när en understruken LCS-siffra klickas i postlistan (`RecordsList`, prop `onClickLcs`) och i postvisningen (`RecordDetail`, prop `onCitedBy`). Listan kan följas vidare i flera steg.
- **Cited Refs.** Siffran under *Recs* öppnar listan över poster som citerar referensen (`ref.citers`), med knappen *Back to cited references*. Återställt från 0.3.
- **Utgående länkar.** Komponenten `ExtLink` använder `paperLink()` (DOI → Web of Science → Scopus → OpenAlex → Google Scholar) och visas i postlistan, postvisningen och *Top Papers*. Klick på länken påverkar inte radens egen klickfunktion.
- **Comparison.** Ny dimension *Affiliations with Subdivision*, definierad som i Networks: `recordUnitKeys(r, "affiliation_sub")`, dvs. organisation och avdelning tolkade ur adressen. Adresser utan avdelning ingår inte i den dimensionen.

## 6a. DOI för citerade referenser (0.91)

- Referenser med DOI (eller som är poster i samlingen med DOI) får länken *↗ DOI* i Cited Refs.
- Referenser utan DOI kan slås upp i Crossref: `findDoiForRef(ref)` anropar `https://api.crossref.org/works?query.bibliographic=…&rows=5` med referenssträngen (utan DOI-del). `refParts()` tolkar förstaförfattarens efternamn, år, volym och första sida ur WoS-format (`V31, P7`) och Scopus-format (`46, 5, pp. 604-632`), samt orden i titel/tidskrift.
- Varje kandidat kontrolleras: efternamn (normaliserat, utan diakritiska tecken), år (exakt), volym, första sida och titelord (andel av referensens ord med minst tre bokstäver som inleder ett ord i kandidatens titel eller tidskrift, gräns 0,6; hanterar WoS-förkortningar och avkortade titlar).
- *Trolig träff* = efternamn och år + (volym eller sida eller titelord). Kandidaterna sorteras efter trolig träff, antal kontroller och Crossrefs poäng. Anledning: Crossrefs förstaträff är ofta fel för korta referenser; för "Kamada T, 1989, Information Processing Letters, 31, 7" rankades en annan artikel i samma tidskrift och år högre än den rätta.
- Utan trolig träff visas kandidaterna med vilka kontroller som stämde. Referenser utan efternamn eller år, och "[No title captured]", får ingen uppslagning.
- *Find DOIs on this page*: alla referenser utan DOI på sidan (högst 50), två anrop åt gången, med förloppsräknare.
- Resultaten cachas per referens under sessionen (`_doiLookupCache`). De sparas inte och används inte i analyserna (koppling, co-citering, historiograf).
- Länken *Scholar* öppnar en Google Scholar-sökning på referenssträngen.
- Test: tolkningen testad på 15 verkliga WoS-referenser (böcker, dubbla DOI-prefix, "[No title captured]"); uppslagningen testad i webbläsare mot simulerade Crossref-svar där fel artikel rankas först (0 felaktiga träffar av 30). Inte testad mot riktiga Crossref från testmiljön.

## 6c. Stavningsvarianter av citerade namn (0.92)

- `makeNameCanon(names, kind)` grupperar namn med `citedNameKey`: för författare `authorKey()` (samma som för samlingens egna författare: efternamn + initialer, gemener, utan punkter och diakritiska tecken), för källor gemener utan skiljetecken. Visningsnamn: variant med blandade versaler/gemener före variant med bara versaler eller gemener, därefter flest förekomster, därefter längst.
- `isAnonName()` utesluter "[Anonymous]" och "[No title captured]" bland citerade författare.
- Används i Comparison (en gemensam kanonisering över hela samlingen, så båda sidor får samma stavning) och i Networks, co-citering på författar- och tidskriftsnivå (nodnyckel = normaliserad nyckel, etikett = visningsnamn).

## 6d. Historiograf: institutioner och citeringstabell (0.93)

- Nya vyer i Historiograph: *Institutions* (`recordUnitKeys(r, "affiliation")`) och *Institutions with Subdivision* (`"affiliation_sub"`), samma tolkning av adresser som i Networks och Comparison. `HistCitePanel` får `records` som prop för detta.
- `buildAggregateFlow` oförändrad: noder = de *Top N* enheterna med flest poster; pil s → t = antal citeringslänkar (`histcite.edges`) där citerande post har enhet s och citerad post har enhet t, s ≠ t.
- `FlowNetwork`: noder och pilar är klickbara (`onSelect({node})` resp. `onSelect({link:[s,t]})`; klick på bakgrunden rensar). Osynliga, 10 px breda linjer under pilarna gör dem lätta att träffa. Pilar i båda riktningar mellan samma par förskjuts 6 px åt var sitt håll. Pilarnas siffror släpper igenom klick. Markering ändras i en egen effekt, så simuleringen startar inte om.
- `FlowCitationTable`: en rad per citeringslänk. Nod: *incoming* = citerad post har enheten, *outgoing* = citerande post har den; *within* = båda har den (ritas inte som pil). Pil: citerande post har s och citerad post har t. Kolumner: enheter på citerande sida, enheter på citerade sidan, citerande post, citerad post (med `ExtLink`). Sorteras efter citerande posts år, nyast först. Högst 200 rader visas tills *Show all* klickas.
- Test: alla 107 pilar i testsamlingen (12 + 12 institutionspilar, 83 författarpilar) gav en tabell med samma antal citeringar som pilen; institutionspilarna med riktiga musklick, författarpilarna med klickhändelse direkt på pilen (de korsar varandra).
- Papers-vyn är oförändrad: klick på en publikation öppnar DOI eller databaspost.

## 6e. Postvisning från citeringstabellen och ljust tema (0.94)

- `FlowCitationTable` visar LCS, GCS, LCR och CR för citerande och citerad post. Klick på titeln öppnar `RecordOverlay`: `RecordDetail` i ett lager ovanpå sidan (z-index 900, under postredigeraren på 1000), så att nätverk och tabell behåller sitt tillstånd. I lagret kan LCS följas (lista över citerande poster) och lokala referenser öppnas; *← Back* går ett steg tillbaka, *✕ Close*, Esc eller klick utanför stänger.
- Teman: `THEMES.dark` (tidigare färger) och `THEMES.light` (ljusgrå bakgrund #e7e9ed, kort #f6f7f9, mörkare accentfärger för kontrast: guld #94660a, teal #0d7a73). `applyTheme()` skriver in värdena i `C`, uppdaterar modulvärden som härletts ur `C` (`CMP_A`, `CMP_B`, `inputStyle`) via `_themeHooks` och sätter sidans bakgrund. Ny färg `C.onAccent` för text på accentfärgade knappar (ersätter hårdkodad #0c0f14).
- Valet sparas i `localStorage` (`biblioscope-theme`) och läses innan första renderingen. Från 0.96 monteras inget om vid byte: React-delarna renderas om med nya värden i `C`, och redan ritade d3/SVG-diagram färgas om på plats av `recolorCharts(from, to)`, som byter varje färg från det gamla temat (attributen fill, stroke, stop-color, color och stilarna fill/stroke, även med alfasuffix #rrggbbaa) mot motsvarande färg i det nya. Zoom, layouter, simuleringar, manuella positioner och urval påverkas därför inte. Händelsehanterare (hover) läser `C` vid händelsen och får automatiskt de nya färgerna.
- Sidhuvudets bakgrund följer temat (tidigare hårdkodad mörk gradient).
- Diagrampaletterna (`PAL`, klusterfärger) är desamma i båda teman.

## 6f. Komponenter i Networks (0.95)

- `filterComponents(network, mode)`: sammanhängande komponenter beräknas med union–find över alla länkar (`layoutLinks`). *main* behåller den största komponenten, *all* alla noder med minst en länk, *full* alla noder (noder utan länkar placeras i en ring av layouten).
- Filtret tillämpas före layout och klustring, så att varken layout eller kluster påverkas av noder som inte visas. Standard är *main*, som i VOSviewer.
- Statusraden visar antal komponenter, den största komponentens storlek och antal noder utan länkar.
- Test: syntetisk fil med komponenter om 15, 8 och 3 poster samt 6 poster utan gemensamma referenser gav 15, 26 och 32 noder för de tre lägena. Överlapp (noder med storlek 3): 136 överlappande par vid 0 %, 69 vid 50 %, 0 vid 100 %; kartans utbredning 314 → 336 px.

## 6g. Nätverksmått (0.97)

Funktionerna ligger i `App.jsx` (avsnittet *SOCIAL NETWORK ANALYSIS METRICS*) och är rena funktioner utan beroende av React.

**Networks: `computeNetworkMetrics(ids, links, {weighted, clusters})`** räknar på kartan som visas (`net`, efter *Show*) och alla dess länkar (`layoutLinks`, råa antal som vikter; parallella länkar summeras). Nätverket är oriktat.

- Täthet 2M/(N(N−1)); genomsnittlig grad 2M/N; genomsnittlig viktad grad 2W/N.
- Komponenter: antal komponenter med minst en länk; noder utan länkar redovisas separat.
- *Betweenness*: Brandes (2001), normaliserad med 2/((N−1)(N−2)). Oviktad: BFS. Viktad: Dijkstra med avstånd 1/w; lika långa vägar avgörs med toleransen 1e−12 (networkx jämför exakt och kan därför fördela betweenness annorlunda vid avrundningslika vägar).
- *Closeness*: harmonisk, Σ 1/d(i,j) / (N−1); oåtkomliga noder bidrar 0. Med vikter kan värdet överstiga 1 (avstånd < 1).
- *Eigenvector*: potensiteration på A + I (samma ledande egenvektor som A, konvergerar även för bipartita grafer), skalad så att största värdet är 1. Viktad med w om *Use link strength*. I nätverk med flera komponenter koncentreras värdena till komponenten med störst egenvärde.
- *PageRank*: dämpning 0,85; övergångar proportionella mot w (viktat) eller lika (oviktat); noder utan länkar fördelar sin massa jämnt.
- Lokal klustringskoefficient (Watts–Strogatz, oviktad); medelvärdet räknar noder med grad < 2 som 0 (som networkx `average_clustering`). Transitivitet = 3 × trianglar / anslutna tripplar.
- Diameter och genomsnittlig väglängd räknas alltid i steg, över alla par som är förbundna (som Gephi).
- Modularitet: Newman, viktad, upplösning 1, för kartans kluster (noder utan kluster bidrar inte).
- *Node size by*: `nodeRadiusFn` ger radien √-skalad 3–20 px efter valt mått (dokument/förekomster som tidigare, 4–18 px). Samma radie används vid *Remove overlap*.

**Historiograph: `computeCitationMetrics(papers, edges)`** på hela lokala citeringsnätverket (alla poster, alla citeringar; dubbletter och självcitering av samma post tas bort). Riktning citerande → citerad. PageRank (0,85; poster utan lokala referenser fördelar jämnt), HITS (Kleinberg 1999; authority = Aᵀh, hub = A·a, L2-normerade per steg, redovisade med största värdet 1).

**`mainPathAnalysis(papers, edges, {method, keyRoutes})`** (Hummon & Doreian 1989; SPC efter Batagelj 2003; Lucio-Arias & Leydesdorff 2008):

1. Bågar i kunskapsflödets riktning, citerad → citerande, mellan poster med minst en lokal länk.
2. Cykler bryts: starkt sammanhängande komponenter (Tarjan); inom en komponent behålls bara bågar från den tidigare posten (år, därefter ordning i samlingen) till den senare. Bågar mellan komponenter behålls. Antalet borttagna redovisas.
3. Topologisk ordning; N⁻(v) = antal vägar från någon källa till v (källa = 1), N⁺(v) = antal vägar från v till någon sänka (sänka = 1). SPC(u→v) = N⁻(u)·N⁺(v). Totalt antal vägar = Σ N⁻ över sänkor. SPC för en post = N⁻·N⁺.
4. *Global*: dynamisk programmering över den topologiska ordningen ger den väg från källa till sänka som maximerar ΣSPC. *Local forward*: start i den eller de tyngsta bågarna från en källa, sedan tyngsta utgående båge. *Key-route* (Liu & Lu 2012): de k tyngsta bågarna, var och en förlängd framåt och bakåt med lokal sökning. Vid lika värden (relativ tolerans 1e−9) behålls alla.

**Aggregerade flöden: `computeFlowMetrics(network)`** på flödesnätverket i vyerna Authors–Institutions (Top N enheter): viktad in- och utgrad (summan av pilvärdena), antal citerande/citerade enheter och viktad PageRank (citerande → citerad). Citeringar inom en enhet ingår inte, som i nätverket.

**Verifiering.** Mot networkx 3.7 på sex slumpgrafer (Watts–Strogatz och Barabási–Albert, 8–40 noder), oviktat och viktat: betweenness, harmonisk closeness, eigenvector, PageRank, klustringskoefficient, transitivitet, modularitet, diameter, genomsnittlig väglängd och täthet stämde (avvikelse < 1e−6) när vikterna var 1, 2, 4 och 8 (exakt representerbara avstånd). Riktad PageRank och HITS stämde mot networkx på fem slumpmässiga citeringsnätverk (10–30 poster); SPC för varje båge, totala antalet vägar och den globala huvudvägen stämde mot fullständig uppräkning av alla vägar. Viktad PageRank för flöden stämde mot networkx (avvikelse 2e−13). Tid: 500 noder och 31 000 länkar 0,7 s oviktat, 1,8 s viktat; huvudväg i ett nätverk med 5 000 poster och 40 000 citeringar 0,13 s.

**Begränsningar.** Antalet vägar räknas med flyttal; i mycket stora och djupa nätverk kan det bli oändligt (> 1e308). Väntevärdet för informationsinnehåll (*expected information value*), som Lucio-Arias & Leydesdorff också använder, är inte implementerat. Måtten räknas i huvudtråden.

## 6h. Kluster och rangordning i historiografen (0.98)

- Klustring: `clusterNetwork()` (avsnitt 6b) på det oriktade direktciteringsnätverket över alla poster; varje citering vikt 1 (ömsesidiga citeringar summeras till 2). Standard: upplösning 1, min. klusterstorlek 2. Poster utan lokala citeringar får −1 (grå). Jfr direktciteringsklustring i Waltman & van Eck (2012), här utan deras normalisering och i liten skala.
- Urval: *Top N* rangordnas efter valt mått (GCS, LCS, LCS + LCR, PageRank, Authority, SPC); lika värden avgörs med LCS och GCS. Med ett valt kluster görs urvalet bland klustrets poster, och huvudvägen beräknas med `mainPathAnalysis` på klustrets poster och citeringarna inom klustret. SPC i tabellen och på korten avser alltid hela nätverket.
- `clusterSummaries()`: per kluster antal poster, år, citeringar inom klustret och från andra kluster (citerande post utanför, citerad inom), tre nyckelposter efter valt mått, och upp till fem termer ur författar- och indexnyckelord rankade med tf·log(N/df) (tf = antal poster i klustret med termen, minst 2 om klustret har minst 4 poster; df = antal poster i samlingen). Den vanligaste skrivformen visas.
- Nodfärg efter kluster eller som tidigare; nodstorlek √-skalad 6–18 px efter LCS, GCS, PageRank, Authority eller SPC. Tooltip visar kluster och rangordningsmåttets värde.
- Test (syntetisk fil, 40 poster, 36 citeringar): 6 kluster vid upplösning 1, 9 vid 2; ett valt kluster gav 7 noder i grafen och 7 rader i tabellen; huvudväg inom kluster 2 med 4 poster; temabyte behåller vyn.

## 6i. Indikatorer (0.99)

**Nya postfält** (alla källor, `emptyRecord`, sammanslagning i `mergeRecordPair`):

| Fält | Innehåll | WoS | Scopus | OpenAlex |
|---|---|---|---|---|
| `pm` | PubMed-id | PM | PubMed ID | ids.pmid |
| `fu` | finansiärer `[{n, a, g[], ror}]` (namn, akronym, bidragsnummer) | FU | Funding Details | funders, awards |
| `fx` | finansieringstext | FX | Funding Texts | – |
| `oaAll` | alla OA-beteckningar från alla källor | OA | Open Access | open_access.oa_status |
| `sdg`, `_sdgKnown` | `[{id, s}]` (mål 1–17, poäng); om klassning finns | – | – | sustainable_development_goals |
| `ind` | `fwci`, `pctl`, `top10`, `top1`, `oaCites`; från Augmenter även `rcr`, `rcrProv`, `nihPctl`, `citedByClin`, `bip*`, `views`, `downloads` | – | – | fwci, citation_normalized_percentile |
| `ot` | organisationer med ROR-typ `[{n, t, ror}]` | – | – | authorships.institutions |

**Öppen tillgång** (`oaStatus`): varje beteckning delas på `;` och `,` och översätts (hybrid → Hybrid, diamond → Diamond, gold/DOAJ → Gold, bronze/free to read → Bronze, green → Green, "All Open Access" → typ okänd). Högsta enligt ordningen Diamond > Gold > Hybrid > Bronze > Green gäller; `green` markeras om en grön kopia också anges. Inget värde: Closed (manuella poster: Unknown). Översikten använder samma status.

**Sektorer** (`recordOrgs`, `sectorRule`): ROR-typer från OpenAlex (`ot`) om de finns (education → Higher education, facility/archive → Research institute, healthcare, government, company, nonprofit/funder → Nonprofit); annars organisationen ur adressen (`parseAffiliation`), klassad med reguljära uttryck i ordningen independent, healthcare, company, universitet (namn som börjar med eller innehåller Univ/University), government, nonprofit, higher education, research institute; om inget passar prövas hela adressen. Manuella val i `localStorage` (`biblioscope-ovr-sector`, nyckel = organisationsnamn i gemener). `parseAffiliation` hoppar nu över fristående postnummer (tidigare blev t.ex. "Beijing" organisation när adressen innehöll "100081").

**Finansiärer**: WoS delas på `;` utanför `[...]`, Scopus på `;` utanför `(...)`; sista kommaseparerade delen i Scopus tolkas som akronym om den är kort och har minst två versaler. `funderKey`: gemener, utan diakritiska tecken och parenteser, & → and, R&D → research and development, programme → program, utan skiljetecken, plus en kort aliaslista (NSFC, NIH, NSF, ERC, DFG, VR). `buildFunderCanon` mappar en akronym som används som namn till fullt namn när Scopus anger paret, och visar den vanligaste skrivningen. `funderTypeRule`: känd-lista, internationella/EU-mönster, centrala kinesiska program, universitets- och sjukhusfonder, regionala program (kinesiska provinser och städer), stiftelser utan offentliga markörer, företag, offentliga markörer (national, ministry, council, agency, research council …). Manuella val: `biblioscope-ovr-funder`. Test på WoS-filen (370 poster): 275 finansiärer, varav 211 myndighet, 46 universitet/organisation, 13 oklassade, 3 privata, 1 företag, 1 EU; stickprov visade rimliga typer men gränsfall (t.ex. "Higher Education Discipline Innovation Project" = 111-projektet blir oklassad).

**Comparison: Numbers / Shares (0.992)**: `mode` i `ComparisonPanel`. Andelar: publikationer/samlingens storlek (skillnad i procentenheter); per publikation: GCS, LCS, distinkta författare, distinkta tidskrifter, referenser (`nr`); år: antal/sidans publikationer; nyckelord och källor: antal poster/sidans publikationer; citerade författare/källor: antal/antal citerade referenser med tolkad författare resp. källa (`citedAuN`, `citedSoN`). Rangordningen inom en sida är densamma; i nyckelordsdiagrammet rangordnas termerna efter summan av andelarna.

**Klickbara mängder (0.991)**: varje kategori bär sina postindex (`ix`); `openSet(titel, index)` öppnar `RecordOverlay` med `view.set = {title, indices}`, som visar `RecordsList` och därifrån postvisningen. Årsdiagrammen samlar index per år och kategori (`byYear` → `ix`).

**Citeringsindikatorer per grupp**: per grupp median och medel av `tc` (högsta antalet när posten finns i flera databaser), andel ociterade, median-LCS, antal med FWCI, median och medel FWCI, andel topp 10 % bland poster med percentil, median-RCR med antal.

**Augmenter-poster** (`meta.mode === "enrich"`): läses som OpenAlex-poster med `_enrich`. `deduplicateRecords` matchar dem som vanligt (DOI, titel), men de räknas inte som indata; i ett kluster slås de vanliga posterna ihop först och därefter läggs `applyEnrichment` på (ind, sdg, ot om saknas, fu, pm, oaAll). Kluster med bara Augmenter-poster tas bort och räknas som omatchade. Filen ensam ger ett felmeddelande.

**Open Sources Augmenter 2.0** (`OA-augment_dev/open-sources-augmenter.html`, fristående, vanilla JS, systemtypsnitt): läser WoS (vanlig text), Scopus (CSV), OpenAlex (JSON) och BiblioScope-samlingar. Uppgift *indicators*: OpenAlex `filter=doi:…|…` (50 per anrop, `select` med indikatorfälten; vid HTTP 400 utan `select`), DOI med komma eller lodstreck var för sig, PubMed-id utan DOI via `filter=pmid:`; iCite `/api/pubs?pmids=` (200 per anrop); OpenAIRE Graph v3 `research-products?pid=("…" OR "…")` (20 per anrop), DOI matchas mot alla DOI i svaret, `indicators.citationImpact` och `usageCounts`. Utdata: `{meta:{mode:"enrich", sources, counts, input_files}, works:[OpenAlex-post eller minimal post + _biblioscope{rcr, …, bip*, views, downloads}]}`, en post per DOI; samt CSV med en rad per indatapost. Uppgift *references* (bara OpenAlex-filer): som tidigare `openalex-augmenter.html`. Om en tjänst inte går att nå (nätverk/CORS) loggas det och de andra används.

**Test.** BiblioScope med de tre filerna (WoS 370, Scopus 512, OpenAlex 100): 568 poster, OA 45 % (diamond 8, gold 193, hybrid 19, bronze 14, green 19), SDG-information för 97 poster, sektorer för 553 poster (221 organisationer typade via ROR, 1 016 via namn), 42 % med finansieringsuppgift, 532 finansiärer. Augmenter testad med simulerade svar från de tre tjänsterna (de kan inte nås från testmiljön): WoS + Scopus (882 poster, 464 DOI) gav 427 Augmenter-poster; inläst i BiblioScope tillsammans med originalen: 545 poster (samma som utan), 424 berikade, FWCI-täckning 0 → 72 %, RCR 0 → 42 %, ROR-typade organisationer 0 → 490. **Ej testat mot de riktiga tjänsterna**: särskilt om iCite och OpenAIRE tillåter anrop från en webbsida (CORS) och om OpenAlex godtar fältlistan.

**OpenAlex CSV (0.993).** `detectSource` känner igen OpenAlex-CSV på `authorships.author.display_name` eller på en titelkolumn tillsammans med `Work ID`, `Cites` eller `Citation count` utan `Authors` (Scopus). `openalexCsvToUnified` läser båda kolumnformaten via `pk(rad, …namn)`: API-namn (`id`, `display_name`, `publication_year`, `fwci`, `citation_normalized_percentile.value`, `funders.display_name`, `referenced_works`, `open_access.oa_status`) och läsbara namn (`Work ID`, `Title`, `Author`, `Year`, `Citation count`, `FWCI`, `Citation percentile by subfield`, `Subfield`, `Cites`, `Open access`, `Abstract`, `Source`, `PMID`). Percentilen (0–1) ger `ind.pctl` i procent och `top10`/`top1` (≥ 0,90/0,99), markerat `pctlFromCsv`. `Cites` ger `crOaIds` som fullständiga OpenAlex-URL:er; utan Augmenter visas dessa som id i nätverken. OpenAlex-JSON: `ab` från `abstract_inverted_index` (`invertedAbstract`), annars textfältet `abstract`.

**Open Sources Augmenter 2.1.** CSS byggd om från originalet (en kvarglömd `@import`-rest gjorde att `:root`-variablerna inte lästes). Filytan: `input[type=file]` ligger överst (`z-index:2`) och ikon/text har `pointer-events:none`. Filtyper: `wos`, `scopus`, `openalex` (JSON), `openalex-csv`, `biblioscope`; OpenAlex-CSV känns igen på `Work ID`, på läsbara namn (`Title` + `Cites`/`FWCI`/percentil, utan `EID`/`Authors`) eller på `id` med openalex.org/W-id. Uppgift *references* (bara OpenAlex-filer): CSV-rader med W-id hämtas med `filter=openalex:W…|…` (50 per anrop, `FULL_SELECT` med `referenced_works`, `abstract_inverted_index`, `funders`, `awards`, SDG m.m.) och `Cites` jämförs med `referenced_works`; rader utan W-id byggs av `csvRowToWork` (id `csv-row-n`, inga DOI). Referenser slås upp med `REF_SELECT`, valfritt andra ordningen; iCite/OpenAIRE läggs i `_biblioscope`. Utdata `{meta:{mode:"openalex"}, works, referenced_works_lookup, unresolved_ids}`. Uppgift *indicators*: som 2.0, men OpenAIRE med 5 DOI per fråga (tjänsten tillåter högst 4 logiska operatorer; belagt med ett verkligt 400-svar) och källan hoppas över efter tre 400-svar utan träff. `addLog` slår ihop identiska meddelanden i följd (×n). Filnamn: första filens namn plus `_+n_more`.

**Test (0.993/2.1).** Augmenter med simulerade svar: CSV med *Work ID* (95 rader) → 95 poster hämtade, `Cites` lika för 37 av 37, 1 106 av 1 173 referenser upplösta; CSV med API-namn (72) och OpenAlex-JSON (100) motsvarande; WoS + Scopus → 0 OpenAIRE-avslag med 5 DOI per fråga, filnamn `…_+1_more_open-indicators.json`; tvingade 400-svar → tre försök, sedan överhoppad; CSV utan *Work ID* → poster byggda från CSV, 952 av 1 009 referenser upplösta, indikatoruppgiften avstängd med förklaring. Utdata inlästa i BiblioScope 0.993: co-citeringsnoder med författare/år/titel, inga körfel. Regressionstester 0.992 mot 0.993 (nätverksmått, huvudväg, historiograf, indikatorer, klickbara mängder, jämförelse): identisk utdata. **Ej testat mot de riktiga tjänsterna** för de nya delarna.

## 6j. Proveniens och val av databas (0.994)

**Inläsning.** Varje post får `_file` (filnamn; i zip `arkiv.zip/fil`). `meta.fileLog = [{name, src, n, format, enrich}]` sparas med samlingen. `readZip` returnerar `{name, text}`.

**Sammanslagning.** I `deduplicateRecords` får ett kluster med fler än en vanlig post `_versions` (en `snapshotVersion` per ursprunglig post: `src`, `file`, `nr` och fälten i `PROV_FIELDS`) och `_files`; efter Augmenter-berikningen sparas `_auto = snapshotFields(acc)`. Referenserna (`crRaw`, `crOaIds`) ingår inte i versionerna, bara antalet.

**Fältgrupper** (`FIELD_GROUPS`): title (ti), authors (au, af), affil (c1Full, c3, co, coNorm, ot, rp, em), source (so, j9, vl, is, bp, ep, pg, py, pd), dt (dt, la), abstract (ab), keywords (de, id), subjects (wc, sc), funding (fu, fx), oa (oa, oaAll), tc. `groupDiffers` jämför bara versioner med värde, med `cmp` per grupp: normaliserad titel; antal författare + efternamn; länder (`coNorm`); år, volym och första sida; finns abstract; författarnyckelord; antal finansiärer; harmoniserad OA-status; citeringar. Dokumenttyp och ämneskategorier jämförs inte (olika klassificeringar).

**Val.** `groupChoice(r, g, prefs)`: `r._pick[g]` ("v<i>", "auto" eller "edit") före `meta.mergePrefs[g]` (databas) före "auto". `applyFieldChoice` sätter gruppens fält från vald version, `_edit` eller `_auto` (saknat fält → `_auto`). `setMergePref` tillämpar på alla poster med `_versions`, `setPick` på en post; båda räknar om all statistik. `saveRecord` lägger ändrade grupper i `_edit` och sätter `_pick[g]="edit"`.

**Gränssnitt.** `SourcesPanel` (fliken Preview, sedan 0.995; i 0.994 överst i Overview) och `RecordProvenance` (postvisningen). `aggregate().srcCounts` räknar `_mergedFrom`. Dashboard har en egen `RecordOverlay` för klickbara mängder.

**Test (0.994).** WoS + Scopus + OpenAlex-JSON + Augmenter-fil: 982 inlästa poster, 568 efter dubblettkontroll, 343 sammanslagna; per databas WoS 369 (34 bara där), Scopus 508 (170), OpenAlex 97 (23); databaserna skiljer sig för t.ex. länder i 22 och finansiering i 106 poster. Adresser från OpenAlex för hela samlingen ändrade *Top institutions* och återställdes med *Automatic*. En redigerad titel behölls när samlingens titelval ändrades; valen överlevde omladdning från webbläsarens lagring. Regressionstester 0.993 mot 0.994: identisk utdata. Exporterad samling (WoS + Scopus): 9,1 MB mot 5,5 MB utan versionerna.

## 6b. Klustring (0.8)

`clusterNetwork()` delar noderna i kluster oberoende av layout. Principen är VOSviewers (Waltman, van Eck & Noyons 2010): maximera Σ_ij δ(c_i, c_j)(s_ij − γ), där s_ij är association strength. Med s_ij = 2m·c_ij/(k_i·k_j) är det ekvivalent med modularitet med upplösning γ:

Q = Σ_c [ L_c/(2m) − γ (K_c/(2m))² ],

där L_c är dubbla summan av länkvikterna inom klustret och K_c summan av nodernas länkstyrka. Q optimeras med Louvain-metoden (Blondel m.fl. 2008): lokal flytt av noder i slumpmässig ordning till det grannkluster som ger störst ökning, därefter aggregering till klusternoder, upprepat tills inget förändras. Tio slumpmässiga starter, den med högst Q behålls. Alla länkar används, med råa antal som vikter.

- **Klusterupplösning** γ (standard 1, 0,05–10): högre värde ger fler och mindre kluster.
- **Min. klusterstorlek**: kluster med färre noder slås ihop, minst först, med det kluster som har störst länkstyrka till klustret delad med målklustrets totala länkstyrka.
- Noder utan länkar får klustret −1 (grå).
- Kluster numreras efter storlek, störst först. Färger ur en palett med 14 färger (upprepas vid fler kluster).
- Test på syntetiska nätverk med planterade kluster: parvis överensstämmelse 99,6 % (200 noder, 5 kluster) och 100 % (500 noder, 8 kluster); tid under 0,1 s. Glesa nätverk med få noder delas i fler kluster än de planterade.
- Skillnad mot VOSviewer: VOSviewer använder i nyare versioner Leiden-algoritmen, som garanterar sammanhängande kluster. Louvain gör inte det. Resultaten blir därför liknande men inte identiska.

## 7. Visning (0.8)

- **Nodstorlek** (0,3–4) multiplicerar nodernas radie (4–18 px efter antal dokument, kvadratrotsskala).
- **Textstorlek** (6–24 px) för etiketterna.
- Storlek, textstorlek och färger sätts i en separat effekt i `StaticNetwork`, så zoom och manuella positioner behålls när de ändras.
- Länkar inom ett kluster ritas i klustrets färg, övriga i neutral färg.

## 8. Manuell justering (0.7)

Gäller ForceAtlas2, VOS-inspirerad och stress-majorisering.

- Manuella positioner lagras per nod-id i `NetworkPanel` (state `over`) i normaliserade koordinater. De nollställs när layouten räknas om (ny analys, nya gränsvärden, ny layout eller ändrade parametrar).
- Dragning: d3-drag inuti det zoomade lagret, så koordinaterna är zoomoberoende. Förflyttningen räknas om till normaliserade enheter med skalan sc = min(bredd, höjd) · 0,44.
- Piltangenter flyttar vald nod 2 px (Shift: 10 px) i ozoomad skala.
- *Remove overlap* (reglage från 0.95, `reduceOverlap(nodes, k, sc, radius)`): parvis isärskjutning tills avståndet mellan två cirklar är minst k · (r₁ + r₂ + 6 px), högst 200 varv. k = 0 ger layouten oförändrad, k = 1 tar bort all överlappning. Beräknas varje gång från layouten plus manuella flyttar (inte kumulativt), med `useDeferredValue` så att reglaget svarar. *Reset positions* nollställer både manuella flyttar och k. Etiketter beaktas inte.
- *Återställ positioner* tar bort alla manuella positioner.
- Positioner sparas inte mellan sessioner.

## 9. Helskärm

Knappen *Helskärm* använder webbläsarens Fullscreen API på nätverkspanelen. Om det inte stöds fyller panelen fönstret. Esc avslutar.

## 10. Licenser och erkännanden

BiblioScope: MIT. Beroenden: d3 7.9.0 (ISC), React/React DOM (MIT), JSZip 3.10.1 (MIT eller GPL-3.0; används under MIT) med pako (MIT), topojson-client 3.1.0 (ISC) och world-atlas 2.0.2 (ISC; Natural Earth, public domain). Licenserna för d3, topojson-client och world-atlas är kontrollerade i `node_modules`.

Algoritmreferenser:

- Jacomy, M., Venturini, T., Heymann, S. & Bastian, M. (2014). ForceAtlas2, a continuous graph layout algorithm for handy network visualization designed for the Gephi software. *PLOS ONE*, 9(6), e98679.
- van Eck, N. J. & Waltman, L. (2009). How to normalize cooccurrence data? An analysis of some well-known similarity measures. *JASIST*, 60(8), 1635–1651.
- van Eck, N. J., Waltman, L., Dekker, R. & van den Berg, J. (2010). A comparison of two techniques for bibliometric mapping: Multidimensional scaling and VOS. *JASIST*, 61(12), 2405–2416.
- van Eck, N. J. & Waltman, L. (2010). Software survey: VOSviewer, a computer program for bibliometric mapping. *Scientometrics*, 84(2), 523–538.
- Blondel, V. D., Guillaume, J.-L., Lambiotte, R. & Lefebvre, E. (2008). Fast unfolding of communities in large networks. *Journal of Statistical Mechanics*, P10008.
- Waltman, L., van Eck, N. J. & Noyons, E. C. M. (2010). A unified approach to mapping and clustering of bibliometric networks. *Journal of Informetrics*, 4(4), 629–635.
- Gansner, E. R., Koren, Y. & North, S. (2004). Graph drawing by stress majorization. I *Graph Drawing 2004*, LNCS 3383, 239–250.

Upphovsrätten till koden anges i `LICENSE` som Johan Eklund och Gustaf Nelhans, Högskolan i Borås. Om rätten i stället tillfaller arbetsgivaren (40 a § upphovsrättslagen) behöver det klargöras före publicering.

## 11. Testning och kända begränsningar

Testat i headless Chromium med en syntetisk Scopus-fil (40 poster, i 0.9 även en variant med citeringar mellan posterna): navigering via LCS och Recs, utgående länkar, Comparison-dimensionen, import, de fyra layouterna, klustring och färgläggning, reglagen för nod- och textstorlek, dragning, piltangenter, knapparna för överlapp och återställning, helskärmsknappen. VOS-layouten är dessutom testad separat på syntetiska klusternätverk.

Inte testat eller kända begränsningar:

- Riktiga exporter från Web of Science, Scopus och OpenAlex, särskilt stora filer och blandade källor.
- Affiliationstolkningen.
- Världskartan (kräver internet för kartgeometrin).
- Layouten räknas i huvudtråden. Vid 500 noder fryser sidan i några sekunder.
- Etiketter kan överlappa även efter *Ta bort överlapp*.
- Klustertillhörighet exporteras sedan 0.97 i CSV-filen från *Network statistics*.
- Gränssnittet är helt på engelska (från 0.81). Namnen i den här dokumentationen följer de engelska fältnamnen i parentes där det behövs: Min. dokument = *Min. documents*, Min. citeringar = *Min. citations*, Max noder = *Max. nodes*, Klusterupplösning = *Cluster resolution*, Min. klusterstorlek = *Min. cluster size*, Nodstorlek = *Node size*, Textstorlek = *Label size*, Ta bort överlapp = *Remove overlap*, Återställ positioner = *Reset positions*.
