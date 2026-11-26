# BiblioScope 0.995 – Instruktionsbok för studenter

BiblioScope är ett webbläsarbaserat verktyg för att utforska bibliografiska data från Web of Science, Scopus och OpenAlex. Du kan beskriva en mängd publikationer (utgivning per år, tidskrifter, författare, länder, nyckelord), undersöka hur publikationerna citerar varandra (lokal citeringsanalys och historiografer) och rita vetenskapskartor: nätverk för bibliografisk koppling, co-citering, sampublicering och samförekomst av nyckelord.

BiblioScope är en enda HTML-fil. Ingenting installeras och dina data lämnar aldrig din dator.

---

## Innehåll

1. Kom igång
2. Exportera data från databaserna
3. Läsa in data
4. Flikarna i korthet
5. Networks: att bygga en vetenskapskarta
6. Historiografen
7. Indikatorer och Open Sources Augmenter
8. Redigera samlingen
9. Spara, exportera och fortsätta senare
10. Att tolka resultaten
11. Övningar
12. Felsökning
13. Ordlista
14. Licens och hur du citerar BiblioScope

---

## 1. Kom igång

1. Öppna <https://gnelhans.github.io/biblioscope/> i en aktuell webbläsare (Chrome, Edge, Firefox eller Safari). För att arbeta utan nätverk: ladda ner filen `index.html` från <https://github.com/gnelhans/biblioscope> (eller `biblioscope0992.html` om du fått den filen) och öppna den med dubbelklick.
2. Allt körs i din webbläsare; dina datafiler laddas inte upp någonstans.
3. Startsidan ber om datafiler. Avsnitt 2 beskriver hur du får fram dem.

**Bra att veta**

- Filen fungerar utan internet. Bara världskartan behöver internet för att hämta landsgränser.
- Samlingen sparas automatiskt **i den här webbläsaren på den här datorn**. I en annan webbläsare eller på en annan dator börjar du med en tom samling. Använd *Export* för att flytta ditt arbete (avsnitt 8).
- **☀ Light / ☾ Dark** i sidhuvudet växlar mellan mörkt och ljusgrått gränssnitt. Bara färgerna ändras; inställningar, zoom och urval ligger kvar. Valet sparas i webbläsaren.
- Gränssnittet är på engelska. Instruktionsboken anger knapparnas och fältens engelska namn i kursiv eller fetstil.

---

## 2. Exportera data från databaserna

BiblioScope behöver varje publikations **referenslista** för citeringsanalys, bibliografisk koppling och co-citering. Ta alltid med referenserna när du exporterar.

| Databas | Exportformat | Vad du väljer |
|---|---|---|
| Web of Science | Plain text (`.txt`) | *Full Record and Cited References* |
| Scopus | CSV (`.csv`) | Kryssa i *References* (och gärna alla bibliografiska fält, abstrakt och nyckelord) |
| OpenAlex | CSV från webbgränssnittet, eller JSON | Välj *Add all* bland kolumnerna (eller åtminstone *Work ID* och *Cites*). Kör sedan CSV-filen genom Open Sources Augmenter, uppgiften *Resolve cited references* (avsnitt 7.1), så att referenserna får författare, år och titel |

Tips:

- Databaserna begränsar hur många poster du kan exportera åt gången. Exportera stora träffmängder i flera delar. BiblioScope kan läsa flera filer samtidigt och även `.zip`-arkiv.
- Du kan blanda källor, till exempel en fil från Web of Science och en från Scopus om samma ämne. Dubbletter tas bort (avsnitt 3).
- Anteckna söksträng, databas, datum och antal träffar. Du behöver uppgifterna när du beskriver din metod.

---

## 3. Läsa in data

1. Klicka på **Select Files** (eller **Select Folder**), eller dra filerna till startsidan.
2. Välj **Duplicate matching** innan du läser in, om du kombinerar källor:
   - **DOI only** – slår bara ihop poster med identisk DOI. Försiktigast.
   - **Balanced** – DOI, eller identisk titel som bekräftas av gemensamt efternamn eller publiceringsår inom ±2.
   - **Fuzzy** – som Balanced, och dessutom nästan identiska titlar. Fångar fler varianter men kan ibland slå ihop olika publikationer.
3. Efter inläsningen visar sidhuvudet antal poster, antal filer, årsintervall och antal poster per databas (en sammanslagen post räknas för varje databas den kommer från). Klicka på en databas för att lista dess poster.
4. Fliken *Preview* visar rutan *Sources, files and merged records*: poster per databas, bara därifrån och även i andra databaser, alla kombinationer, de inlästa filerna och dubblettkontrollen. Alla tal är klickbara.

