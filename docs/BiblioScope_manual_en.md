# BiblioScope 0.995 – Student Manual

BiblioScope is a browser-based tool for exploring bibliographic data from Web of Science, Scopus and OpenAlex. You can describe a set of publications (output per year, journals, authors, countries, keywords), study how the publications cite each other (local citation analysis and historiographs), and draw science maps: bibliographic coupling, co-citation, co-authorship and keyword co-occurrence networks.

BiblioScope is a single HTML file. Nothing is installed and your data never leaves your computer.

---

## Contents

1. Getting started
2. Exporting data from the databases
3. Loading data
4. The tabs at a glance
5. Networks: building a science map
6. The Historiograph
7. Indicators and the Open Sources Augmenter
8. Editing the collection
9. Saving, exporting and continuing later
10. Interpreting the results
11. Exercises
12. Troubleshooting
13. Glossary
14. Licence and how to cite BiblioScope

---

## 1. Getting started

1. Open <https://gnelhans.github.io/biblioscope/> in an up-to-date browser (Chrome, Edge, Firefox or Safari). To work offline, download the file `index.html` from <https://github.com/gnelhans/biblioscope> (or `biblioscope0992.html` if you were given that file) and open it by double-clicking.
2. Everything runs in your browser; your data files are not uploaded anywhere.
3. The start screen asks for data files. See section 2 for how to get them.

**Good to know**

- The file works offline. Only the world map needs an internet connection, to download country borders.
- Your collection is saved automatically **in this browser on this computer**. Another browser or computer starts with an empty collection. Use *Export* to move your work (section 8).
- **☀ Light / ☾ Dark** in the header switches between a dark and a light grey interface. Only the colours change; settings, zoom and selections stay as they are. The choice is remembered in this browser.

---

## 2. Exporting data from the databases

BiblioScope needs the **cited references** of each publication for citation analysis, bibliographic coupling and co-citation. Always include them when exporting.

| Database | Export format | What to choose |
|---|---|---|
| Web of Science | Plain text (`.txt`) | *Full Record and Cited References* |
| Scopus | CSV (`.csv`) | Tick *References* (and preferably all bibliographic fields, abstracts and keywords) |
| OpenAlex | CSV from the web interface, or JSON | Choose *Add all* among the columns (or at least *Work ID* and *Cites*). Then run the CSV file through the Open Sources Augmenter, task *Resolve cited references* (section 7.1), so that the references get authors, years and titles |

Tips:

- The databases limit how many records you can export at a time. Export large result sets in several parts. BiblioScope can read several files at once and also `.zip` archives.
- You can mix sources, for example a Web of Science file and a Scopus file on the same topic. Duplicates are removed (section 3).
- Write down your search string, database, date and number of hits. You will need this to describe your method.

---

## 3. Loading data

1. Click **Select Files** (or **Select Folder**), or drag the files onto the start screen.
2. Choose **Duplicate matching** before loading if you combine sources:
   - **DOI only** – merges only records with identical DOIs. Most conservative.
   - **Balanced** – DOI, or identical title confirmed by a shared author surname or a publication year within ±2.
   - **Fuzzy** – as Balanced, plus nearly identical titles. Catches more variants but may occasionally merge different publications.
3. After loading, the header shows the number of records, files, the year range and the number of records per database (a merged record counts for each database it comes from). Click a database to list its records.
4. The *Preview* tab shows the box *Sources, files and merged records*: records per database, only there and also in other databases, all combinations, the files read and the deduplication. Every number can be clicked.

**Merged records.** When the same publication is in several databases, the records are merged. Automatically, each field takes the most complete value, with Web of Science before Scopus before OpenAlex when they are equally complete; keywords, subject categories and organisations are combined from all versions. In the record view, *Show what each database holds* shows what each database has (title, authors, addresses and countries, source, abstract, keywords, funding, open access, citations, number of references) and where they differ. *Use* takes one database's value for that record. Under *Take from* in *Preview* a database is chosen per group of fields for the whole collection, e.g. addresses from Web of Science; records without that value keep the automatic one. A choice for one record comes before the collection's choice, and your own edit (*Edit*) is not overwritten. References are never switched, as their format and matching depend on the database. Report in your method section if you changed the automatic choices.

