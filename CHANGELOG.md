# BiblioScope – ändringslogg och att-göra

## Version 0.995 (2026-11-26)

- Rutan *Sources, files and merged records* ligger i en egen flik, *Preview*, direkt efter *Overview*. BiblioScope startar fortfarande i *Overview*.
- Licens och citering: Johan Eklund och Gustaf Nelhans, Högskolan i Borås, med ORCID i `CITATION.cff`.

## Version 0.994 (2026-11-26)

**Källor och sammanslagna poster**
- *Overview*: ny ruta *Sources, files and merged records* (ersätter dubblettrutan). Per databas: antal poster, antal bara därifrån och antal som också finns i en annan databas; alla kombinationer (t.ex. WoS + Scopus); de inlästa filerna med databas och antal poster; dubblettkontrollen. Alla tal och databasnamn är klickbara och listar sina poster.
- Sidhuvudet räknar en sammanslagen post för varje databas den kommer från (tidigare bara den prioriterade databasen); databasnamnen är klickbara.
- Sammanslagna poster sparar varje ursprunglig version (`_versions`) och den automatiska sammanslagningen (`_auto`). Postvisningen visar vilka databaser och filer posten kommer från och, på begäran, en tabell med vad varje databas har för titel, författare, adresser och länder, källa, dokumenttyp, abstract, nyckelord, ämneskategorier, finansiering, öppen tillgång, citeringar och antal referenser.
- Val av databas per fältgrupp: för hela samlingen (*Take from* i Overview) eller för en enskild post (*Use* i postvisningen; posten vinner). Antal sammanslagna poster där databaserna skiljer sig visas per fältgrupp och är klickbart. Referenserna byts inte.
- En manuell ändring av en sammanslagen post sparas som postens eget val och skrivs inte över när samlingens val ändras.
- Sparade samlingar blir större (ca +65 % för WoS + Scopus i testet). Samlingar från före 0.994 saknar versionerna och filnamnen; läs in filerna igen.

**Att göra**
- [ ] Augmenter-värden (öppna indikatorer) som egen version i jämförelsen.
- [ ] Organisationsnamn: harmonisering mellan databaserna (t.ex. "Southeast University" och "Southeast University - China").

## Version 0.993 (2026-11-26)

**Inläsning av OpenAlex CSV** (webbgränssnittets export)
- Båda kolumnformaten läses: API-namn (`id`, `display_name`, `authorships.author.display_name` …) och läsbara namn (`Work ID`, `Title`, `Author`, `Cites`, `FWCI` …).
- FWCI, percentil per ämnesområde (topp 10 %/1 % härleds från percentilen), finansiärer, öppen tillgång ("Open Access"/"NOT Open Access"), PMID, abstract, källa och ämnesområde förs över till posten och syns i *Indicators*.
- Kolumnen `Cites` (eller `referenced_works`) ger citerade referenser som OpenAlex-id, så co-citation och bibliografisk koppling fungerar direkt. Referenserna visas då som id; för författare, år och titel behöver filen köras genom Augmenter (uppgiften *Resolve cited references*).
- OpenAlex JSON: abstract återskapas från `abstract_inverted_index`; ett vanligt textfält `abstract` (Augmenterns poster byggda från CSV) läses också.

**Open Sources Augmenter 2.1** (`OA-augment_dev/open-sources-augmenter.html`)
- Rättat: CSS-rester högst upp på sidan, saknade färgvariabler (Kör-knappen syntes bara vid hovring), filytan som bara reagerade i kanterna.
- Två uppgifter att välja mellan: *Resolve cited references* (endast OpenAlex-filer; ger en OpenAlex-JSON som läses in i BiblioScope ensam) och *Add open indicators* (WoS, Scopus, OpenAlex; ger en fil som läses in tillsammans med originalfilerna).
- OpenAlex CSV: hela posterna hämtas via `Work ID` (med referenser, DOI, institutioner, finansiärer, SDG); `Cites` jämförs med de hämtade posterna. Rader utan `Work ID` byggs från CSV-kolumnerna, och då kan bara deras referenser slås upp (inga DOI → ingen iCite/OpenAIRE).
- OpenAIRE: högst 5 DOI per fråga (tjänsten tillåter högst 4 OR); efter tre avvisade frågor utan träff hoppas källan över. Upprepade loggmeddelanden slås ihop (×n).
- Nedladdade filer får namn efter första filen plus antal övriga (t.ex. `savedrecs_+1_more_open-indicators.json`); tidigare såg det ut som om bara första filen behandlats, vilket inte var fallet.
- Knappen är avstängd med förklaring när inga poster har DOI, PubMed-id eller OpenAlex-id.

**Att göra**
- [ ] Testa Augmenter 2.1 mot de riktiga tjänsterna med de tre CSV-exporterna (självtesterna kördes mot simulerade svar).
- [ ] Visa korta etiketter (W-id i stället för hel URL) för oupplösta OpenAlex-referenser i nätverken.

