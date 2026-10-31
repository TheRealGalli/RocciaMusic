#!/usr/bin/env python3
"""Create smaller turntable images and refresh srcset without changing originals."""
from pathlib import Path
import re
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'giradischi' / 'responsive'
OUTPUT.mkdir(parents=True, exist_ok=True)
index = ROOT / 'index.html'
html = index.read_text()


def responsive(match):
    tag = match.group(0)
    source = re.search(r'src="([^"]+)"', tag).group(1)
    image = Image.open(ROOT / source).convert('RGBA')
    candidates = []
    for width in (320, 640):
        if width >= image.width:
            continue
        height = round(image.height * width / image.width)
        relative = f'giradischi/responsive/{Path(source).stem}-{width}.webp'
        image.resize((width, height), Image.Resampling.LANCZOS).save(ROOT / relative, 'WEBP', quality=88, method=6)
        candidates.append(f'{relative} {width}w')
    candidates.append(f'{source} {image.width}w')
    tag = re.sub(r' (?:srcset|sizes|decoding)="[^"]*"', '', tag)
    attributes = f' srcset="{", ".join(candidates)}" sizes="(max-width: 640px) 175px, 320px" decoding="async"'
    return tag.replace(' class="giradischi-img"', attributes + ' class="giradischi-img"')


html = re.sub(r'<img\b[^>]*class="giradischi-img"[^>]*>', responsive, html)
index.write_text(html)
print('Responsive images generated; original artwork and aspect ratios preserved.')