**Sammanslagna poster.** När samma publikation finns i flera databaser slås posterna ihop. Automatiskt tas för varje fält det mest fullständiga värdet, med Web of Science före Scopus före OpenAlex när de är lika fullständiga; nyckelord, ämneskategorier och organisationer slås samman från alla versioner. I postvisningen visar *Show what each database holds* vad varje databas har (titel, författare, adresser och länder, källa, abstract, nyckelord, finansiering, öppen tillgång, citeringar, antal referenser) och var de skiljer sig. *Use* tar en databas värde för just den posten. Under *Take from* i *Preview* väljs databas per fältgrupp för hela samlingen, t.ex. adresser från Web of Science; poster utan det värdet behåller det automatiska. Ett val för en enskild post går före samlingens val, och en egen ändring (*Edit*) skrivs inte över. Referenserna byts aldrig, eftersom formatet och matchningen beror på databasen. Redovisa i metodbeskrivningen om du har ändrat de automatiska valen.

**New Upload** (uppe till höger) börjar om. Nya filer ersätter den sparade samlingen, så exportera först om du vill behålla den.

---

## 4. Flikarna i korthet

| Flik | Visar |
|---|---|
| **Overview** | Nyckeltal, publikationer per år, dokumenttyper, citeringsfördelning och världskarta över publikationer per land. |
| **Preview** | Källor, filer och sammanslagna poster: poster per databas och kombinationer, inlästa filer, dubblettkontroll och val av databas per fält. |
| **Collection** | Posterna som lista. Filtrera, sortera, öppna en post, lägg till eller redigera poster. Statistik per författare, tidskrift, år, dokumenttyp, språk, affiliation och land. |
| **Sources & Authors** | De mest produktiva tidskrifterna, författarna, institutionerna och länderna. |
| **Subject Map** | Ämneskategorier och forskningsområden som treemap. |
| **Keywords** | Nyckelordsmoln och de vanligaste nyckelorden. |
| **Networks** | Vetenskapskartor (avsnitt 5). |
| **Historiograph** | Hur publikationerna i samlingen citerar varandra över tid (avsnitt 6). |
| **Top Papers** | De mest citerade publikationerna, var och en med en länk (↗) till DOI eller databasposten. |
| **Cited Refs** | Alla citerade referenser, hur ofta de citeras i samlingen och om de själva ingår i samlingen. Klicka på siffran under *Recs* för att se vilka poster som citerar referensen. Varje referens har en länk till sin DOI (↗ DOI) eller, utan DOI, en sökning i Crossref och Google Scholar (se nedan). |
| **Comparison** | Två organisationer, affiliationer med avdelning (*Affiliations with Subdivision*), länder, författare, OA-status, sektorer, finansiärer, finansiärstyper, SDG eller årsintervall sida vid sida (*Side A* och *Side B*). *Show: Numbers / Shares* växlar mellan antal och värden i förhållande till varje sidas storlek (andel av dess publikationer eller citerade referenser, genomsnitt per publikation), vilket är rättvisare när sidorna är olika stora. |
| **Indicators** | Öppen tillgång, Agenda 2030 (SDG), författarorganisationernas sektorer, finansiärer och finansiärstyper samt citeringsindikatorer (även FWCI och RCR där de finns) per grupp (avsnitt 7). |

Klicka på en post var som helst för att öppna dess detaljer. Länken **↗** bredvid en titel (i *Collection*, *Top Papers* och postvisningen) öppnar DOI, eller posten i Web of Science, Scopus eller OpenAlex om DOI saknas; i sista hand en sökning i Google Scholar.

**Hitta citerade verk utan DOI.** Många citerade referenser, särskilt böcker och äldre artiklar, saknar DOI i exporten. Klicka på **🔍 Find DOI** vid en referens i *Cited Refs*, eller på **🔍 Find DOIs on this page** för upp till 50 åt gången. BiblioScope frågar Crossref (kräver internet) och markerar en DOI som *found* bara när förstaförfattare och år stämmer, tillsammans med volym eller sida, eller för böcker orden i den förkortade titeln. Annars visas kandidaterna och vilka uppgifter som stämde, så att du kan bedöma själv. **Scholar** öppnar en sökning i Google Scholar. Funna DOI:er sparas bara medan sidan är öppen och används ännu inte i analyserna.

