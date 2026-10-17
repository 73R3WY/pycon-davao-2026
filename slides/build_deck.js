/*
 * build_deck.js — generates the PyCon Davao 2026 workshop deck inside the official
 * conference template (backgrounds in template/bg, Sora + Inter typography).
 * "From Python to AI-Powered Django: Build a Quiz & Reviewer App".
 *
 * Run:   NODE_PATH=./node_modules node build_deck.js
 * Output: "Jeremy Patrick Pacabis - From Python to AI-Powered Django_ Build a Quiz & Reviewer App.pptx"
 *         (the organizers' required file name), with the template's 7 reference pages appended as hidden slides.
 *
 * The deck is a "structured deck": a theme, a handful of layouts, sections per
 * part, speaker notes on every slide. Content is written for a room of high
 * school students meeting Python and Django for the first time.
 */

const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const Fa = require("react-icons/fa");
const Prism = require("prismjs");
require("prismjs/components/")(["python", "bash", "json", "markup-templating", "django"]);


// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
const THEME = {
  name: "PyCon Davao 2026",
  headFontFace: "Sora", // template headline font
  bodyFontFace: "Inter", // template body font
  colors: {
    // Palette from the template's branding page: 04B1A4 F99508 5DA144 FBEFCF 072E47
    dk1: "072E47", // navy — code cards, dark text
    lt1: "FFFFFF",
    dk2: "0F8D91", // teal — secondary / body text (as in the template)
    lt2: "FFFFFF", // card fill on the cream background
    accent1: "F99508", // orange — Python, step badges
    accent2: "5DA144", // green — Django
    accent3: "04B1A4", // teal — AI / web
    accent4: "8FD3CC", // light teal
    accent5: "1B6F86", // deep teal — database
    accent6: "D9534F", // soft red — warnings / reject
    hlink: "04B1A4",
    folHlink: "1B6F86",
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10" x 5.625"
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "From Python to AI-Powered Django";
pres.author = "Jeremy Patrick Pacabis";
const BG = (name) => path.join(__dirname, "template", "bg", name);
pres.subject = "PyCon Davao 2026 workshop";
// Brand colours as plain hex. (pptxgenjs cannot write theme colours, so scheme
// colours would fall back to Office's stock palette; hex keeps the deck faithful.)
const C = {
  text1: HEX.dk1, text2: HEX.dk2, background1: HEX.lt1, background2: HEX.lt2,
  accent1: HEX.accent1, accent2: HEX.accent2, accent3: HEX.accent3,
  accent4: HEX.accent4, accent5: HEX.accent5, accent6: HEX.accent6,
};
const CODE_FONT = "Courier New";

// ---------------------------------------------------------------------------
// Monokai syntax colours for code cards (hex on purpose: independent of the theme)
// ---------------------------------------------------------------------------
const MONOKAI = {
  bg: "272822",
  fg: "F8F8F2",
  comment: "9A9B8C", // Monokai uses 75715E; lifted a little so comments survive a projector
  string: "E6DB74",
  number: "AE81FF",
  keyword: "F92672",
  name: "A6E22E",
  builtin: "66D9EF",
};
// Prism token type -> colour. Anything not listed renders in the default foreground.
const TOKEN_COLOR = {
  comment: MONOKAI.comment, prolog: MONOKAI.comment, doctype: MONOKAI.comment, cdata: MONOKAI.comment,
  "triple-quoted-string": MONOKAI.string, string: MONOKAI.string, char: MONOKAI.string, "attr-value": MONOKAI.string,
  "template-string": MONOKAI.string, interpolation: MONOKAI.fg, "string-interpolation": MONOKAI.string,
  number: MONOKAI.number, boolean: MONOKAI.number, constant: MONOKAI.number, null: MONOKAI.number,
  keyword: MONOKAI.keyword, operator: MONOKAI.keyword, tag: MONOKAI.keyword, important: MONOKAI.keyword,
  "delimiter": MONOKAI.keyword, "template-tag": MONOKAI.keyword,
  function: MONOKAI.name, "class-name": MONOKAI.name, decorator: MONOKAI.name, "attr-name": MONOKAI.name,
  "function-name": MONOKAI.name, selector: MONOKAI.name, property: MONOKAI.name,
  builtin: MONOKAI.builtin, "function-variable": MONOKAI.builtin, variable: MONOKAI.builtin, parameter: MONOKAI.fg,
  punctuation: MONOKAI.fg, namespace: MONOKAI.fg,
};
// Pick a Prism grammar from the card's label (or an explicit opts.lang).
function langFor(label = "", explicit) {
  if (explicit) return explicit;
  const l = label.toLowerCase();
  if (/\.py(\s|$)/.test(l)) return "python"; // also "views.py  (compact version)"
  if (/\.html(\s|$)/.test(l)) return "django";
  if (l.startsWith("terminal") || l.startsWith(".env")) return "bash";
  if (l.includes("json")) return "json";
  return "plain";
}
// Prism tokens (nested) -> flat [text, type] pairs.
function flattenTokens(tokens, type = null, out = []) {
  for (const tok of tokens) {
    if (typeof tok === "string") out.push([tok, type]);
    else if (Array.isArray(tok.content)) flattenTokens(tok.content, tok.type, out);
    else if (typeof tok.content === "string") out.push([tok.content, tok.type]);
    else flattenTokens([tok.content], tok.type, out);
  }
  return out;
}
// Build pptxgenjs text runs for a code sample, one run per coloured piece, breakLine at newlines.
function highlightRuns(code, lang) {
  let pieces;
  if (lang === "plain" || !Prism.languages[lang]) {
    // Mock-ups and trees: grey out comment-looking lines, default colour for the rest.
    pieces = code.split("\n").flatMap((line, i, arr) => {
      const isComment = /^\s*(#|\/\/|\{#)/.test(line);
      return [[line + (i < arr.length - 1 ? "\n" : ""), isComment ? "comment" : null]];
    });
  } else {
    pieces = flattenTokens(Prism.tokenize(code, Prism.languages[lang]));
  }
  const runs = [];
  for (const [text, type] of pieces) {
    const color = (type && TOKEN_COLOR[type]) || MONOKAI.fg;
    const parts = text.split("\n");
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      if (part.length) runs.push({ text: part, options: { color, breakLine: !last } });
      else if (!last) {
        // Newline with no text before it on this run: either an empty line or a trailing break.
        const prev = runs[runs.length - 1];
        if (prev && !prev.options.breakLine) prev.options.breakLine = true;
        else runs.push({ text: " ", options: { color, breakLine: true } });
      }
    });
  }
  if (runs.length) runs[runs.length - 1].options.breakLine = false;
  return runs;
}

// ---------------------------------------------------------------------------
// Icons (react-icons -> SVG -> PNG via sharp)
// ---------------------------------------------------------------------------
const iconCache = new Map();
async function icon(name, hex = "FFFFFF") {
  const key = `${name}-${hex}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Fa[name], { color: `#${hex}`, size: 256 })
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const data = "image/png;base64," + png.toString("base64");
  iconCache.set(key, data);
  return data;
}

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------
// Every layout carries one of the template's full-slide artwork images.
pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { path: BG("title.png") },
  objects: [
    {
      placeholder: {
        options: { name: "title", type: "title", x: 1.6, y: 0.95, w: 6.2, h: 2.15, fontSize: 36, bold: true, color: C.accent3, valign: "bottom", margin: 0 },
        text: "",
      },
    },
    {
      placeholder: {
        options: { name: "body", type: "body", x: 1.73, y: 3.85, w: 6.6, h: 0.7, fontSize: 14, bold: true, color: C.text1, valign: "top", margin: 0 },
        text: "",
      },
    },
  ],
});

pres.defineSlideMaster({
  title: "DIVIDER",
  background: { path: BG("segment.png") },
  objects: [
    {
      placeholder: {
        options: { name: "title", type: "title", x: 5.45, y: 1.6, w: 4.1, h: 1.9, fontSize: 30, bold: true, color: "FEF9D7", valign: "bottom", margin: 0 },
        text: "",
      },
    },
    {
      placeholder: {
        options: { name: "body", type: "body", x: 5.45, y: 3.6, w: 4.1, h: 0.8, fontSize: 13, color: C.accent4, valign: "top", margin: 0 },
        text: "",
      },
    },
  ],
});

pres.defineSlideMaster({
  title: "CONTENT",
  background: { path: BG("content.png") },
  objects: [
    {
      placeholder: {
        options: { name: "title", type: "title", x: 0.5, y: 0.78, w: 8.7, h: 0.52, fontSize: 24, bold: true, color: C.accent3, valign: "middle", margin: 0 },
        text: "",
      },
    },
  ],
  slideNumber: { x: 8.7, y: 4.82, w: 0.5, h: 0.25, fontSize: 9, color: HEX.dk1, align: "right" },
});

// Dark checkpoint slides: solid brand navy (matches the segment divider).
pres.defineSlideMaster({
  title: "CONTENT_DARK",
  background: { color: HEX.dk1 },
  objects: [
    {
      placeholder: {
        options: { name: "title", type: "title", x: 0.5, y: 0.78, w: 8.7, h: 0.52, fontSize: 24, bold: true, color: "FEF9D7", valign: "middle", margin: 0 },
        text: "",
      },
    },
  ],
  slideNumber: { x: 8.7, y: 4.82, w: 0.5, h: 0.25, fontSize: 9, color: "8FD3CC", align: "right" },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let currentSection = "Intro";
// Content was authored for x 0.5–9.5, y 1.3–5.0 on a plain white slide. The
// template artwork leaves a smaller safe area (logos top-left, art on the right
// edge, sponsor strip at the bottom), so every add* call on a content slide is
// remapped into x 0.45–9.3, y 1.35–4.8.
const AREA = { x0: 0.4, sx: 8.75 / 9.0, y0: 1.35, sy: 3.45 / 3.7 };
function remap(o) {
  if (!o || typeof o !== "object" || o.placeholder || typeof o.x !== "number") return o;
  const r = { ...o };
  r.x = AREA.x0 + (o.x - 0.5) * AREA.sx;
  if (typeof o.w === "number") r.w = o.w * AREA.sx;
  if (typeof o.y === "number") r.y = AREA.y0 + (o.y - 1.3) * AREA.sy;
  if (typeof o.h === "number") r.h = o.h * AREA.sy;
  return r;
}
function slide(master, title, notes) {
  const real = pres.addSlide({ masterName: master, sectionTitle: currentSection });
  if (title) real.addText(title, { placeholder: "title" });
  if (notes) real.addNotes(notes);
  if (master !== "CONTENT" && master !== "CONTENT_DARK") return real;
  return {
    addText: (txt, o) => real.addText(txt, remap(o)),
    addShape: (type, o) => real.addShape(type, remap(o)),
    addImage: (o) => real.addImage(remap(o)),
    addNotes: (n) => real.addNotes(n),
  };
}
function section(title) {
  currentSection = title;
  pres.addSection({ title });
}
function shadow() {
  return { type: "outer", color: "000000", blur: 6, offset: 2, angle: 90, opacity: 0.18 };
}

// Dark rounded card with monospace code. `label` = small file-name chip.
function codeCard(s, x, y, w, h, code, opts = {}) {
  const { label, color = MONOKAI.bg, lang } = opts;
  const lines = code.split("\n");
  // Auto-fit: largest size (<= requested) at which no line wraps and all lines fit the height.
  // Boxes on content slides are scaled by AREA (see remap), so measure the real size.
  const availW = (w - 0.5) * AREA.sx - 0.05, availH = h * AREA.sy - (label ? 0.65 : 0.4);
  const longest = Math.max(...lines.map((l) => l.length));
  let fontSize = 12; // always start at 12 and shrink only as far as the 11pt floor (requested sizes below that are ignored)
  const fits = (sz) => longest <= Math.floor(availW / (sz * 0.6 / 72)) - 2 && lines.length * (sz * 1.2 / 72) <= availH;
  while (fontSize > 11 && !fits(fontSize)) fontSize -= 0.5; // 11pt floor: large fonts for the projector
  if (!fits(fontSize)) console.warn(`  ! code card does not fit at ${fontSize}pt (slide ${pres.slides.length}, label ${label || "-"}, longest ${longest} chars, ${lines.length} lines)`);
  else if (fontSize < 11.5) console.warn(`  ~ ${fontSize}pt slide ${pres.slides.length} [${label || "-"}] w=${availW.toFixed(1)} h=${availH.toFixed(2)} longest=${longest} lines=${lines.length} need_h=${(lines.length * fontSize * 1.2 / 72).toFixed(2)} :: ${lines.find((l) => l.length === longest)}`);
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.12, fill: { color }, line: { color, width: 0 }, shadow: shadow(), objectName: "code card",
  });
  if (label) {
    const lw = Math.min(w - 0.4, 0.085 * label.length + 0.35);
    s.addShape(pres.ShapeType.roundRect, {
      x: x + 0.2, y: y + 0.12, w: lw, h: 0.28, rectRadius: 0.08, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 }, objectName: "file label",
    });
    s.addText(label, {
      x: x + 0.2, y: y + 0.12, w: lw, h: 0.28, fontSize: 10, bold: true, color: C.text1, fontFace: CODE_FONT, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "file label text",
    });
  }
  const runs = highlightRuns(code, langFor(label, lang));
  s.addText(runs, {
    x: x + 0.25, y: y + (label ? 0.5 : 0.2), w: w - 0.5, h: h - (label ? 0.65 : 0.4), fontSize, fontFace: CODE_FONT, valign: "top", margin: 0, isTextBox: true, objectName: "code",
  });
}