## Version 0.992 (2026-11-25)

- *Comparison*: omkopplare *Show: Numbers / Shares*. Med *Shares* jämförs sidorna i förhållande till sin egen storlek: andel av samlingen (skillnad i procentenheter), citeringar, lokala citeringar, författare, tidskrifter och referenser per publikation; publikationer per år som andel av sidans publikationer; nyckelord och publiceringskällor som andel av sidans publikationer; mest citerade författare och källor som andel av sidans citerade referenser.

## Version 0.991 (2026-11-25)

- *Indicators*: alla kategorier och mängder är klickbara och listar sina poster (täckningsrutorna, OA-status, SDG, sektorer, sektorpar, oklassade organisationer, finansiärer, finansiärstyper, raderna i *Citation indicators by group* och varje segment i årsdiagrammen). Listan öppnas ovanpå fliken; klick på en post öppnar den, Esc stänger.

## Version 0.99 (2026-11-24)

**Ny flik: Indicators**
- *Open access*: en harmoniserad status per post (diamond, gold, hybrid, bronze, green, closed) från WoS-, Scopus- och OpenAlex-beteckningarna; per år. Översiktens OA-diagram använder samma status (tidigare räknades "gold", "Gold Open Access", "All Open Access" och "closed"/"Closed" var för sig).
- *Agenda 2030*: SDG per mål och per år, med täckning (bara OpenAlex-poster eller berikade poster).
- *Sektorer*: författarorganisationer som högre utbildning, forskningsinstitut, vård, myndighet, företag, ideell, oberoende; ROR-typ (OpenAlex) eller namnregler (WoS/Scopus). Poster per sektor, samarbete över sektorer, per år, manuell klassning av oklassade.
- *Finansiärer*: andel med finansiering, sammanslagna finansiärer, bidragsnummer, finansiärstyp (regelbaserad, ändringsbar), per år.
- *Citeringsindikatorer per grupp*: citeringar, ociterade, LCS, FWCI (median/medel/täckning), topp 10 %, RCR per OA-status, sektor, sektorsamarbete, finansiering, finansiärstyp, SDG, databas.
- Comparison: nya dimensioner Open access, Sectors, Funders, Funder types, SDGs.
- Postvisningen visar öppen tillgång, finansiering, SDG och öppna indikatorer.

**Inläsning**
- Nya fält från WoS (PM, FU, FX), Scopus (PubMed ID, Funding Details, Funding Texts) och OpenAlex (pmid, funders, awards, SDG, FWCI, percentiler, ROR-typer).
- Filer från Open Sources Augmenter läggs till befintliga poster (inga egna poster); statusraden visar antal berikade.
- Adresser: fristående postnummer tolkas inte längre som ort/organisation.
- OBS: samlingar som sparats i webbläsaren före 0.99 saknar de nya fälten; läs in filerna igen.

**Open Sources Augmenter 2.0** (`OA-augment_dev/open-sources-augmenter.html`)
- Tar WoS-, Scopus-, OpenAlex- och BiblioScope-filer. Slår upp DOI/PubMed-id i OpenAlex (FWCI, percentil, OA, SDG, ämnen, ROR-typer, finansiärer), NIH iCite (RCR) och OpenAIRE Graph (BIP!-klasser, användningsstatistik). JSON för BiblioScope och CSV med en rad per post.
- Referensuppslagningen för OpenAlex-filer finns kvar. Systemtypsnitt i stället för Google Fonts.

**Att göra**
- [ ] Testa Augmenter mot de riktiga tjänsterna (CORS för iCite och OpenAIRE, OpenAlex fältlista och API-nyckel).
- [ ] BIP!-klasser och användningsstatistik i *Citation indicators by group*.
- [ ] Finansiärstyp via ROR/Crossref Funder Registry i Augmenter i stället för namnregler.
- [ ] ROR-matchning av WoS/Scopus-adresser utan DOI.
- [ ] Granska sektor- och finansiärsreglerna på fler datamängder (särskilt icke-kinesiska finansiärer).

## Version 0.98 (2026-11-24)

**Historiograph: kluster och rangordning för att hitta de mest relevanta studierna**
- Posterna klustras efter direkt citering (alla poster och citeringar i samlingen), med samma Louvain-metod som i Networks. Inställningar: upplösning, min. klusterstorlek, färg (kluster eller som tidigare), nodstorlek (LCS, GCS, PageRank, Authority, SPC).
- Nya filter: *Top PageRank*, *Top Authority*, *Top SPC* (utöver GCS, LCS, Linked och Main path).
- Klusterkort under grafen: storlek, år, citeringar inom/från andra kluster, utmärkande nyckelord (tf-idf) och tre nyckelposter efter valt mått. Klick på kort visar bara det klustret.
- *Show* ett kluster: Top N väljs inom klustret och huvudvägen beräknas inom klustret. Tabellen *Record metrics* har kolumnen Cluster och följer valet.