**Följa citeringar inom samlingen.** Där en **LCS**-siffra är understruken (i listan i *Collection* och i postvisningen) kan du klicka på den för att se vilka poster i samlingen som citerar posten. Från den listan kan du öppna en post eller följa dess LCS vidare, och på så sätt spåra en citeringskedja steg för steg.

---

## 5. Networks: att bygga en vetenskapskarta

Fliken *Networks* bygger ett nätverk i fem steg: välj analys, välj enhet, sätt gränsvärden, välj layout och justera klustringen.

### 5.1 Analys (*Analysis*)

| Analys | Två noder kopplas när … | Länkens styrka |
|---|---|---|
| **Bibliographic coupling** (bibliografisk koppling) | de citerar samma referenser | antal gemensamma referenser |
| **Co-citation** (co-citering) | de citeras tillsammans av publikationer i samlingen | antal publikationer som citerar båda |
| **Co-authorship** (sampublicering) | de delar publikationer (eller författare) | antal gemensamma publikationer |
| **Keyword co-occurrence** (samförekomst av nyckelord) | de förekommer i samma publikation | antal publikationer |

Bibliografisk koppling relaterar publikationer genom deras *källor* och passar för att kartlägga aktuella forskningsfronter. Co-citering relaterar *citerade verk* genom hur senare forskning använder dem tillsammans och passar för att kartlägga ett fälts intellektuella bas.

### 5.2 Enhet (*Unit*)

*Document* (publikation), *Author* (författare), *Source* (tidskrift), *Affiliation* och *Affiliation with subdivision* (affiliation med institution eller avdelning). Alla enheter finns inte för alla analyser. Affiliationer läses ur adressfältet med en enkel regel, så granska etiketterna.

### 5.3 Gränsvärden

Som i VOSviewer avgör gränsvärden vilka noder som tas med:

- **Min. documents** – minsta antal publikationer bakom en nod (för co-citering: antal citerande publikationer).
- **Min. citations** – minsta antal citeringar (summan av citeringar i databasen; för co-citering av publikationer: lokala citeringar).
- **Max. nodes** – högst så många noder visas (10–500), de största först.

Statusraden visar hur många noder som uppfyller gränsvärdena och hur många noder och länkar som visas. Börja strikt (till exempel *Min. documents* 3–5 för författare) och sänk gränsvärdena stegvis. Stora nätverk är svåra att läsa och tar längre tid att rita.

**Show** avgör vilka av de valda noderna som ritas: *Main component* (den största gruppen noder som är länkade till varandra; standard, som i VOSviewer), *All components* (alla noder med minst en länk) eller *All nodes (incl. unlinked)*, där noder utan länkar placeras i en ring runt nätverket. Statusraden anger hur många sammanhängande komponenter det finns, hur stor den största är och hur många noder som saknar länkar.

### 5.4 Layout

| Layout | Karaktär | Inställningar |
|---|---|---|
| **ForceAtlas2** | Kraftbaserad layout som i Gephi. Tydliga kluster. | *Attraction* (drar ihop länkade noder), *Repulsion* (skjuter isär alla noder), *Gravity* (drar mot mitten) |
| **VOS-inspired** | Bygger på samma princip som VOSviewer. Rekommenderas för jämförelser med VOSviewer-kartor. | *Normalization* (association strength är VOSviewers standard), *Attraction* och *Repulsion* (heltal, attraktion större än repulsion; rekommenderat 2 och 1) |
| **Stress majorization** (stress-majorisering) | Avstånden på skärmen följer de kortaste vägarna i nätverket. Bra översikt över helheten. | inga |
| **Force (classic)** | Den animerade layouten från tidigare versioner. | inga |

Alla layouter utom *Force* räknas ut en gång och ritas sedan. Den VOS-inspirerade layouten kan ta några sekunder för nätverk med flera hundra noder, och sidan svarar inte under tiden.

**Att läsa kartan:** noder nära varandra är starkt relaterade. Nodens storlek visar antal publikationer. Linjens bredd visar länkens styrka. Färgerna visar kluster (avsnitt 5.5).

### 5.5 Kluster

BiblioScope delar in noderna i kluster av starkt länkade noder, enligt samma princip som VOSviewer. Varje kluster får en egen färg, och länkar inom ett kluster ritas i klustrets färg. Under kartan listas klustren med storlek och de tre största noderna; håll muspekaren över en rad för att se alla medlemmar.

