# Press kit

## One line

**Skywake** is a free, open-source live flight tracker for the web and Android. It has no ads and no accounts, and it runs on community ADS-B data.

## Short description

Skywake shows aircraft around the world in real time, using positions shared by volunteer receivers through
ADSB.lol. It runs in any modern browser, can be installed as an app, and has a native Android version. You can search
by flight, registration or airport, filter the sky, follow a plane, and get an alert when a watched aircraft appears.
The code is AGPL-licensed, and all data comes from openly licensed sources.

## Facts

- **Licence:** AGPL-3.0-or-later. Data under ODbL, CC0 or public domain (see [DATA_SOURCES.md](../DATA_SOURCES.md)).
- **Platforms:** web (PWA) and Android.
- **Languages:** English and Romanian.
- **Status:** pre-release (0.x).
- **Maintainer:** [@andrei1000z](https://github.com/andrei1000z), Bucharest.

We only publish user numbers, coverage percentages or performance figures that have actually been measured.
When there are measured results, they will be listed here together with the method used.

## Assets

- **Logo:** `apps/web/public/icon.svg`, with PNGs in `apps/web/public/icons/`. It is original artwork and free to use when referring to Skywake.
- **Screenshots:** please take them from the live app, and keep the map attribution visible.

## AI-assisted development

Skywake is built by its maintainer with an AI coding assistant (Claude, by Anthropic), which wrote much of the code
and documentation under the maintainer's direction. Every change has to pass the same checks:

- unit tests on captured real data, end-to-end browser tests and automated accessibility checks;
- static analysis (CodeQL), a dependency audit and secret scanning on every push;
- a rule in the contribution guide that no feature is marked as working without a test or a check in a real browser.

We disclose this because people deserve to know how the software they rely on is made.
