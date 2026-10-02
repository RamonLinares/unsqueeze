"""Build dependency-free product icons and a distributable extension ZIP."""
from pathlib import Path
import hashlib, json, math, shutil, struct, zlib
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / 'extension' / 'icons'
ICONS.mkdir(exist_ok=True)

def segment(x, y, ax, ay, bx, by):
    dx, dy = bx-ax, by-ay
    t = max(0, min(1, ((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)))
    return math.hypot(x-ax-t*dx, y-ay-t*dy)

def pixel(x, y):
    if math.hypot(max(abs(x-64)-38, 0), max(abs(y-64)-38, 0)) > 22:
        return (0,0,0,0)
    arrows = [(18,64,42,64),(18,64,28,54),(18,64,28,74),(86,64,110,64),(100,54,110,64),(100,74,110,64)]
    if any(segment(x,y,*s)<3.8 for s in arrows): return (213,239,159,255)
    if abs(math.hypot((x-64)*1.35,y-64)-29)<4.3: return (240,243,236,255)
    return (17,23,21,255)

def png(size):
    raw=bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            samples=[pixel((x+(sx+.5)/4)*128/size,(y+(sy+.5)/4)*128/size) for sy in range(4) for sx in range(4)]
            alpha=sum(p[3] for p in samples)
            raw.extend([round(sum(p[i]*p[3] for p in samples)/alpha) if alpha else 0 for i in range(3)]+[round(alpha/16)])
    def chunk(tag, data):
        return struct.pack('>I',len(data))+tag+data+struct.pack('>I',zlib.crc32(tag+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')

for size in (16,32,48,128): (ICONS/f'icon{size}.png').write_bytes(png(size))
manifest=json.loads((ROOT/'extension/manifest.json').read_text())
archive_path=ROOT/f'Unsqueeze-{manifest["version"]}.zip'
with ZipFile(archive_path,'w',ZIP_DEFLATED) as archive:
    for path in sorted((ROOT/'extension').rglob('*')):
        if path.is_file() and not path.name.startswith('.'):
            archive.write(path,Path('Unsqueeze')/path.relative_to(ROOT/'extension'))
    for source, target in (
        ('docs/START-HERE.html', 'START-HERE.html'),
        ('docs/INSTALL.md', 'README.md'),
        ('PRIVACY.md', 'PRIVACY.md'),
        ('LICENSE', 'LICENSE'),
    ):
        archive.write(ROOT/source, f'Unsqueeze/{target}')
# Chrome Web Store uploads need manifest.json at the ZIP root and only the runtime files.
store_path=ROOT/f'Unsqueeze-{manifest["version"]}-chrome-web-store.zip'
with ZipFile(store_path,'w',ZIP_DEFLATED) as archive:
    for path in sorted((ROOT/'extension').rglob('*')):
        if path.is_file() and not path.name.startswith('.'):
            archive.write(path,path.relative_to(ROOT/'extension'))
stable_path = ROOT/'Unsqueeze.zip'
shutil.copyfile(archive_path, stable_path)
digest = hashlib.sha256(stable_path.read_bytes()).hexdigest()
(ROOT/'SHA256SUMS.txt').write_text(f'{digest}  Unsqueeze.zip\n')
print(f'Built {archive_path.name}, Unsqueeze.zip, and {store_path.name}. Load the extracted Unsqueeze folder in Chrome; upload the store ZIP to the Chrome Web Store.')