**New Upload** (top right) starts over. Loading new files replaces the saved collection, so export first if you want to keep it.

---

## 4. The tabs at a glance

| Tab | What it shows |
|---|---|
| **Overview** | Key figures, publications per year, document types, citation distribution and a world map of publications by country. |
| **Preview** | Sources, files and merged records: records per database and combinations, files read, deduplication and a choice of database per field. |
| **Collection** | The records as a list. Filter, sort, open a record, add or edit records. Statistics by author, journal, year, document type, language, affiliation and country. |
| **Sources & Authors** | Most productive journals, authors, institutions and countries. |
| **Subject Map** | Subject categories and research areas as a treemap. |
| **Keywords** | Keyword cloud and the most frequent keywords. |
| **Networks** | Science maps (section 5). |
| **Historiograph** | How the publications in the collection cite each other over time (section 6). |
| **Top Papers** | The most cited publications, each with a link (↗) to the DOI or database record. |
| **Cited Refs** | All cited references, how often they are cited in the collection, and whether they are part of the collection. Click the number under *Recs* to see which records cite the reference. Each reference has a link to its DOI (↗ DOI) or, without a DOI, a Crossref lookup and a Google Scholar search (see below). |
| **Comparison** | Two organisations, affiliations with subdivision (department), countries, authors, open access statuses, sectors, funders, funder types, SDGs or year intervals side by side (*Side A* and *Side B*). *Show: Numbers / Shares* switches between counts and values relative to each side's size (shares of its publications or cited references, averages per publication), which is fairer when the sides differ in size. |
| **Indicators** | Open access, Agenda 2030 (SDGs), sectors of the authors' organisations, funders and funder types, and citation indicators (incl. FWCI and RCR where available) by group (section 7). |

Click a record anywhere to open its details. The **↗** link next to a title (in *Collection*, *Top Papers* and the record view) opens the DOI, or the Web of Science, Scopus or OpenAlex record when there is no DOI; as a last resort it searches Google Scholar.

**Finding cited works without a DOI.** Many cited references, especially books and older articles, have no DOI in the export. In *Cited Refs*, click **🔍 Find DOI** next to a reference, or **🔍 Find DOIs on this page** for up to 50 at a time. BiblioScope asks Crossref (internet needed) and marks a DOI as *found* only when the first author and the year match, together with the volume or page, or, for books, the words of the abbreviated title. Otherwise it shows the candidates and which details matched, so you can judge for yourself. **Scholar** opens a Google Scholar search for the reference. Found DOIs are kept only while the page is open and are not yet used in the analyses.

**Following citations within the collection.** Wherever an **LCS** number is underlined (in the *Collection* list and in the record view), click it to list the records in your collection that cite that record. From that list you can open a record or follow its LCS further, which lets you trace a line of citations step by step.

---

## 5. Networks: building a science map

The *Networks* tab builds a network in five steps: choose an analysis, choose a unit, set thresholds, choose a layout and adjust the clustering.

### 5.1 Analysis

| Analysis | Two nodes are linked when … | Link strength |
|---|---|---|
| **Bibliographic coupling** | they cite the same references | number of shared references |
| **Co-citation** | they are cited together by publications in the collection | number of publications citing both |
| **Co-authorship** | they share publications (or authors) | number of shared publications |
| **Keyword co-occurrence** | they occur in the same publication | number of publications |

Bibliographic coupling relates publications by their *sources* and is good for mapping current research fronts. Co-citation relates *cited works* by how later research uses them together and is good for mapping a field's intellectual base.

### 5.2 Unit

*Document*, *Author*, *Source* (journal), *Affiliation* and *Affiliation with subdivision* (affiliation with department). Not every unit is available for every analysis. Affiliations are read from the address field with a simple rule, so check the labels.

