import glob, os
from fontTools.ttLib import TTFont

d = "public/fonts/Xiaolai"
files = sorted(glob.glob(os.path.join(d, "*.woff2")))
print("files:", len(files))

def range_str(cps):
    cps = sorted(cps)
    out = []
    start = prev = cps[0]
    for c in cps[1:]:
        if c == prev + 1:
            prev = c
        else:
            out.append(f"U+{start:04X}" if start == prev else f"U+{start:04X}-{prev:04X}")
            start = prev = c
    out.append(f"U+{start:04X}" if start == prev else f"U+{start:04X}-{prev:04X}")
    return ",".join(out)

rules = []
for fp in files:
    try:
        f = TTFont(fp)
        cps = set(f.getBestCmap().keys())
        fname = os.path.basename(fp)
        ur = range_str(cps)
        rules.append((fname, ur, len(cps)))
        f.close()
    except Exception as e:
        print("ERR", fp, e)

print("rule count:", len(rules))
css = "/* Xiaolai (小赖体) — excalidraw-cn optimized Chinese handwriting. SIL OFL-1.1. */\n"
css += "/* unicode-range computed per-subset from each woff2 cmap. */\n"
for fname, ur, n in rules:
    css += (
        '@font-face{font-family:"Xiaolai";src:url("/fonts/Xiaolai/%s") format("woff2");'
        'font-weight:normal;font-style:normal;font-display:swap;unicode-range:%s}\n'
        % (fname, ur)
    )

out = "public/fonts/Xiaolai/_generated_fontfaces.css"
with open(out, "w", encoding="utf-8") as fh:
    fh.write(css)
print("wrote", out, "size", len(css))

subtitle = "本地优先无账号你的画布只存在这台设备不会上传到任何服务器"
allset = set()
for fp in files:
    try:
        f = TTFont(fp); allset |= set(f.getBestCmap().keys()); f.close()
    except: pass
missing = [c for c in subtitle if ord(c) not in allset]
print("subtitle missing glyphs:", missing)
print("U+00B7 (·) in union:", 0x00b7 in allset)
print("U+FF0C (，) in union:", 0xff0c in allset)
print("U+3002 (。) in union:", 0x3002 in allset)
print("U+3001 (、) in union:", 0x3001 in allset)