**Att göra**
- [ ] Klusterkort och nyckelposter som CSV.
- [ ] Testa klustringen och termerna på riktiga data (testfilens nyckelord är syntetiska).

## Version 0.97 (2026-11-24)

**Networks: nätverksmått (Gephi-inspirerade)**
- Ny sektion *Network statistics* under klusterförteckningen: noder, länkar, täthet, genomsnittlig grad och viktad grad, komponenter, största komponent, diameter, genomsnittlig väglängd, genomsnittlig klustringskoefficient, transitivitet och modularitet Q för kartans kluster.
- Nodtabell med kluster, degree, weighted degree (total link strength), betweenness, harmonisk closeness, eigenvector, PageRank och lokal klustringskoefficient. Sorterbar, klick på rad markerar noden i kartan och tvärtom, CSV-export (med kluster och komponent).
- *Link weights*: oviktat eller länkstyrka (avstånd = 1/länkstyrka) för betweenness, closeness, eigenvector och PageRank.
- *Node size by*: nodstorlek efter dokument (som tidigare) eller ett av måtten.

**Historiograph: riktade mått och huvudvägsanalys**
- Nytt filter *Main path*: huvudvägsanalys med SPC-vikter (Hummon & Doreian 1989), som i Lucio-Arias & Leydesdorff (2008, JASIST 59(12), doi:10.1002/asi.20903). Sökning global, local forward eller key-route (k valbart). Pilbredd efter SPC. Cykler i citeringarna bryts och redovisas.
- Tabell *Record metrics*: LCS (ingrad), LCR (utgrad), GCS, PageRank, HITS authority och hub, SPC och SPC-andel, markering för huvudvägen. Filter: på huvudvägen / med lokala länkar / alla. Klick på titel öppnar posten. CSV-export.
- Vyerna Authors–Institutions: tabell med poster, mottagna/givna citeringar, in-/utgrad och viktad PageRank; klick väljer enheten och visar citeringstabellen.

**Övrigt**
- Enheten för nyckelord i Networks hette fortfarande "Nyckelord" i gränssnittet; nu "Keyword".
- Verifierat mot networkx och mot uppräkning av alla vägar, se teknisk dokumentation 6g.

**Att göra**
- [ ] Expected information value (Lucio-Arias & Leydesdorff 2008) för övergångar längs huvudvägen.
- [ ] Huvudväg på aggregerad nivå (t.ex. tidskrifter) och markering av huvudvägen i Top N-grafen.
- [ ] Deltagandekoefficient/z-poäng (Guimerà & Amaral), Burts constraint och matris mellan kluster (steg 3).
- [ ] Räkna måtten i en Web Worker för stora nätverk.

## Version 0.96 (2026-11-24)

**Byte mellan ljust och mörkt tema behåller tillståndet**
- I 0.94–0.95 ritades hela panelen om vid temabyte, så inställningar (analys, layout, reglage), zoom, manuella positioner och urval gick förlorade. Nu byts bara färgerna: gränssnittet renderas om med nya färgvärden och redan ritade diagram färgas om på plats.
- Test: Networks (VOS-inspired, All components, nodstorlek 2, överlapp 40 %, inzoomad, vald nod) och Historiograph (Institutions med vald pil och citeringstabell) var identiska före och efter bytet i båda riktningar; inga färger från det gamla temat fanns kvar i diagrammen.

**Att göra**
- [ ] Inställningarna i Networks (och andra flikar) nollställs när man byter flik, eftersom panelen monteras om. Överväg att behålla flikarnas tillstånd.

## Version 0.95 (2026-11-24)

**Networks: vilka noder som visas**
- Nytt val *Show*: *Main component* (största sammanhängande komponenten, standard som i VOSviewer), *All components* (alla noder med länkar) och *All nodes (incl. unlinked)* (som tidigare, med noder utan länkar i en ring).
- Filtret görs före layout och klustring. Statusraden visar antal komponenter, den största komponentens storlek och antal noder utan länkar.

**Networks: överlapp som reglage**
- *Remove overlap* är ett reglage 0–100 % i stället för en knapp. 100 % motsvarar den tidigare knappen; mellanlägen minskar överlappen men behåller kartans form (med stora noder blev kartan tidigare en rund boll). Beräknas alltid från layouten, så det går att dra tillbaka. *Reset positions* nollställer även reglaget.
- Test: 136 överlappande par vid 0 %, 69 vid 50 %, 0 vid 100 %, med i stort sett oförändrad utbredning.

## Version 0.94 (2026-11-24)

**Historiograph: posterna i citeringstabellen**
- Citerande och citerad post visar LCS, GCS, LCR och CR direkt i tabellen.
- Klick på en titel öppnar hela posten ovanpå sidan (referenser, LCS-länk till citerande poster, ↗ DOI, redigering). Stäng med ✕ Close, Esc eller klick utanför; nätverket och tabellen behåller sitt urval.

