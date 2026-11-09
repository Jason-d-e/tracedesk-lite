# Third-party components and references

TraceDesk Lite reuses existing open-source work wherever it can. This file lists every component used, as of 2026-11-09 (v0.4).

## Server dependencies (`app/package.json`, exact versions)

| Component | Version | License | Copyright | Used for |
| --- | --- | --- | --- | --- |
| [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) | 1.6.0 | Apache-2.0 | Anthropic | Calling the Claude API |
| [express](https://github.com/expressjs/express) | 5.3.0 | MIT | the Express contributors | HTTP server |
| [lowdb](https://github.com/typicode/lowdb) | 7.0.1 | MIT | (c) typicode | Stores the organiser review queue in a local JSON file |
| [csv-stringify](https://github.com/adaltas/node-csv) | 6.9.0 | MIT | (c) Adaltas | CSV export of the review queue (escaping commas, quotes, line breaks) |

## Interface dependencies (`app/web/package.json`, bundled into `app/web/dist`)

| Component | Version | License | Copyright | Used for |
| --- | --- | --- | --- | --- |
| [React](https://github.com/facebook/react) and react-dom | 19.3.1 | MIT | (c) Meta Platforms, Inc. and affiliates | Interface framework |
| [Mantine](https://github.com/mantinedev/mantine): core, hooks, charts, notifications | 9.7.5 | MIT | (c) 2021 Vitaly Rtishchev | Accessible components: layout, tabs, drawer, modal, accordion, checklist, tables, notifications, charts |
| [Recharts](https://github.com/recharts/recharts) | 3.10.1 | MIT | (c) 2015-present recharts | Chart engine behind the dashboard charts |
| [Tabler Icons](https://github.com/tabler/tabler-icons) (@tabler/icons-react) | 3.51.0 | MIT | (c) 2020-2026 Paweł Kuna | Icons; the favicon uses its "shield-check" icon |
| [i18next](https://github.com/i18next/i18next) | 27.0.1 | MIT | (c) 2011-present i18next | Chinese / English interface text |
| [react-i18next](https://github.com/i18next/react-i18next) | 18.0.1 | MIT | (c) 2015-present i18next | Connects i18next to React |
| [easy-speech](https://github.com/leaonline/easy-speech) | 2.4.0 | MIT | (c) 2021 Jan Küster | Cross-browser read-aloud on top of the Web Speech API |
| [text-vide](https://github.com/Gumball12/text-vide) | 1.8.6 | MIT | (c) 2022 shj | Optional "bold word starts" reading aid |
| [chrono-node](https://github.com/wanasit/chrono) | 2.10.3 | MIT | (c) 2014 Wanasit Tanakitrungruang | Finds dates and times in the bottom line (English and Chinese) and in the verified quotes, so only backed facts are marked |
| [Rough Notation](https://github.com/rough-stuff/rough-notation) | 0.5.1 | MIT | (c) 2020 Preet Shihn | The highlighter stroke behind key facts in the bottom line |

## Fonts (loaded at runtime from their providers, not redistributed)

| Font | License | Source | Used for |
| --- | --- | --- | --- |
| General Sans | ITF Free Font License (free for personal and commercial use) | Indian Type Foundry, via Fontshare | All Latin text |
| Noto Sans SC | SIL Open Font License 1.1 | Google, via Google Fonts | Chinese text |
| Geist Mono | SIL Open Font License 1.1 | Vercel, via Google Fonts | Figures and counts |

## Design guidance (used while designing; nothing from these ships except where noted)

- **[Hallmark](https://github.com/Nutlope/hallmark)** (MIT License, Copyright (c) 2026 Hallmark contributors; made by Together AI). The visual system is its "Coral" theme: the colour tokens, the letterpress control recipe and the generated paper-texture recipe in `app/web/src/styles/` are adapted from it. Its `sloplint` checker was run on the cover, the help desk and the dashboard.
- **[Emil Kowalski's skills](https://github.com/emilkowalski/skills)** (MIT License, Copyright (c) 2026 Emil Kowalski). Motion rules: easing, durations, press feedback, reduced motion.
- **[Impeccable](https://github.com/pbakaus/impeccable)** (Apache-2.0, Paul Bakaus). Its quality checklist was applied by hand.

Build tools (not shipped in the bundle): [Vite](https://github.com/vitejs/vite) 8.3.6 (MIT) with @vitejs/plugin-react (MIT), [TypeScript](https://github.com/microsoft/TypeScript) 7.0.2 (Apache-2.0), postcss-preset-mantine 1.18.0 and postcss-simple-vars 7.0.1 (MIT). The interface started from Vite's official `react-ts` template.

Each package's full license text ships inside `node_modules/<package>/` after `npm install`.

  > Permission is hereby granted, free of charge, to any person obtaining a copy of this software … The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

## Adapted text

- **[i-have-adhd](https://github.com/ayghri/i-have-adhd)**, MIT License, Copyright (c) 2026 Ayoub Ghriss. The style rules in `app/lib/prompts.js` (lead with what matters, no preamble or closers, no idioms, no filler hedges, matter-of-fact tone, at most 5 list items) are adapted from its `skills/i-have-adhd/SKILL.md`.

  > Permission is hereby granted, free of charge, to any person obtaining a copy of this software … The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

## Testing tools (not distributed with the app)

- **[axe-core](https://github.com/dequelabs/axe-core)** 4.10.2, MPL-2.0. This automated accessibility checker is loaded from jsDelivr only during manual checks.

## Design references (read and cited, no code or text copied)

- W3C, *Making Content Usable for People with Cognitive and Learning Disabilities* (COGA), https://www.w3.org/TR/coga-usable/
- W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*, https://www.w3.org/TR/WCAG22/
