"""Split frontend/src/index.css into domain files under src/styles/."""
from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src" / "index.css"
OUT = ROOT / "src" / "styles"

AUTH = re.compile(
    r"auth-|login-|onboard|password-field|password-toggle|field-error|"
    r"brand-lockup|brand-badge|stat-pills|\.kicker|\.lede",
    re.I,
)
PLANTILLA = re.compile(r"roster-|add-player|plantilla|jugador-card", re.I)
PARTIDOS = re.compile(
    r"live-|cal-|conv-|hb-|crear-partido|match-result|acta-|rival-|alin-|"
    r"shot-map|court-area|live-clock|live-feed|live-board|live-grid|"
    r"live-acciones|confirm-grid",
    re.I,
)
ANALITICA = re.compile(
    r"analitica-|gk-|ficha-|informes-|zone-eff|zone-card|bar-row|bar-track|"
    r"bar-fill|\.metric\b|dash-|grid-2|mini-card|panel-photo",
    re.I,
)
CLUB = re.compile(
    r"miembros-|cuotas-|cuota-|club-|temporada-|temp-estado|ajustes-|escudo-|"
    r"prep-form|prep-filters|prep-list|prep-row|prep-tipo|prep-objetivo",
    re.I,
)
JUGADAS = re.compile(r"jugada-|jugadas-|hb-full|fisico-tabs", re.I)
LAYOUT = re.compile(
    r"app-shell|\.rail\b|rail-|workspace|page-head|page-kicker|btn-back|"
    r"btn-seg|btn-play|\.filters\b|table-wrap|form-grid|\.panel\b|\.card\b|"
    r"\.ghost|\.full\b|ok-msg|\.hint\b|\.error\b|\.muted\b|\.danger|"
    r"\.field\b|\.dot\b|metrics|metric-grid|topbar|sidebar|nav-item|\.brand\b",
    re.I,
)
TOKENS = re.compile(r"^:root|\[data-theme|^\*|html\b|^body\b|fonts\.googleapis", re.I)
BASE = re.compile(
    r"^(a|button|input|select|textarea|label|h[1-6]|p|ul|img|table|th|td|strong|small)\b",
    re.I,
)

FILE_ORDER = [
    "tokens",
    "base",
    "layout",
    "auth",
    "plantilla",
    "partidos",
    "analitica",
    "club",
    "jugadas",
]

HEADERS = {
    "tokens": "/* Design tokens, fonts, themes */\n",
    "base": "/* Base element styles */\n",
    "layout": "/* App shell, panels, forms, shared UI */\n",
    "auth": "/* Login, registro, onboarding */\n",
    "plantilla": "/* Plantilla / roster */\n",
    "partidos": "/* Partidos, live, convocatoria, campo, shot maps de partido */\n",
    "analitica": "/* Dashboard, analitica, ficha, informes */\n",
    "club": "/* Club, miembros, cuotas, ajustes, prep fisica list */\n",
    "jugadas": "/* Jugadas / entrenamientos editor */\n",
}


def split_top_level(css: str):
    chunks = []
    i = 0
    n = len(css)
    while i < n:
        if css[i].isspace():
            j = i
            while j < n and css[j].isspace():
                j += 1
            chunks.append(("ws", css[i:j]))
            i = j
            continue
        if css.startswith("/*", i):
            j = css.find("*/", i + 2)
            if j < 0:
                chunks.append(("comment", css[i:]))
                break
            chunks.append(("comment", css[i : j + 2]))
            i = j + 2
            continue
        if css.startswith("@import", i):
            # Respect quoted URLs (Google Fonts uses ';' inside the query string).
            j = i + len("@import")
            while j < n:
                c = css[j]
                if c in ('"', "'"):
                    q = c
                    j += 1
                    while j < n and css[j] != q:
                        if css[j] == "\\":
                            j += 2
                            continue
                        j += 1
                    j += 1
                    continue
                if c == ";":
                    j += 1
                    break
                j += 1
            chunks.append(("import", css[i:j]))
            i = j
            continue
        start = i
        while i < n and css[i] != "{":
            if css.startswith("/*", i):
                k = css.find("*/", i + 2)
                i = n if k < 0 else k + 2
                continue
            i += 1
        if i >= n:
            chunks.append(("other", css[start:]))
            break
        depth = 0
        while i < n:
            c = css[i]
            if c in ('"', "'"):
                q = c
                i += 1
                while i < n and css[i] != q:
                    if css[i] == "\\":
                        i += 2
                        continue
                    i += 1
                i += 1
                continue
            if css.startswith("/*", i):
                k = css.find("*/", i + 2)
                i = n if k < 0 else k + 2
                continue
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    i += 1
                    break
            i += 1
        chunk = css[start:i]
        kind = "atrule" if chunk.lstrip().startswith("@") else "rule"
        chunks.append((kind, chunk))
    return chunks


