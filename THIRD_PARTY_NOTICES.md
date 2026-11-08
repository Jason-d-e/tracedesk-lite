# Third-party components and references

TraceDesk Lite reuses existing open-source work wherever it can. This file lists every component used, as of 2026-11-09.

## Runtime dependencies (installed through npm, exact versions)

| Component | Version | License | Copyright | Used for |
| --- | --- | --- | --- | --- |
| [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) | 1.6.0 | Apache-2.0 | Anthropic | Calling the Claude API |
| [express](https://github.com/expressjs/express) | 5.3.0 | MIT | the Express contributors | HTTP server |
| [easy-speech](https://github.com/leaonline/easy-speech) | 2.4.0 | MIT | (c) 2021 Jan Küster | Cross-browser read-aloud on top of the Web Speech API |
| [text-vide](https://github.com/Gumball12/text-vide) | 1.8.6 | MIT | (c) 2022 shj | Optional "bold word starts" reading aid |
| [lowdb](https://github.com/typicode/lowdb) | 7.0.1 | MIT | (c) typicode | Stores the organiser review queue in a local JSON file |
| [csv-stringify](https://github.com/adaltas/node-csv) | 6.9.0 | MIT | (c) Adaltas | CSV export of the review queue (escaping commas, quotes, line breaks) |

Each package's full license text ships inside `app/node_modules/<package>/`. The browser modules are served unmodified from those files.

## Adapted text

- **[i-have-adhd](https://github.com/ayghri/i-have-adhd)**, MIT License, Copyright (c) 2026 Ayoub Ghriss. The style rules in `app/lib/prompts.js` (lead with what matters, no preamble or closers, no idioms, no filler hedges, matter-of-fact tone, at most 5 list items) are adapted from its `skills/i-have-adhd/SKILL.md`.

  > Permission is hereby granted, free of charge, to any person obtaining a copy of this software … The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

## Testing tools (not distributed with the app)

- **[axe-core](https://github.com/dequelabs/axe-core)** 4.10.2, MPL-2.0. This automated accessibility checker is loaded from jsDelivr only during manual checks.

## Design references (read and cited, no code or text copied)

- W3C, *Making Content Usable for People with Cognitive and Learning Disabilities* (COGA), https://www.w3.org/TR/coga-usable/
- W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*, https://www.w3.org/TR/WCAG22/
