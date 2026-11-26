# BiblioScope

A browser-based tool for bibliometric analysis and science mapping of Web of Science, Scopus and OpenAlex data.

**Open BiblioScope:** <https://gnelhans.github.io/biblioscope/>  
**Open Sources Augmenter:** <https://gnelhans.github.io/biblioscope/augmenter/>

BiblioScope runs entirely in the browser. Data files are read on your own computer and are not uploaded anywhere; the collection is kept in the browser's local storage. The whole program is one HTML file ([`index.html`](index.html)), which can also be downloaded and used offline (the world map needs an internet connection).

Version 0.992 · Gustaf Nelhans, Swedish School of Library and Information Science (SSLIS), University of Borås

## What it does

- **Import and merge** Web of Science (plain text), Scopus (CSV) and OpenAlex (JSON) exports; duplicates are merged by DOI and title.
- **Overview, sources, authors, subjects, keywords and top papers**, with case and spelling variants of names merged.
- **Networks**: bibliographic coupling, co-citation, co-authorship and keyword co-occurrence at several levels (documents, authors, sources, organisations, countries), with a VOSviewer-inspired layout (association strength), ForceAtlas2 and stress layouts, Louvain clustering, and network statistics (degree, weighted degree, betweenness, closeness, eigenvector, PageRank, clustering coefficient, modularity).
- **Historiograph** (in the tradition of HistCite): the local citation network over time for papers, authors, journals, countries and institutions; main path analysis with search path counts (global, local forward, key-route); direct-citation clusters with key records; PageRank, HITS and SPC per record.
- **Cited references**, with DOI links and DOI lookup in Crossref.
- **Comparison** of two organisations, departments, countries, authors, open access statuses, sectors, funders, SDGs or periods, as numbers or as shares.
- **Indicators**: open access (harmonised across sources), Agenda 2030 (SDGs), sectors of the authors' organisations, funders and funder types, and citation indicators by group (FWCI, top 10 % and RCR where available). Every category can be clicked to list its records.
- **Editing** of records and export of the collection.

## Open Sources Augmenter

[`augmenter/index.html`](augmenter/) adds open indicators to Web of Science, Scopus and OpenAlex records by DOI or PubMed ID: OpenAlex (FWCI, citation percentiles, open access, SDGs, topics, organisation types, funders), NIH iCite (relative citation ratio) and the OpenAIRE Graph (BIP! impact classes, usage counts). Load its output in BiblioScope together with the original files. For OpenAlex exports it can also resolve the referenced works, for cited-reference and co-citation analysis.

## Documentation

- [Student manual (English)](docs/BiblioScope_manual_en.md)
- [Instruktionsbok för studenter (svenska)](docs/BiblioScope_manual_sv.md)
- [Technical documentation (Swedish)](docs/BiblioScope_technical_documentation_sv.md)
- [Changelog (Swedish)](CHANGELOG.md)

The indicators and maps describe the structure of a collection of records. They depend on the data source, the search and the choices made in the program, and are meant for exploration, not for evaluating individuals or units.

## Building from source

The source code is in [`source/`](source/) (React 19, d3).

```sh
cd source
npm install
npm run dev            # development server
npm run build:single   # builds the single-file ../index.html
```

## Citation and licence

If you use BiblioScope in research, please cite it as described in [`CITATION.cff`](CITATION.cff) (GitHub shows a "Cite this repository" button):

> Nelhans, G. (2026). *BiblioScope: a browser-based tool for bibliometric analysis and network mapping* (Version 0.992) [Computer software]. University of Borås. https://github.com/gnelhans/biblioscope

Released under the [MIT licence](LICENSE).
