# DUO Rekentool — SF35 Studieschuld Calculator

Gratis, open-source calculator voor het berekenen van je maandelijkse DUO-terugbetaling, rente, kwijtschelding en hypotheek-impact onder het SF35-stelsel.

## Features

- **Draagkrachtberekening** — op basis van verzamelinkomen, huishoudsituatie en WML
- **Twee leningen** — met aparte aanloopfases, rentes en looptijden
- **Rente per 5-jaarperiode** — simuleer veranderende rentes over 35 jaar
- **Aflossingstabel** — per jaar en per maand, met split per lening
- **Hypotheek-impact** — bruteringsfactor (Trhk 2025), extra aflossing vs. eigen inleg
- **Sparen/beleggen vs. extra aflossen** — vergelijking met samengestelde rente
- **Scenariovergelijking** — bewaar tot 3 scenario's en vergelijk side-by-side
- **PDF export** — sla je rapport op via de printfunctie
- **Deelbare URL** — alle invoer wordt opgeslagen in de URL-parameters

## Tech Stack

- Vanilla HTML/CSS/JS (geen framework, geen build step)
- [Chart.js 4.4](https://www.chartjs.org/) via CDN
- [DM Sans](https://fonts.google.com/specimen/DM+Sans) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) via Google Fonts

## Deployment

### Optie 1: Netlify (aanbevolen)

1. Push deze directory naar een Git repository (GitHub/GitLab)
2. Ga naar [app.netlify.com](https://app.netlify.com)
3. "Add new site" → "Import an existing project"
4. Selecteer je repo → Deploy
5. Custom domain instellen onder Domain settings

### Optie 2: Vercel

1. Push naar GitHub
2. Ga naar [vercel.com](https://vercel.com)
3. Import project → selecteer repo → Deploy

### Optie 3: GitHub Pages

1. Push naar GitHub
2. Settings → Pages → Source: "Deploy from branch" → main → / (root)
3. Je site staat op `https://username.github.io/repo-name/`

### Optie 4: Elke webserver

Dit is een statische site — kopieer alle bestanden naar je webserver (Apache, Nginx, etc.). Geen build step nodig.

```bash
# Voorbeeld met een simpele HTTP-server
npx serve .
```

## Projectstructuur

```
duo-rekentool/
├── index.html          # Hoofdpagina
├── css/
│   └── style.css       # Alle styling
├── js/
│   └── app.js          # Berekeningen, charts, interactie
├── img/
│   └── favicon.svg     # Favicon
├── robots.txt          # SEO
├── sitemap.xml         # SEO
├── netlify.toml        # Netlify config
├── vercel.json         # Vercel config
├── _headers            # Security & caching headers
└── README.md           # Dit bestand
```

## Aanpassen

- **Standaardwaarden**: pas de `value` attributen aan in `index.html`
- **Bruteringsfactor**: update de `brut()` functie in `js/app.js`
- **WML/vrijstelling**: pas het `wml` veld aan
- **Kleuren/styling**: alles via CSS variabelen in `css/style.css`

## Disclaimer

Indicatieve berekening op basis van DUO SF35-regels (2026). Geen financieel advies. Raadpleeg [duo.nl](https://duo.nl) voor je officiële gegevens.

## Licentie

MIT