- **Cluster resolution** (klusterupplösning): ett högre värde ger fler och mindre kluster, ett lägre värde färre och större. Standard 1.
- **Min. cluster size** (minsta klusterstorlek): mindre kluster slås ihop med det kluster de har starkast koppling till.
- Noder utan länkar klustras inte och visas grå.

Klustringen beror inte på layouten. Ett kluster är ett förslag, inte ett faktum: pröva några upplösningar och se vilka kluster som är stabila. Namnge ett kluster först efter att du öppnat några av dess publikationer.

### 5.6 Navigera och justera

- **Zooma:** scrolla. **Panorera:** dra i bakgrunden. **Återställ zoom:** dubbelklicka.
- **Node size by** (nodstorlek efter): antal dokument/förekomster (standard) eller ett av måtten under *Network statistics* (se 5.7).
- **Node size** och **Label size** (nodstorlek och textstorlek): gör alla noder eller alla etiketter större eller mindre.
- **Flytta en nod:** dra den.
- **Finjustera en nod:** klicka på den (den får en guldfärgad kant) och använd piltangenterna: 2 px per tryck, 10 px med Shift.
- **Remove overlap** (reglage, 0–100 %): skjuter isär noder som överlappar. Vid 0 % visas layouten som den beräknats; vid 100 % överlappar inga cirklar, vilket med stora noder sprider ut kartan. Värden däremellan minskar de värsta överlappen men behåller kartans form. Reglaget utgår alltid från den beräknade layouten (plus dina egna flyttar), så det går att dra tillbaka.
- **Reset positions:** tar bort alla manuella flyttar och sätter *Remove overlap* till 0 %.
- **Full screen:** visar nätverket över hela skärmen. Avsluta med knappen eller Esc.

Manuella flyttar försvinner när du ändrar analys, gränsvärden, layout eller en layoutinställning (men inte när du ändrar klustring, nodstorlek eller textstorlek). Justera kartan sist, precis innan du tar en skärmbild.

### 5.7 Nätverksmått (Network statistics)

Under klusterförteckningen beskriver *Network statistics* kartan som visas (efter *Show*, trösklarna och *Max. nodes*). Håll muspekaren över ett värde eller en kolumnrubrik för att se definitionen.

**Sammanfattning:** noder, länkar (alla länkar, även de som inte ritas), täthet, genomsnittlig grad och viktad grad, komponenter, den största komponentens storlek, diameter och genomsnittlig väglängd (räknat i länkar), genomsnittlig klustringskoefficient, transitivitet och modulariteten Q för kartans kluster.

**Nodtabell:** en rad per nod med kluster, *degree* (antal länkade noder), *weighted degree* (summan av länkstyrkorna, VOSviewers *total link strength*), *betweenness* (andel av de kortaste vägarna mellan andra noder som går genom noden), *closeness* (harmonisk: medelvärdet av 1/avstånd till alla andra noder), *eigenvector*-centralitet, *PageRank* och den lokala *klustringskoefficienten*. Klicka på en rubrik för att sortera. Klicka på en rad för att markera noden i kartan; en nod som klickas i kartan markeras i tabellen. *⤓ CSV* laddar ner hela tabellen.

**Link weights:** *Ignore* räknar varje länk som 1. *Use link strength* behandlar en stark länk som ett kort avstånd (1 / länkstyrka) för betweenness och closeness och låter starka länkar väga tyngre i eigenvector och PageRank.

Måtten beskriver strukturen i en enskild karta. De ändras med varje val bakom kartan och är utforskande: en nod med hög betweenness i en kopplingskarta är en publikation som förbinder grupper av referenser i den här samlingen, inte en bättre publikation.

---

## 6. Historiografen

Historiografen (efter Garfields HistCite) visar publikationerna i samlingen längs en tidsaxel, med pilar för citeringar mellan dem.

- **LCS** (local citation score): hur många publikationer *i din samling* som citerar publikationen.
- **GCS** (global citation score): citeringar i hela databasen.
- **LCR** (local cited references): hur många av publikationens referenser som finns i din samling.

Välj *Top LCS*, *Top GCS* eller *Top Linked* och antal publikationer (*Top N*). Klicka på en publikation för att öppna dess DOI eller databaspost. En publikation med högt LCS men måttligt GCS är central för *ditt* ämne även om den inte citeras mycket i övrigt.