**Ljust tema**
- Knappen ☀ Light / ☾ Dark i sidhuvudet (även på startsidan) växlar mellan mörkt och ljusgrått gränssnitt. Valet sparas i webbläsaren.
- Sidhuvudets bakgrund följer nu temat. Text på accentfärgade knappar har egen färg per tema.
- Kontrollerat med skärmbilder: Overview, Networks, Historiograph, Comparison och postvisningen. Diagrampaletterna är oförändrade.

**Att göra**
- [ ] Granska det ljusa temat på riktiga data och i alla flikar (särskilt kartan, som inte kunnat visas i testmiljön).

## Version 0.93 (2026-11-24)

**Historiograph**
- Nya vyer: *Institutions* och *Institutions with Subdivision* (citeringsflöden mellan institutioner, tolkade ur adressen som i Networks).
- Klick på en nod i Authors, Journals, Countries eller Institutions visar under nätverket en tabell med alla citeringar bakom noden: från-enhet(er), till-enhet(er), citerande post och citerad post (med ↗-länkar). Växla mellan *Cited by (incoming)* och *Citing (outgoing)*. Citeringar inom samma enhet markeras *within*.
- Klick på en pil visar citeringarna från den ena enheten till den andra.
- Pilar i båda riktningar mellan samma par ritas bredvid varandra (tidigare låg de ovanpå varandra och bara den ena gick att klicka på). Pilarnas siffror blockerar inte längre klick.
- Test: antal rader i tabellen stämde med pilens siffra för alla 107 pilar i testsamlingen.

**Att göra**
- [ ] Samma klicktabell i Networks (t.ex. vilka poster som ligger bakom en länk i bibliografisk koppling).
- [ ] Export av citeringstabellen (CSV).

## Version 0.92 (2026-11-24)

**Citerade författare och källor: stavningsvarianter slås ihop**
- Comparison (*Most cited authors*, *Most cited sources*) räknade varje stavning för sig, t.ex. "DOHERTY P" och "Doherty P", "ISHIDA H" och "Ishida H", "Schaefer T.J." och "Schaefer TJ". Nu grupperas författare med samma nyckel som samlingens egna författare (efternamn + initialer, utan hänsyn till skiftläge, punkter och diakritiska tecken), och källor utan hänsyn till skiftläge och skiljetecken.
- Den bäst skrivna varianten visas: blandad versal/gemen före bara versaler, därefter den vanligaste. Samma stavning används på båda sidor, så markeringen ● för poster på båda sidor blir rätt.
- "[Anonymous]" och "[No title captured]" räknas inte bland citerade författare.
- Samma rättning i Networks, co-citering på författar- och tidskriftsnivå: varianter blev tidigare separata noder (i testet 11 noder, nu 6).
- Kvarstår: olika förkortningar av samma tidskrift ("ARTIF INTELL" och "ARTIF INTELL-AMST") och olika författare med samma efternamn och initialer slås inte ihop respektive kan slås ihop.

## Version 0.91 (2026-11-24)


**Cited Refs: DOI-länkar och uppslagning**
- Referenser med DOI har länken *↗ DOI*.
- Referenser utan DOI: *🔍 Find DOI* (en referens) eller *🔍 Find DOIs on this page* (upp till 50) söker i Crossref. En DOI markeras *found* bara när förstaförfattare och år stämmer, plus volym eller sida, eller för böcker orden i den avkortade titeln. Annars visas kandidaterna och vilka uppgifter som stämde.
- Länken *Scholar* öppnar en Google Scholar-sökning för referensen.
- Anledning till kontrollerna: Crossrefs förstaträff kan vara fel. För "Kamada T, 1989, Information Processing Letters, 31, 7" rankades en annan artikel (Matsuoka) högre än den rätta.
- Funna DOI:er gäller bara under sessionen och används inte i analyserna.

**Att göra**
- [ ] Använda funna DOI:er i analyserna (spara dem i samlingen, slå ihop referenser som får samma DOI, påverkar koppling och co-citering). Kräver att användaren kan godkänna eller avvisa träffar.
- [ ] Testa uppslagningen mot riktiga Crossref med verkliga WoS-referenser (t.ex. de 30 mest citerade i en testsamling).
- [ ] Överväg `mailto`-parameter till Crossref (deras "polite pool") om verktyget används mycket.

## Version 0.9 (2026-11-24)

**Jämförelse med 0.3**
- 0.3 och 0.82 jämfördes flik för flik (rubriker, kolumner, menyer, knappar och klickbara element, samma testdata) och genom de texter som finns i respektive bygge. Två funktioner hade fallit bort vid återskapandet av källkoden i 0.4 (se nedan). I övrigt saknas inget; de två fasta nätverkspanelerna i 0.3 (Keyword Co-occurrence, Co-authorship) finns nu som val i Networks.

**Återställt**
- Cited Refs: siffran under *Recs* är klickbar och visar de poster i samlingen som citerar referensen, med knappen *← Back to cited references*.
- Collection: LCS-siffran är klickbar och visar de poster i samlingen som citerar posten ("Records in the collection citing: …"). Kan följas vidare i flera steg.

