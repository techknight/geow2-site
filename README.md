# geow2-site

The website for [geow2](https://github.com/techknight/geow2), served at
<https://geow2.com> by GitHub Pages.

It is one hand-written page: `index.html`, `css/site.css` and `js/site.js`,
with no build step. The download button reads the latest release from the
GitHub API; without JavaScript it links to the Releases page.

## Preview

    python -m http.server 8000

then open <http://localhost:8000>.

## Media

`media/` holds stills and short silent clips of geow2 running with data
from the game. They are made by replaying recorded games in geow2's
headless mode (`--record`), so they show the port itself. Clips are H.264
at 1280x720, 60 fps; each mode's clip has a poster (its first frame), a
1920x1080 still and a 640x360 thumbnail.

## Checks

`tools/check.py` runs in CI before every deploy: every local link and
asset referenced by the page must exist, no file may exceed its size
budget, and every text file must use LF line endings.

## Licence

The code is MIT (see `LICENSE`). The fonts keep their own licences and the
media are screenshots of the game: see `NOTICE.md`.