**Citeringsflöden mellan författare, tidskrifter, länder och institutioner.** Under *View* kan du också visa hur citeringar flödar mellan *Authors*, *Journals*, *Countries*, *Institutions* och *Institutions with Subdivision* (med avdelning). Varje nod är en enhet, och varje pil visar hur många poster från en enhet som citerar poster från en annan. Citeringar inom samma enhet ritas inte. *Top N* anger hur många enheter som visas. Institutioner läses ur adressfältet på samma sätt som i *Networks*.

- **Klicka på en nod** för att under nätverket få en lista över alla citeringar bakom den: *Cited by (incoming)* visar citeringar till enheten, *Citing (outgoing)* citeringar från den. Rader markerade *within* är citeringar mellan två poster från samma enhet.
- **Klicka på en pil** för att lista citeringarna från den ena enheten till den andra.
- Varje rad visar enheterna på båda sidor, den **citerande posten** och den **citerade posten**, var och en med LCS, GCS, LCR och CR och en ↗-länk till DOI eller databaspost. Klicka på en titel för att öppna hela posten ovanpå sidan (referenser, LCS med mera); stäng med *✕ Close* eller Esc, så ligger nätverket och tabellen kvar som du lämnade dem. Klicka på nätverkets bakgrund för att rensa urvalet.
- När två enheter citerar varandra ritas de två pilarna bredvid varandra, så att båda går att klicka på.
- Under nätverket finns en **måttabell** med varje enhets poster, mottagna och givna citeringar (summan av pilarnas värden), in- och utgrad (hur många andra enheter som citerar den / som den citerar) och PageRank längs citeringsflödet. Klicka på en rad för att välja enheten.

### 6.1 Huvudvägsanalys (Main path)

Välj filtret **Main path** för att visa citeringsnätverkets huvudväg i stället för de *Top N* publikationerna (Hummon & Doreian 1989; för HistCite-historiogram Lucio-Arias & Leydesdorff 2008). Varje citering viktas med sitt *search path count* (SPC): antalet vägar som går genom den från en *källa* (en publikation som inte citerar någon annan publikation i samlingen) till en *sänka* (en publikation som inte citeras inom samlingen). Huvudvägen följer de tyngsta citeringarna och kan läsas som ryggraden i hur ämnet har utvecklats i samlingen.

- **Global**: den eller de vägar från källa till sänka som har störst sammanlagt SPC.
- **Local forward**: börjar vid den tyngsta citeringen från en källa och följer sedan hela tiden den tyngsta citeringen framåt.
- **Key-route**: börjar vid de *k* tyngsta citeringarna i hela nätverket och förlänger var och en åt båda hållen (Liu & Lu 2012).

Pilarnas bredd visar SPC; håll muspekaren över en pil för värdet. Raden ovanför grafen anger citeringsnätverkets storlek och antalet källor, sänkor och vägar. Om publikationer citerar varandra (t.ex. två artiklar från samma år) utelämnas citeringen från den senare till den tidigare, så att vägarna går att räkna; antalet utelämnade redovisas.

### 6.2 Kluster: att hitta de mest relevanta studierna

Publikationerna delas i kluster efter vem som citerar vem inom samlingen (direkt citering), med samma metod som i *Networks*. Alla publikationer och citeringar används, inte bara de som ritas. Publikationer utan citeringar till eller från samlingen klustras inte (grå).

- **Resolution** och **Min. size** fungerar som i *Networks*: högre upplösning ger fler och mindre kluster; mindre kluster slås ihop med det kluster de citerar eller citeras av mest.
- **Colour**: efter kluster (standard) eller som tidigare (citerad lokalt eller inte).
- **Node size**: LCS (standard), GCS, PageRank, Authority eller SPC.
- **Show**: alla kluster eller ett kluster. Med ett kluster hämtas *Top N* ur det klustret och *Main path* beräknas inom klustret.

Under grafen finns ett kort för varje kluster med storlek, år, antal citeringar inom klustret och från andra kluster, de mest utmärkande nyckelorden och klustrets tre **nyckelposter**, rangordnade efter måttet som valts under *Filter* (SPC för *Main path*). Klicka på ett kort för att visa bara det klustret; klicka på en titel för att öppna posten.

Ett praktiskt sätt att hitta de mest relevanta studierna: titta på klusterkorten med *Top LCS* (mest citerade inom samlingen), sedan *Top PageRank* (citerade av publikationer som själva citeras) och *Top SPC* (på många citeringsvägar); publikationer som återkommer är centrala i samlingen. Visa sedan ett kluster i taget med *Main path* för att följa hur den forskningslinjen har utvecklats. Namnge ett kluster först när du har läst några av dess publikationer.

