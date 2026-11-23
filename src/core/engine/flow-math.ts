/**
 * Normalizes bare or partially-delimited tensor/state-flow strings and raw ASCII/Unicode math
 * into crisp inline-LaTeX (`$...$`) expressions for KaTeX rendering without mangling prose or code names.
 */

const PRECOMPOSED_HATS: Record<string, string> = {
  "\u00e2": "\\hat{a}",
  "\u00ea": "\\hat{e}",
  "\u00ee": "\\hat{i}",
  "\u00f4": "\\hat{o}",
  "\u00fb": "\\hat{u}",
  "\u0177": "\\hat{y}",
  "\u0175": "\\hat{w}",
  "\u1e91": "\\hat{z}",
  "\u00c2": "\\hat{A}",
  "\u00ca": "\\hat{E}",
  "\u00ce": "\\hat{I}",
  "\u00d4": "\\hat{O}",
  "\u00db": "\\hat{U}",
  "\u0176": "\\hat{Y}",
  "\u0174": "\\hat{W}",
  "\u1e90": "\\hat{Z}",
};

const PRECOMPOSED_BARS: Record<string, string> = {
  "\u0101": "\\bar{a}",
  "\u0113": "\\bar{e}",
  "\u012b": "\\bar{i}",
  "\u014d": "\\bar{o}",
  "\u016b": "\\bar{u}",
  "\u0100": "\\bar{A}",
  "\u0112": "\\bar{E}",
  "\u012a": "\\bar{I}",
  "\u014c": "\\bar{O}",
  "\u016a": "\\bar{U}",
};

const COMBINING_HAT_REGEX = /([A-Za-z])\u0302/g;
const COMBINING_BAR_REGEX = /([A-Za-z])\u0304/g;
const COMBINING_TILDE_REGEX = /([A-Za-z])\u0303/g;

/** Converts Unicode precomposed/combining circumflexes and macrons into KaTeX commands. */
export function normalizeUnicodeMathDiacritics(input: string): string {
  if (!input) return input;
  let out = input
    .replace(COMBINING_HAT_REGEX, (_m, ch: string) => `\\hat{${ch}}`)
    .replace(COMBINING_BAR_REGEX, (_m, ch: string) => `\\bar{${ch}}`)
    .replace(COMBINING_TILDE_REGEX, (_m, ch: string) => `\\tilde{${ch}}`);

  out = out.replace(/[\u00e2\u00ea\u00ee\u00f4\u00fb\u0177\u0175\u1e91\u00c2\u00ca\u00ce\u00d4\u00db\u0176\u0174\u1e90]/g, (ch) => {
    return PRECOMPOSED_HATS[ch] ?? ch;
  });
  out = out.replace(/[\u0101\u0113\u012b\u014d\u016b\u0100\u0112\u012a\u014c\u016a]/g, (ch) => {
    return PRECOMPOSED_BARS[ch] ?? ch;
  });
  return out;
}

/**
 * Fixes common ASCII/LLM LaTeX issues inside a math expression so KaTeX renders clean typography:
 * - Unicode hats (`ẑ`, `â`) -> `\hat{z}`, `\hat{a}`
 * - ASCII norm delimiters `||expr||` -> `\lVert expr \rVert`
 * - Multi-character unbraced subscripts (`L_distill`, `a_ij`, `d_model`) -> braced `L_{\mathrm{distill}}`, `a_{ij}`
 * - Unbraced exponents (`10^-9`, `2^16`) -> `10^{-9}`, `2^{16}`
 * - ASCII shifts/relations/arrows (`<<`, `>>`, `<=`, `>=`, `!=`, `->`) -> `\ll`, `\gg`, `\le`, `\ge`, `\ne`, `\rightarrow`
 */