### 5.3 Thresholds

As in VOSviewer, thresholds decide which nodes are included:

- **Min. documents** – the minimum number of publications behind a node (for co-citation: the number of citing publications).
- **Min. citations** – the minimum number of citations (sum of database citations; for co-citation of publications: local citations).
- **Max. nodes** – at most this many nodes are shown (10–500), the largest first.

The status line shows how many nodes pass the thresholds and how many nodes and links are shown. Start strict (for example *Min. documents* 3–5 for authors) and relax the thresholds gradually. Large networks are hard to read and slower to draw.

**Show** decides which of the selected nodes are drawn: *Main component* (the largest group of nodes linked to each other; the default, as in VOSviewer), *All components* (every node with at least one link), or *All nodes (incl. unlinked)*, where nodes without links are placed on a ring around the network. The status line tells how many connected components there are, how large the largest is, and how many nodes lack links.

### 5.4 Layout

| Layout | Character | Settings |
|---|---|---|
| **ForceAtlas2** | Force-based layout as in Gephi. Clear clusters. | *Attraction* (pulls linked nodes together), *Repulsion* (pushes all nodes apart), *Gravity* (pulls towards the center) |
| **VOS-inspired** | Uses the same principle as VOSviewer. Recommended for comparisons with VOSviewer maps. | *Normalization* (association strength is VOSviewer's default), *Attraction* and *Repulsion* (whole numbers, attraction greater than repulsion; recommended 2 and 1) |
| **Stress majorization** | Distances on screen follow the shortest paths in the network. Good overview of the overall structure. | none |
| **Force (classic)** | The animated layout from earlier versions. | none |

All layouts except *Force* are computed once and then drawn. The VOS-inspired layout can take a few seconds for networks with several hundred nodes; the page does not respond meanwhile.

**Reading the map:** nodes close to each other are strongly related. Node size reflects the number of publications. Line width reflects link strength. Colours show clusters (section 5.5).

### 5.5 Clusters

BiblioScope groups the nodes into clusters of strongly linked nodes, following the same principle as VOSviewer. Each cluster gets its own colour, and links within a cluster are drawn in that colour. Below the map, a legend lists each cluster with its size and its three largest nodes; hover over a row to see all members.

- **Cluster resolution**: a higher value gives more and smaller clusters; a lower value gives fewer and larger clusters. Default 1.
- **Min. cluster size**: smaller clusters are merged into the cluster they are most strongly linked to.
- Nodes without links are not clustered and are shown in grey.

Clustering does not depend on the layout. A cluster is a suggestion, not a fact: try a few resolutions and see which clusters remain stable. Name a cluster only after opening some of its publications.

### 5.6 Navigating and adjusting

- **Zoom:** scroll. **Pan:** drag the background. **Reset zoom:** double-click.
- **Node size by**: the number of documents/occurrences (default), or one of the metrics under *Network statistics* (see 5.7).
- **Node size** and **Label size**: make all nodes or all labels larger or smaller.
- **Move a node:** drag it.
- **Nudge a node:** click it (it gets a gold outline), then use the arrow keys: 2 px per press, 10 px with Shift.
- **Remove overlap** (slider, 0–100 %): pushes overlapping nodes apart. At 0 % the layout is shown as computed; at 100 % no circles overlap, which with large nodes spreads the map out. Values in between reduce the worst overlaps while keeping the shape of the map. The slider always starts from the computed layout (plus your own moves), so it can be moved back.
- **Reset positions**: undoes all manual moves and sets *Remove overlap* to 0 %.
- **Full screen**: shows the network on the whole screen. Leave with the button or Esc.

Manual moves are lost when you change the analysis, thresholds, layout or a layout setting (not when you change clustering, node size or label size). Adjust the map last, just before taking a screenshot.

### 5.7 Network statistics

Below the cluster legend, *Network statistics* describes the map that is shown (after *Show*, the thresholds and *Max. nodes*). Hover over a figure or a column heading for its definition.

**Summary:** nodes, links (all links, also those not drawn), density, average degree and average weighted degree, components, the size of the largest component, diameter and average path length (counted in links), average clustering coefficient, transitivity, and the modularity Q of the clusters in the map.

**Node table:** one row per node with cluster, *degree* (number of linked nodes), *weighted degree* (sum of link strengths, VOSviewer's *total link strength*), *betweenness* (share of shortest paths between other nodes that pass through the node), *closeness* (harmonic: mean of 1/distance to all other nodes), *eigenvector* centrality, *PageRank* and the local *clustering coefficient*. Click a heading to sort. Click a row to select the node in the map; a node clicked in the map is highlighted in the table. *⤓ CSV* downloads the whole table.

**Link weights:** *Ignore* treats every link as 1. *Use link strength* treats a strong link as a short distance (1 / link strength) for betweenness and closeness, and lets strong links carry more weight in eigenvector and PageRank.

The metrics describe the structure of one map. They change with every choice behind the map, and they are exploratory: a node with high betweenness in a coupling map is a publication that bridges groups of references in this collection, not a better publication.

---

## 6. The Historiograph

The historiograph (after Garfield's HistCite) shows the publications in the collection on a time axis, with arrows for citations between them.

- **LCS** (local citation score): how many publications *in your collection* cite the publication.
- **GCS** (global citation score): citations in the whole database.
- **LCR** (local cited references): how many of the publication's references are in your collection.

Choose which publications to show (*Top GCS*, *Top LCS*, *Top Linked*, *Top PageRank*, *Top Authority*, *Top SPC* or *Main path*, see 6.1–6.3) and the number of publications (*Top N*). Click a publication to open its DOI or database record. A publication with high LCS but modest GCS is central to *your* topic even if it is not widely cited elsewhere.

**Citation flows between authors, journals, countries and institutions.** Under *View* you can also show how citations flow between *Authors*, *Journals*, *Countries*, *Institutions* and *Institutions with Subdivision* (department). Each node is a unit, and each arrow shows how many records of one unit cite records of another. Citations within the same unit are not drawn. *Top N* sets how many units are shown. Institutions are read from the address field in the same way as in *Networks*.

- **Click a node** to list, below the network, every citation behind it: *Cited by (incoming)* shows citations to the unit, *Citing (outgoing)* citations from it. Rows marked *within* are citations between two records of the same unit.
- **Click an arrow** to list the citations from one unit to the other.
- Each row shows the units on both sides, the **citing record** and the **cited record**, each with its LCS, GCS, LCR and CR and a ↗ link to the DOI or database record. Click a title to open the full record on top of the page (references, LCS and so on); close it with *✕ Close* or Esc, and the network and table are as you left them. Click the background of the network to clear the selection.
- When two units cite each other, the two arrows are drawn side by side so that each can be clicked.
- Below the network, a **metrics table** lists for each unit its records, citations received and given (the sum of the arrow values), in- and out-degree (how many other units cite it / it cites) and PageRank along the citation flow. Click a row to select the unit.

### 6.1 Main path analysis

Choose the filter **Main path** to show the main path of the citation network instead of the *Top N* publications (Hummon & Doreian 1989; for HistCite historiograms, Lucio-Arias & Leydesdorff 2008). Each citation is weighted by its *search path count* (SPC): the number of paths that run through it from a *source* (a publication that cites no other publication in the collection) to a *sink* (a publication not cited within the collection). The main path follows the heaviest citations and is read as the backbone of how the topic developed in the collection.

- **Global**: the path(s) from a source to a sink with the largest total SPC.
- **Local forward**: starts at the heaviest citation from a source and keeps following the heaviest citation onwards.
- **Key-route**: starts at the *k* heaviest citations anywhere in the network and extends each of them in both directions (Liu & Lu 2012).

Arrow width shows SPC; hover over an arrow for the value. The line above the graph states the size of the citation network, the number of sources, sinks and paths. If publications cite each other (for instance two papers from the same year), the citation from the later to the earlier one is left out so that paths can be counted; the number left out is reported.

### 6.2 Clusters: finding the most relevant studies

The publications are grouped into clusters by who cites whom within the collection (direct citation), with the same method as in *Networks*. All publications and citations are used, not only those drawn. Publications without citations to or from the collection are not clustered (grey).

- **Resolution** and **Min. size** work as in *Networks*: a higher resolution gives more and smaller clusters; smaller clusters are merged into the cluster they cite or are cited by most.
- **Colour**: by cluster (default) or as before (cited locally or not).
- **Node size**: LCS (default), GCS, PageRank, Authority or SPC.
- **Show**: all clusters or one cluster. With one cluster, *Top N* is taken from that cluster, and *Main path* is computed within the cluster.

Below the graph, a card for each cluster gives its size, years, the number of citations within the cluster and from other clusters, its most characteristic keywords, and its three **key records**, ranked by the measure chosen under *Filter* (SPC for *Main path*). Click a card to show only that cluster; click a title to open the record.

A practical way to find the most relevant studies: look at the cluster cards with *Top LCS* (most cited within the collection), then *Top PageRank* (cited by publications that are themselves cited) and *Top SPC* (on many citation paths); publications that recur are central to the collection. Then show one cluster at a time with *Main path* to follow how that line of work developed. Name a cluster only after reading some of its publications.

### 6.3 Record metrics

Below the historiograph, a table gives for every publication: LCS (in-degree), LCR (out-degree), GCS, *PageRank* (high for publications cited by publications that are themselves cited), HITS *authority* and *hub* (a hub cites many authorities, as a review does), *SPC* (source–sink paths through the publication, and their share of all paths) the cluster, and whether it is on the main path. When one cluster is shown, the table lists only that cluster. Show *On the main path*, *With local links* or *All* publications, sort by any column, open a record by clicking its title, and download the table as CSV.

All of these depend on which publications the collection contains: a main path in a collection of 300 papers is the main path of those papers.

---

## 7. Indicators: open access, Agenda 2030, sectors, funders and citation impact

The *Indicators* tab describes the collection with information that the databases add to each record. Each section shows how many records the values are based on. The values describe the collection and are not measures of quality.

**Open access.** One status per record: diamond, gold, hybrid, bronze, green or closed (in that order, as Unpaywall does). Web of Science, Scopus and OpenAlex use different labels; BiblioScope maps them to these. Diamond (no fees for authors or readers) is only given by OpenAlex. A record without an open access value in Web of Science or Scopus counts as closed. The chart shows the statuses per year.

**Agenda 2030 (SDGs).** The Sustainable Development Goals come from OpenAlex, which assigns them automatically from title and abstract. Web of Science and Scopus exports contain no SDGs; use the Open Sources Augmenter (section 7.1) to add them. Different SDG classifications disagree considerably, so read the counts as "what this classifier finds".

**Sectors.** Each author organisation is assigned a sector: higher education, research institute, healthcare, government, company, nonprofit or independent. OpenAlex records (and augmented records) use the organisation types in ROR; Web of Science and Scopus addresses are classified from words in the name (Univ, Hosp, Minist, Acad Sci, Co Ltd …), which is approximate. The table shows records per sector, records with only that sector and with other sectors, and the largest organisations; below it, the most common combinations of sectors and the sectors per year. Unclassified organisations can be given a sector by hand (kept in your browser).

**Funders.** Funders come from Web of Science (FU), Scopus (Funding Details) and OpenAlex. Spelling variants are merged. The funder type (government/public agency, international/EU, private foundation/charity, university/research organisation, company) is not in any export and is assigned from the name; check the types in the table and change them where needed. Records without funding information are not necessarily unfunded.

**Citation indicators by group.** For a chosen grouping (open access, sector, cross-sector collaboration, funding, funder type, SDG or source database) the table gives records, median and mean citations, share uncited, median LCS and, where available, the OpenAlex FWCI (field-weighted citation impact; 1 = world average for the same subfield, year and type), the share in the top 10 % and the NIH relative citation ratio (RCR). Look at the coverage (n) before comparing groups, and prefer medians and top-10 % shares to means.

Every figure, bar, bar segment and table row in the tab can be clicked to list the records behind it; click a record in the list to open it.

The same groupings (open access, sectors, funders, funder types, SDGs) are available in *Comparison*.

### 7.1 The Open Sources Augmenter

The Open Sources Augmenter (<https://gnelhans.github.io/biblioscope/augmenter/>, or the file `open-sources-augmenter.html`) is a separate page with two tasks. Load the exported files, choose a task and run; only identifiers (OpenAlex IDs, DOIs, PubMed IDs) are sent to the services.

**Resolve cited references** (OpenAlex files only, CSV or JSON). The Augmenter fetches the full records by their *Work ID* and looks up every cited work (authors, year, title, source). The result is an OpenAlex JSON file that is loaded in BiblioScope **on its own**; co-citation, bibliographic coupling, cited references and the historiograph then work as for Web of Science data. RCR and OpenAIRE values can be added in the same run.

- Export from the OpenAlex web interface as CSV and choose *Add all* among the columns, or at least *Work ID* and *Cites*.
- Without *Work ID* the records are built from the CSV columns, and only their references can be looked up.
- An OpenAlex CSV can also be loaded directly in BiblioScope (FWCI, percentile, funders and open access are kept), but the cited references then appear only as OpenAlex IDs.

**Add open indicators** (Web of Science, Scopus, OpenAlex). Looks up the records by DOI, OpenAlex ID or PubMed ID:

- **OpenAlex** (by DOI or ID): FWCI, citation percentile and top 1 %/10 %, open access status, SDGs, topics, organisation types and funders.
- **NIH iCite** (by PubMed ID): relative citation ratio (RCR) for biomedical records.
- **OpenAIRE Graph** (by DOI): BIP! impact classes (influence, popularity, impulse) and usage counts.

Download the JSON file and load it in BiblioScope **together with** the original files. It adds the values to the matching records and adds no records of its own. The CSV file has one row per record for use in other programs. Several files can be loaded at once; the downloaded file is named after the first one (e.g. `savedrecs_+1_more_open-indicators.json`), but all files are processed.

---

## 8. Editing the collection

- **Add record** (in *Collection*): enter a publication that is missing, for example a book or a report. Authors one per line, references one per line in Web of Science style.
- **Edit** (in the record view): correct titles, years, authors, addresses or references. You can also link records in the collection manually, which counts towards LCS and LCR.
- **Remove**: removes a record. It can be restored with *Undo*.

All statistics, networks and the historiograph are recomputed after each change. Document your edits; they are part of your method.

---

## 9. Saving, exporting and continuing later

- **Automatic saving:** the header shows *Saved in this browser*. Next time you open the file in the same browser you can choose **Resume**.
- **Export → BiblioScope collection (.json):** everything, including your edits. Load it again later or on another computer.
- **Export → Web of Science format (.txt):** all records written as Web of Science records, for example for VOSviewer or other tools.
- **Images:** take a screenshot of the network or chart, preferably in full-screen mode.

Clearing your browser data also deletes the saved collection. Export regularly.

---

## 10. Interpreting the results

- **Coverage:** Web of Science, Scopus and OpenAlex cover different journals, languages and document types. Your results describe *your data set*, not the field as such.
- **Citations take time:** recent publications have had less time to be cited. Compare publications of similar age.
- **Fields differ:** citation rates differ greatly between fields. Do not compare raw counts across fields.
- **Names and addresses:** authors with the same name may be merged, and one author may appear under several spellings. BiblioScope merges spellings that differ only in case, punctuation or accents ("DOHERTY P" and "Doherty P"), also among cited authors, but not different abbreviations of the same journal. Institutions are written in many ways.
- **Thresholds and layout are choices:** a map changes with thresholds, normalisation and layout. Report the settings you used and try alternatives before drawing conclusions.
- **Maps are interpretations:** the position of a node relative to its neighbours is meaningful; absolute position, orientation and colour are not.

Report at least: database(s), search string and date, number of records before and after deduplication, analysis, unit, thresholds, layout and settings, and any manual edits.

---

## 11. Exercises

**Exercise 1 – Describe a field.** Export 300–1,000 records on a topic of your choice from one database. Use *Overview*, *Sources & Authors* and *Keywords* to write a half-page description: growth over time, central journals, productive countries and dominant themes.

**Exercise 2 – Find the intellectual base.** In *Networks*, choose *Co-citation*, unit *Document*, and raise *Min. documents* until 30–80 nodes remain. Use the VOS-inspired layout. Which clusters do you get? Open some of the cited works in each cluster and give each cluster a name. Then change *Cluster resolution* to 0.5 and 2. Which clusters are stable?

**Exercise 3 – Compare layouts.** Make a bibliographic coupling network at the document level. Draw it with ForceAtlas2, the VOS-inspired layout and stress majorization. Which groups are stable across layouts? What changes?

**Exercise 4 – Trace a research front.** In the *Historiograph*, choose *Top LCS* and *Top N* = 30. Which early publications does the field build on? Compare LCS and GCS for the five most locally cited publications.

**Exercise 5 – Sensitivity.** Load the same data with *DOI only* and with *Fuzzy* matching. How many records differ? Does it change your results?

---

## 12. Troubleshooting

| Problem | What to do |
|---|---|
| "No valid records found" | Check the export format (section 2). Scopus must be CSV, Web of Science plain text. |
| No networks for co-citation or coupling | The export lacks cited references. Export again with references. |
| "No nodes meet the thresholds" | Lower *Min. documents* or *Min. citations*. |
| The page freezes for a few seconds | The layout is being computed. Lower *Max noder* or choose ForceAtlas2. |
| No world map | The map needs internet access. A ranked country list is shown instead. |
| My collection is gone | It is stored per browser. Use the same browser, or load your exported `.json`. |
| Labels or nodes overlap | Zoom in, lower *Node size* or *Label size*, raise *Remove overlap* step by step, or move nodes by hand. |

---

## 13. Glossary

| Term | Meaning |
|---|---|
| Association strength | Normalisation that divides the link strength by the product of the nodes' total link strengths, so that large nodes do not dominate. Used by VOSviewer. |
| Bibliographic coupling | Two publications cite the same references. |
| Co-citation | Two works are cited together by a third. |
| GCS | Global citation score: citations in the database. |
| LCS / LCR | Local citation score / local cited references: citations within your collection. |
| Node / link | A unit in the network / a relation between two units. |
| Threshold | Minimum value a node must reach to be included. |
| Layout | The algorithm that places the nodes on the map. |
| Cluster | A group of nodes that are more strongly linked to each other than to the rest of the network. |
| Resolution | Clustering setting: higher values give more and smaller clusters. |
| Degree / weighted degree | Number of links of a node / sum of their strengths. |
| Betweenness | How often a node lies on the shortest path between two other nodes. |
| Main path | The chain of citations carrying the most source-to-sink paths in a citation network. |
| SPC | Search path count: number of source-to-sink paths through a citation or publication. |

---

## 14. Licence and how to cite BiblioScope

BiblioScope is free software under the MIT licence. It is developed at Data as Impact Lab, Swedish School of Library and Information Science, University of Borås.

Cite as: Eklund, J., & Nelhans, G. (2026). *BiblioScope* (Version 0.995) [Computer software]. University of Borås.

When you use the VOS-inspired layout, ForceAtlas2, stress majorization or the clustering, also cite the methods: van Eck & Waltman (2010), Jacomy et al. (2014), Gansner, Koren & North (2004) or Waltman, van Eck & Noyons (2010). Full references are under *License and acknowledgements* at the bottom of the app.