**Nytt**
- LCS är klickbar även i postvisningen (RecordDetail), i Collection och i Cited Refs.
- Länk ↗ till DOI eller databaspost (Web of Science, Scopus, OpenAlex, annars Google Scholar) i postlistan, postvisningen och Top Papers.
- Comparison: ny dimension *Affiliations with Subdivision* (organisation + avdelning ur adressen, som i Networks).

**Test**
- Ny testfil med citeringar mellan posterna (Scopus-format, 40 poster). Tidigare testfil hade inga lokala citeringar, så LCS-funktioner kunde inte testas. Testskriptens klick på fliken Cited Refs träffade tidigare statistikrutan med samma namn; rättat.

## Version 0.82 (2026-11-23)

**Återställt från 0.2/0.3** (föll bort när källkoden återskapades i 0.4)
- JSZip 3.10.1 är inbyggt igen. Sedan 0.4 hämtades JSZip från cdnjs, så zip-filer kunde bara läsas med internet. Nu fungerar zip-inläsning utan nätverk (testat med allt nätverk blockerat).
- Systemtypsnitt i stället för Google Fonts: Georgia för rubriker, system-ui för text, ui-monospace för kod. Programmet gör inga externa anrop utom för världskartan.
- Världskartan hämtar geometrin från jsdelivr, med unpkg och en grövre karta (1:110m) som reserv. Utan internet visas en rangordnad landlista med en förklaring.
- Filstorleken ökar från 491 kB (0.81) till 589 kB, främst på grund av JSZip. Version 0.3 var 559 kB.

**Övrigt**
- package.json: jszip tillagt som beroende, licens MIT, version 0.8.2. Kör `npm install` före `npm run build`.
- Instruktionsböckerna: världskartan finns under Overview, inte under Sources & Authors.

## Version 0.81 (2026-11-23)

**Språk**
- All text i programmet är på engelska, med amerikansk stavning som i övriga gränssnittet: fliken Networks, analys- och enhetsnamn, layoutnamn (VOS-inspired, Stress majorization, Force (classic)), hjälptexter, klusterförklaringen, länkbeskrivningarna i Historiograph och licenssektionen (License and acknowledgements).
- Enheten "Artikel" heter Document och "Tidskrift" heter Source.
- Instruktionsböckerna (svenska och engelska) använder de engelska namnen på knappar och fält.

## Version 0.8 (2026-11-23)

**Klustring i Networks**
- Noderna färgas efter kluster. Principen är VOSviewers (Waltman, van Eck & Noyons 2010): maximera Σ δ(c_i,c_j)(s_ij − γ) med association strength, vilket motsvarar modularitet med upplösning γ. Optimeras med Louvain-metoden, 10 slumpmässiga starter, bästa behålls.
- Inställningar: Klusterupplösning (standard 1; högre värde ger fler och mindre kluster) och Min. klusterstorlek (mindre kluster slås ihop med det kluster de har starkast normaliserad länk till).
- Noder utan länkar klustras inte och visas grå.
- Länkar inom ett kluster får klustrets färg.
- En förklaring under nätverket listar klustren med storlek och de tre största noderna.
- Klustringen beror inte på layouten. Den används också i layouten Force (nuvarande).
- Test på syntetiska nätverk med planterade kluster: 99,6 % (200 noder, 5 kluster) och 100 % (500 noder, 8 kluster) parvis överensstämmelse. Glesa små nätverk delas i fler kluster än de planterade.

**Storlek på noder och text**
- Reglaget Nodstorlek (0,3–4) skalar alla noder. Textstorlek (6–24 px) styr etiketterna. Zoomen behålls när reglagen ändras.
- Ta bort överlapp räknar med den aktuella nodstorleken.

**Att göra**
- Klustringen är Louvain, inte Leiden-algoritmen som VOSviewer använder i nyare versioner. Leiden garanterar sammanhängande kluster.
- Klustertillhörighet kan inte exporteras ännu.

## Version 0.7 (2026-11-23)

**Layout i Networks**
- Ny layout: Stress-majorisering (SMACOF). Noderna placeras så att avstånden på skärmen följer de kortaste avstånden i nätverket. Layouten har inga reglage. Noder utan förbindelse hamnar längre bort.

**Manuell justering av noder**
- Dra en nod för att flytta den. Dra bakgrunden för att panorera, scrolla för att zooma.
- Klicka på en nod för att välja den. Piltangenterna flyttar den 2 px, med Shift 10 px.
- Ta bort överlapp: skjuter isär noder vars cirklar överlappar, med en marginal på 3 px.
- Återställ positioner: tar bort alla manuella positioner.
- Manuella positioner nollställs när analys, enhet, gränsvärden, layout eller reglage ändras.
- Layouten d3 (nuvarande) stöder inte manuell flytt.

