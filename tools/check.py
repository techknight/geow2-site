"""Checks the site before it is deployed, and copies it into _site/.

    python tools/check.py [--out _site]

- every src/href/poster/data-src in index.html, and every url() in the CSS,
  that points inside the site exists;
- clips are at most 8 MB, other files at most 2 MB, media at most 64 MB in
  all;
- text files have LF line endings.
"""

import argparse
import os
import re
import shutil
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PUBLISH = ["index.html", "CNAME", "css", "js", "fonts", "img", "media"]
TEXT = (".html", ".css", ".js", ".md", ".py", ".yml", ".txt")
MB = 1024 * 1024


def local(ref):
    return not re.match(r"^(https?:|mailto:|data:|#|//)", ref)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="")
    args = ap.parse_args()
    errors = []

    with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
        page = f.read()
    refs = re.findall(r'(?:src|href|poster|data-src)="([^"]+)"', page)
    with open(os.path.join(ROOT, "css", "site.css"), encoding="utf-8") as f:
        refs += [os.path.join("css", u) for u in re.findall(r'url\("([^"]+)"\)', f.read())]
    for ref in refs:
        if local(ref) and not os.path.exists(os.path.normpath(os.path.join(ROOT, ref.split("#")[0]))):
            errors.append("missing: " + ref)

    media_total = 0
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in (".git", "_site", "__pycache__")]
        for name in files:
            path = os.path.join(base, name)
            rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
            size = os.path.getsize(path)
            limit = 8 * MB if name.endswith(".mp4") else 2 * MB
            if size > limit:
                errors.append("too big: %s (%.1f MB, limit %d MB)" % (rel, size / MB, limit // MB))
            if rel.startswith("media/"):
                media_total += size
            if name.endswith(TEXT) or name in ("CNAME", "LICENSE", ".gitattributes", ".gitignore"):
                with open(path, "rb") as f:
                    if b"\r\n" in f.read():
                        errors.append("CRLF: " + rel)
    if media_total > 64 * MB:
        errors.append("media total %.1f MB, limit 64 MB" % (media_total / MB))

    for e in errors:
        print(e)
    if errors:
        sys.exit(1)
    print("ok: %d references, media %.1f MB" % (len(refs), media_total / MB))

    if args.out:
        out = os.path.join(ROOT, args.out)
        shutil.rmtree(out, ignore_errors=True)
        os.makedirs(out)
        for item in PUBLISH:
            src = os.path.join(ROOT, item)
            if os.path.isdir(src):
                shutil.copytree(src, os.path.join(out, item))
            else:
                shutil.copy2(src, out)


if __name__ == "__main__":
    main()