### 6.3 Mått per post

Under historiografen finns en tabell med, för varje publikation: LCS (ingrad), LCR (utgrad), GCS, *PageRank* (högt för publikationer som citeras av publikationer som själva citeras), HITS *authority* och *hub* (en hub citerar många authorities, som en översiktsartikel gör), *SPC* (vägar från källa till sänka genom publikationen och deras andel av alla vägar) klustret och om den ligger på huvudvägen. När ett kluster visas listar tabellen bara det klustret. Visa *On the main path*, *With local links* eller *All*, sortera på valfri kolumn, öppna en post genom att klicka på titeln och ladda ner tabellen som CSV.

Allt detta beror på vilka publikationer samlingen innehåller: huvudvägen i en samling med 300 artiklar är huvudvägen bland just de artiklarna.

---

## 7. Indikatorer: öppen tillgång, Agenda 2030, sektorer, finansiärer och citeringsgenomslag

Fliken *Indicators* beskriver samlingen med uppgifter som databaserna lägger till varje post. Varje avsnitt anger hur många poster värdena bygger på. Värdena beskriver samlingen och är inte kvalitetsmått.

**Öppen tillgång.** En status per post: diamond, gold, hybrid, bronze, green eller closed (i den ordningen, som Unpaywall). Web of Science, Scopus och OpenAlex använder olika beteckningar; BiblioScope översätter dem. Diamond (inga avgifter för författare eller läsare) anges bara av OpenAlex. En post utan värde för öppen tillgång i Web of Science eller Scopus räknas som closed. Diagrammet visar statusen per år.

**Agenda 2030 (SDG).** De globala målen kommer från OpenAlex, som tilldelar dem automatiskt utifrån titel och sammanfattning. Exporter från Web of Science och Scopus innehåller inga SDG; använd Open Sources Augmenter (avsnitt 7.1) för att lägga till dem. Olika SDG-klassificeringar skiljer sig mycket åt, så läs siffrorna som "vad den här klassificeraren hittar".

**Sektorer.** Varje författarorganisation tilldelas en sektor: högre utbildning, forskningsinstitut, hälso- och sjukvård, myndighet/offentlig, företag, ideell eller oberoende forskare. OpenAlex-poster (och berikade poster) använder organisationstyperna i ROR; adresser från Web of Science och Scopus klassas utifrån ord i namnet (Univ, Hosp, Minist, Acad Sci, Co Ltd …), vilket är ungefärligt. Tabellen visar poster per sektor, poster med enbart den sektorn och med andra sektorer samt de största organisationerna; därunder de vanligaste kombinationerna av sektorer och sektorer per år. Oklassade organisationer kan ges en sektor för hand (sparas i webbläsaren).

**Finansiärer.** Finansiärer hämtas från Web of Science (FU), Scopus (Funding Details) och OpenAlex. Stavningsvarianter slås ihop. Finansiärstyp (myndighet/offentlig, internationell/EU, privat stiftelse, universitet/forskningsorganisation, företag) finns inte i någon export och tilldelas utifrån namnet; kontrollera typerna i tabellen och ändra vid behov. Poster utan finansieringsuppgift är inte nödvändigtvis ofinansierade.

**Citeringsindikatorer per grupp.** För en vald gruppering (öppen tillgång, sektor, samarbete över sektorer, finansiering, finansiärstyp, SDG eller databas) visar tabellen antal poster, median och medelvärde för citeringar, andel ociterade, median-LCS och, där det finns, OpenAlex FWCI (fältnormerat citeringsgenomslag; 1 = världsgenomsnittet för samma delområde, år och typ), andelen bland de 10 % mest citerade och NIH:s relativa citeringskvot (RCR). Titta på täckningen (n) innan grupper jämförs, och föredra medianer och topp 10 %-andelar framför medelvärden.

Alla värden, staplar, stapelsegment och tabellrader i fliken går att klicka på för att lista posterna bakom dem; klicka på en post i listan för att öppna den.

Samma grupperingar (öppen tillgång, sektorer, finansiärer, finansiärstyper, SDG) finns i *Comparison*.

### 7.1 Open Sources Augmenter