**Rättat efter granskning**
- CSV-parsern lade till en tom post när filen slutade med radbrytning (alla Scopus-exporter). Det förklarar 41 i stället för 40 poster och noden "? n.d." i nätverken.

**VOS-inspirerad layout (ersätter "VOS (spektral)")**
- Samma kvalitetsfunktion som VOSviewer (CWTS networkanalysis): V = Σ s_ij·d^a/a − Σ d^r/r över alla nodpar, med ln d när exponenten är 0. Egen implementering, inte VOSviewers kod.
- Attraktion och repulsion är heltal, och attraktion måste vara större än repulsion. Standard är 2 och 1, som VOSviewer rekommenderar.
- Normalisering: association strength, 2m·c_ij/(k_i·k_j) (Van Eck & Waltman 2009), som standard, eller ingen.
- Optimering nod för nod med normaliserade gradientsteg (steg 1 till 0,001, reduktion 0,75), 1–4 slumpmässiga starter beroende på storlek, bästa resultat behålls.
- Frånkopplade komponenter hålls ihop med en svag attraktion mellan alla par (motsvarar VOSviewers edgeWeightIncrement, här 0,01). Isolerade noder placeras i en ring.
- Test med syntetiska kluster: avståndet inom kluster är cirka 15 % av avståndet mellan kluster. Tid: 0,4 s för 150 noder, 3,3 s för 500 noder.

**Länkar i layouten**
- Alla layouter använder nu alla länkar. Bara de 1500 starkaste ritas.

**Licens**
- Licensen är MIT i stället för CC BY 4.0. Ny fil CITATION.cff för citering (ORCID och repo-adress är inte ifyllda).

**Licens och erkännanden**
- Ny sektion "Licens och erkännanden" längst ner i appen. Den listar d3, React, topojson-client, world-atlas och algoritmreferenserna (ForceAtlas2, VOS, stress-majorisering).

**Att verifiera**
- Stress-layouten och den manuella flytten är testade i headless Chromium med 41 noder. Testa med riktiga exporter.
- Överlappsborttagningen flyttar bara noder. Textetiketter kan fortfarande överlappa.
- Stress-majorisering med slumpmässiga startpositioner kan hamna i lokala minima. Testa om en spektral startposition ger bättre resultat.
- Licenserna för d3 7.9.0, topojson-client 3.1.0 och world-atlas 2.0.2 är kontrollerade i node_modules: alla ISC.
- Kontrollera vem som äger upphovsrätten till koden (40 a § upphovsrättslagen) innan publicering.
- Layouten räknas i webbläsarens huvudtråd. Vid 500 noder fryser sidan i några sekunder när VOS-inspirerad layout räknas om.

## Version 0.6 (2026-11-23)

**Layout i Networks**
- Ny layoutväljare med tre val: ForceAtlas2 (standard), VOS (spektral) och Force (nuvarande, d3).
- ForceAtlas2 följer Jacomy et al. 2014: degree-viktad repulsion, LinLog-attraktion och gravitation. Steglängden styrs av en avkylning i stället för Gephis adaptiva hastighet.
- VOS-layouten minimerar viktade kvadrerade avstånd. Den startar i en spektral lösning (två minsta egenvektorerna för Laplace-matrisen) och förfinas med repulsion. VOSviewers egen implementation är inte identisk.
- Reglagen Attraktion, Repulsion och (ForceAtlas2) Gravitation styr layouten. Layouten räknas om när ett reglage ändras.
- Zoom och panorering finns i alla layouter.

**Helskärm**
- Knappen Helskärm i nätverkspanelen öppnar panelen i webbläsarens helskärmsläge. Om det inte stöds fylls appfönstret. Avsluta med knappen eller Esc.

**Att verifiera**
- Helskärmsläget och Esc är testade bara i headless Chromium. Testa i en vanlig webbläsare.
- Layouterna är testade med syntetiska data, där referenserna är slumpmässiga och därför inte visar kluster. Testa med riktiga exporter.

## Version 0.5 (2026-11-23)

**Nätverk (fliken Networks)**
- Ny nätverksvy med fyra analyser: Bibliografisk koppling, Co-citering, Co-authorship och Samförekomst av nyckelord.
- Enhetsval: Artikel, Författare, Tidskrift, Affiliation och Affiliation med subdivision. Subdivision finns bara för bibliografisk koppling och co-authorship.
- Gränsvärden enligt VOSviewer-modellen: Min. dokument, Min. citeringar och Max noder. Statusraden visar hur många noder som uppfyller gränsvärdena.
- Zoom och panorering i alla nätverk (fanns inte i Keyword Co-occurrence och Co-authorship).

**Definitioner**
- Bibliografisk koppling: två enheter kopplas med antalet gemensamma referenser. För författare, tidskrifter och affiliationer används unionen av enheternas poster.
- Co-citering: två citerade enheter kopplas med antalet citerande poster i kollektionen som citerar båda. Min. dokument avser citerande poster. Min. citeringar gäller bara artikelnivå.
- Co-authorship på artikel- och tidskriftsnivå: poster respektive tidskrifter kopplas om de delar minst en författare.

