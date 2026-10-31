#!/usr/bin/env python3
"""Build silent desktop/mobile VP9-alpha hero variants. Requires ffmpeg/libvpx."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'video_trasparente.webm'
output = ROOT / 'assets' / 'video'
output.mkdir(parents=True, exist_ok=True)
common = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y']
subprocess.run(common + ['-i', str(source), '-map', '0:v:0', '-c:v', 'copy', '-an', str(output / 'hero.webm')], check=True)
subprocess.run(common + [
    '-c:v', 'libvpx-vp9', '-i', str(source), '-map', '0:v:0', '-an',
    '-vf', 'scale=536:-2,fps=24', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
    '-b:v', '0', '-crf', '34', '-deadline', 'good', '-cpu-used', '4',
    '-row-mt', '1', '-auto-alt-ref', '0', str(output / 'hero-mobile.webm'),
], check=True)