// Numbered badge (circle) + bold heading + description. The deck's visual motif.
function stepRow(s, x, y, w, n, heading, body, color = C.accent1, opts = {}) {
  const narrow = w < 3.0; // side column next to a wide code card
  const { h = 0.8, bodySize = narrow ? 11 : 13 } = opts;
  const b = narrow ? 0.36 : 0.45, gap = narrow ? 0.48 : 0.6;
  s.addShape(pres.ShapeType.ellipse, { x, y: y + 0.05, w: b, h: b, fill: { color }, line: { color, width: 0 }, objectName: `badge ${n}` });
  s.addText(String(n), { x, y: y + 0.05, w: b, h: b, fontSize: narrow ? 12 : 15, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: `badge ${n} text` });
  s.addText(
    [
      { text: heading, options: { bold: true, fontSize: narrow ? 12 : 15, breakLine: true } },
      { text: body, options: { fontSize: bodySize, color: C.text2 } },
    ],
    { x: x + gap, y, w: w - gap, h, valign: "top", margin: 0, isTextBox: true, objectName: `step ${n}` }
  );
}

// Tinted card with optional icon and title.
async function card(s, x, y, w, h, title, body, opts = {}) {
  const narrow = w < 3.0;
  const { color = C.accent1, iconName, dark = false, bodySize = narrow ? 11 : 12, titleSize = narrow ? 12 : 14 } = opts;
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.12, fill: { color: dark ? C.text1 : C.background2 }, line: { color: dark ? C.text1 : C.background2, width: 0 }, objectName: `card ${title}`,
  });
  let textY = y + 0.18;
  if (iconName) {
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.2, y: y + 0.18, w: 0.5, h: 0.5, fill: { color }, line: { color, width: 0 }, objectName: `icon bg ${title}` });
    s.addImage({ data: await icon(iconName), x: x + 0.31, y: y + 0.29, w: 0.28, h: 0.28, objectName: `icon ${title}` });
    s.addText(title, { x: x + 0.85, y: y + 0.18, w: w - 1.0, h: 0.5, fontSize: titleSize, bold: true, color: dark ? C.background1 : C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: `card title ${title}` });
    textY = y + 0.8;
  } else {
    s.addText(title, { x: x + 0.2, y: y + 0.15, w: w - 0.4, h: 0.4, fontSize: titleSize, bold: true, color: dark ? C.background1 : C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: `card title ${title}` });
    textY = y + 0.6;
  }
  const items = Array.isArray(body) ? body : [body];
  s.addText(
    items.map((t, i) => ({ text: t, options: { bullet: items.length > 1, breakLine: i < items.length - 1, paraSpaceAfter: 4 } })),
    { x: x + 0.2, y: textY, w: w - 0.4, h: y + h - textY - 0.15, fontSize: bodySize, color: dark ? C.background1 : C.text2, valign: "top", margin: 0, isTextBox: true, objectName: `card body ${title}` }
  );
}

// Horizontal flow: boxes joined by arrows. steps = [{label, color, iconName?}]
async function flow(s, x, y, w, h, steps, opts = {}) {
  const { fontSize = 12, dark = false } = opts;
  const gap = 0.32;
  const boxW = (w - gap * (steps.length - 1)) / steps.length;
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    const bx = x + i * (boxW + gap);
    const color = st.color || C.accent1;
    s.addShape(pres.ShapeType.roundRect, { x: bx, y, w: boxW, h, rectRadius: 0.1, fill: { color }, line: { color, width: 0 }, shadow: shadow(), objectName: `flow ${st.label}` });
    if (st.iconName) {
      s.addImage({ data: await icon(st.iconName, st.iconHex || "FFFFFF"), x: bx + boxW / 2 - 0.2, y: y + 0.15, w: 0.4, h: 0.4, objectName: `flow icon ${st.label}` });
      s.addText(st.label, { x: bx + 0.05, y: y + 0.55, w: boxW - 0.1, h: h - 0.6, fontSize, bold: true, color: st.textColor || C.text1, align: "center", valign: "top", margin: 0, isTextBox: true, objectName: `flow label ${st.label}` });
    } else {
      s.addText(st.label, { x: bx + 0.05, y, w: boxW - 0.1, h, fontSize, bold: true, color: st.textColor || C.text1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: `flow label ${st.label}` });
    }
    if (i < steps.length - 1) {
      s.addShape(pres.ShapeType.rightArrow, { x: bx + boxW + 0.04, y: y + h / 2 - 0.12, w: gap - 0.08, h: 0.24, fill: { color: dark ? C.background1 : C.text2 }, line: { color: dark ? C.background1 : C.text2, width: 0 }, objectName: `arrow ${i}` });
    }
  }
}

function bullets(s, x, y, w, h, items, opts = {}) {
  const { fontSize = 15, color = C.text1, spacing = 8 } = opts;
  s.addText(
    items.map((t, i) => {
      const o = typeof t === "string" ? { text: t } : t;
      return { text: o.text, options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: spacing, bold: o.bold, color: o.color } };
    }),
    { x, y, w, h, fontSize, color, valign: "top", margin: 0, isTextBox: true, objectName: "bullets" }
  );
}

function para(s, x, y, w, h, text, opts = {}) {
  s.addText(text, { fontSize: 15, color: C.text1, valign: "top", margin: 0, isTextBox: true, objectName: "paragraph", ...opts, x, y, w, h });
}

async function bigIcon(s, x, y, size, iconName, color = C.accent1) {
  s.addShape(pres.ShapeType.ellipse, { x, y, w: size, h: size, fill: { color }, line: { color, width: 0 }, objectName: `big icon bg ${iconName}` });
  s.addImage({ data: await icon(iconName), x: x + size * 0.25, y: y + size * 0.25, w: size * 0.5, h: size * 0.5, objectName: `big icon ${iconName}` });
}

function tip(s, x, y, w, text, opts = {}) {
  const { color = C.accent3, h = 0.55 } = opts;
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.1, fill: { color: C.background2 }, line: { color: C.background2, width: 0 }, objectName: "tip" });
  s.addShape(pres.ShapeType.ellipse, { x: x + 0.15, y: y + h / 2 - 0.15, w: 0.3, h: 0.3, fill: { color }, line: { color, width: 0 }, objectName: "tip dot" });
  s.addText("!", { x: x + 0.15, y: y + h / 2 - 0.15, w: 0.3, h: 0.3, fontSize: 12, bold: true, color: C.text1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "tip mark" });
  s.addText(text, { x: x + 0.6, y, w: w - 0.75, h, fontSize: 12, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "tip text" });
}

