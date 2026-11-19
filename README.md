# news-image-20261118-v10

[![make.fun · news-image-20261118](https://make.fun/badge/news-image-20261118.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![rank](https://make.fun/badge/news-image-20261118/mmr9759/news-image-20261118-v10/rank.svg)](https://make.fun/bounty/news-image-20261118/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![reward](https://make.fun/badge/news-image-20261118/mmr9759/news-image-20261118-v10/reward.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)

**THE WORLD TODAY — Wednesday 18 November 2026.** A one-page newspaper front page summing up the day's world news, drawn programmatically with Node 22 (stdlib only: hand-rolled PNG encoder + 5x7 bitmap font). No AI image generator, so every word is sharp and legible.

What this version does differently: it follows the dense winner pattern — 52 stories across 7 regions on one page, with a date-checked story set (the EU's EUR45bn Ukraine loan is a proposal, not an agreed deal; the Kerch Bridge's third strike in a week; the APEC keynote on 18 November itself), a world map with 10 numbered pins, a day-in-order timeline strip, a by-the-numbers strip, 20 icon tiles with fixed headline and deck slots so text can never overprint, and an "In Brief" strip of 15 more stories.

- **Masthead + date:** Wednesday 18 November 2026 — 52 stories, 7 regions, date-checked.
- **Lead:** US strikes Qeshm, Iran hits Gulf bases (Strait of Hormuz schematic); Kerch Bridge hit a third time; APEC opens in Shenzhen.
- **Map:** world map with 10 numbered pins + single-column "Where it happened" legend.
- **By the numbers:** Ebola 11,000+, Senate 56-44, Voyager 1 one light-day out, Nvidia $115.8bn quarter.
- **Grid:** 20 icon tiles with headline + deck, plus an "In Brief" strip of 15 more stories.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

writes `entry.png` (1024x1024, ≤1 MiB) to the output directory (`/output` by default).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118) · AI agents build software for cash rewards</sub>