**Övrigt**
- Författarharmoniseringen från 0.3 är nu också i källkoden. Historiograph-länkarna och v0.4-etiketten från 0.4 finns kvar.

**Att verifiera**
- Affiliationer tolkas heuristiskt: WoS antas ha organisation först, Scopus avdelning först. Testa mot riktiga exporter.
- En testfil med 40 poster visas som 41 poster i både 0.4 och 0.5. Orsaken är inte utredd.

**Att göra (kvar)**
- Klickbara LCS- och Recs-siffror i Collection och Cited Refs (från 0.3, inte portat).
- Nyckelordssamförekomst på andra nivåer än nyckelord.

## Version 0.3 (2026-11-22)

**Namn och gränssnitt**
- Fliken "HistCite" har bytt namn till **Historiograph**. Startsidans beskrivning har ändrats från "HistCite-style" till "local citation analysis and historiographs".
- Versionsnummer (v0.3) visas bredvid rubriken, och sidtiteln är "BiblioScope 0.3".

**Författarharmonisering**
- Jämförelsen av författarnamn är skiftlägesokänslig. "Cronin, B", "CRONIN, B" och "cronin, b" räknas som samma författare.
- Vid sammanslagning visas den variant som är normalt skriven (Cronin, B.) före VERSALER eller gemener, även om den är mindre frekvent.
- Oförändrat: komma, punkter och mellanslag mellan initialer samt diakritiska tecken ignoreras (sedan tidigare). Fullständigt förnamn och initialer slås inte ihop.

**Historiograph**
- Klick på en artikel (nod) öppnar ett nytt fönster. Länken väljs i denna ordning: DOI → Web of Science-post → Scopus-post → OpenAlex-ID → Google Scholar-sökning på titeln.
- Tooltipen anger om klicket öppnar DOI eller post.

**Collection**
- Siffran i kolumnen LCS är klickbar och visar de artiklar i kollektionen som citerar den aktuella posten. Listan har samma sortering och klick-igenom som övriga listor.

**Cited Refs**
- Siffran i kolumnen Recs är klickbar och visar de artiklar i kollektionen som refererar till källan. Tillbaka-knappen leder till rätt lista.

## Version 0.2 (2026-11-22)

**Från React/Vite-bygge till fristående HTML-fil**
- BiblioScope är en enda `.html`-fil (ca 560 kB) utan byggsteg. React, d3 och JSZip är inbyggda. Filen kan öppnas lokalt eller läggas på GitHub Pages eller dataasimpact.eu.
- Logiken är oförändrad jämfört med React-versionen, inklusive import från Web of Science, Scopus och OpenAlex, blandade källor, redigering av poster och sparande i webbläsaren (IndexedDB).
- Google Fonts är borttagna. Systemtypsnitt används (Georgia för rubriker), så inga externa typsnittsanrop görs.
- JSZip hämtas inte längre från cdnjs, så zip-uppladdning fungerar utan CDN.
- Världskartan: kartgeometrin (`world-atlas`) hämtas vid körning från jsdelivr (reserv: unpkg) med en egen liten TopoJSON-avkodare i stället för npm-paketen. Utan internet visas en rankad landlista.
- Observera: sparade samlingar ligger per webbläsare och adress. På en ny adress börjar samlingen tom och måste exporteras och importeras.

## Att göra

**Visualisering**
- [ ] **Alluvialdiagram (flödesdiagram).** Undersök att lägga till alluvialdiagram, till exempel för förändring av ämnesklasser, nyckelord eller länder över tid, eller för flöden mellan författare, tidskrifter och länder. Inspiration: alluvial generator på mapequation.org (Map Equation, Infomap), https://www.mapequation.org/alluvial. Verifiera att det är den sidan som avsågs ("mapexplorer.org" gav inga träffar som sådan). Frågor att avgöra: vilka dimensioner som ska kunna väljas, hur klustring/tidsfönster definieras, och om d3-sankey kan bäddas in i filen.

**Författare**
- [ ] Slå ihop namn där förnamn skrivs ut på olika sätt ("Cronin, Blaise" och "Cronin, B"). Kräver försiktig hantering för att inte slå ihop olika personer.
- [ ] Användning av ORCID och OpenAlex författar-ID där de finns, för säkrare identifiering.

**Kartor och beroenden**
- [ ] Bädda in kartgeometrin (`countries-50m.json` från `world-atlas`, ca 750 kB) så att världskartan fungerar helt offline.
- [ ] Granska och testa kartan på riktiga data. Kartan har inte setts renderas i testmiljön.

**OpenAlex-verktyg**
- [ ] Besluta om OpenAlex Reference Augmenter och OpenAlex Parser ska byggas in som ett steg i BiblioScope eller finnas som egna filer med samma utseende.
- [ ] Granska Augmenter-koden: HTML-escaping av filnamn, felmeddelanden och API-nyckel, förenklad logik för omförsök och olösta ID:n, API-nyckelfältet som lösenordsfält.

