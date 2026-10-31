#!/usr/bin/env python3
"""Build link-preview images and crawler-readable track links.

Run from any directory: python3 scripts/build_sharing.py
Requires Pillow. index.html is the source of truth for tracks.
"""
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://' + (ROOT / 'CNAME').read_text().strip()
OUTPUT = ROOT / 'assets' / 'share'


class Tracks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = []
        self.current = None
        self.depth = 0
        self.track_depth = 0
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'div':
            self.depth += 1
        if 'giradischi-item' in a.get('class', '').split():
            self.current = {'id': a['data-track-id'], 'title': ''}
            self.track_depth = self.depth
        if self.current is None:
            return
        if tag == 'h2' and 'track-title' in a.get('class', '').split():
            self.in_title = True
        if tag == 'img':
            self.current['image'] = unquote(urlsplit(a['src']).path)
        if tag == 'audio':
            self.current['audio'] = unquote(urlsplit(a['src']).path)

    def handle_endtag(self, tag):
        if tag == 'h2':
            self.in_title = False
        if tag == 'div':
            if self.current is not None and self.depth == self.track_depth:
                self.current['title'] = self.current['title'].strip()
                self.items.append(self.current)
                self.current = None
            self.depth -= 1

    def handle_data(self, data):
        if self.current is not None and self.in_title:
            self.current['title'] += data


def font(size, bold=False):
    names = (
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    )
    for name in names:
        if Path(name).exists():
            return ImageFont.truetype(name, size)
    raise RuntimeError('Install Arial or DejaVu Sans to generate sharing cards.')


def card(track):
    image = Image.new('RGB', (1080, 1080), '#09090c')
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((28, 28, 1052, 1052), radius=32, outline='#29292f', width=2)
    draw.rounded_rectangle((60, 61, 68, 87), radius=4, fill='#f22443')
    draw.text((84, 55), 'ROCCIAMUSIC', font=font(30, True), fill='#f5f5f7')
    draw.text((1020, 61), 'ASCOLTA IL BRANO', font=font(21), fill='#a6a6b2', anchor='ra')
    sprite = Image.open(ROOT / track['image']).convert('RGBA')
    sprite = sprite.crop(sprite.getchannel('A').getbbox())
    sprite.thumbnail((760, 680), Image.Resampling.LANCZOS)
    image.paste(sprite, ((1080 - sprite.width) // 2, 122 + (680 - sprite.height) // 2), sprite)
    title, _, subtitle = track['title'].partition(' - ')
    size = 76
    while draw.textlength(title, font=font(size, True)) > 940:
        size -= 1
    draw.text((60, 822), title, font=font(size, True), fill='#ffffff')
    draw.text((62, 916), subtitle, font=font(36), fill='#c5c5cf')
    draw.line((60, 985, 1020, 985), fill='#34343d', width=2)
    draw.text((62, 1004), 'rocciamusic.com', font=font(22), fill='#a6a6b2')
    draw.text((1020, 1004), 'PREMI PLAY', font=font(22, True), fill='#f22443', anchor='ra')
    image.save(OUTPUT / f"{track['id']}.jpg", quality=93, optimize=True)


def page(track):
    track_id = track['id']
    title = escape(track['title'], quote=True)
    description = escape(f"Ascolta {track['title']} su RocciaMusic. Apri il brano e premi play.", quote=True)
    url = f'{SITE}/brani/{track_id}/'
    image_url = f'{SITE}/assets/share/{track_id}.jpg'
    destination = f'../../?track={track_id}'
    directory = ROOT / 'brani' / track_id
    directory.mkdir(parents=True, exist_ok=True)
    # Real metadata in static HTML is essential: chat crawlers do not run main.js.
    # JS replacement keeps a single player on the home page, and a link remains if JS is off.
    (directory / 'index.html').write_text(f'''<!doctype html>
<html lang="it" prefix="og: https://ogp.me/ns#">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} | RocciaMusic</title>
    <meta name="description" content="{description}" />
    <link rel="canonical" href="{url}" />
    <meta property="og:site_name" content="RocciaMusic" />
    <meta property="og:locale" content="it_IT" />
    <meta property="og:type" content="music.song" />
    <meta property="og:title" content="{title}" />
    <meta property="og:description" content="{description}" />
    <meta property="og:url" content="{url}" />
    <meta property="og:image" content="{image_url}" />
    <meta property="og:image:secure_url" content="{image_url}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1080" />
    <meta property="og:image:height" content="1080" />
    <meta property="og:image:alt" content="Giradischi e copertina di {title}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{title}" />
    <meta name="twitter:description" content="{description}" />
    <meta name="twitter:image" content="{image_url}" />
    <meta name="theme-color" content="#09090c" />
    <style>
      :root {{ color-scheme: dark; }}
      body {{ margin: 0; min-height: 100svh; display: grid; place-items: center; background: #09090c; color: #fff; font: 16px/1.5 system-ui, sans-serif; }}
      main {{ width: min(440px, 88%); text-align: center; padding: 24px 0; }}
      img {{ display: block; width: 100%; height: auto; border-radius: 16px; }}
      h1 {{ font-size: 1.3rem; }}
      a {{ display: block; padding: 14px; background: #c90020; color: #fff; border-radius: 28px; text-decoration: none; }}
    </style>
  </head>
  <body>
    <main>
      <img src="../../assets/share/{track_id}.jpg" alt="Copertina di {title}" width="1080" height="1080" />
      <h1>{title}</h1>
      <a href="{destination}">Ascolta su RocciaMusic</a>
    </main>
    <script>window.location.replace('{destination}');</script>
  </body>
</html>
''')


def main():
    tracks = Tracks()
    tracks.feed((ROOT / 'index.html').read_text())
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for track in tracks.items:
        card(track)
        page(track)
        print(f"Built link preview: {track['title']}", flush=True)


if __name__ == '__main__':
    main()