Open Sources Augmenter (<https://gnelhans.github.io/biblioscope/augmenter/>, eller filen `open-sources-augmenter.html`) är en separat sida med två uppgifter. Läs in exportfilerna, välj uppgift och kör; bara identifierare (OpenAlex-id, DOI, PubMed-id) skickas till tjänsterna.

**Resolve cited references** (bara OpenAlex-filer, CSV eller JSON). Augmenter hämtar de fullständiga posterna via kolumnen *Work ID* och slår upp varje citerat verk (författare, år, titel, källa). Resultatet är en OpenAlex-JSON som läses in i BiblioScope **ensam**; co-citering, bibliografisk koppling, citerade referenser och historiografen fungerar då som för Web of Science-data. RCR och OpenAIRE-värden kan läggas till i samma körning.

- Exportera från OpenAlex webbgränssnitt som CSV och välj *Add all* bland kolumnerna, eller åtminstone *Work ID* och *Cites*.
- Saknas *Work ID* byggs posterna från CSV-kolumnerna, och bara deras referenser kan slås upp.
- En OpenAlex-CSV kan också läsas direkt i BiblioScope (FWCI, percentil, finansiärer och öppen tillgång följer med), men de citerade referenserna syns då bara som OpenAlex-id.

**Add open indicators** (Web of Science, Scopus, OpenAlex). Slår upp posterna via DOI, OpenAlex-id eller PubMed-id:

- **OpenAlex** (via DOI eller id): FWCI, citeringspercentil och topp 1 %/10 %, öppen tillgång, SDG, ämnen, organisationstyper och finansiärer.
- **NIH iCite** (via PubMed-id): relativ citeringskvot (RCR) för biomedicinska poster.
- **OpenAIRE Graph** (via DOI): BIP!-klasser för genomslag (influence, popularity, impulse) och användningsstatistik.

Ladda ner JSON-filen och läs in den i BiblioScope **tillsammans med** originalfilerna. Den lägger till värdena i de matchande posterna och lägger inte till några egna poster. CSV-filen har en rad per post för användning i andra program. Flera filer kan läsas in samtidigt; den nedladdade filen får namn efter den första (t.ex. `savedrecs_+1_more_open-indicators.json`), men alla filer behandlas.

---

## 8. Redigera samlingen

- **Add record** (i *Collection*): lägg till en publikation som saknas, till exempel en bok eller rapport. Författare en per rad, referenser en per rad i Web of Science-format.
- **Edit** (i postvisningen): rätta titel, år, författare, adresser eller referenser. Du kan också koppla poster i samlingen manuellt, vilket räknas in i LCS och LCR.
- **Remove**: tar bort en post. Den kan återställas med *Undo*.

All statistik, alla nätverk och historiografen räknas om efter varje ändring. Dokumentera dina ändringar; de är en del av din metod.

---

## 9. Spara, exportera och fortsätta senare

- **Automatiskt sparande:** sidhuvudet visar *Saved in this browser*. Nästa gång du öppnar filen i samma webbläsare kan du välja **Resume**.
- **Export → BiblioScope collection (.json):** allt, inklusive dina ändringar. Läs in filen igen senare eller på en annan dator.
- **Export → Web of Science format (.txt):** alla poster skrivna som Web of Science-poster, till exempel för VOSviewer eller andra verktyg.
- **Bilder:** ta en skärmbild av nätverket eller diagrammet, gärna i helskärmsläge.

Om du rensar webbläsarens data försvinner också den sparade samlingen. Exportera regelbundet.

---

## 10. Att tolka resultaten

- **Täckning:** Web of Science, Scopus och OpenAlex täcker olika tidskrifter, språk och dokumenttyper. Resultaten beskriver *ditt dataset*, inte fältet som sådant.
- **Citeringar tar tid:** nya publikationer har haft kortare tid att bli citerade. Jämför publikationer av liknande ålder.
- **Fält skiljer sig åt:** citeringsnivåerna varierar mycket mellan fält. Jämför inte råa antal mellan fält.
- **Namn och adresser:** författare med samma namn kan slås ihop, och en författare kan förekomma med flera stavningar. BiblioScope slår ihop stavningar som bara skiljer sig i versaler, skiljetecken eller accenter ("DOHERTY P" och "Doherty P"), även bland citerade författare, men inte olika förkortningar av samma tidskrift. Institutioner skrivs på många sätt.
- **Gränsvärden och layout är val:** kartan ändras med gränsvärden, normalisering och layout. Redovisa inställningarna och pröva alternativ innan du drar slutsatser.
- **Kartor är tolkningar:** en nods läge i förhållande till grannarna är meningsfullt; absolut läge, riktning och färg är det inte.

Redovisa minst: databas(er), söksträng och datum, antal poster före och efter dubblettkontroll, analys, enhet, gränsvärden, layout och inställningar samt eventuella manuella ändringar.

---

## 11. Övningar

**Övning 1 – Beskriv ett fält.** Exportera 300–1 000 poster om ett valfritt ämne från en databas. Använd *Overview*, *Sources & Authors* och *Keywords* och skriv en halvsidas beskrivning: tillväxt över tid, centrala tidskrifter, produktiva länder och dominerande teman.

**Övning 2 – Hitta den intellektuella basen.** Välj *Co-citation* i *Networks*, enhet *Document*, och höj *Min. documents* tills 30–80 noder återstår. Använd den VOS-inspirerade layouten. Vilka kluster får du? Öppna några av de citerade verken i varje kluster och ge klustren namn. Ändra sedan *Cluster resolution* till 0,5 och 2. Vilka kluster är stabila?

**Övning 3 – Jämför layouter.** Gör ett nätverk för bibliografisk koppling på dokumentnivå. Rita det med ForceAtlas2, den VOS-inspirerade layouten och stress-majorisering. Vilka grupper är stabila mellan layouterna? Vad förändras?

**Övning 4 – Följ en forskningsfront.** Välj *Top LCS* och *Top N* = 30 i *Historiograph*. Vilka tidiga publikationer bygger fältet på? Jämför LCS och GCS för de fem mest lokalt citerade publikationerna.

**Övning 5 – Känslighet.** Läs in samma data med *DOI only* och med *Fuzzy*. Hur många poster skiljer? Påverkar det dina resultat?

---

## 12. Felsökning

| Problem | Gör så här |
|---|---|
| "No valid records found" | Kontrollera exportformatet (avsnitt 2). Scopus ska vara CSV, Web of Science plain text. |
| Inga nätverk för co-citering eller koppling | Exporten saknar referenser. Exportera igen med referenser. |
| "No nodes meet the thresholds" | Sänk *Min. documents* eller *Min. citations*. |
| Sidan fryser i några sekunder | Layouten räknas ut. Sänk *Max noder* eller välj ForceAtlas2. |
| Ingen världskarta | Kartan behöver internet. En rangordnad landlista visas i stället. |
| Min samling är borta | Den sparas per webbläsare. Använd samma webbläsare, eller läs in din exporterade `.json`. |
| Etiketter eller noder överlappar | Zooma in, minska *Node size* eller *Label size*, öka *Remove overlap* stegvis eller flytta noder för hand. |

---

## 13. Ordlista

| Term | Betydelse |
|---|---|
| Association strength | Normalisering som delar länkens styrka med produkten av nodernas totala länkstyrkor, så att stora noder inte dominerar. Används av VOSviewer. |
| Bibliografisk koppling | Två publikationer citerar samma referenser. |
| Co-citering | Två verk citeras tillsammans av ett tredje. |
| GCS | Global citation score: citeringar i databasen. |
| LCS / LCR | Local citation score / local cited references: citeringar inom din samling. |
| Nod / länk | En enhet i nätverket / en relation mellan två enheter. |
| Gränsvärde | Lägsta värde en nod måste nå för att tas med. |
| Layout | Den algoritm som placerar noderna på kartan. |
| Kluster | En grupp noder som är starkare länkade till varandra än till resten av nätverket. |
| Upplösning | Inställning för klustringen: högre värden ger fler och mindre kluster. |
| Grad / viktad grad | Antal länkar för en nod / summan av deras styrka. |
| Betweenness | Hur ofta en nod ligger på den kortaste vägen mellan två andra noder. |
| Huvudväg | Den kedja av citeringar som bär flest vägar från källa till sänka i ett citeringsnätverk. |
| SPC | Search path count: antal vägar från källa till sänka genom en citering eller publikation. |

---

## 14. Licens och hur du citerar BiblioScope

BiblioScope är fri programvara under MIT-licensen. Verktyget utvecklas vid Data as Impact Lab, Bibliotekshögskolan, Högskolan i Borås.

Citera så här: Eklund, J., & Nelhans, G. (2026). *BiblioScope* (version 0.995) [Programvara]. Högskolan i Borås.

Om du använder den VOS-inspirerade layouten, ForceAtlas2, stress-majorisering eller klustringen, citera också metoderna: van Eck & Waltman (2010), Jacomy m.fl. (2014), Gansner, Koren & North (2004) respektive Waltman, van Eck & Noyons (2010). Fullständiga referenser finns under *License and acknowledgements* längst ner i appen.