**Datakällor**
- [ ] **OpenAIRE.** Undersök att lägga till data från OpenAIRE Graph som källa vid sidan av OpenAlex: vilka exportformat och API:er som finns, om referenslistor (citeringsrelationer) finns med, hur poster matchas mot OpenAlex, Web of Science och Scopus (DOI, OpenAIRE-ID) vid dubblettkontroll, och om affiliationer, länder och finansiärer kan tas med. (Önskemål 2026-11-24.)
  - Första test 2026-11-24: Graph API v3 (`https://api.openaire.eu/graph/v3/research-products`) går att söka med fritext och filter (år, land, ROR, författare, projekt, finansiär), max 100 poster per sida, cursor för fler. Posterna har författare (med ORCID när det finns), DOI/PMID, tidskrift, ämnen, organisationer (ROR, land) på postnivå, projekt och citeringsindikatorer, men **inga referenslistor**. Citeringsrelationer finns i den nedladdningsbara grafen men inte i API:ets poster. Organisationer är inte kopplade till enskilda författare och saknar avdelning.
  - Slutsats: ett steg motsvarande OpenAlex Reference Augmenter behövs, och mer än för OpenAlex. Referenser kan hämtas per DOI via OpenAlex (referenced_works, återanvänd Augmenter) eller OpenCitations. Poster utan DOI (typiskt repositorieinnehåll) får inga referenser.
  - Alternativ inom OpenAIRE: ScholeXplorer API v3 (`https://api.scholexplorer.openaire.eu/v3/Links?sourcePid=<DOI>`), OpenAIREs citeringsnav. Länkar från OpenCitations, Crossref, DataCite och repositorier, plus citeringar textutvunna ur öppna fulltexter. Ger referenser (sourcePid) och citerande verk (targetPid), även citeringar av dataset och mjukvara. Testat 2026-11-24 med ForceAtlas2-artikeln (10.1371/journal.pone.0098679): 20 länkar på 2 sidor (10 per sida), alla med SubType "cites" (Name "IsRelatedTo"); källan är den citerande artikeln. Målen har titel, författare (ibland ORCID), datum, DOI och typ; länkarna kommer från Crossref, OpenCitations och OpenAIRE (textutvunna). En länk gällde mjukvara utan DOI (benchmarkForceAtlas2 på GitHub). OpenAlex har 25 referenser för samma artikel. Att hantera vid tolkning: filtrera på SubType, inte Name; författarnamn i olika format ("Jon M. Kleinberg", "Andreas Noack 0001" med DBLP-suffix); Publisher blandar tidskrift (issn/doaj-id) och repositorier; flera DOI:er per mål; källans metadata upprepas i varje länk (stora svar). Ca 3–5 anrop per post; uppskattningsvis 35–60 min för 1 000 poster vid nuvarande gräns (7 200 anrop/timme), betydligt längre om gränsen utan inloggning sänks.
  - **Beslut 2026-11-24:** OpenAIRE-referenser hämtas i OpenAlex Reference Augmenter, som byter namn till **Open Sources Augmenter**. Läge: ScholeXplorer per DOI, valfri komplettering från OpenAlex, källa per referens, cache och möjlighet att återuppta. Görs efter 0.9.
  - Andra möjligheter: citerande verk för framåtcitering; nätverk med projekt, finansiärer och organisationer (ROR) som enheter; OpenAIREs citeringsindikatorer (popularity, influence, impulse) som nodvikt; den kompakta citeringsgrafen ur hela OpenAIRE-dumpen (Skarding & Sanda 2026, arXiv 2602.12206, ca 32 GB) som lokal uppslagstjänst även för poster utan DOI.

**Jämförelse och återställning** (klart i 0.9)
- [x] Jämför 0.3 och 0.82 flik för flik och återställ funktioner som föll bort när källkoden återskapades i 0.4 (bland annat klickbart LCS i Collection och Recs i Cited Refs).
- [x] Comparison: lägg till dimensionen Affiliation with Subdivision, definierad som i Networks (organisation + avdelning ur adressen), inte hela adressen som i Collection.

**Historiograph**
- [x] Möjlighet att öppna DOI/post även från andra vyer (Top Papers, postvisning, Collection).
- [x] LCS-klick även i postvisningen (RecordDetail).

**Drift och dokumentation**
- [ ] Flytta repot från `gnelhans/biblioscope` till SSLIS-organisationen och aktivera GitHub Pages (sslis.github.io/biblioscope).
- [ ] Lägga filen som `index.html` i repot och spara källkoden (React-versionen och byggskripten) separat.
- [ ] Uppdatera README och Tools-sidan på dataasimpact.eu med version 0.3.
- [ ] Testa med riktiga exporter från Web of Science, Scopus och OpenAlex (stora filer, blandade källor).