def prelude(chunk: str) -> str:
    brace = chunk.find("{")
    return chunk[:brace] if brace >= 0 else chunk


def score(text: str, rx: re.Pattern) -> int:
    return len(rx.findall(text))


def classify(kind: str, chunk: str) -> str:
    if kind == "import":
        return "tokens"
    pre = prelude(chunk)

    if kind == "atrule" and chunk.lstrip().startswith("@media"):
        body = chunk
        scores = {
            "auth": score(body, AUTH),
            "plantilla": score(body, PLANTILLA),
            "partidos": score(body, PARTIDOS),
            "analitica": score(body, ANALITICA),
            "club": score(body, CLUB),
            "jugadas": score(body, JUGADAS),
            "layout": score(body, LAYOUT),
        }
        best = max(scores, key=scores.get)
        return best if scores[best] else "layout"

    scores = {
        "auth": score(pre, AUTH),
        "plantilla": score(pre, PLANTILLA),
        "partidos": score(pre, PARTIDOS),
        "analitica": score(pre, ANALITICA),
        "club": score(pre, CLUB),
        "jugadas": score(pre, JUGADAS),
        "layout": score(pre, LAYOUT),
    }

    pl = pre.strip()
    if TOKENS.search(pl) or pl.startswith(":root") or pl.startswith("[data-theme"):
        if any(scores[k] > 0 for k in scores):
            best = max(scores, key=scores.get)
            if scores[best] > 0:
                return best
        return "tokens"

    if BASE.search(pl) and not any(
        scores[k] for k in ("auth", "plantilla", "partidos", "analitica", "club", "jugadas", "layout")
    ):
        return "base"

    best = max(scores, key=scores.get)
    if scores[best] > 0:
        return best

    body_scores = {
        "auth": score(chunk, AUTH),
        "plantilla": score(chunk, PLANTILLA),
        "partidos": score(chunk, PARTIDOS),
        "analitica": score(chunk, ANALITICA),
        "club": score(chunk, CLUB),
        "jugadas": score(chunk, JUGADAS),
        "layout": score(chunk, LAYOUT),
    }
    best = max(body_scores, key=body_scores.get)
    return best if body_scores[best] else "layout"


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    if text.startswith("\ufeff"):
        text = text[1:]

    chunks = split_top_level(text)
    assigned = {k: [] for k in FILE_ORDER}
    order_log = []
    pending: list[str] = []

    for kind, chunk in chunks:
        if kind in ("ws", "comment"):
            pending.append(chunk)
            continue
        domain = classify(kind, chunk)
        prefix = "".join(pending)
        pending = []
        assigned[domain].append(prefix + chunk)
        order_log.append(domain)

    if pending:
        assigned["layout"].append("".join(pending))

    print("chunks", len(chunks))
    print("assignment", Counter(order_log))

    OUT.mkdir(parents=True, exist_ok=True)
    for name in FILE_ORDER:
        parts = assigned[name]
        body = "\n\n".join(p.strip() for p in parts if p.strip())
        content = HEADERS[name] + "\n" + body + "\n"
        path = OUT / f"{name}.css"
        path.write_text(content, encoding="utf-8")
        print(f"wrote {path.name}: {len(content)} chars, {content.count(chr(10))} lines")

    barrel = (
        "/* SIETE styles — split by domain; import order matters for cascade */\n"
        + "\n".join(f"@import './{n}.css';" for n in FILE_ORDER)
        + "\n"
    )
    (OUT / "index.css").write_text(barrel, encoding="utf-8")

    SRC.write_text(
        "/* Re-export: styles live in ./styles */\n@import './styles/index.css';\n",
        encoding="utf-8",
    )
    print("updated src/index.css re-export")
    print("done")


if __name__ == "__main__":
    main()