// ---------------------------------------------------------------------------
// SLIDES
// ---------------------------------------------------------------------------
async function build() {
  let s;

  // ======================= INTRO =======================
  section("Intro");

  // 1 Title
  s = slide("TITLE_DARK", null, "Welcome everyone. Quick intro: who you are, what you do with Python. Ask: who has written Python before? Who has built a website? Who has used ChatGPT? Today we connect all three. Two hours, lots of typing, it's fine to fall behind: the finished code is in the repo.");
  s.addText("From Python to AI-Powered Django: Build a Quiz & Reviewer App", { placeholder: "title" });
  // "BY:" pill exactly where the template puts it
  s.addShape(pres.ShapeType.roundRect, { x: 1.73, y: 3.27, w: 3.9, h: 0.42, rectRadius: 0.08, fill: { color: C.text1 }, line: { color: C.text1, width: 0 }, objectName: "by pill" });
  s.addText("BY: Jeremy Patrick Pacabis", { x: 1.85, y: 3.27, w: 3.8, h: 0.42, fontSize: 16, bold: true, color: "FEF9D7", valign: "middle", margin: 0, isTextBox: true, objectName: "by text" });
  s.addText("Workshop 1 · PyCon Davao 2026 · Saturday 17 October · 1:10–3:10 PM", { placeholder: "body" });

  // 2 Big question
  s = slide("CONTENT", "Code a website, then teach it to talk to an AI", "Set the hook. Everyone has taken an online quiz. Today YOU build the thing that makes quizzes, and then you make it smart. Emphasise that nothing today is magic: it is all small Python pieces joined together.");
  await card(s, 0.5, 1.3, 2.85, 2.9, "You will write Python", ["Variables, lists, dictionaries", "Functions and classes", "Just enough, exactly when needed"], { iconName: "FaPython", color: C.accent1, bodySize: 13 });
  await card(s, 3.575, 1.3, 2.85, 2.9, "You will build a web app", ["Pages, links, forms", "A real database", "Share a link, friends take your quiz"], { iconName: "FaGlobe", color: C.accent2, bodySize: 13 });
  await card(s, 6.65, 1.3, 2.85, 2.9, "You will add an AI", ["Ask it for quiz questions", "Check what it gives you", "You stay in charge of publishing"], { iconName: "FaRobot", color: C.accent3, bodySize: 13 });

  // 3 What we'll build
  s = slide("CONTENT", "What we are building today", "Walk through the flow left to right. A teacher (or you) creates a reviewer, adds questions, publishes it, shares a link. A friend opens the link, answers, and immediately sees a score. This is a complete product. Then the AI helps write the questions.");
  await flow(s, 0.5, 1.4, 9.0, 1.0, [
    { label: "Create", color: C.accent1, iconName: "FaPlus" },
    { label: "Publish", color: C.accent2, iconName: "FaCheck" },
    { label: "Share", color: C.accent4, iconName: "FaLink", textColor: C.text1 },
    { label: "Answer", color: C.accent5, iconName: "FaPen" },
    { label: "Evaluate", color: C.accent3, iconName: "FaCogs" },
    { label: "Results", color: C.accent6, iconName: "FaTrophy" },
  ], { fontSize: 13 });
  codeCard(s, 0.5, 2.75, 4.3, 2.2,
    "Python Fundamentals Reviewer\n1. Which keyword defines a function?\n   ( ) func   (•) def\n   ( ) function   ( ) define\n2. What does len() return?\n   [ the number of items     ]\n            [ Submit answers ]",
    { label: "/reviewer/python-fundamentals/", fontSize: 11 });
  bullets(s, 5.1, 2.8, 4.4, 2.2, [
    "A Reviewer has a title and many Questions",
    "Multiple choice: pick one of 4 choices",
    "Direct answer: type the answer",
    "Anyone with the link can take it, no login",
    "The app grades it instantly",
  ], { fontSize: 14 });

  // 4 The journey
  s = slide("CONTENT", "The journey in one picture", "This is the map for the next two hours. Each step is a skill that exists on its own, and they stack. Point out: the same 'call an external API' skill you learn for AI works for maps, payments, weather, anything.");
  await flow(s, 0.5, 1.5, 9.0, 1.1, [
    { label: "Python", color: C.accent1, iconName: "FaPython" },
    { label: "Django", color: C.accent2, iconName: "FaCubes" },
    { label: "Web app", color: C.accent4, iconName: "FaGlobe", textColor: C.text1 },
    { label: "Database", color: C.accent5, iconName: "FaDatabase" },
    { label: "External API", color: C.accent3, iconName: "FaPlug" },
    { label: "AI feature", color: C.accent6, iconName: "FaRobot" },
  ], { fontSize: 12 });
  stepRow(s, 0.5, 3.0, 4.3, 1, "Part 1 · Python (20 min)", "Only the pieces the app needs.", C.accent1, { h: 0.7 });
  stepRow(s, 0.5, 3.8, 4.3, 2, "Part 2 · Django app (35 min)", "Models, admin, URLs, views, templates.", C.accent2, { h: 0.7 });
  stepRow(s, 5.2, 3.0, 4.3, 3, "Part 3 · Quiz experience (30 min)", "Forms, shareable link, grading, results.", C.accent4, { h: 0.7 });
  stepRow(s, 5.2, 3.8, 4.3, 4, "Part 4 · Generative AI (30 min)", "Structured output, validation, human review.", C.accent3, { h: 0.7 });

  // 5 Setup check
  s = slide("CONTENT", "Before we start: setup check", "Give people 3 to 4 minutes. Helpers walk around. Anyone stuck: pair with a neighbour, keep going, the repo has the finished app. FAKE_AI=1 means no API key is needed to finish Part 4.");
  codeCard(s, 0.5, 1.3, 6.1, 3.7,
    "# 1. Python 3.12 or newer?\npython --version\n# 2. Get the workshop code\ngit clone https://github.com/73R3WY/pycon-davao-2026\ncd pycon-davao-2026/quiz_reviewer\n# 3. A private 'lunchbox' for packages\npython -m venv .venv\nsource .venv/bin/activate\n# Windows: .venv\\Scripts\\activate\n# 4. Install Django and friends\npip install -r requirements.txt\n# 5. Settings (FAKE_AI=1 already set)\ncp .env.example .env",
    { label: "terminal", fontSize: 11 });
  bullets(s, 6.8, 1.35, 2.7, 2.4, [
    "A laptop and a code editor (VS Code)",
    "Python 3.12+ and Git installed",
    "A browser",
    "OpenAI API key: optional!",
  ], { fontSize: 14 });
  tip(s, 6.8, 3.9, 2.7, "No key? FAKE_AI=1 uses a built-in sample AI reply.", { h: 1.0 });

  // ======================= PART 1 =======================
  section("Part 1 · Python foundations");

  s = slide("DIVIDER", "Part 1 · Python foundations", "Twenty minutes. Every concept here will appear again inside the Django code, so when we meet it later it feels familiar. Files: python_basics/01 to 05. Run each one as we go.");
  s.addText("Part 1 · Python foundations", { placeholder: "title" });
  s.addText("Variables · lists · dictionaries · if · functions · classes · pip", { placeholder: "body" });

  // 7 What is Python
  s = slide("CONTENT", "What is Python?", "Analogy: a recipe. A program is a list of instructions the computer follows top to bottom. Python is popular because it reads almost like English. Show python_basics/01_variables.py running.");
  await card(s, 0.5, 1.3, 4.3, 1.75, "A recipe for the computer", "A program is a list of steps, read top to bottom. Python is a language for writing those steps that looks almost like English.", { iconName: "FaUtensils", color: C.accent1, bodySize: 13 });
  await card(s, 0.5, 3.2, 4.3, 1.75, "Where it is used", "Websites (Instagram, YouTube), data science, AI (ChatGPT's tooling), games, robots, school projects.", { iconName: "FaRocket", color: C.accent2, bodySize: 13 });
  codeCard(s, 5.1, 1.3, 4.4, 3.65,
    "# A comment. Python ignores it.\n# Comments explain WHY to humans.\n\nprint(\"Hello, PyCon Davao!\")\n\n# Run it:\n#   python hello.py\n#\n# Output:\n#   Hello, PyCon Davao!",
    { label: "hello.py" });

  // 8 Variables
  s = slide("CONTENT", "Variables: labelled boxes", "Run 01_variables.py. Ask: what happens if we change question_count to 20? Introduce f-strings as 'fill in the blanks'. Note integer vs float vs string by asking which ones have quotes.");
  codeCard(s, 0.5, 1.3, 6.2, 3.0,
    "title = \"Python Fundamentals\"   # str (text)\nquestion_count = 10             # int (whole number)\nmc_percent = 70.0               # float (decimal)\n\n# f-string: fill in the blanks with {variables}\nprint(f\"{title} has {question_count} questions\")\n\nmc_count = question_count * mc_percent // 100\nprint(mc_count)   # 7",
    { label: "python_basics/01_variables.py" });
  stepRow(s, 6.9, 1.3, 2.6, 1, "A name on the left", "The box's label. Use lowercase_with_underscores.", C.accent1, { h: 0.75 });
  stepRow(s, 6.9, 2.2, 2.6, 2, "A value on the right", "Text in quotes, numbers without.", C.accent1, { h: 0.75 });
  stepRow(s, 6.9, 3.1, 2.6, 3, "= means 'put into'", "Not 'equals' like in math. The box can be refilled later.", C.accent1, { h: 0.75 });
  tip(s, 0.5, 4.45, 9.0, "In the app: title, description and question count are exactly these kinds of values, just stored in a database.");

  // 9 Lists
  s = slide("CONTENT", "Lists: many things in order", "Run 02_lists_and_dicts.py (first half). The gotcha: counting starts at 0. Ask the room what choices[3] is. append adds to the end, len counts.");
  codeCard(s, 0.5, 1.3, 6.2, 3.0,
    "choices = [\"func\", \"def\", \"function\", \"define\"]\n\nchoices[0]        # \"func\"  <- counts from 0!\nchoices[1]        # \"def\"\nlen(choices)      # 4\n\nchoices.append(\"lambda\")   # add to the end\n\nfor choice in choices:     # visit each one\n    print(choice)",
    { label: "python_basics/02_lists_and_dicts.py" });
  await card(s, 6.9, 1.3, 2.6, 1.6, "Square brackets", "[ ] create a list. Items are separated by commas and keep their order.", { color: C.accent1, bodySize: 13 });
  await card(s, 6.9, 3.05, 2.6, 1.25, "In the app", "A question's four choices; a reviewer's questions.", { color: C.accent2, bodySize: 13 });

  // 10 Dictionaries
  s = slide("CONTENT", "Dictionaries: things with labels", "Second half of 02. A dict is like a form: each field has a name (key) and a value. Point out this is EXACTLY the shape the AI will send us in Part 4 (JSON). Lists of dicts = a whole quiz.");
  codeCard(s, 0.5, 1.3, 6.2, 3.4,
    "question = {\n    \"text\": \"Which keyword defines a function?\",\n    \"type\": \"multiple_choice\",\n    \"choices\": [\"func\", \"def\", \"function\"],\n    \"correct\": \"def\",\n}\n\nquestion[\"text\"]      # look up by key\nquestion[\"correct\"]   # \"def\"\n\nquiz = [question, another_question]   # a list of dicts",
    { label: "python_basics/02_lists_and_dicts.py" });
  await card(s, 6.9, 1.3, 2.6, 1.6, "Curly braces", "{ key: value } pairs. Look things up by name instead of position.", { color: C.accent1, bodySize: 13 });
  await card(s, 6.9, 3.05, 2.6, 1.65, "Remember this shape", "In Part 4 the AI replies with a dictionary that has a list of question dictionaries. Same thing!", { color: C.accent3, bodySize: 13 });

  // 11 if / else
  s = slide("CONTENT", "if / else: making a decision", "Run 03_if_and_functions.py. Indentation matters in Python: the indented lines belong to the if. Ask: how do we make 'DEF' count as correct? Reveal .casefold() and .strip().");
  codeCard(s, 0.5, 1.3, 6.2, 2.9,
    "submitted = \"Def \"\ncorrect = \"def\"\n\n# .strip() drops spaces, .casefold() ignores case\nif submitted.strip().casefold() == correct:\n    print(\"Correct!\")\nelse:\n    print(f\"Not quite. It is {correct}.\")",
    { label: "python_basics/03_if_and_functions.py" });
  stepRow(s, 6.9, 1.3, 2.6, 1, "Ask a yes/no question", "== compares two values. Result is True or False.", C.accent1, { h: 0.8 });
  stepRow(s, 6.9, 2.2, 2.6, 2, "Indent what belongs", "4 spaces say 'these lines are inside the if'.", C.accent1, { h: 0.8 });
  stepRow(s, 6.9, 3.1, 2.6, 3, "else = otherwise", "Runs only when the question was False.", C.accent1, { h: 0.8 });
  tip(s, 0.5, 4.4, 9.0, "In the app: this exact check decides whether a quiz taker's answer is right.");

  // 12 Functions
  s = slide("CONTENT", "Functions: name a recipe, reuse it", "def = define. Parameters go in parentheses, return sends a value back. We will call check_answer for every question in the quiz instead of copy-pasting the if. Type hints (str, bool) are optional labels that help readers and editors.");
  codeCard(s, 0.5, 1.3, 6.2, 3.0,
    "def check_answer(submitted: str, correct: str) -> bool:\n    \"\"\"True when the typed answer matches.\"\"\"\n    return (submitted.strip().casefold()\n            == correct.casefold())\n\n\ncheck_answer(\"Def\", \"def\")    # True\ncheck_answer(\"func\", \"def\")   # False\n\n# Write once, call a thousand times.",
    { label: "python_basics/03_if_and_functions.py" });
  stepRow(s, 6.9, 1.3, 2.6, 1, "def + a name", "Followed by inputs in parentheses and a colon.", C.accent1, { h: 0.75 });
  stepRow(s, 6.9, 2.15, 2.6, 2, "The body", "Indented lines that do the work.", C.accent1, { h: 0.75 });
  stepRow(s, 6.9, 3.0, 2.6, 3, "return", "Hands a result back to whoever called it.", C.accent1, { h: 0.75 });
  tip(s, 0.5, 4.45, 9.0, "In Django, every web page is a function: it receives a request and returns a response.");

  // 13 Classes
  s = slide("CONTENT", "Classes: a blueprint for many objects", "Run 04_classes.py. A class is a cookie cutter; objects are the cookies. self means 'this particular one'. Key message: Django models are classes. When you see class Reviewer(models.Model) in 10 minutes, this is it.");
  codeCard(s, 0.5, 1.3, 6.2, 3.5,
    "class Question:\n    \"\"\"The blueprint.\"\"\"\n\n    def __init__(self, text: str, answer: str):\n        self.text = text        # self = this question\n        self.answer = answer\n\n    def is_correct(self, submitted: str) -> bool:\n        return submitted.casefold() == self.answer\n\n\nq = Question(\"Which keyword makes a function?\", \"def\")\nq.is_correct(\"DEF\")   # True",
    { label: "python_basics/04_classes.py" });
  await card(s, 6.9, 1.3, 2.6, 1.7, "Attributes", "Data each object carries: q.text, q.answer. Like dictionary keys, but fixed by the blueprint.", { color: C.accent1, bodySize: 13 });
  await card(s, 6.9, 3.15, 2.6, 1.65, "Methods", "Functions inside the class that can use self, like q.is_correct().", { color: C.accent2, bodySize: 13 });

  // 14 venv & pip
  s = slide("CONTENT", "Virtual environments and pip", "Analogy: each project gets its own lunchbox so packages don't mix. pip is the delivery service that fills it. Everyone should already have done this in the setup check; confirm 'python -m django --version' prints 5.x.");
  await card(s, 0.5, 1.3, 4.3, 1.7, "Virtual environment = lunchbox", "A private folder (.venv) holding the exact packages THIS project needs. Other projects can't mess with it.", { iconName: "FaBoxOpen", color: C.accent1, bodySize: 13 });
  await card(s, 0.5, 3.15, 4.3, 1.7, "pip = package delivery", "Downloads code other people wrote (Django, openai) from PyPI, the Python Package Index.", { iconName: "FaTruck", color: C.accent2, bodySize: 13 });
  codeCard(s, 5.1, 1.3, 4.4, 3.55,
    "python -m venv .venv\nsource .venv/bin/activate\n# (.venv) appears in your prompt\n\npip install -r requirements.txt\n\n# requirements.txt\ndjango>=5.2,<6\nopenai>=1.50\npython-dotenv>=1.0\n\npython -m django --version   # 5.2.x",
    { label: "terminal", fontSize: 11 });

  // ======================= PART 2 =======================
  section("Part 2 · Build the Django app");

  s = slide("DIVIDER", null, "Thirty-five minutes. We go from an empty folder to a database-backed page in the browser. The pattern repeats: learn a concept, type it, test it, move on.");
  s.addText("Part 2 · Build the Django app", { placeholder: "title" });
  s.addText("Project · app · models · migrations · admin · URLs · views · templates", { placeholder: "body" });

  // 16 What is a web framework
  s = slide("CONTENT", "What is Django? A restaurant for web pages", "Analogy that carries the whole workshop: URL = the order the customer places, view = the kitchen that prepares it, model = the pantry/storeroom (database), template = the plate it is served on. Django is the restaurant building with the kitchen already installed.");
  await flow(s, 0.5, 1.4, 9.0, 1.2, [
    { label: "URL\nthe order", color: C.accent4, iconName: "FaReceipt", textColor: C.text1 },
    { label: "View\nthe kitchen", color: C.accent2, iconName: "FaUtensils" },
    { label: "Model\nthe pantry", color: C.accent5, iconName: "FaDatabase" },
    { label: "Template\nthe plate", color: C.accent1, iconName: "FaFileCode" },
  ], { fontSize: 12 });
  bullets(s, 0.5, 2.95, 4.4, 2.1, [
    "A framework = the building, kitchen and staff already set up",
    "You write the menu (URLs), recipes (views) and plating (templates)",
    "Django also brings a free admin site, security and a database layer",
  ], { fontSize: 14 });
  await card(s, 5.2, 2.95, 4.3, 2.0, "Used by", ["Instagram, Spotify, Pinterest, NASA, The Washington Post", "and today: your quiz app"], { color: C.accent2, bodySize: 13 });

  // 17 Request/response cycle
  s = slide("CONTENT", "Every page follows the same path", "Trace one request out loud: the browser asks for /reviewer/python-fundamentals/. Django matches the URL, calls the take view, the view asks the model for the questions, hands them to the template, HTML comes back. Every page on the internet is a variation of this.");
  await flow(s, 0.5, 1.4, 9.0, 1.1, [
    { label: "Browser", color: C.accent4, iconName: "FaGlobe", textColor: C.text1 },
    { label: "urls.py", color: C.accent2, iconName: "FaRoute" },
    { label: "views.py", color: C.accent2, iconName: "FaCogs" },
    { label: "models.py", color: C.accent5, iconName: "FaDatabase" },
    { label: "template", color: C.accent1, iconName: "FaFileCode" },
    { label: "HTML back", color: C.accent4, iconName: "FaReply", textColor: C.text1 },
  ], { fontSize: 12 });
  codeCard(s, 0.5, 2.8, 9.0, 2.2,
    "GET /reviewer/python-fundamentals/            # 1. browser asks\n  -> urls.py matches  \"reviewer/<slug:slug>/\"   # 2. which view?\n  -> views.take(request, slug=\"python-fundamentals\")   # 3. the kitchen\n  -> Reviewer.objects.get(slug=slug)           # 4. fetch from database\n  -> render(request, \"take.html\", {...})       # 5. fill the template\n<- 200 OK  <html>...</html>                   # 6. the page you see",
    { label: "one request, step by step", fontSize: 11 });

  // 18 startproject
  s = slide("CONTENT", "Step 1 · Create the project", "Everyone types this. The dot at the end matters: it puts manage.py in the current folder instead of a nested one. Run runserver and open 127.0.0.1:8000: the rocket page means Django works. Ctrl+C stops it.");
  codeCard(s, 0.5, 1.3, 6.2, 2.6,
    "# inside quiz_reviewer/ with .venv active\ndjango-admin startproject config .\n\npython manage.py runserver\n# Starting development server at http://127.0.0.1:8000/\n\n# open that address in your browser -> rocket!\n# Ctrl + C stops the server",
    { label: "terminal" });
  stepRow(s, 6.9, 1.3, 2.6, 1, "startproject", "Creates the skeleton: settings, URLs, manage.py.", C.accent2, { h: 0.8 });
  stepRow(s, 6.9, 2.2, 2.6, 2, "The dot .", "'Put it right here', not in another folder.", C.accent2, { h: 0.8 });
  stepRow(s, 6.9, 3.1, 2.6, 3, "runserver", "A tiny web server for development. Reloads when you save.", C.accent2, { h: 0.8 });
  tip(s, 0.5, 4.2, 9.0, "The repo already has this done. If you are behind, just follow along in the finished files.");

  // 19 Project tour
  s = slide("CONTENT", "What did Django just create?", "Walk the tree. Only three files matter today: settings.py (we touch it twice), urls.py (the menu), manage.py (the remote control). wsgi/asgi are for real servers; ignore them.");
  codeCard(s, 0.5, 1.3, 4.4, 3.7,
    "quiz_reviewer/\n├── manage.py       # remote control\n├── db.sqlite3      # database file\n└── config/\n    ├── settings.py # control panel\n    ├── urls.py     # address menu\n    ├── wsgi.py     # for real servers\n    └── asgi.py     # for real servers",
    { label: "folder tree", fontSize: 12 });
  stepRow(s, 5.2, 1.3, 4.3, 1, "manage.py", "python manage.py <command>. Runs the server, migrations, tests.", C.accent2, { h: 0.85 });
  stepRow(s, 5.2, 2.25, 4.3, 2, "config/settings.py", "Installed apps, database, templates. We edit it twice today.", C.accent2, { h: 0.85 });
  stepRow(s, 5.2, 3.2, 4.3, 3, "config/urls.py", "The table of contents for every address on the site.", C.accent2, { h: 0.85 });
  stepRow(s, 5.2, 4.15, 4.3, 4, "db.sqlite3", "SQLite: a whole database in one file. Nothing to install.", C.accent5, { h: 0.85 });

  // 20 startapp
  s = slide("CONTENT", "Step 2 · Create the reviewers app", "A project can hold many apps (a blog app, a shop app). Ours has one: reviewers. The most common beginner bug: forgetting to add it to INSTALLED_APPS. Do it now, together.");
  codeCard(s, 0.5, 1.3, 4.4, 1.5, "python manage.py startapp reviewers", { label: "terminal" });
  codeCard(s, 0.5, 2.95, 4.4, 2.05,
    "INSTALLED_APPS = [\n    \"django.contrib.admin\",\n    # ... built-ins ...\n    \"reviewers\",  # <-- add this!\n]",
    { label: "config/settings.py", fontSize: 12 });
  codeCard(s, 5.2, 1.3, 4.3, 3.7,
    "reviewers/\n├── models.py    # data (tables)\n├── views.py     # pages\n├── admin.py     # admin site\n├── urls.py      # (we add)\n├── forms.py     # (we add)\n├── ai.py        # (Part 4)\n├── tests.py     # checks\n├── templates/   # HTML\n└── migrations/  # DB history",
    { label: "the app folder", fontSize: 12 });

  // 21 Models
  s = slide("CONTENT", "Step 3 · Models: describe your data as a class", "Connect to 04_classes.py: same class idea, but models.Model gives it superpowers: save to the database, query, show in admin. Each attribute is a column. Type the Reviewer model together.");
  codeCard(s, 0.5, 1.3, 6.2, 3.3,
    "from django.db import models\n\nclass Reviewer(models.Model):\n    \"\"\"A quiz / study set.\"\"\"\n    title = models.CharField(max_length=200)\n    slug = models.SlugField(unique=True, blank=True)\n    description = models.TextField(blank=True)\n    created_at = models.DateTimeField(auto_now_add=True)\n\n    def __str__(self):\n        return self.title",
    { label: "reviewers/models.py" });
  await card(s, 6.9, 1.3, 2.6, 1.6, "class = table", "Reviewer becomes a table called reviewers_reviewer.", { color: C.accent5, bodySize: 13 });
  await card(s, 6.9, 3.05, 2.6, 1.55, "attribute = column", "CharField = short text, TextField = long text, DateTimeField = a timestamp.", { color: C.accent5, bodySize: 13 });
  tip(s, 0.5, 4.75, 9.0, "__str__ decides what the admin shows in lists. Without it you'd see 'Reviewer object (1)'.", { h: 0.4 });

  // 22a Relationships (picture)
  s = slide("CONTENT", "Relationships: a Reviewer has many Questions", "Draw the tree. A ForeignKey is the arrow: 'this Question belongs to that Reviewer'. on_delete=CASCADE: delete the reviewer, its questions go too. related_name lets us write reviewer.questions.all(). Then Choice points at Question the same way.");
  codeCard(s, 0.5, 1.3, 3.6, 2.4,
    "Reviewer\n ├── Question (MC)\n │    ├── Choice func\n │    ├── Choice def ✔\n │    └── Choice function\n └── Question (direct)\n      answer = \"length\"",
    { label: "the data tree", fontSize: 11 });
  tip(s, 0.5, 3.9, 3.6, "ForeignKey = 'belongs to'. One reviewer, many questions.", { h: 1.0, color: C.accent5 });
  stepRow(s, 4.5, 1.3, 5.0, 1, "One to many", "One Reviewer has many Questions; one Question has many Choices.", C.accent5, { h: 1.0 });
  stepRow(s, 4.5, 2.45, 5.0, 2, "The arrow lives on the 'many' side", "Question stores which Reviewer it belongs to: a ForeignKey column.", C.accent5, { h: 1.0 });
  stepRow(s, 4.5, 3.6, 5.0, 3, "Follow it both ways", "question.reviewer, and (via related_name) reviewer.questions.all().", C.accent5, { h: 1.0 });

  // 22b Relationships (code)
  s = slide("CONTENT", "The Question and Choice models", "Type these. Point at the three ForeignKey arguments: the target model, on_delete, related_name. status is the column that makes Part 4's drafts possible; mention it now, explain it later.");
  codeCard(s, 0.5, 1.3, 6.2, 3.7,
    "class Question(models.Model):\n    reviewer = models.ForeignKey(\n        Reviewer, on_delete=models.CASCADE,\n        related_name=\"questions\")\n    text = models.TextField()\n    question_type = models.CharField(\n        max_length=20, choices=Type.choices)\n    answer = models.CharField(max_length=300, blank=True)\n    status = models.CharField(   # draft / published\n        max_length=10, choices=Status.choices)\nclass Choice(models.Model):\n    question = models.ForeignKey(Question,\n        on_delete=models.CASCADE, related_name=\"choices\")\n    text = models.CharField(max_length=300)\n    is_correct = models.BooleanField(default=False)",
    { label: "reviewers/models.py" });
  stepRow(s, 6.9, 1.3, 2.6, 1, "ForeignKey(Reviewer, …)", "This Question belongs to that Reviewer.", C.accent5, { h: 1.0 });
  stepRow(s, 6.9, 2.4, 2.6, 2, "on_delete=CASCADE", "Delete the reviewer and its questions go too.", C.accent5, { h: 1.0 });
  stepRow(s, 6.9, 3.5, 2.6, 3, "related_name", "reviewer.questions.all() and question.choices.all().", C.accent5, { h: 1.1 });

  // 23 Migrations
  s = slide("CONTENT", "Step 4 · Migrations: turn models into tables", "Analogy: makemigrations writes down the change (a save file), migrate applies it to the database. Every time you edit models.py you run both. Show the generated 0001_initial.py: it's just Python describing tables.");
  await flow(s, 0.5, 1.4, 9.0, 1.0, [
    { label: "edit models.py", color: C.accent5 },
    { label: "makemigrations\nwrites the plan", color: C.accent2 },
    { label: "migrate\napplies it", color: C.accent2 },
    { label: "tables exist\nin db.sqlite3", color: C.accent3 },
  ], { fontSize: 12 });
  codeCard(s, 0.5, 2.65, 6.2, 2.35,
    "python manage.py makemigrations reviewers\n# Migrations for 'reviewers':\n#   0001_initial.py\n#     + Create model Reviewer\n#     + Create model Question\n#     + Create model Choice\npython manage.py migrate\n# Applying reviewers.0001_initial... OK",
    { label: "terminal", fontSize: 11 });
  bullets(s, 6.9, 2.7, 2.6, 2.3, [
    "Migrations are saved in reviewers/migrations/",
    "They are a history: teammates run migrate and get the same tables",
    "Changed a model? Run both commands again",
  ], { fontSize: 13 });

  // 24 Admin
  s = slide("CONTENT", "Step 5 · The free admin site", "This is the moment the room goes 'whoa'. Three lines in admin.py and we have full create/edit/delete pages. Create a superuser, log in at /admin/, create the Python Fundamentals reviewer with 2 questions. Inlines let us type choices right inside the question page.");
  codeCard(s, 0.5, 1.3, 5.5, 3.0,
    "from django.contrib import admin\nfrom .models import Choice, Question, Reviewer\n\nclass ChoiceInline(admin.TabularInline):\n    model = Choice\n    extra = 4      # 4 empty rows to fill\n\n@admin.register(Question)\nclass QuestionAdmin(admin.ModelAdmin):\n    inlines = [ChoiceInline]\nadmin.site.register(Reviewer)",
    { label: "reviewers/admin.py" });
  codeCard(s, 6.2, 1.3, 3.3, 1.5, "python manage.py \\\n  createsuperuser\n# then open /admin/", { label: "terminal", fontSize: 11 });
  await card(s, 6.2, 2.95, 3.3, 1.35, "Try it now", "Create a reviewer, add a multiple-choice question with 4 choices, tick the correct one.", { color: C.accent2, bodySize: 13 });
  tip(s, 0.5, 4.45, 9.0, "Zero HTML written and we can already put real data in. Django built those pages from our models.");

  // 25 URLs
  s = slide("CONTENT", "Step 6 · URLs: the menu of addresses", "config/urls.py hands everything to reviewers/urls.py with include(). <slug:slug> is a wildcard that captures part of the address and passes it to the view as an argument. name= lets templates build links without hard-coding paths.");
  codeCard(s, 0.5, 1.3, 4.6, 1.55,
    "urlpatterns = [\n    path(\"admin/\", admin.site.urls),\n    path(\"\", include(\"reviewers.urls\")),\n]",
    { label: "config/urls.py", fontSize: 11 });
  codeCard(s, 0.5, 2.95, 4.6, 2.1,
    "app_name = \"reviewers\"\nurlpatterns = [\n    path(\"\", views.reviewer_list,\n         name=\"list\"),\n    path(\"reviewer/<slug:slug>/\",\n         views.take, name=\"take\"),\n]",
    { label: "reviewers/urls.py", fontSize: 11 });
  stepRow(s, 5.4, 1.3, 4.1, 1, "path(\"pattern\", view, name=)", "When the address matches, call this view.", C.accent2, { h: 0.85 });
  stepRow(s, 5.4, 2.25, 4.1, 2, "<slug:slug>", "A blank to fill: /reviewer/python-basics/ sends slug=\"python-basics\".", C.accent2, { h: 0.85 });
  stepRow(s, 5.4, 3.2, 4.1, 3, "include()", "'For the rest, look in the app's own urls.py'.", C.accent2, { h: 0.85 });
  stepRow(s, 5.4, 4.15, 4.1, 4, "name=\"take\"", "Templates use {% url %} with this name, so paths can change safely.", C.accent2, { h: 0.85 });

  // 26 Views
  s = slide("CONTENT", "Step 7 · Views: a function per page", "Connect to the functions slide: request in, response out. Reviewer.objects.all() is the ORM: Python instead of SQL. render() = take this template, fill it with this data, return HTML. get_object_or_404 = a friendly 'not found' page instead of a crash.");
  codeCard(s, 0.5, 1.3, 6.2, 3.4,
    "from django.shortcuts import render, get_object_or_404\nfrom .models import Reviewer\n\ndef reviewer_list(request):\n    \"\"\"Home page: every reviewer.\"\"\"\n    reviewers = Reviewer.objects.all()\n    return render(request,\n                  \"reviewers/reviewer_list.html\",\n                  {\"reviewers\": reviewers})\n\ndef take(request, slug):\n    reviewer = get_object_or_404(Reviewer, slug=slug)\n    ...",
    { label: "reviewers/views.py", fontSize: 11 });
  stepRow(s, 6.9, 1.3, 2.6, 1, "request comes in", "Who asked, which method (GET/POST), what they typed.", C.accent2, { h: 0.85 });
  stepRow(s, 6.9, 2.25, 2.6, 2, "Ask the model", "Reviewer.objects.all() is Python that becomes SQL for you.", C.accent5, { h: 0.85 });
  stepRow(s, 6.9, 3.2, 2.6, 3, "render a template", "Template + data = HTML response.", C.accent1, { h: 0.85 });
  tip(s, 0.5, 4.8, 9.0, "The dictionary {\"reviewers\": reviewers} is called the context: the data the template can use.", { h: 0.38 });

  // 27 Templates
  s = slide("CONTENT", "Step 8 · Templates: HTML with blanks to fill", "{{ }} prints a value. {% %} does logic: loops, ifs, urls. extends base.html means 'use the shared frame, I only fill the content block'. Note the pico.css link in base.html: one line and everything looks decent.");
  codeCard(s, 0.5, 1.3, 6.2, 3.5,
    "{% extends \"base.html\" %}\n{% block content %}\n<h1>Reviewers</h1>\n\n{% for reviewer in reviewers %}\n  <article>\n    <strong>{{ reviewer.title }}</strong>\n    <p>{{ reviewer.description }}</p>\n    <a href=\"{% url 'reviewers:take' reviewer.slug %}\">\n      Take it\n    </a>\n  </article>\n{% endfor %}\n{% endblock %}",
    { label: "templates/reviewers/reviewer_list.html", fontSize: 11 });
  stepRow(s, 6.9, 1.3, 2.6, 1, "{{ variable }}", "Print a value from the context.", C.accent1, { h: 0.75 });
  stepRow(s, 6.9, 2.15, 2.6, 2, "{% for %} loop", "Repeat the HTML inside for each item.", C.accent1, { h: 0.75 });
  stepRow(s, 6.9, 3.0, 2.6, 3, "extends + block", "base.html holds the <head>, nav and styles once.", C.accent1, { h: 0.75 });
  stepRow(s, 6.9, 3.85, 2.6, 4, "{% url %}", "Builds the link from the URL's name.", C.accent1, { h: 0.75 });

  // 28 Checkpoint 1
  s = slide("CONTENT_DARK", "Checkpoint 1 · Your first page is live", "Everyone should see their reviewer on the home page. Pause 2 minutes, help stragglers. Recap the path: URL to view to model to template. Everything from here on is more of the same.");
  await flow(s, 0.5, 1.4, 9.0, 1.0, [
    { label: "/  (URL)", color: C.accent4, textColor: C.text1 },
    { label: "reviewer_list (view)", color: C.accent2 },
    { label: "Reviewer.objects.all()", color: C.accent5 },
    { label: "reviewer_list.html", color: C.accent1 },
  ], { fontSize: 12, dark: true });
  codeCard(s, 0.5, 2.7, 6.2, 2.3,
    "python manage.py runserver\n# http://127.0.0.1:8000/\n#\n#   Reviewers\n#   ┌──────────────────────────────────┐\n#   │ Python Fundamentals · 2 questions│\n#   │ [Take it] [Add questions]        │\n#   └──────────────────────────────────┘",
    { label: "browser", fontSize: 11 });
  s.addText(
    [
      { text: "You just used:", options: { bold: true, breakLine: true, fontSize: 16 } },
      { text: "a class (the model)", options: { bullet: true, breakLine: true } },
      { text: "a function (the view)", options: { bullet: true, breakLine: true } },
      { text: "a list and a for-loop (template)", options: { bullet: true, breakLine: true } },
      { text: "a dictionary (the context)", options: { bullet: true } },
    ],
    { x: 6.1, y: 2.7, w: 3.4, h: 2.3, fontSize: 14, color: C.background1, valign: "top", margin: 0, isTextBox: true, objectName: "recap" }
  );

  // 29 ORM cheat sheet
  s = slide("CONTENT", "Bonus: the ORM, talking to the database", "Optional if time is short. Open python manage.py shell and try these live. Point out that no SQL was written: the ORM translates. filter returns many, get returns one, and the related_name arrows work in both directions.");
  codeCard(s, 0.5, 1.3, 9.0, 3.2,
    "python manage.py shell\n\n>>> from reviewers.models import Reviewer, Question\n>>> r = Reviewer.objects.create(title=\"Django Basics\")   # INSERT\n>>> r.slug                                   # 'django-basics' (automatic)\n>>> Reviewer.objects.all()                   # SELECT * ...\n>>> Reviewer.objects.get(slug=\"django-basics\")   # exactly one\n>>> r.questions.all()                        # follow the ForeignKey backwards\n>>> Question.objects.filter(status=\"published\").count()   # WHERE ...\n>>> r.title = \"Django 101\"; r.save()        # UPDATE",
    { label: "terminal · the Django shell", fontSize: 11, lang: "python" });
  tip(s, 0.5, 4.65, 9.0, "ORM = Object-Relational Mapper. You think in objects, Django writes the SQL.", { color: C.accent5, h: 0.45 });

  // ======================= PART 3 =======================
  section("Part 3 · The quiz experience");

  s = slide("DIVIDER", null, "Thirty minutes. Now the app becomes something a friend can use: create a reviewer without the admin, add questions, open the link, answer, see a score.");
  s.addText("Part 3 · The quiz experience", { placeholder: "title" });
  s.addText("Forms · GET vs POST · shareable link · grading · results", { placeholder: "body" });

  // 31 Forms
  s = slide("CONTENT", "Step 9 · Forms: collect and check input", "A Django Form does three jobs: draws the inputs, validates them, gives clean Python values. ModelForm reads the fields from the model so we don't repeat ourselves. Highlight: validation happens on the server, always, no matter what the browser did.");
  codeCard(s, 0.5, 1.3, 6.2, 2.6,
    "from django import forms\nfrom .models import Reviewer\n\nclass ReviewerForm(forms.ModelForm):\n    \"\"\"Create a Reviewer from a title + description.\"\"\"\n    class Meta:\n        model = Reviewer\n        fields = [\"title\", \"description\"]",
    { label: "reviewers/forms.py" });
  stepRow(s, 6.9, 1.3, 2.6, 1, "Renders the inputs", "{{ form.as_div }} draws labels and boxes.", C.accent4, { h: 0.8 });
  stepRow(s, 6.9, 2.2, 2.6, 2, "Validates", "Required? Too long? Wrong type? form.is_valid() says.", C.accent4, { h: 0.8 });
  stepRow(s, 6.9, 3.1, 2.6, 3, "Gives clean data", "form.cleaned_data or form.save().", C.accent4, { h: 0.8 });
  tip(s, 0.5, 4.1, 9.0, "Rule of the day: never trust input. Not from humans, and (Part 4) not from AI either.", { color: C.accent6, h: 0.6 });

  // 32 GET vs POST
  s = slide("CONTENT", "GET vs POST: opening a page vs sending a form", "The single most important pattern in web development. GET = 'show me the form'. POST = 'here is what I typed'. After a successful POST we redirect so refresh doesn't resubmit. Students will reuse this pattern 4 times today.");
  await card(s, 0.5, 1.3, 2.9, 1.6, "GET", "The browser asks to SEE a page: an address, a link. Nothing changes.", { iconName: "FaEye", color: C.accent4, bodySize: 13 });
  await card(s, 0.5, 3.05, 2.9, 1.6, "POST", "The browser SENDS data: a form submit. The server may change something.", { iconName: "FaPaperPlane", color: C.accent2, bodySize: 13 });
  codeCard(s, 3.6, 1.3, 5.9, 3.65,
    "def reviewer_create(request):\n    if request.method == \"POST\":\n        form = ReviewerForm(request.POST)\n        if form.is_valid():\n            reviewer = form.save()\n            return redirect(\"reviewers:question_add\",\n                            slug=reviewer.slug)\n    else:\n        form = ReviewerForm()\n    return render(request,\n                  \"reviewers/reviewer_form.html\",\n                  {\"form\": form})",
    { label: "reviewers/views.py", fontSize: 11 });

  // 33 The form template
  s = slide("CONTENT", "The form template (and the mysterious csrf_token)", "csrf_token is a secret stamp proving the form came from OUR page, not a malicious site. Django refuses POSTs without it. Everyone forgets it once; now you know the error message. method=post is the other thing people forget.");
  codeCard(s, 0.5, 1.3, 6.2, 2.5,
    "{% extends \"base.html\" %}\n{% block content %}\n<h1>New reviewer</h1>\n<form method=\"post\">\n  {% csrf_token %}\n  {{ form.as_div }}\n  <button type=\"submit\">Create reviewer</button>\n</form>\n{% endblock %}",
    { label: "templates/reviewers/reviewer_form.html", fontSize: 11 });
  stepRow(s, 6.9, 1.3, 2.6, 1, "method=\"post\"", "Without it the form sends a GET and nothing saves.", C.accent4, { h: 0.85 });
  stepRow(s, 6.9, 2.25, 2.6, 2, "{% csrf_token %}", "A secret stamp. Django blocks POSTs that lack it (403 error).", C.accent6, { h: 0.85 });
  stepRow(s, 6.9, 3.2, 2.6, 3, "{{ form.as_div }}", "Django draws every field plus any error messages.", C.accent4, { h: 0.85 });
  tip(s, 0.5, 4.0, 5.3, "CSRF = Cross-Site Request Forgery. Big words, simple idea: prove the form is ours.", { h: 0.7 });

  // 34 Add question
  s = slide("CONTENT", "Step 10 · Adding a question and its choices", "This form creates two kinds of rows at once (a Question and up to 4 Choices), so it is a plain Form with a custom clean(). transaction.atomic = all or nothing. Students should add one MC and one direct question to their reviewer now.");
  codeCard(s, 0.5, 1.3, 6.2, 3.7,
    "class QuestionForm(forms.Form):\n    text = forms.CharField(widget=forms.Textarea)\n    question_type = forms.ChoiceField(\n        choices=Question.Type.choices)\n    answer = forms.CharField(required=False)\n    correct_choice = forms.TypedChoiceField(\n        choices=[(0,\"1\"),(1,\"2\"),(2,\"3\"),(3,\"4\")],\n        coerce=int, required=False)\n    def clean(self):  # choice_0..3 come from __init__\n        \"\"\"Rules that need several fields.\"\"\"\n        data = super().clean()\n        if data[\"question_type\"] == \"multiple_choice\":\n            if len(self.choice_texts()) < 2:\n                raise forms.ValidationError(\n                    \"Need at least two choices.\")",
    { label: "reviewers/forms.py", fontSize: 10.5 });
  stepRow(s, 6.9, 1.3, 2.6, 1, "Fields per input", "Each attribute becomes an <input>.", C.accent4, { h: 0.8 });
  stepRow(s, 6.9, 2.2, 2.6, 2, "clean() = house rules", "MC needs 2+ choices and a correct one; direct needs an answer.", C.accent4, { h: 0.9 });
  stepRow(s, 6.9, 3.2, 2.6, 3, "Save together", "with transaction.atomic(): question + choices, or nothing.", C.accent5, { h: 0.9 });
  tip(s, 6.9, 4.3, 2.6, "See views.question_add for the saving part.", { h: 0.6 });

  // 35 Shareable link
  s = slide("CONTENT", "Step 11 · A shareable link, no account needed", "The slug is generated in Reviewer.save(): slugify turns the title into URL-safe text, and a counter avoids duplicates. get_absolute_url is the one place that knows a reviewer's public address. Have students copy their link and send it to a neighbour.");
  codeCard(s, 0.5, 1.3, 6.2, 3.7,
    "from django.utils.text import slugify\n\n# inside class Reviewer(models.Model):\ndef save(self, *args, **kwargs):\n    if not self.slug:\n        base = slugify(self.title)  # Python Basics\n        slug = base                 # -> python-basics\n        n = 2\n        while Reviewer.objects.filter(slug=slug):\n            slug = f\"{base}-{n}\"; n += 1  # -2, -3\n        self.slug = slug\n    super().save(*args, **kwargs)\ndef get_absolute_url(self):\n    return reverse(\"reviewers:take\",\n                   kwargs={\"slug\": self.slug})",
    { label: "reviewers/models.py", fontSize: 10.5 });
  await card(s, 6.9, 1.3, 2.6, 1.9, "Why a slug?", ["Readable URLs", "Stable if the title changes", "No spaces or odd characters"], { iconName: "FaLink", color: C.accent4, bodySize: 12 });
  await card(s, 6.9, 3.35, 2.6, 1.25, "No login for takers", "The link IS the access. Simple for a public reviewer.", { color: C.accent2, bodySize: 13 });

  // 36 Take page
  s = slide("CONTENT", "Step 12 · The take page: radio buttons or a text box", "Loop the questions; an if inside the template chooses the input type. The input name q_<id> is the trick that lets the view match answers to questions. Note prefetch_related: fetch all choices in one query instead of one per question.");
  codeCard(s, 0.5, 1.3, 6.2, 3.7,
    "  {% for question in questions %}\n    <b>{{ forloop.counter }}. {{ question.text }}</b>\n    {% if question.is_multiple_choice %}\n      {% for choice in question.choices.all %}\n        <label>\n          <input type=\"radio\" name=\"q_{{ question.id }}\"\n                 value=\"{{ choice.id }}\" required>\n          {{ choice.text }}\n        </label>\n      {% endfor %}\n    {% else %}\n      <input type=\"text\" name=\"q_{{ question.id }}\"\n             required>\n    {% endif %}\n  {% endfor %}",
    { label: "templates/reviewers/take.html", fontSize: 10 });
  stepRow(s, 6.9, 1.3, 2.6, 1, "{% if %} in a template", "Multiple choice gets radios, direct gets a text box.", C.accent1, { h: 0.9 });
  stepRow(s, 6.9, 2.3, 2.6, 2, "name=\"q_{{ question.id }}\"", "Each answer is labelled with its question's id.", C.accent4, { h: 0.9 });
  stepRow(s, 6.9, 3.3, 2.6, 3, "Only published questions", "reviewer.published_questions hides AI drafts (Part 4).", C.accent3, { h: 0.9 });

  // 37a Grading: the model
  s = slide("CONTENT", "Step 13 · Grading: the model decides", "This is 03_if_and_functions.py living inside a model method. For MC we compare the chosen choice id; for direct we compare text ignoring case and spaces. The isdigit() guard is a real bug fix: a hand-edited form used to crash the page.");
  codeCard(s, 0.5, 1.3, 6.2, 3.3,
    "# inside class Question\ndef is_correct(self, submitted):\n    submitted = submitted.strip()\n    if self.is_multiple_choice:\n        if not submitted.isdigit():   # tampered form?\n            return False\n        return self.choices.filter(\n            pk=submitted, is_correct=True).exists()\n    answer = self.answer.casefold()\n    return submitted.casefold() == answer",
    { label: "reviewers/models.py" });
  stepRow(s, 6.9, 1.3, 2.6, 1, "Multiple choice", "Compare the chosen Choice id. Not a number? Simply wrong.", C.accent2, { h: 1.0 });
  stepRow(s, 6.9, 2.4, 2.6, 2, "Direct answer", ".strip() and .casefold(): 'Def ' equals 'def'.", C.accent2, { h: 1.0 });
  stepRow(s, 6.9, 3.5, 2.6, 3, "A method on the model", "Part 1's check_answer(), living where the data lives.", C.accent2, { h: 1.1 });
  tip(s, 0.5, 4.75, 6.2, "Never trust input: even a choice id can be edited in the browser.", { color: C.accent6, h: 0.4 });

  // 37b Grading: the view
  s = slide("CONTENT", "Step 13 · Grading: the view collects the answers", "The view reads request.POST['q_<id>'] for each question, asks is_correct, counts the Trues, and renders results.html. GET renders the take page; POST renders results: one URL, two outcomes.");
  codeCard(s, 0.5, 1.3, 6.2, 3.7,
    "def take(request, slug):\n    r = get_object_or_404(Reviewer, slug=slug)\n    questions = r.published_questions\n    if request.method == \"POST\":\n        results = []\n        for q in questions:\n            answer = request.POST.get(f\"q_{q.id}\", \"\")\n            results.append({\"question\": q,\n                \"correct\": q.is_correct(answer)})\n        score = sum(x[\"correct\"] for x in results)\n        return render(request, \"reviewers/results.html\",\n            {\"results\": results, \"score\": score,\n             \"total\": len(results)})\n    return render(request, \"reviewers/take.html\",\n        {\"reviewer\": r, \"questions\": questions})",
    { label: "reviewers/views.py" });
  stepRow(s, 6.9, 1.3, 2.6, 1, "request.POST.get(...)", "Find each answer by its question's id.", C.accent2, { h: 1.0 });
  stepRow(s, 6.9, 2.4, 2.6, 2, "Count the Trues", "sum() over the results: True counts as 1.", C.accent2, { h: 1.0 });
  stepRow(s, 6.9, 3.5, 2.6, 3, "Two renders", "POST → results.html, GET → take.html.", C.accent2, { h: 1.1 });

  // 38 Results + checkpoint 2
  s = slide("CONTENT_DARK", "Checkpoint 2 · Create, share, answer, score", "Have pairs swap links and take each other's reviewer. This is a complete product. Celebrate it. Then: 'writing good questions is the slow part… what if we had help?'");
  codeCard(s, 0.5, 1.3, 4.4, 3.0,
    "Your score: 2 / 3\n\n1. Which keyword defines a function?\n   ✔ Correct — def\n2. What does len() return?\n   ✔ Correct — length\n3. What is a Django model?\n   ✘ Not quite. Correct: a class\n      that becomes a database table\n\n[ Try again ]  [ All reviewers ]",
    { label: "results.html", fontSize: 11, lang: "plain" });
  await flow(s, 5.2, 1.4, 4.3, 0.8, [
    { label: "Create", color: C.accent1 },
    { label: "Share", color: C.accent4, textColor: C.text1 },
    { label: "Answer", color: C.accent5 },
    { label: "Score", color: C.accent3 },
  ], { fontSize: 11, dark: true });
  s.addText(
    [
      { text: "Swap links with a neighbour and take their reviewer.", options: { breakLine: true, paraSpaceAfter: 10 } },
      { text: "Everything so far is ordinary Django: models, forms, views, templates.", options: { breakLine: true, paraSpaceAfter: 10 } },
      { text: "Writing good questions is still slow and manual… let's get help.", options: { bold: true, color: C.accent3 } },
    ],
    { x: 5.2, y: 2.5, w: 4.3, h: 2.4, fontSize: 15, color: C.background1, valign: "top", margin: 0, isTextBox: true, objectName: "checkpoint text" }
  );

  // ======================= PART 4 =======================
  section("Part 4 · Add Generative AI");

  s = slide("DIVIDER", null, "Thirty minutes. The AI part is deliberately small in code and big in ideas: structured output, validation, drafts, human review. All the AI code is in one file: reviewers/ai.py.");
  s.addText("Part 4 · Add Generative AI", { placeholder: "title" });
  s.addText("Structured output · validation · drafts · human-in-the-loop", { placeholder: "body" });

  // 40 What is an AI API
  s = slide("CONTENT", "What is an AI API? Text in, text out", "Demystify: an API is a way for programs to talk to other programs over the internet. You send a request (a letter), you get a response (a reply). ChatGPT is a website on top of exactly this API. Our Django app will be the 'website' now.");
  await flow(s, 0.5, 1.4, 9.0, 1.1, [
    { label: "Your Python", color: C.accent1, iconName: "FaPython" },
    { label: "HTTPS request\n(the letter)", color: C.accent4, iconName: "FaEnvelope", textColor: C.text1 },
    { label: "OpenAI's model", color: C.accent3, iconName: "FaRobot" },
    { label: "HTTPS response\n(the reply)", color: C.accent4, iconName: "FaReply", textColor: C.text1 },
    { label: "Your Python", color: C.accent1, iconName: "FaPython" },
  ], { fontSize: 11 });
  codeCard(s, 0.5, 2.8, 6.2, 2.2,
    "from openai import OpenAI\nclient = OpenAI(api_key=\"sk-...\")   # from .env!\nreply = client.chat.completions.create(\n    model=\"gpt-4o-mini\",\n    messages=[{\"role\": \"user\",\n               \"content\": \"Write 3 Python questions\"}])\nprint(reply.choices[0].message.content)",
    { label: "the simplest possible call", fontSize: 11, lang: "python" });
  bullets(s, 6.9, 2.85, 2.6, 2.2, [
    "API: programs talking to programs",
    "Same skill as payments, maps, weather",
    "The openai SDK does the HTTP for us",
  ], { fontSize: 13 });

  // 41 Why not free text
  s = slide("CONTENT", "The problem with free text", "Show a messy free-text reply. How would code find 'the correct answer' in a paragraph? It can't, reliably. We need the AI to answer in a shape our program can read: the dictionaries and lists from Part 1. That shape, as text, is JSON.");
  codeCard(s, 0.5, 1.3, 3.9, 2.3,
    "Sure! Here are some questions:\n\nQ1: Which keyword defines a\nfunction? It's def, though some\nthink it's 'function'. Options...\n\n(Good luck parsing that.)",
    { label: "free text ✘", fontSize: 11 });
  codeCard(s, 4.6, 1.3, 4.9, 2.3,
    "{\"questions\": [\n  {\"type\": \"multiple_choice\",\n   \"question\": \"What makes a function?\",\n   \"choices\": [\n     {\"text\": \"def\", \"correct\": true},\n     {\"text\": \"func\", \"correct\": false}\n  ]}]}",
    { label: "structured JSON ✔", fontSize: 10.5 });
  await flow(s, 0.5, 3.85, 3.9, 0.7, [
    { label: "AI", color: C.accent3 },
    { label: "random text", color: C.accent6 },
    { label: "app breaks", color: C.accent6 },
  ], { fontSize: 11 });
  await flow(s, 4.6, 3.85, 4.9, 0.7, [
    { label: "AI", color: C.accent3 },
    { label: "JSON", color: C.accent4, textColor: C.text1 },
    { label: "validate", color: C.accent1 },
    { label: "database", color: C.accent5 },
  ], { fontSize: 11 });
  tip(s, 0.5, 4.7, 9.0, "JSON = JavaScript Object Notation. It is dictionaries and lists written as text. json.loads() turns it back into Python.", { h: 0.42 });

  // 42 Parameters
  s = slide("CONTENT", "Step 14 · What the creator asks for", "GenerateForm is guardrail number one. min/max on the fields mean nobody can ask for 10,000 questions or 150% multiple choice, and the check happens before we spend a single API call. Same Form idea as Part 3.");
  codeCard(s, 0.5, 1.3, 6.2, 3.2,
    "class GenerateForm(forms.Form):\n    topic = forms.CharField(max_length=120)\n    count = forms.IntegerField(\n        min_value=1, max_value=20, initial=5)\n    mc_percent = forms.IntegerField(\n        min_value=0, max_value=100, initial=60)\n    difficulty = forms.ChoiceField(choices=[\n        (\"beginner\", \"Beginner\"),\n        (\"intermediate\", \"Intermediate\"),\n        (\"advanced\", \"Advanced\"),\n    ])",
    { label: "reviewers/forms.py", fontSize: 11 });
  codeCard(s, 6.9, 1.3, 2.6, 1.9,
    "Topic: Django\nQuestions: 10\nMulti-choice: 60%\nDirect answer: 40%\nLevel: Beginner",
    { label: "example", fontSize: 11 });
  await card(s, 6.9, 3.35, 2.6, 1.5, "Guardrail #1", "Ranges are enforced BEFORE we call the AI. Cheap, instant, no surprises.", { color: C.accent6, bodySize: 13 });

  // 43 Prompt
  s = slide("CONTENT", "Step 15 · Writing the instructions (the prompt)", "A prompt is just strings we build with f-strings: Part 1 again. The system message sets the rules; the user message is this request. We compute the MC/direct split ourselves so the model gets exact numbers, not percentages.");
  codeCard(s, 0.5, 1.3, 6.2, 3.7,
    "def build_prompt(topic, count, mc_percent, difficulty):\n    mc_count = round(count * mc_percent / 100)\n    direct_count = count - mc_count\n    system = (\n        \"You write quiz questions for students. \"\n        \"Reply ONLY with JSON matching the schema. \"\n        \"MC: 4 choices, exactly one correct=true. \"\n        \"Direct: no choices, a short expected answer.\"\n    )\n    user = (f\"Topic: {topic}\\nDifficulty: {difficulty}\\n\"\n            f\"Create exactly {count} questions: \"\n            f\"{mc_count} multiple_choice and \"\n            f\"{direct_count} direct.\")\n    return [{\"role\": \"system\", \"content\": system},\n            {\"role\": \"user\", \"content\": user}]",
    { label: "reviewers/ai.py", fontSize: 10.5 });
  stepRow(s, 6.9, 1.3, 2.6, 1, "system", "The standing rules: who the model is and how to answer.", C.accent3, { h: 1.0, bodySize: 12 });
  stepRow(s, 6.9, 2.4, 2.6, 2, "user", "This particular request, built with f-strings.", C.accent3, { h: 1.0, bodySize: 12 });
  stepRow(s, 6.9, 3.5, 2.6, 3, "Be exact", "We do the math: '6 multiple_choice and 4 direct', not '60%'.", C.accent3, { h: 1.2, bodySize: 12 });

  // 44 Calling OpenAI with JSON schema
  s = slide("CONTENT", "Step 16 · Calling OpenAI and forcing JSON", "response_format with a JSON Schema is the key line: the model is constrained to our shape, so json.loads always works. We still wrap it in try/except: networks fail, keys expire, quotas run out. AIError is our own exception that the view turns into a friendly message.");
  codeCard(s, 0.5, 1.3, 6.2, 3.7,
    "SCHEMA = {\"name\": \"quiz_questions\", \"strict\": True,\n    \"schema\": {...}}  # questions: [{type, ...}]\ndef call_openai(messages):\n    client = OpenAI(api_key=settings.OPENAI_API_KEY)\n    try:\n        completion = client.chat.completions.create(\n            model=settings.OPENAI_MODEL,\n            messages=messages,\n            response_format={\n                \"type\": \"json_schema\",\n                \"json_schema\": SCHEMA})\n    except OpenAIError as exc:\n        raise AIError(f\"OpenAI request failed: {exc}\")\n    content = completion.choices[0].message.content\n    return json.loads(content)",
    { label: "reviewers/ai.py", fontSize: 10.5 });
  stepRow(s, 6.9, 1.3, 2.6, 1, "response_format", "'Answer in exactly this JSON shape.'", C.accent3, { h: 1.0, bodySize: 12 });
  stepRow(s, 6.9, 2.4, 2.6, 2, "try / except", "Networks fail. Catch it, explain it, don't crash.", C.accent6, { h: 1.0, bodySize: 12 });
  stepRow(s, 6.9, 3.5, 2.6, 3, "json.loads", "Text becomes dictionaries and lists (05_json_and_apis.py).", C.accent1, { h: 1.2, bodySize: 12 });

  // 45 Secrets
  s = slide("CONTENT", "Keep the key secret", "Non-negotiable. The key is money: anyone who has it can spend your credits. It lives in .env, which .gitignore keeps out of git, and settings.py reads it from the environment. Show how FAKE_AI switches on automatically when no key is present.");
  codeCard(s, 0.5, 1.3, 5.3, 1.3, "OPENAI_API_KEY=sk-...your-key...\nFAKE_AI=0", { label: ".env  (never committed)", fontSize: 11, lang: "bash" });
  codeCard(s, 0.5, 2.75, 5.3, 2.25,
    "load_dotenv(BASE_DIR / \".env\")\nenv = os.environ.get\nOPENAI_API_KEY = env(\"OPENAI_API_KEY\", \"\")\nOPENAI_MODEL = env(\"OPENAI_MODEL\",\n                   \"gpt-4o-mini\")\nFAKE_AI = (env(\"FAKE_AI\") == \"1\"\n           or not OPENAI_API_KEY)",
    { label: "config/settings.py", fontSize: 10.5 });
  await card(s, 6.1, 1.3, 3.4, 1.7, "Never in code, never in git", [".gitignore keeps .env out", ".env.example: shape, no values", "A leaked key costs money"], { iconName: "FaKey", color: C.accent6, bodySize: 12 });
  await card(s, 6.1, 3.15, 3.4, 1.85, "FAKE_AI mode", ["Same JSON shape as the real API", "Downstream code can't tell", "Workshops, tests, dead Wi-Fi"], { iconName: "FaPlug", color: C.accent3, bodySize: 12 });

  // 46 Validation
  s = slide("CONTENT", "Step 17 · Validate the AI's answer like any form", "Even with a schema, the content can be wrong: two correct choices, empty answers, 50 questions when we asked for 5. validate_questions checks every rule and raises AIError on the first problem. If anything fails, nothing is saved.");
  codeCard(s, 0.5, 1.3, 6.2, 3.7,
    "def validate_questions(data, requested_count):\n    questions = data[\"questions\"]   # count checked above\n    for i, item in enumerate(questions, start=1):\n        if item[\"type\"] not in ALLOWED_TYPES:\n            raise AIError(f\"Q{i}: unknown type\")\n        if not item[\"question\"].strip():\n            raise AIError(f\"Q{i}: empty text\")\n        if item[\"type\"] == \"multiple_choice\":\n            correct = [c for c in item[\"choices\"]\n                       if c[\"correct\"]]\n            if len(correct) != 1:\n                raise AIError(f\"Q{i}: need 1 correct\")\n        elif not item[\"answer\"].strip():\n            raise AIError(f\"Q{i}: missing answer\")\n    return clean_list",
    { label: "reviewers/ai.py  (shortened)", fontSize: 10 });
  bullets(s, 6.9, 1.3, 2.6, 3.0, [
    { text: "Count ≤ what was requested", bold: false },
    "Type is one we know",
    "Question text not empty, not huge",
    "MC: 2 to 6 choices, exactly one correct",
    "Direct: has an answer",
    { text: "Any failure = reject ALL, save nothing", bold: true, color: C.accent6 },
  ], { fontSize: 13, spacing: 6 });
  tip(s, 6.9, 4.4, 2.6, "Never assume AI output is valid application data.", { color: C.accent6, h: 0.6 });

  // 47 Drafts & human in the loop
  s = slide("CONTENT", "Step 18 · Drafts: the AI proposes, a human decides", "This is the design idea to take home. Valid is not the same as good. AI questions are saved with status=draft and ai_generated=True; the take page filters them out until a person publishes them. One extra column buys you safety.");
  await flow(s, 0.5, 1.3, 9.0, 0.8, [
    { label: "AI JSON", color: C.accent3 },
    { label: "validate", color: C.accent1 },
    { label: "save as DRAFT", color: C.accent5 },
    { label: "human reviews", color: C.accent2, iconName: "FaUserCheck" },
    { label: "PUBLISHED", color: C.accent3, iconName: "FaCheck" },
  ], { fontSize: 11 });
  codeCard(s, 0.5, 2.3, 6.2, 2.75,
    "@transaction.atomic   # all or nothing\ndef save_as_drafts(reviewer, questions):\n    for item in questions:\n        q = Question.objects.create(\n            reviewer=reviewer, text=item[\"question\"],\n            question_type=item[\"type\"],\n            status=Question.Status.DRAFT,  # hidden!\n        )\n        for c in item.get(\"choices\", []):\n            Choice.objects.create(question=q, **c)",
    { label: "reviewers/ai.py", fontSize: 10 });
  await card(s, 6.9, 2.3, 2.6, 2.75, "Why drafts?", ["Valid JSON can still be a bad question", "The creator knows the students", "A wrong key teaches the wrong thing", "Accept the good, reject the rest"], { color: C.accent2, bodySize: 12 });

  // 48 Generate view
  s = slide("CONTENT", "Step 19 · The generate view", "Same GET/POST pattern as Part 3. generate_questions chains prompt, call (or fake), validate, save. AIError becomes a red message; success redirects to the review page. Students: open /reviewer/<slug>/generate/ and try it with FAKE_AI=1.");
  codeCard(s, 0.5, 1.3, 6.2, 3.7,
    "def generate(request, slug):\n    reviewer = get_object_or_404(Reviewer, slug=slug)\n    form = GenerateForm(request.POST or None)\n    if request.method == \"POST\" and form.is_valid():\n        d = form.cleaned_data\n        try:\n            n = generate_questions(reviewer, **d)\n        except AIError as exc:\n            messages.error(request, f\"AI error: {exc}\")\n        else:\n            return redirect(\"reviewers:review_drafts\",\n                            slug=slug)\n    return render(request, \"reviewers/generate.html\",\n                  {\"form\": form})",
    { label: "reviewers/views.py  (compact version)", fontSize: 10 });
  stepRow(s, 6.9, 1.3, 2.6, 1, "form.is_valid()", "Guardrail #1, before any API call.", C.accent1, { h: 0.85, bodySize: 12 });
  stepRow(s, 6.9, 2.2, 2.6, 2, "generate_questions()", "prompt → AI → validate → drafts, all in ai.py.", C.accent3, { h: 0.85, bodySize: 12 });
  stepRow(s, 6.9, 3.1, 2.6, 3, "except AIError", "Bad reply? Red message, nothing saved.", C.accent6, { h: 0.85, bodySize: 12 });
  await card(s, 6.9, 4.0, 2.6, 1.0, "Try it", "5 questions, 60% multiple choice, beginner.", { color: C.accent3, bodySize: 12, titleSize: 13 });

  // 49a Review page (what the creator sees)
  s = slide("CONTENT", "Step 20 · The review page: accept or reject", "Two submit buttons in one form, told apart by name=action. Every draft starts ticked; untick the bad ones, then Accept or Reject. After this the accepted questions appear on the take page like any other.");
  codeCard(s, 0.5, 1.3, 3.9, 3.7,
    "AI drafts · Python Fundamentals\n\n☑ What is a Django model?\n    ✔ class that becomes a table\n☑ Which command runs the server?\n    ✔ python manage.py runserver\n☐ What does the interpreter do?\n    (too vague — reject)\n☑ What is a Django view?\n    expected: a function that\n    returns a response\n\n[ Accept selected ]\n[ Reject selected ]",
    { label: "review_drafts.html", fontSize: 11, lang: "plain" });
  stepRow(s, 4.7, 1.3, 4.8, 1, "Tick what you like", "Each draft is a checkbox named question_ids, pre-ticked.", C.accent3, { h: 1.0 });
  stepRow(s, 4.7, 2.45, 4.8, 2, "Two buttons, one form", "Both submit; name=\"action\" carries accept or reject.", C.accent3, { h: 1.0 });
  stepRow(s, 4.7, 3.6, 4.8, 3, "Publish or delete", "Accepted drafts become published; rejected ones are gone.", C.accent3, { h: 1.0 });

  // 49b Review view (the code)
  s = slide("CONTENT", "Step 20 · The review view", "getlist reads every ticked checkbox. update() publishes in one query; delete() removes rejects. Redirect after POST so a refresh never repeats the action.");
  codeCard(s, 0.5, 1.3, 6.2, 3.7,
    "def review_drafts(request, slug):\n    reviewer = get_object_or_404(Reviewer, slug=slug)\n    drafts = reviewer.draft_questions\n    if request.method == \"POST\":\n        ids = request.POST.getlist(\"question_ids\")\n        selected = drafts.filter(pk__in=ids)\n        if request.POST.get(\"action\") == \"accept\":\n            selected.update(\n                status=Question.Status.PUBLISHED)\n        elif request.POST.get(\"action\") == \"reject\":\n            selected.delete()\n        return redirect(request.path)  # reload\n    return render(request,\n        \"reviewers/review_drafts.html\",\n        {\"reviewer\": reviewer, \"drafts\": drafts})",
    { label: "reviewers/views.py" });
  stepRow(s, 6.9, 1.3, 2.6, 1, "getlist()", "Every ticked checkbox, as a list of ids.", C.accent3, { h: 1.0 });
  stepRow(s, 6.9, 2.4, 2.6, 2, "update() vs delete()", "One query each; published rows are never touched.", C.accent3, { h: 1.0 });
  stepRow(s, 6.9, 3.5, 2.6, 3, "Redirect after POST", "A refresh never repeats the action.", C.accent3, { h: 1.1 });

  // 50 Guardrails checklist
  s = slide("CONTENT", "Guardrails checklist: what protects this app", "Read through quickly; each item maps to code they have seen. The message: AI features are ordinary software engineering with one new untrusted input. Validation, limits, drafts and secrets handling are the whole story.");
  const guards = [
    ["Form ranges", "1 to 20 questions, 0 to 100 percent", "FaSlidersH", C.accent1],
    ["Structured output", "JSON Schema fixes the reply's shape", "FaCode", C.accent3],
    ["Content validation", "One correct choice, non-empty answers", "FaShieldAlt", C.accent6],
    ["Reject, don't repair", "Invalid reply dropped whole; nothing saved", "FaTimes", C.accent6],
    ["Drafts by default", "AI text stays hidden until a human accepts", "FaUserCheck", C.accent2],
    ["Secrets in .env", "Key never in code or git; offline fallback", "FaKey", C.accent5],
  ];
  for (let i = 0; i < guards.length; i++) {
    const [t, b, ic, col] = guards[i];
    const col_ = i % 2, row = Math.floor(i / 2);
    await card(s, 0.5 + col_ * 4.6, 1.3 + row * 1.25, 4.4, 1.12, t, b, { iconName: ic, color: col, bodySize: 12, titleSize: 13 });
  }

  // 51 Architecture recap
  s = slide("CONTENT_DARK", "The whole AI feature on one slide", "Trace it top to bottom one more time. Then ask: where would you add a guardrail if the AI started returning offensive questions? (Answer: a content check in validate_questions, or a moderation call.) That is how real teams think about it.");
  const steps = [
    ["Creator fills GenerateForm", "topic · count · % · difficulty", C.accent1],
    ["Django builds the prompt", "build_prompt() with f-strings", C.accent2],
    ["OpenAI returns JSON", "response_format = json_schema", C.accent3],
    ["Django validates", "validate_questions() or AIError", C.accent6],
    ["Saved as drafts", "status = draft, ai_generated = True", C.accent5],
    ["Human accepts or rejects", "review_drafts view", C.accent2],
    ["Published reviewer", "visible on /reviewer/<slug>/", C.accent3],
  ];
  for (let i = 0; i < steps.length; i++) {
    const [t, b, col] = steps[i];
    const y = 1.3 + i * 0.52;
    s.addShape(pres.ShapeType.ellipse, { x: 0.6, y: y + 0.06, w: 0.36, h: 0.36, fill: { color: col }, line: { color: col, width: 0 }, objectName: `arch badge ${i}` });
    s.addText(String(i + 1), { x: 0.6, y: y + 0.06, w: 0.36, h: 0.36, fontSize: 12, bold: true, color: C.text1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: `arch badge text ${i}` });
    s.addText([{ text: t, options: { bold: true, color: C.background1 } }, { text: "   " + b, options: { color: C.accent4, fontSize: 12 } }],
      { x: 1.15, y, w: 5.0, h: 0.48, fontSize: 14, valign: "middle", margin: 0, isTextBox: true, objectName: `arch step ${i}` });
    if (i < steps.length - 1) s.addShape(pres.ShapeType.line, { x: 0.78, y: y + 0.42, w: 0, h: 0.16, line: { color: C.accent4, width: 1.5 }, objectName: `arch line ${i}` });
  }
  codeCard(s, 6.4, 1.3, 3.1, 3.6,
    "Python app\n   │\n   ▼\nAI API\n   │  structured\n   ▼\nvalidation\n   │\n   ▼\nhuman review\n   │\n   ▼\napplication data",
    { label: "the pattern", fontSize: 11 });

  // ======================= CLOSING =======================
  section("Closing");

  // 52 What you learned
  s = slide("CONTENT", "What you learned today", "Point back to the three columns from slide 2. Everything on this slide was typed by them in the last two hours. Encourage them to keep the repo and read the comments: every file and function says what it is for.");
  await card(s, 0.5, 1.3, 2.85, 3.6, "Python", ["Variables, strings, numbers", "Lists and dictionaries", "if / else, functions", "Classes and objects", "venv and pip", "JSON"], { iconName: "FaPython", color: C.accent1, bodySize: 13 });
  await card(s, 3.575, 1.3, 2.85, 3.6, "Django", ["Project and app structure", "Models, ForeignKey, migrations", "Admin site", "URLs, views, templates", "Forms and validation", "GET vs POST, CSRF"], { iconName: "FaCubes", color: C.accent2, bodySize: 13 });
  await card(s, 6.65, 1.3, 2.85, 3.6, "Generative AI", ["Calling an API from Python", "Prompts as code", "Structured (JSON) output", "Validating AI output", "Drafts and human review", "Keeping secrets secret"], { iconName: "FaRobot", color: C.accent3, bodySize: 13 });

  // 53 Ideas to extend
  s = slide("CONTENT", "Where to take it next", "Give them homework ideas sorted by difficulty. The best one for learning Django deeper is accounts (django.contrib.auth is already installed). The best one for AI is swapping providers: the pattern is identical.");
  stepRow(s, 0.5, 1.3, 4.3, 1, "Add accounts", "Only the creator can edit their reviewers. django.contrib.auth is already installed.", C.accent2, { h: 0.9 });
  stepRow(s, 0.5, 2.3, 4.3, 2, "Save attempts and a leaderboard", "A new Attempt model with a ForeignKey to Reviewer. Models, migrate, done.", C.accent5, { h: 0.9 });
  stepRow(s, 0.5, 3.3, 4.3, 3, "Timer and shuffled choices", "A little JavaScript in take.html, random.shuffle in the view.", C.accent4, { h: 0.9 });
  stepRow(s, 5.2, 1.3, 4.3, 4, "AI explanations for wrong answers", "Same pattern: prompt, structured reply, validate, show.", C.accent3, { h: 0.9 });
  stepRow(s, 5.2, 2.3, 4.3, 5, "Swap the AI provider", "Claude, Gemini, a local model: only call_openai() changes.", C.accent3, { h: 0.9 });
  stepRow(s, 5.2, 3.3, 4.3, 6, "Deploy it", "Railway, Render or Fly.io run Django for free-ish. Set DEBUG=False first!", C.accent1, { h: 0.9 });
  tip(s, 0.5, 4.4, 9.0, "Don't just use AI tools. Build applications that use AI.", { color: C.accent3, h: 0.55 });

  // 54 Thank you
  s = slide("TITLE_DARK", null, "Thank them. Share the repo link and your contact. Stay around for questions and help people who want to finish.");
  s.addText("Salamat! Keep building.", { placeholder: "title" });
  s.addShape(pres.ShapeType.roundRect, { x: 1.73, y: 3.27, w: 5.6, h: 0.42, rectRadius: 0.08, fill: { color: C.text1 }, line: { color: C.text1, width: 0 }, objectName: "repo pill" });
  s.addText("github.com/73R3WY/pycon-davao-2026", { x: 1.85, y: 3.27, w: 5.5, h: 0.42, fontSize: 15, bold: true, color: "FEF9D7", fontFace: CODE_FONT, valign: "middle", margin: 0, isTextBox: true, objectName: "repo text" });
  s.addText("All code, comments and slides · Questions welcome", { placeholder: "body" });

  const out = path.join(__dirname, "Jeremy Patrick Pacabis - From Python to AI-Powered Django_ Build a Quiz & Reviewer App.pptx");
  await pres.writeFile({ fileName: out });
  // Append the organizers' 7 reference pages (layout samples, branding, assets) as hidden slides.
  require("child_process").execFileSync("python3", [path.join(__dirname, "merge_template_slides.py"), out, path.join(__dirname, "template", "pycon-davao-2026-template.pptx")], { stdio: "inherit" });
  console.log("wrote", out);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