export function normalizeLatexSyntax(expr: string): string {
  if (!expr) return expr;
  let out = normalizeUnicodeMathDiacritics(expr.trim());

  // Replace ASCII norm pairs `|| ... ||` with LaTeX `\lVert ... \rVert`
  out = out.replace(/\|\|\s*([^|\n]+?)\s*\|\|/g, (_m, inner: string) => `\\lVert ${inner.trim()} \\rVert`);

  // Unicode & ASCII roots: `√d_k` or `sqrt(d_k)` -> `\sqrt{d_k}`
  out = out
    .replace(/√\s*\(([^()\n]+)\)/g, (_m, inner: string) => `\\sqrt{${inner.trim()}}`)
    .replace(/√\s*([A-Za-z](?:_[A-Za-z0-9]+|_\{[^}]+\})?|[0-9]+)/g, (_m, sym: string) => `\\sqrt{${sym}}`)
    .replace(/(?<![\\A-Za-z])sqrt\(([^()\n]+)\)/g, (_m, inner: string) => `\\sqrt{${inner.trim()}}`);

  // ASCII comparison, relation, division, multiplication, and tensor-product operators
  out = out
    .replace(/-->/g, " \\rightarrow ")
    .replace(/->/g, " \\rightarrow ")
    .replace(/=>/g, " \\Rightarrow ")
    .replace(/<</g, " \\ll ")
    .replace(/>>/g, " \\gg ")
    .replace(/<=/g, " \\le ")
    .replace(/>=/g, " \\ge ")
    .replace(/!=/g, " \\ne ")
    .replace(/÷/g, "\\div ")
    .replace(/(?<=[\])A-Za-z0-9}])\s+x\s+(?=[A-Za-z\\(\[])/g, " \\times ")
    .replace(/(?<=[\])A-Za-z0-9}])(?:\s*×\s*|\s+\*\s+)(?=[A-Za-z\\(\[0-9])/g, " \\times ")
    .replace(/(?<!\\)([A-Za-z0-9_}\)])\s+\[/g, "$1[");

  // Typeset multi-letter mixed/lowercase word tensor names before `[dims]` or `_` upright
  // (e.g. Scores[n,m], head_i, TokenEmb[n,512]), while preserving matrix products like QK^T / QW_i^Q
  out = out.replace(/(?<![\\A-Za-z])((?=[A-Za-z]*[a-z])[A-Za-z]{3,})(?=\[|[_^])/g, (m) => `\\mathrm{${m}}`);

  // Wrap unbraced multi-char subscripts (e.g. L_distill, d_model, beta_10, a_ij)
  out = out.replace(/(?<!\\)_(?!\{)([A-Za-z0-9]{2,})/g, (_m, sub: string) => {
    if (/^[A-Za-z]{3,}$/.test(sub)) {
      return `_{\\mathrm{${sub}}}`;
    }
    return `_{${sub}}`;
  });

  // Wrap unbraced negative or multi-char superscripts (e.g. 10^-9, 2^16)
  out = out.replace(/(?<!\\)\^(?!\{)(-[0-9]+|[A-Za-z0-9]{2,})/g, (_m, sup: string) => {
    return `^{${sup}}`;
  });

  return out.replace(/\s{2,}/g, " ").trim();
}

const HAS_DIACRITIC_HAT_RE = /[A-Za-z]\u0302|[\u00e2\u00ea\u00ee\u00f4\u00fb\u0177\u0175\u1e91\u00c2\u00ca\u00ce\u00d4\u00db\u0176\u0174\u1e90]/;

function hasBareMathSignal(segment: string): boolean {
  const s = segment.trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s) || /https?:\/\//i.test(s)) return false;

  // Reject plain multi-word snake_case programming identifiers when no math syntax is present
  if (
    /^[a-z]{3,}_[a-z_]{3,}$/.test(s) &&
    !s.includes("[") &&
    !s.includes("^") &&
    !s.includes("=") &&
    !s.includes("\\")
  ) {
    return false;
  }

  // Parenthetical clauses mixing symbols with English prose words (e.g. `÷ √d_k & Softmax`)
  // should not wrap `& Softmax` as one inline formula; let inner token formatting handle `√d_k`
  if (/(?:^|\s)&(?:\s|$)/.test(s)) {
    return false;
  }

  if (HAS_DIACRITIC_HAT_RE.test(s)) return true;
  if (/[_^]\{|\\[A-Za-z]{2,}/.test(s)) return true;
  if (/√|(?<![\\A-Za-z])sqrt\(/.test(s)) return true;
  if (/\|\|[^|\n]+\|\|/.test(s)) return true;
  if (/<<|>>/.test(s)) return true;
  if (/[A-Za-z0-9_}\)]\s?\[[A-Za-z0-9_,+\-*:\s]+\]/.test(s)) return true;
  if (/(?:^|[\s([=+\-*/|])[A-Za-z][A-Za-z0-9]{0,5}[_^](?:[A-Za-z0-9{+-])/.test(s)) return true;
  if (/[A-Za-z0-9_\]\)]\s*=\s*[A-Za-z0-9_\\|(]/.test(s) && /[_^()\[\]+\-*/|]/.test(s)) return true;
  return false;
}

const EPISTEMIC_BRACKET_RE =
  /\[(?:原文明示|分析推断|原文未说明|原文不一致|易误解)(?:[^\]\n]{0,80})\]/;
const FLOW_ARROW_RE = /\s*(?:-->|->|=>|→)\s*/;
const NON_MATH_BOUNDARY_RE =
  /(\[(?:原文明示|分析推断|原文未说明|原文不一致|易误解)(?:[^\]\n]{0,80})\]|\s*(?:-->|->|=>|→)\s*|[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+|[;；、，。：]+)/g;

function formatBareSegmentPieces(segment: string): string {
  // Split standalone spaced parenthetical clauses `(d_z << D)` from preceding math/text tokens
  // while keeping attached function calls like `E(F_t[D])` or `P(F_t)` intact.
  const subParts = segment.split(/(\s+\([^()\n]+\))/g);
  return subParts
    .map((part) => {
      if (!part) return "";
      const spacedParen = part.match(/^(\s+)\(([^()\n]+)\)$/);
      if (spacedParen) {
        const [, leadingSpace, inner] = spacedParen;
        if (hasBareMathSignal(inner)) {
          return `${leadingSpace}($${normalizeLatexSyntax(inner)}$)`;
        }
        const replacedInlineRoot = inner.replace(
          /√\s*([A-Za-z](?:_[A-Za-z0-9]+|_\{[^}]+\})?|[0-9]+)/g,
          (_m, sym: string) => `$\\sqrt{${sym}}$`
        );
        return replacedInlineRoot !== inner ? `${leadingSpace}(${replacedInlineRoot})` : part;
      }

      const match = part.match(/^(\s*)(.*?)(\s*)$/);
      if (!match) return part;
      const [, lead, core, trail] = match;
      if (!core) return part;
      if (hasBareMathSignal(core)) {
        return `${lead}$${normalizeLatexSyntax(core)}$${trail}`;
      }
      // Fallback for clauses containing mixed prose & inline symbols (e.g. `(÷ √d_k & Softmax)`)
      return part.replace(/√\s*([A-Za-z](?:_[A-Za-z0-9]+|_\{[^}]+\})?|[0-9]+)/g, (_m, sym: string) => {
        return `$\\sqrt{${sym}}$`;
      });
    })
    .join("");
}

