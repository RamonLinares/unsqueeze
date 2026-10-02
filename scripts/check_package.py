"""Validate the download users install; requires only Python's standard library."""
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'extension'
manifest = json.loads((source / 'manifest.json').read_text())
data = (ROOT / 'Unsqueeze.zip').read_bytes()
assert data == (ROOT / f'Unsqueeze-{manifest["version"]}.zip').read_bytes()
assert (ROOT / 'SHA256SUMS.txt').read_text() == f'{sha256(data).hexdigest()}  Unsqueeze.zip\n'

class LocalLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in ('src', 'href') and value and not value.startswith(('#', 'https:', 'data:')):
                self.paths.append(value)

with ZipFile(ROOT / 'Unsqueeze.zip') as archive:
    assert archive.testzip() is None, 'Corrupt ZIP'
    names = archive.namelist()
    expected = {f'Unsqueeze/{p.relative_to(source).as_posix()}'
                for p in source.rglob('*') if p.is_file() and not p.name.startswith('.')}
    expected.update(f'Unsqueeze/{p}' for p in ('README.md', 'START-HERE.html', 'PRIVACY.md', 'LICENSE'))
    assert len(names) == len(set(names)), 'Duplicate ZIP entries'
    assert set(names) == expected, 'Unexpected or missing package files'
    assert all(PurePosixPath(n).parts[0] == 'Unsqueeze' and '..' not in PurePosixPath(n).parts for n in names)
    assert json.loads(archive.read('Unsqueeze/manifest.json')) == manifest
    for path in source.rglob('*'):
        if path.is_file() and not path.name.startswith('.'):
            assert archive.read(f'Unsqueeze/{path.relative_to(source).as_posix()}') == path.read_bytes()
    references = list(manifest['icons'].values()) + list(manifest['action']['default_icon'].values())
    references.append(manifest['action']['default_popup'])
    for script in manifest['content_scripts']:
        references.extend(script['js'])
    for path in references:
        assert f'Unsqueeze/{path}' in names, f'Missing manifest reference: {path}'
    for name in names:
        if name.endswith('.html'):
            parser = LocalLinks()
            parser.feed(archive.read(name).decode())
            for path in parser.paths:
                target = str(PurePosixPath(name).parent / path)
                assert target in names, f'Missing HTML reference: {target}'
with ZipFile(ROOT / f'Unsqueeze-{manifest["version"]}-chrome-web-store.zip') as store:
    assert store.testzip() is None, 'Corrupt store ZIP'
    store_names = store.namelist()
    assert set(store_names) == {n.removeprefix('Unsqueeze/') for n in expected if n.removeprefix('Unsqueeze/') not in ('README.md', 'START-HERE.html', 'PRIVACY.md', 'LICENSE')}, 'Unexpected or missing store files'
    assert all('..' not in PurePosixPath(n).parts for n in store_names)
    assert json.loads(store.read('manifest.json')) == manifest, 'Store ZIP needs manifest.json at its root'
    for name in store_names:
        assert store.read(name) == (source / name).read_bytes()
print(f'Package verified: v{manifest["version"]}, {len(names)} files, all runtime files and local links intact; store ZIP has {len(store_names)} runtime files at its root.')
