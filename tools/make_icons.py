"""se7en Browser — icônes et images de l'installeur (python tools/make_icons.py, il faut Pillow).
  build/icon.ico           : « 7 » graphite sur verre argenté (comme le logo de la barre de titre), 16 à 256 px
  build/icon.png           : la même en 512 px (fenêtre, notifications)
  build/wizard-large.bmp   : bandeau de gauche de l'installeur
  build/wizard-small.bmp   : petite image en haut à droite de l'installeur
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'build'


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def seven(S, scale=1.0):
    """« 7 » épais dessiné à la main (même tracé que les autres applis se7en)."""
    m = Image.new('L', (S, S), 0)
    top, bar, x0, x1, leg, bottom = 0.25 * S, 0.17 * S, 0.24 * S, 0.78 * S, 0.20 * S, 0.79 * S
    pts = [(x0, top), (x1, top), (x1, top + bar * 0.95), (0.52 * S, bottom), (0.52 * S - leg, bottom), (x1 - leg * 1.08, top + bar), (x0, top + bar)]
    c = S / 2
    ImageDraw.Draw(m).polygon([((x - c) * scale + c, (y - c) * scale + c) for x, y in pts], fill=255)
    return m


def tache(S, cx, cy, r, col, alpha):
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse((cx - r, cy - r, cx + r, cy + r), fill=col + (alpha,))
    return layer.filter(ImageFilter.GaussianBlur(r * 0.55))


def verre(W, H):
    """Fond de verre argenté : dégradé blanc → acier, reflets bleutés."""
    bg = Image.new('RGBA', (W, H))
    g = ImageDraw.Draw(bg)
    for y in range(H):
        g.line([(0, y), (W, y)], fill=lerp((250, 251, 253), (142, 150, 166), (y / H) ** 1.2) + (255,))
    S = max(W, H)
    for layer in (tache(S, S * 0.85, S * 0.12, S * 0.42, (255, 255, 255), 230), tache(S, S * 0.1, S * 0.95, S * 0.4, (150, 175, 215), 140)):
        bg = Image.alpha_composite(bg, layer.crop((0, 0, W, H)))
    return bg


def icone(size):
    S = size * 2
    bg = verre(S, S)
    # ombre douce sous le 7, puis le 7 graphite
    m = seven(S, scale=1.02 if size >= 32 else 1.15)
    ombre = Image.new('RGBA', (S, S), (20, 25, 35, 0))
    ombre.putalpha(m.filter(ImageFilter.GaussianBlur(S * 0.02)).point(lambda v: v * 0.35))
    bg = Image.alpha_composite(bg, ombre.transform((S, S), Image.AFFINE, (1, 0, 0, 0, 1, -S * 0.012)))
    bg = Image.composite(Image.new('RGBA', (S, S), (58, 64, 77, 255)), bg, m)
    reflet = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(reflet)
    for i in range(S):
        d.line([(i, 0), (0, i)], fill=(255, 255, 255, int(60 * max(0, 1 - i / S / 0.5) ** 1.6)), width=2)
    bg = Image.alpha_composite(bg, reflet)
    ImageDraw.Draw(bg).rounded_rectangle((2, 2, S - 3, S - 3), radius=int(S * 0.22), outline=(255, 255, 255, 160), width=max(2, S // 100))
    masque = Image.new('L', (S, S), 0)
    ImageDraw.Draw(masque).rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * 0.22), fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(bg, (0, 0), masque)
    return out.resize((size, size), Image.LANCZOS)


def bmp(W, H, taille_icone, chemin):
    fond = verre(W, H)
    ic = icone(taille_icone)
    fond.alpha_composite(ic, ((W - taille_icone) // 2, (H - taille_icone) // 2 if H < 100 else int(H * 0.18)))
    fond.convert('RGB').save(chemin)


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    tailles = [16, 24, 32, 48, 64, 128, 256]
    images = [icone(n) for n in tailles]
    images[-1].save(OUT / 'icon.ico', sizes=[(n, n) for n in tailles], append_images=images[:-1])
    icone(512).save(OUT / 'icon.png')
    bmp(164, 314, 112, OUT / 'wizard-large.bmp')
    bmp(55, 55, 48, OUT / 'wizard-small.bmp')
    print('build/icon.ico, icon.png, wizard-large.bmp, wizard-small.bmp')