function formatPlainFlowChunk(chunk: string): string {
  if (!chunk) return "";
  const tokens = chunk.split(NON_MATH_BOUNDARY_RE);
  return tokens
    .map((tok) => {
      if (!tok) return "";
      if (EPISTEMIC_BRACKET_RE.test(tok)) return tok;
      if (FLOW_ARROW_RE.test(tok)) {
        return tok.includes("=>") ? " ⇒ " : " → ";
      }
      if (/^[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef;；、，。：\s]+$/.test(tok)) {
        return tok;
      }
      return formatBareSegmentPieces(tok);
    })
    .join("");
}

/**
 * Formats a `TENSOR / STATE FLOW` string so existing `$...$` spans are normalized and
 * bare ASCII/Unicode tensor expressions (`x_t[H,W,3]`, `L_distill = ||P(F_t)-G_t||^2`,
 * `ẑ_{t+1:t+H}[H,d_z]`, `d_z << D`) are cleanly wrapped in `$...$` for KaTeX rendering.
 */
export function formatFlowTextForMath(raw: string): string {
  if (!raw) return raw;
  const parts: string[] = [];
  const inlineDollarRe = /\$([^$\n]{1,600})\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineDollarRe.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push(formatPlainFlowChunk(raw.slice(lastIndex, match.index)));
    }
    parts.push(`$${normalizeLatexSyntax(match[1])}$`);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    parts.push(formatPlainFlowChunk(raw.slice(lastIndex)));
  }

  return parts.join("");
}
