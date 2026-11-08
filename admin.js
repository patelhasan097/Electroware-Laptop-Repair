// ============================================================
// admin.js: Admin Panel (login, editors, draft / preview / publish)
// ============================================================
import {
  watchAuth,
  adminLogin,
  adminLogout,
  friendlyAuthError,
  isFirebaseConfigured
} from "./firebase.js";
import {
  escapeHtml,
  safeUrl,
  isHexColor,
  makeId,
  cloneContent,
  deepMerge,
  DEFAULT_CONTENT,
  ICON_KEYS,
  THEME_PRESETS,
  FONT_CHOICES,
  SECTION_ORDER,
  SECTION_LABELS,
  STAGE_PARTS,
  loadDraft,
  saveDraft,
  publish,
  getWorkflowStatus,
  checkAdminAccess
} from "./content.js";

const e = escapeHtml;
const MAX_ITEMS = 40;
const BACKUP_KEY = "ew-admin-backup-v1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const IMG_NOTE =
  "Paste a direct, public image link (starting with https://). A preview appears below so you can check it. " +
  "Uploading a photo from your phone or computer gallery needs an image storage service, which is not part of this version.";

const TABS = [
  ["dashboard", "Dashboard"],
  ["hero", "Hero"],
  ["about", "About"],
  ["services", "Services"],
  ["expertise", "Expertise"],
  ["whyUs", "Why Us"],
  ["gallery", "Gallery"],
  ["process", "Process"],
  ["testimonials", "Testimonials"],
  ["contact", "Contact"],
  ["branding", "Logo & Footer"],
  ["studio", "Design Studio"],
  ["layout", "Sections & Order"]
];

const COLOR_FIELDS = [
  ["accent", "Main accent"],
  ["accent2", "Second accent"],
  ["bg", "Page background"],
  ["surface", "Cards and panels"],
  ["text", "Text on dark"],
  ["paper", "Light sections"],
  ["ink", "Text on light"],
  ["laptopColor", "3D laptop body"]
];

const REVEAL_OPTIONS = [["rise", "Rise up (default)"], ["fade", "Soft fade"], ["zoom", "Zoom in"], ["none", "No animation"]];
const CORNER_OPTIONS = [["sharp", "Sharp (engineered)"], ["soft", "Soft (friendly)"], ["round", "Round (playful)"]];
const DENSITY_OPTIONS = [["low", "Low (fastest)"], ["medium", "Medium"], ["high", "High (richest)"]];

const TITLE_FIELD = { key: "title", type: "text", label: "Title" };
const DESC_FIELD = { key: "description", type: "area", label: "Description" };

// Har list-section ka schema: naye item ki shape aur editor fields
const LISTS = {
  services: {
    prefix: "svc", noun: "service", liveKey: "title",
    fields: [
      TITLE_FIELD,
      DESC_FIELD,
      {
        key: "imageUrl", type: "image", label: "Photo (optional)",
        hint: "Shown beside the services list on devices without 3D, or when 3D is switched off."
      },
      {
        key: "part", type: "select", label: "Part of the 3D laptop that lights up", options: STAGE_PARTS,
        hint: "When a visitor points at this service, this part of the 3D laptop glows. Automatic picks a sensible part."
      }
    ],
    blank: () => ({ icon: "wrench", part: "auto", title: "New service", description: "", imageUrl: "" })
  },
  expertise: {
    prefix: "exp", noun: "skill", liveKey: "title",
    fields: [TITLE_FIELD, DESC_FIELD],
    blank: () => ({ title: "New skill", description: "" })
  },
  whyUs: {
    prefix: "why", noun: "reason", liveKey: "title",
    fields: [TITLE_FIELD, DESC_FIELD],
    blank: () => ({ title: "New reason", description: "" })
  },
  process: {
    prefix: "pro", noun: "step", liveKey: "title",
    fields: [TITLE_FIELD, DESC_FIELD],
    blank: () => ({ title: "New step", description: "" })
  },
  gallery: {
    prefix: "gal", noun: "image", liveKey: "caption",
    fields: [
      { key: "imageUrl", type: "image", label: "After photo (the finished repair)", hint: "This is the main photo. It is required for the item to appear." },
      { key: "beforeUrl", type: "image", label: "Before photo (optional)", hint: "Add this to show a drag slider that compares before and after." },
      { key: "caption", type: "text", label: "Caption (optional)" }
    ],
    blank: () => ({ imageUrl: "", beforeUrl: "", caption: "" })
  },
  testimonials: {
    prefix: "tes", noun: "testimonial", liveKey: "name",
    fields: [
      { key: "text", type: "area", label: "Testimonial text" },
      { key: "name", type: "text", label: "Customer name" },
      { key: "role", type: "text", label: "Role or detail (optional)" }
    ],
    blank: () => ({ text: "", name: "", role: "" })
  }
};

const LIST_PAGES = {
  services: { title: "Services", add: "Add service", intro: "Every service is shown equally on the website, in the order below." },
  expertise: { title: "Technical Expertise", add: "Add skill", intro: "The skills behind your repairs." },
  whyUs: { title: "Why Choose Us", add: "Add reason", intro: "Short reasons customers should choose you." },
  process: { title: "Repair Process", add: "Add step", intro: "Steps are numbered automatically." },
  gallery: {
    title: "Repair Gallery", add: "Add image",
    intro: "Add your own repair photos by pasting public image links. Add a before photo too and visitors get a drag slider. The Gallery section stays hidden on the website while it has no images.",
    note: IMG_NOTE
  },
  testimonials: {
    title: "Testimonials", add: "Add testimonial",
    intro: "The Testimonials section stays hidden while this list is empty.",
    warn: "Only add real testimonials from real customers, with their permission."
  }
};

// ------------------------------------------------------------
// Module state (mountAdmin har baar naya state banata hai)
// ------------------------------------------------------------
let root = null;
let iconSvg = () => "";
let state = null;
let mounted = false;
let unsubAuth = null;
let authSeq = 0;
let idn = 0;
let backupTimer = null;
const cleanups = [];
const timers = new Set();

const nid = () => "f" + ++idn;
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

// ------------------------------------------------------------
// Path helpers: "services.2.title" jaise paths se content padho / likho
// ------------------------------------------------------------
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function splitPath(path) {
  return String(path).split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p));
}

function getPath(obj, path) {
  return splitPath(path).reduce((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);
}

function setPath(obj, path, value) {
  const keys = splitPath(path);
  if (keys.some((k) => BAD_KEYS.has(k))) return;
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] === undefined || o[keys[i]] === null) {
      o[keys[i]] = typeof keys[i + 1] === "number" ? [] : {};
    }
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
}

const val = (path) => getPath(state.content, path);

// ------------------------------------------------------------
// Small UI helpers
// ------------------------------------------------------------
function listen(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  cleanups.push(() => target.removeEventListener(type, fn, opts));
}

function later(fn, ms) {
  const t = setTimeout(() => {
    timers.delete(t);
    fn();
  }, ms);
  timers.add(t);
  return t;
}

function toast(message, tone = "info", ms = 4500) {
  const box = document.getElementById("a-toasts");
  if (!box) return;
  const el = document.createElement("div");
  el.className = `a-toast a-toast--${tone}`;
  el.setAttribute("role", tone === "error" ? "alert" : "status");
  el.textContent = message;
  box.appendChild(el);
  later(() => el.remove(), ms);
}

function fmtDate(ms) {
  if (!ms) return "recently";
  try {
    return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch (err) {
    return new Date(ms).toLocaleString();
  }
}

function friendlyError(err) {
  const code = err && err.code ? String(err.code) : "";
  if (code === "permission-denied") {
    return "Permission denied. This account is not in the admin allowlist in firestore.rules, or the rules have not been published yet.";
  }
  if (code === "unavailable" || code === "deadline-exceeded" || code === "network-request-failed") {
    return "Network problem. Check your internet connection and try again.";
  }
  if (code === "resource-exhausted") return "The free Firebase quota is used up for now. Please try again later.";
  if (code === "unauthenticated") return "Your login expired. Please sign in again.";
  return (err && err.message) || "Something went wrong. Please try again.";
}

// ------------------------------------------------------------
// Field builders (sab fields data-path se content se jude hain)
// ------------------------------------------------------------
function hintHtml(text) {
  return text ? `<p class="a-hint">${e(text)}</p>` : "";
}

function fText(label, path, o = {}) {
  const id = nid();
  return `<div class="a-field">
    <label class="a-label" for="${id}">${e(label)}</label>
    <input class="a-input" id="${id}" type="${o.type || "text"}" data-path="${e(path)}" value="${e(val(path))}"
      ${o.placeholder ? `placeholder="${e(o.placeholder)}"` : ""} ${o.maxlength ? `maxlength="${o.maxlength}"` : ""}
      ${o.inputmode ? `inputmode="${o.inputmode}"` : ""} autocomplete="off" spellcheck="${o.type ? "false" : "true"}">
    ${hintHtml(o.hint)}
  </div>`;
}

function fArea(label, path, o = {}) {
  const id = nid();
  return `<div class="a-field">
    <label class="a-label" for="${id}">${e(label)}</label>
    <textarea class="a-textarea" id="${id}" rows="${o.rows || 3}" data-path="${e(path)}">${e(val(path))}</textarea>
    ${hintHtml(o.hint)}
  </div>`;
}

// Array of strings ko textarea mein dikhata hai. type = "lines" (har line ek item) ya "paras" (khaali line se alag)
function fList(label, path, type, o = {}) {
  const id = nid();
  const arr = Array.isArray(val(path)) ? val(path) : [];
  return `<div class="a-field">
    <label class="a-label" for="${id}">${e(label)}</label>
    <textarea class="a-textarea" id="${id}" rows="${o.rows || 4}" data-path="${e(path)}" data-type="${type}">${e(arr.join(type === "paras" ? "\n\n" : "\n"))}</textarea>
    ${hintHtml(o.hint)}
  </div>`;
}

function fImage(label, path, o = {}) {
  const id = nid();
  return `<div class="a-field">
    <label class="a-label" for="${id}">${e(label)}</label>
    <input class="a-input" id="${id}" type="url" data-path="${e(path)}" data-img="1" value="${e(val(path))}"
      ${o.fallback ? `data-fallback="${e(o.fallback)}"` : ""} placeholder="https://example.com/photo.jpg" autocomplete="off" spellcheck="false">
    <div class="a-imgprev" data-state="empty"><img alt="" referrerpolicy="no-referrer"><span class="a-imgprev__msg">No image yet</span></div>
    <div class="a-imgtools"><button class="a-btn" type="button" data-action="clear-field" data-target="${e(path)}">Clear</button></div>
    ${hintHtml(o.hint)}
  </div>`;
}

function fIcon(label, path) {
  const id = nid();
  const current = val(path) || "spark";
  const keys = ICON_KEYS.includes(current) ? ICON_KEYS : [current, ...ICON_KEYS];
  return `<div class="a-field">
    <label class="a-label" for="${id}">${e(label)}</label>
    <div class="a-iconpick">
      <span class="a-iconpick__prev">${iconSvg(current)}</span>
      <select class="a-select" id="${id}" data-path="${e(path)}" data-type="icon">
        ${keys.map((k) => `<option value="${e(k)}" ${k === current ? "selected" : ""}>${e(cap(k))}</option>`).join("")}
      </select>
    </div>
  </div>`;
}

function fCheck(label, path, hint) {
  return `<label class="a-check">
    <input type="checkbox" data-path="${e(path)}" data-type="bool" ${val(path) ? "checked" : ""}>
    <span><strong>${e(label)}</strong>${hint ? `<small>${e(hint)}</small>` : ""}</span>
  </label>`;
}

function fColor(label, path) {
  const id = nid();
  const raw = val(path);
  const v = isHexColor(raw) ? raw.trim() : "#000000";
  return `<div class="a-field a-colorfield">
    <label class="a-label" for="${id}">${e(label)}</label>
    <div class="a-colorrow">
      <input class="a-color" id="${id}" type="color" data-path="${e(path)}" data-type="color" value="${e(v)}">
      <code>${e(v.toUpperCase())}</code>
    </div>
  </div>`;
}

function fSelect(label, path, options, o = {}) {
  const id = nid();
  const cur = String(val(path) ?? options[0][0]);
  return `<div class="a-field">
    <label class="a-label" for="${id}">${e(label)}</label>
    <select class="a-select" id="${id}" data-path="${e(path)}">
      ${options.map(([v, l]) => `<option value="${e(v)}" ${v === cur ? "selected" : ""}>${e(l)}</option>`).join("")}
    </select>
    ${hintHtml(o.hint)}
  </div>`;
}

function fRange(label, path, o) {
  const id = nid();
  const n = Number(val(path));
  const v = Number.isFinite(n) ? n : o.def;
  return `<div class="a-field a-rangefield">
    <label class="a-label" for="${id}">${e(label)}<output data-out>${v.toFixed(o.dec ?? 2)}</output></label>
    <input class="a-range" id="${id}" type="range" min="${o.min}" max="${o.max}" step="${o.step}" value="${v}" data-path="${e(path)}" data-type="number" data-dec="${o.dec ?? 2}">
    ${hintHtml(o.hint)}
  </div>`;
}

function card(title, body) {
  return `<section class="a-card">${title ? `<h3>${e(title)}</h3>` : ""}${body}</section>`;
}

function page(title, intro, body) {
  return `<div class="a-page"><div class="a-page__head"><h2>${e(title)}</h2>${intro ? `<p class="a-muted">${e(intro)}</p>` : ""}</div>${body}</div>`;
}

function noteBox(text, warn) {
  return `<div class="a-note${warn ? " a-note--warn" : ""}">${e(text)}</div>`;
}

function sectionHeadingCard(key) {
  return card(
    "Section heading",
    fText("Small label", `sections.${key}.eyebrow`) +
      fText("Title", `sections.${key}.title`) +
      fArea("Sub-title (optional)", `sections.${key}.subtitle`, { rows: 2 })
  );
}

// ------------------------------------------------------------
// Views
// ------------------------------------------------------------
function healthNotes(c) {
  const notes = [];
  if (!String(c.contact.phone || "").trim() && !String(c.contact.whatsapp || "").trim()) {
    notes.push("No phone or WhatsApp number added yet. Add real contact details in Contact.");
  }
  if (!(c.gallery || []).some((g) => String(g.imageUrl || "").trim())) {
    notes.push("The Gallery has no images, so that section is hidden. Add photos of your own repairs there. The photos in the hero and About sections are stock photography.");
  }
  if (!(c.testimonials || []).some((t) => String(t.text || "").trim())) {
    notes.push("There are no testimonials, so that section is hidden. Only add real testimonials from real customers.");
  }
  return notes;
}

function stat(label, value) {
  return `<div class="a-stat" data-atilt><strong data-count="${Number(value) || 0}">${value}</strong><span>${e(label)}</span></div>`;
}

function viewDashboard() {
  const c = state.content;
  const s = state.status;
  const galleryCount = (c.gallery || []).filter((g) => String(g.imageUrl || "").trim()).length;
  const testiCount = (c.testimonials || []).filter((t) => String(t.text || "").trim()).length;
  const notes = healthNotes(c);

  let live = "Checking…";
  let draft = "Checking…";
  if (state.statusError) {
    live = "Could not load status";
    draft = "Could not load status";
  } else if (s) {
    live = s.hasPublished
      ? `Published ${fmtDate(s.publishedAt)}`
      : "Not published yet. Visitors currently see the built-in starter content.";
    draft = s.hasDraft ? `Last saved ${fmtDate(s.draftAt)}` : "No draft saved yet";
  }

  const tiles = [
    ["studio", "Design Studio", "Colours, fonts, 3D laptop and animations. Try a ready-made look in one click."],
    ["layout", "Sections & Order", "Show, hide and re-order the sections of your website."],
    ["services", "Services", "Edit what you repair. Each service lights up part of the 3D laptop."],
    ["gallery", "Gallery", "Add your real before and after repair photos."]
  ];
  return page(
    "Dashboard",
    "",
    `<section class="a-hero3d">
      <div class="a-hero3d__text">
        <p class="a-eyebrow">Welcome back</p>
        <h2>Your website, your rules.</h2>
        <p class="a-muted">Change colours, fonts, the 3D laptop and every word. Nothing goes live until you press Publish.</p>
        <div class="a-btnrow">
          <button class="a-btn a-btn--primary" type="button" data-tab="studio">Open Design Studio</button>
          <button class="a-btn" type="button" data-action="preview">Preview Draft</button>
        </div>
      </div>
      ${stackHtml()}
    </section>
    <div class="a-stats">
      ${stat("Services", (c.services || []).length)}
      ${stat("Expertise items", (c.expertise || []).length)}
      ${stat("Gallery images", galleryCount)}
      ${stat("Testimonials", testiCount)}
    </div>
    <div class="a-tiles">
      ${tiles.map(([id, t, d], i) => `<button class="a-tile" type="button" data-tab="${id}" data-atilt style="--i:${i}"><span class="a-tile__n">0${i + 1}</span><strong>${e(t)}</strong><small>${e(d)}</small></button>`).join("")}
    </div>` +
      card(
        "Publishing status",
        `<dl class="a-dl">
          <dt>Live website</dt><dd>${e(live)}</dd>
          <dt>Draft</dt><dd>${e(draft)}</dd>
          <dt>This session</dt><dd>${state.dirty ? "You have unsaved changes." : "No unsaved changes."}</dd>
        </dl>
        <div class="a-btnrow">
          <button class="a-btn" type="button" data-action="refresh-status">Refresh status</button>
          <a class="a-btn" href="#/" data-leave>View live website</a>
        </div>`
      ) +
      (notes.length ? card("Suggestions", `<ul class="a-notes">${notes.map((n) => `<li>${e(n)}</li>`).join("")}</ul>`) : "") +
      card(
        "How saving and publishing work",
        `<ol class="a-steps">
          <li><strong>Edit</strong> any section from the menu.</li>
          <li><strong>Save Draft</strong> stores your work privately. Visitors cannot see it.</li>
          <li><strong>Preview Draft</strong> shows the website with your draft.</li>
          <li><strong>Publish</strong> makes your draft live for everyone.</li>
        </ol>`
      ) +
      card("About images", `<p class="a-hint">${e(IMG_NOTE)}</p>`)
  );
}

function viewHero() {
  return page(
    "Hero",
    "The first section visitors see.",
    card(
      "Headline",
      fText("Small label above the headline", "hero.eyebrow") +
        fText("Headline", "hero.headline", { hint: "Tip: two short sentences work best. The second sentence is shown in italic and the accent colour." }) +
        fArea("Sub-headline", "hero.subheadline", { rows: 3 })
    ) +
      card(
        "Background photo",
        noteBox(IMG_NOTE) + "<div style='height:14px'></div>" +
          fImage("Hero photo URL", "hero.imageUrl", { hint: "A wide, dark photo works best. Text is shown over it." })
      ) +
      card(
        "Experience and key facts",
        `<div class="a-row">${fText("Number", "hero.experienceNumber", { maxlength: 12 })}${fText("Label", "hero.experienceLabel")}</div>` +
          fList("Key facts", "hero.facts", "lines", { rows: 4, hint: "One short fact per line. They appear in a strip along the bottom of the hero." })
      ) +
      card(
        "Buttons",
        `<div class="a-row">${fText("Main button text", "hero.primaryCta.label")}${fText("Main button link", "hero.primaryCta.href", { placeholder: "#contact" })}</div>
        <div class="a-row">${fText("Second button text", "hero.secondaryCta.label")}${fText("Second button link", "hero.secondaryCta.href", { placeholder: "#services" })}</div>
        ${hintHtml("To scroll to a section use #about, #services, #expertise, #why, #gallery, #process or #contact. For other websites use a full https:// link.")}`
      )
  );
}

function viewAbout() {
  return page(
    "About",
    "Tell visitors about the business.",
    card(
      "Text",
      fText("Small label", "about.eyebrow") +
        fText("Title", "about.title") +
        fList("Paragraphs", "about.paragraphs", "paras", { rows: 7, hint: "Leave an empty line between paragraphs." }) +
        fList("Highlights", "about.highlights", "lines", { rows: 4, hint: "One short highlight per line. They appear as small tags." })
    ) +
      card(
        "Image",
        noteBox(IMG_NOTE) + "<div style='height:14px'></div>" +
          fImage("About image URL (optional)", "about.imageUrl", { hint: "Best as a portrait (tall) photo. If empty, a plain dark panel with the experience badge is shown." })
      ) +
      card(
        "Photo band",
        `<p class="a-hint" style="margin-bottom:14px">A full-width photo with one short line, between Services and Expertise. Leave the line empty to hide it.</p>` +
          fText("Line of text", "band.quote") +
          fImage("Band photo URL", "band.imageUrl")
      )
  );
}

function itemCard(listKey, item, i, total) {
  const L = LISTS[listKey];
  const base = `${listKey}.${i}`;
  const liveText = String(item[L.liveKey] || "").trim() || cap(L.noun);
  const fields = L.fields
    .map((f) => {
      const p = `${base}.${f.key}`;
      if (f.type === "icon") return fIcon(f.label, p);
      if (f.type === "image") return fImage(f.label, p, { hint: f.hint });
      if (f.type === "select") return fSelect(f.label, p, f.options, { hint: f.hint });
      if (f.type === "area") return fArea(f.label, p, { rows: 3 });
      return fText(f.label, p);
    })
    .join("");
  const attrs = `data-list="${listKey}" data-index="${i}"`;
  return `<article class="a-item">
    <header class="a-item__head">
      <span class="a-item__num">${i + 1}</span>
      <strong data-live="${base}.${L.liveKey}" data-live-fallback="${e(cap(L.noun))}">${e(liveText)}</strong>
      <div class="a-item__tools">
        <button class="a-icon-btn" type="button" data-action="move-up" ${attrs} aria-label="Move up" title="Move up" ${i === 0 ? "disabled" : ""}>&uarr;</button>
        <button class="a-icon-btn" type="button" data-action="move-down" ${attrs} aria-label="Move down" title="Move down" ${i === total - 1 ? "disabled" : ""}>&darr;</button>
        <button class="a-icon-btn a-icon-btn--danger" type="button" data-action="delete-item" ${attrs} aria-label="Delete" title="Delete">&times;</button>
      </div>
    </header>
    <div class="a-item__body">${fields}</div>
  </article>`;
}

function listView(key) {
  const P = LIST_PAGES[key];
  const L = LISTS[key];
  const list = Array.isArray(state.content[key]) ? state.content[key] : [];
  const items = list.length
    ? list.map((item, i) => itemCard(key, item, i, list.length)).join("")
    : `<div class="a-empty">No ${e(L.noun)}s yet.</div>`;
  const body =
    (P.note ? noteBox(P.note) : "") +
    (P.warn ? noteBox(P.warn, true) : "") +
    sectionHeadingCard(key) +
    `<div class="a-items">${items}</div>` +
    `<div><button class="a-btn a-btn--primary" type="button" data-action="add-item" data-list="${key}" ${list.length >= MAX_ITEMS ? "disabled" : ""}>+ ${e(P.add)}</button></div>`;
  return page(P.title, P.intro, body);
}

function viewContact() {
  return page(
    "Contact",
    "Only the details you fill in are shown on the website.",
    sectionHeadingCard("contact") +
      card(
        "Contact details",
        fText("Email", "contact.email", { type: "email" }) +
          `<div class="a-row">
            ${fText("Phone", "contact.phone", { type: "tel", hint: "Shown as a call link, also in the top bar." })}
            ${fText("Second phone (optional)", "contact.phone2", { type: "tel" })}
          </div>` +
          fText("WhatsApp number", "contact.whatsapp", { inputmode: "numeric", hint: "Country code plus number, digits only, for example 919920709340. Used by the Enquire links and the repair ticket." }) +
          fArea("Address", "contact.address", { rows: 3 }) +
          fArea("Opening hours", "contact.hours", { rows: 3 }) +
          fText("Short line under the contact details", "contact.note")
      )
  );
}

function viewBranding() {
  return page(
    "Logo & Footer",
    "Business name, logo, favicon and footer text.",
    card("Business name", `<div class="a-row">${fText("Name", "brand.name")}${fText("Second line", "brand.suffix")}</div>`) +
      card(
        "Logo and favicon",
        noteBox(IMG_NOTE) + "<div style='height:14px'></div>" +
          fImage("Logo URL", "brand.logoUrl", { fallback: "logo.svg", hint: "Leave empty to use the built-in logo." }) +
          fImage("Favicon URL", "brand.faviconUrl", { fallback: "favicon.svg", hint: "The small icon in the browser tab. Leave empty to use the built-in one." })
      ) +
      card(
        "Footer",
        fArea("Footer text", "footer.text", { rows: 2 }) +
          fText("Name shown in the copyright line", "footer.copyrightName") +
          fArea("Photo credits", "footer.credits", { rows: 3, hint: "Shown in small print at the bottom. Keep the credits for any stock photos you use. Remove the line only after replacing all stock photos with your own." })
      )
  );
}

// Admin mein sirf approved fonts/colours hi inline style mein jaate hain
function stackHtml() {
  return `<div class="a-stack" aria-hidden="true"><div class="a-stack__rig">
    <i class="a-plate a-plate--lid"></i><i class="a-plate a-plate--keys"></i><i class="a-plate a-plate--board"></i><i class="a-plate a-plate--cell"></i><i class="a-plate a-plate--base"></i>
  </div></div>`;
}

function presetCard(p) {
  const cur = String(val("appearance.preset") || "");
  const c = p.colors;
  return `<button class="a-preset" type="button" data-action="apply-preset" data-preset="${e(p.id)}" data-atilt aria-pressed="${cur === p.id}">
    <span class="a-preset__sw" style="background:${e(c.bg)}">
      <i style="background:${e(c.accent)}"></i><i style="background:${e(c.accent2)}"></i><i style="background:${e(c.paper)}"></i><i style="background:${e(c.surface)}"></i>
    </span>
    <strong>${e(p.name)}</strong><small>${e(p.note)}</small>
  </button>`;
}

function fontGroup(kind, label, path) {
  const cur = String(val(path) || "");
  return `<div class="a-fontgroup"><p class="a-label">${e(label)}</p>
    <div class="a-fontgrid" data-kind="${kind}">
      ${FONT_CHOICES[kind].map((f) => `<button class="a-fontcard" type="button" data-action="pick-font" data-kind="${kind}" data-name="${e(f.name)}" aria-pressed="${f.name === cur}" style="font-family:'${e(f.name)}', ${kind === "mono" ? "monospace" : "serif"}">
        <span class="a-fontcard__aa">Aa</span><span class="a-fontcard__name">${e(f.name)}</span><small>${e(f.note)}</small>
      </button>`).join("")}
    </div></div>`;
}

function liveHtml() {
  return `<div class="a-live" data-live-preview aria-label="Live preview of your colours and fonts">
    <div class="a-live__bar"><i></i><i></i><i></i><span>Live preview</span></div>
    <div class="a-live__dark">
      <p class="a-live__eyebrow">Laptop repair workshop &middot; Mumbai</p>
      <h4 class="a-live__title">Precision Repairs. <em>Powerful Performance.</em></h4>
      <p class="a-live__sub">Screens, batteries, keyboards, motherboards and more.</p>
      <div class="a-live__btns"><span class="a-live__btn">Book a Repair</span><span class="a-live__btn a-live__btn--ghost">Explore Services</span></div>
      <div class="a-live__lap" aria-hidden="true"><i></i><i></i><i></i></div>
    </div>
    <div class="a-live__paper">
      <small>(01) About</small>
      <strong>A workshop built on careful diagnosis.</strong>
      <span class="a-live__tag">Genuine parts</span><span class="a-live__tag">Honest pricing</span>
    </div>
  </div>`;
}

function viewStudio() {
  return page(
    "Design Studio",
    "Pick a ready-made look or fine-tune everything. The preview updates instantly. Use Preview Draft to see your real website.",
    `<div class="a-studio"><aside class="a-studio__side">${liveHtml()}<p class="a-hint">This preview shows colours, fonts and corners. The 3D laptop and animations appear on the real website: press Preview Draft.</p></aside><div class="a-studio__main">` +
      card("Ready-made looks", `<div class="a-presets">${THEME_PRESETS.map(presetCard).join("")}</div><p class="a-hint">Picking a look changes the colours only. Your fonts and effects stay as they are.</p>`) +
      card("Colours", `<div class="a-colors">${COLOR_FIELDS.map(([k, label]) => fColor(label, `appearance.${k}`)).join("")}</div><p class="a-hint">Buttons and small text on light sections automatically adjust so they stay readable, whatever colours you pick.</p>`) +
      card("Fonts", fontGroup("display", "Headings", "appearance.fontDisplay") + fontGroup("body", "Body text", "appearance.fontBody") + fontGroup("mono", "Small labels", "appearance.fontMono")) +
      card(
        "3D laptop scene",
        fCheck("Show the 3D laptop", "appearance.enable3D", "The laptop opens in the hero and splits into parts in Services. Phones and devices that cannot run 3D show photos instead.") +
          fCheck("Floating particles", "appearance.particles", "Tiny glowing dust inside the 3D scene.") +
          fCheck("Cursor lights up the laptop", "appearance.cursorLight", "A soft light follows the visitor's mouse over the laptop.") +
          fSelect("Particle amount", "appearance.particleDensity", DENSITY_OPTIONS) +
          fRange("Sway speed", "appearance.spin", { min: 0, max: 2, step: 0.05, def: 1, hint: "0 keeps the laptop still." }) +
          fRange("Teardown spread", "appearance.explode", { min: 0.4, max: 1.5, step: 0.05, def: 1, hint: "How far the parts separate in the Services section." }) +
          fRange("Glow strength", "appearance.glow", { min: 0, max: 2, step: 0.05, def: 1 })
      ) +
      card(
        "Motion and feel",
        fSelect("Appear animation", "appearance.reveal", REVEAL_OPTIONS, { hint: "How text and cards appear while scrolling." }) +
          fSelect("Corner style", "appearance.corners", CORNER_OPTIONS) +
          fRange("Film grain", "appearance.grain", { min: 0, max: 0.25, step: 0.01, def: 0.07, hint: "A fine texture over the page. 0 turns it off." }) +
          fCheck("Smooth scrolling", "appearance.smoothScroll", "Buttery, slightly eased scrolling.") +
          fCheck("Glow that follows the mouse", "appearance.cursorGlow", "A soft coloured light behind the cursor.") +
          fCheck("3D tilt on cards", "appearance.tiltCards", "Cards lean towards the mouse.") +
          fCheck("Scrolling text strip under the hero", "appearance.marquee", "The moving line of services.")
      ) +
      `<div><button class="a-btn" type="button" data-action="reset-appearance">Reset the whole design to default</button></div></div></div>`
  );
}

function layoutState() {
  const lay = state.content.layout && typeof state.content.layout === "object" ? state.content.layout : (state.content.layout = { order: [], hidden: [] });
  let order = (Array.isArray(lay.order) ? lay.order : []).filter((id) => SECTION_ORDER.includes(id));
  order = [...new Set(order)];
  SECTION_ORDER.forEach((id) => { if (!order.includes(id)) order.push(id); });
  lay.order = order;
  lay.hidden = (Array.isArray(lay.hidden) ? lay.hidden : []).filter((id) => SECTION_ORDER.includes(id) && id !== "contact");
  return lay;
}

function viewLayout() {
  const lay = layoutState();
  const rows = lay.order.map((id, i) => {
    const hidden = lay.hidden.includes(id);
    const locked = id === "contact";
    return `<li class="a-lrow${hidden ? " is-off" : ""}" data-atilt>
      <span class="a-lrow__n">${i + 1}</span>
      <strong>${e(SECTION_LABELS[id] || id)}</strong>
      <span class="a-lrow__state">${locked ? "Always shown" : hidden ? "Hidden" : "Visible"}</span>
      <label class="a-switch" title="${locked ? "Contact is always shown" : "Show or hide"}">
        <input type="checkbox" data-action="layout-toggle" data-id="${e(id)}" ${hidden ? "" : "checked"} ${locked ? "disabled" : ""} aria-label="Show ${e(SECTION_LABELS[id] || id)}"><span></span>
      </label>
      <button class="a-icon-btn" type="button" data-action="layout-move" data-id="${e(id)}" data-dir="-1" aria-label="Move up" ${i === 0 ? "disabled" : ""}>&uarr;</button>
      <button class="a-icon-btn" type="button" data-action="layout-move" data-id="${e(id)}" data-dir="1" aria-label="Move down" ${i === lay.order.length - 1 ? "disabled" : ""}>&darr;</button>
    </li>`;
  }).join("");
  return page(
    "Sections & Order",
    "Choose which sections your visitors see and in what order. The hero is always first and the footer is always last.",
    `<div class="a-lfixed" data-atilt><span>Hero</span><small>Always first</small></div>
     <ol class="a-llist">${rows}</ol>
     <div class="a-lfixed" data-atilt><span>Footer</span><small>Always last</small></div>` +
      noteBox("Gallery and Testimonials also stay hidden automatically until you add real photos or reviews. The 3D teardown scene lives in the Services section, so keep it visible for the full effect.") +
      `<div><button class="a-btn" type="button" data-action="reset-layout">Reset order and visibility</button></div>`
  );
}

const VIEWS = {
  dashboard: viewDashboard,
  hero: viewHero,
  about: viewAbout,
  services: () => listView("services"),
  expertise: () => listView("expertise"),
  whyUs: () => listView("whyUs"),
  gallery: () => listView("gallery"),
  process: () => listView("process"),
  testimonials: () => listView("testimonials"),
  contact: viewContact,
  branding: viewBranding,
  studio: viewStudio,
  layout: viewLayout
};

// ------------------------------------------------------------
// Screens (config / login / checking / denied / error / panel)
// ------------------------------------------------------------
function screenConfig() {
  return `<div class="a-center"><div class="a-card a-login">
    <h1>Firebase is not set up yet</h1>
    <p class="a-muted">Open <code>firebase.js</code>, paste your Firebase web configuration, save the file and refresh this page.</p>
    <a class="a-link" href="#/">&larr; Back to website</a>
  </div></div>`;
}

function screenMessage(text) {
  return `<div class="a-center"><div class="a-card a-login"><p class="a-muted" role="status">${e(text)}</p></div></div>`;
}

function screenLogin() {
  return `<div class="a-center"><form class="a-card a-login" data-form="login" novalidate>
    <div class="a-login__art">${stackHtml()}</div>
    <div class="a-login__logo"><img src="logo.svg" alt="" width="46" height="46"></div>
    <h1>Admin Login</h1>
    <p class="a-muted">Sign in to manage the website content.</p>
    <div class="a-field">
      <label class="a-label" for="a-email">Email</label>
      <input class="a-input" id="a-email" name="email" type="email" autocomplete="username" required>
    </div>
    <div class="a-field">
      <label class="a-label" for="a-pass">Password</label>
      <input class="a-input" id="a-pass" name="password" type="password" autocomplete="current-password" required>
    </div>
    <p class="a-error" role="alert" data-login-error hidden></p>
    <button class="a-btn a-btn--primary a-btn--block" type="submit">Sign in</button>
    <a class="a-link" href="#/">&larr; Back to website</a>
  </form></div>`;
}

function screenDenied() {
  const u = state.user || {};
  return `<div class="a-center"><div class="a-card a-login">
    <h1>Access not granted</h1>
    <p class="a-muted">You are signed in as <strong>${e(u.email || "")}</strong>, but this account is not on the admin allowlist.</p>
    <p class="a-muted">If you are the owner: copy the User UID below, paste it into the <code>isAdmin</code> list in <code>firestore.rules</code>, publish the rules in the Firebase Console, then press "Check again".</p>
    <div class="a-uid"><code id="a-uid">${e(u.uid || "")}</code><button class="a-btn" type="button" data-action="copy-uid">Copy</button></div>
    <div class="a-btnrow">
      <button class="a-btn a-btn--primary" type="button" data-action="retry">Check again</button>
      <button class="a-btn a-btn--ghost" type="button" data-action="logout">Logout</button>
    </div>
  </div></div>`;
}

function screenError() {
  return `<div class="a-center"><div class="a-card a-login">
    <h1>Could not load the Admin Panel</h1>
    <p class="a-error" role="alert">${e(state.error || "Unknown error.")}</p>
    <div class="a-btnrow">
      <button class="a-btn a-btn--primary" type="button" data-action="retry">Try again</button>
      <button class="a-btn a-btn--ghost" type="button" data-action="logout">Logout</button>
    </div>
  </div></div>`;
}

function screenPanel() {
  return `<div class="a-app">
    <header class="a-top">
      <div class="a-top__brand">
        <img src="logo.svg" alt="" width="34" height="34">
        <div><strong>Admin Panel</strong><small>${e((state.user && state.user.email) || "")}</small></div>
      </div>
      <span class="a-pill" data-pill></span>
      <div class="a-actions">
        <button class="a-btn" type="button" data-action="save-draft">Save Draft</button>
        <button class="a-btn" type="button" data-action="preview">Preview Draft</button>
        <button class="a-btn a-btn--primary" type="button" data-action="publish">Publish</button>
        <button class="a-btn a-btn--ghost" type="button" data-action="logout">Logout</button>
      </div>
    </header>
    <div class="a-body">
      <nav class="a-tabs" aria-label="Admin sections">
        ${TABS.map(([id, label]) => `<button class="a-tab" type="button" data-tab="${id}">${e(label)}</button>`).join("")}
      </nav>
      <main class="a-main" data-view-root></main>
    </div>
  </div>`;
}

// Admin ka rang client ke chune hue accent ke hisaab se badalta hai
function hexRgbList(hex) {
  const h = hex.trim().slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function onAccent(hex) {
  const lin = hexRgbList(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return L > 0.3 ? "#07090D" : "#FFFFFF";
}
function syncAdminTheme() {
  const app = root && root.querySelector(".a-app");
  const a = (state && state.content && state.content.appearance) || {};
  const targets = [document.body];
  targets.forEach((el) => {
    if (isHexColor(a.accent)) {
      el.style.setProperty("--a-accent", a.accent.trim());
      el.style.setProperty("--a-accent-rgb", hexRgbList(a.accent).join(", "));
      el.style.setProperty("--a-on-accent", onAccent(a.accent));
    }
    if (isHexColor(a.accent2)) {
      el.style.setProperty("--a-accent2", a.accent2.trim());
      el.style.setProperty("--a-accent2-rgb", hexRgbList(a.accent2).join(", "));
    }
  });
  return app;
}

const loadedFonts = new Set();
function ensureAdminFont(kind, name) {
  const f = (FONT_CHOICES[kind] || []).find((x) => x.name === name);
  if (!f || loadedFonts.has(f.name)) return;
  loadedFonts.add(f.name);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.dataset.adminFont = "1";
  link.href = `https://fonts.googleapis.com/css2?family=${f.q}&display=swap`;
  document.head.appendChild(link);
}
function loadAllFontsForStudio() {
  Object.keys(FONT_CHOICES).forEach((kind) => FONT_CHOICES[kind].forEach((f) => ensureAdminFont(kind, f.name)));
}

// Live preview: colours, fonts, corners turant dikhte hain
function paintLive() {
  const el = root && root.querySelector("[data-live-preview]");
  if (!el || !state || !state.content) return;
  const a = state.content.appearance || {};
  const set = (name, key, fb) => el.style.setProperty(name, isHexColor(a[key]) ? a[key].trim() : fb);
  set("--lp-bg", "bg", "#07080B");
  set("--lp-surface", "surface", "#0E1015");
  set("--lp-text", "text", "#F4EFE8");
  set("--lp-accent", "accent", "#FF9F43");
  set("--lp-accent2", "accent2", "#2EE6C5");
  set("--lp-paper", "paper", "#EFE9DD");
  set("--lp-ink", "ink", "#0B0C10");
  set("--lp-body", "laptopColor", "#2B2F39");
  const pick = (kind, key, fb) => {
    const f = (FONT_CHOICES[kind] || []).find((x) => x.name === a[key]);
    return f ? `'${f.name}', ${kind === "mono" ? "monospace" : kind === "display" ? "serif" : "sans-serif"}` : fb;
  };
  el.style.setProperty("--lp-display", pick("display", "fontDisplay", "serif"));
  el.style.setProperty("--lp-font", pick("body", "fontBody", "sans-serif"));
  el.style.setProperty("--lp-mono", pick("mono", "fontMono", "monospace"));
  const r = { sharp: "3px", soft: "10px", round: "999px" }[a.corners] || "3px";
  el.style.setProperty("--lp-radius", r);
  ["display", "body", "mono"].forEach((kind) => ensureAdminFont(kind, a[{ display: "fontDisplay", body: "fontBody", mono: "fontMono" }[kind]]));
}

function animateCounts(host) {
  const nodes = host.querySelectorAll("[data-count]");
  if (!nodes.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const start = performance.now();
  const tick = (now) => {
    if (!mounted) return;
    const t = Math.min(1, (now - start) / 800);
    const k = 1 - Math.pow(1 - t, 3);
    nodes.forEach((n) => { n.textContent = String(Math.round(Number(n.dataset.count) * k)); });
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Cards par halka 3D tilt (admin ke liye)
function onTiltMove(ev) {
  const el = ev.target.closest && ev.target.closest("[data-atilt]");
  if (!el || window.matchMedia("(pointer: coarse)").matches) return;
  const r = el.getBoundingClientRect();
  const px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height;
  el.style.setProperty("--ry", ((px - 0.5) * 8).toFixed(2) + "deg");
  el.style.setProperty("--rx", ((0.5 - py) * 8).toFixed(2) + "deg");
  el.style.setProperty("--mx", (px * 100).toFixed(0) + "%");
  el.style.setProperty("--my", (py * 100).toFixed(0) + "%");
}
function onTiltOut(ev) {
  const el = ev.target.closest && ev.target.closest("[data-atilt]");
  if (!el || (ev.relatedTarget && el.contains(ev.relatedTarget))) return;
  el.style.setProperty("--ry", "0deg");
  el.style.setProperty("--rx", "0deg");
}

function render() {
  if (!root) return;
  idn = 0;
  switch (state.phase) {
    case "config": root.innerHTML = screenConfig(); break;
    case "login": root.innerHTML = screenLogin(); break;
    case "denied": root.innerHTML = screenDenied(); break;
    case "error": root.innerHTML = screenError(); break;
    case "panel":
      root.innerHTML = screenPanel();
      syncAdminTheme();
      renderView();
      updatePill();
      break;
    default: root.innerHTML = screenMessage("Checking your access…");
  }
}

function renderView() {
  if (!root) return;
  const host = root.querySelector("[data-view-root]");
  if (!host) return;
  idn = 0;
  const build = VIEWS[state.tab] || viewDashboard;
  host.innerHTML = build();
  host.classList.remove("a-in");
  void host.offsetWidth; // animation dobara chalane ke liye
  host.classList.add("a-in");
  if (state.tab === "studio") { loadAllFontsForStudio(); paintLive(); }
  if (state.tab === "dashboard") animateCounts(host);
  root.querySelectorAll(".a-tab").forEach((b) => {
    b.setAttribute("aria-current", b.dataset.tab === state.tab ? "true" : "false");
  });
  host.querySelectorAll("[data-img]").forEach(updateImgPreview);
}

function goTab(tab) {
  if (!VIEWS[tab]) return;
  state.tab = tab;
  renderView();
  window.scrollTo(0, 0);
}

// ------------------------------------------------------------
// Status pill, busy state, unsaved-changes backup
// ------------------------------------------------------------
function statusInfo() {
  if (state.dirty) return { text: "Unsaved changes", tone: "warn" };
  const s = state.status;
  if (!s) return { text: state.statusError ? "Status unavailable" : "Loading status…", tone: "muted" };
  if (!s.hasPublished) return { text: "Not published yet", tone: "info" };
  if (s.hasUnpublished) return { text: "Draft saved, not published", tone: "info" };
  return { text: "All changes published", tone: "ok" };
}

function updatePill() {
  if (!root) return;
  const pill = root.querySelector("[data-pill]");
  if (!pill) return;
  const info = statusInfo();
  pill.textContent = info.text;
  pill.dataset.tone = info.tone;
}

function setBusy(action) {
  state.busy = action;
  if (!root) return;
  root.querySelectorAll(".a-actions .a-btn").forEach((b) => {
    b.disabled = !!action;
    b.classList.toggle("is-busy", !!action && b.dataset.action === action);
  });
}

function writeBackup() {
  try {
    if (!state || !state.dirty || !state.user || !state.content) return;
    sessionStorage.setItem(BACKUP_KEY, JSON.stringify({ uid: state.user.uid, savedAt: Date.now(), content: state.content }));
  } catch (err) { /* storage band ho sakta hai, ignore */ }
}

function scheduleBackup() {
  clearTimeout(backupTimer);
  backupTimer = setTimeout(writeBackup, 500);
}

function clearBackup() {
  clearTimeout(backupTimer);
  try { sessionStorage.removeItem(BACKUP_KEY); } catch (err) { /* ignore */ }
}

function readBackup() {
  try {
    const raw = sessionStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw);
    return b && state.user && b.uid === state.user.uid && b.content ? b : null;
  } catch (err) {
    return null;
  }
}

function markDirty() {
  state.dirty = true;
  updatePill();
  scheduleBackup();
}

// ------------------------------------------------------------
// Image URL preview
// ------------------------------------------------------------
function updateImgPreview(input) {
  if (!mounted) return;
  const field = input.closest(".a-field");
  const box = field && field.querySelector(".a-imgprev");
  if (!box) return;
  const img = box.querySelector("img");
  const msg = box.querySelector(".a-imgprev__msg");
  const raw = input.value.trim();
  const fallback = input.dataset.fallback || "";
  const url = raw ? safeUrl(raw, "image") : fallback;
  const isDefault = !raw && !!fallback;

  box._seq = (box._seq || 0) + 1;
  const seq = box._seq;
  img.onload = null;
  img.onerror = null;

  const setState = (s, text) => {
    box.dataset.state = s;
    msg.textContent = text;
  };

  if (!raw && !fallback) {
    img.removeAttribute("src");
    setState("empty", "No image yet");
    return;
  }
  if (raw && !url) {
    img.removeAttribute("src");
    setState("error", "This link is not allowed. Use a full https:// image link.");
    return;
  }
  if (/^http:\/\//i.test(url)) {
    img.removeAttribute("src");
    setState("error", "Use an https:// link. http:// images are blocked on secure websites.");
    return;
  }

  setState("loading", "Loading preview…");
  img.onload = () => {
    if (seq === box._seq) setState(isDefault ? "default" : "ok", isDefault ? "Default (built-in)" : "Image loaded");
  };
  img.onerror = () => {
    if (seq === box._seq) setState("error", "Could not load this image. Make sure the link is a direct, public image URL.");
  };
  img.src = url;
}

// ------------------------------------------------------------
// Input handling (typing, selects, checkboxes, colours)
// ------------------------------------------------------------
function onInput(ev) {
  const t = ev.target;
  const path = t && t.dataset ? t.dataset.path : "";
  if (!path || !state || !state.content) return;

  let v;
  switch (t.dataset.type) {
    case "bool": v = t.checked; break;
    case "number": v = Number(t.value); break;
    case "lines": v = t.value.split("\n").map((s) => s.trim()).filter(Boolean); break;
    case "paras": v = t.value.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean); break;
    default: v = t.value;
  }
  setPath(state.content, path, v);

  if (t.dataset.type === "icon") {
    const prev = t.closest(".a-iconpick").querySelector(".a-iconpick__prev");
    if (prev) prev.innerHTML = iconSvg(t.value);
  }
  if (t.dataset.type === "color") {
    const code = t.closest(".a-colorfield").querySelector("code");
    if (code) code.textContent = t.value.toUpperCase();
  }
  if (t.dataset.type === "number") {
    const out = t.closest(".a-field").querySelector("[data-out]");
    if (out) out.textContent = Number(t.value).toFixed(Number(t.dataset.dec) || 0);
  }
  if (path.startsWith("appearance.")) {
    if (path === "appearance.accent" || path === "appearance.accent2") syncAdminTheme();
    paintLive();
  }
  if (t.dataset.img !== undefined) {
    clearTimeout(t._previewTimer);
    t._previewTimer = later(() => updateImgPreview(t), 350);
  }
  root.querySelectorAll("[data-live]").forEach((el) => {
    if (el.dataset.live === path) el.textContent = String(v).trim() || el.dataset.liveFallback || "";
  });
  markDirty();
}

// ------------------------------------------------------------
// Validation
// ------------------------------------------------------------
function validate() {
  const c = state.content;
  const errs = [];
  if (!String((c.hero && c.hero.headline) || "").trim()) errs.push("Hero: the headline cannot be empty.");

  const email = String((c.contact && c.contact.email) || "").trim();
  if (email && !EMAIL_RE.test(email)) errs.push("Contact: the email address looks invalid.");

  const images = [
    ["Logo", c.brand && c.brand.logoUrl],
    ["Favicon", c.brand && c.brand.faviconUrl],
    ["Hero photo", c.hero && c.hero.imageUrl],
    ["About image", c.about && c.about.imageUrl],
    ["Band photo", c.band && c.band.imageUrl],
    ...(c.services || []).map((s, i) => [`Service ${i + 1} photo`, s.imageUrl]),
    ...(c.gallery || []).flatMap((g, i) => [[`Gallery image ${i + 1}`, g.imageUrl], [`Gallery before photo ${i + 1}`, g.beforeUrl]])
  ];
  images.forEach(([label, u]) => {
    const t = String(u || "").trim();
    if (!t) return;
    if (/^http:\/\//i.test(t)) errs.push(`${label}: use an https:// link (http:// is blocked on secure websites).`);
    else if (!safeUrl(t, "image")) errs.push(`${label}: not a valid image link. Use a full https:// URL.`);
  });

  const links = [
    ["Main button link", c.hero && c.hero.primaryCta && c.hero.primaryCta.href],
    ["Second button link", c.hero && c.hero.secondaryCta && c.hero.secondaryCta.href]
  ];
  links.forEach(([label, u]) => {
    const t = String(u || "").trim();
    if (t && !safeUrl(t, "link")) errs.push(`${label}: use #section, a relative path or a full https:// link.`);
  });

  COLOR_FIELDS.forEach(([k, label]) => {
    if (!isHexColor(c.appearance && c.appearance[k])) errs.push(`Appearance: "${label}" must be a colour like #00D4FF.`);
  });
  return errs;
}

// ------------------------------------------------------------
// Save / Preview / Publish / Logout
// ------------------------------------------------------------
async function refreshStatus() {
  try {
    const s = await getWorkflowStatus();
    if (!mounted) return;
    state.status = s;
    state.statusError = false;
  } catch (err) {
    console.warn("Status load failed:", err);
    if (!mounted) return;
    state.status = null;
    state.statusError = true;
  }
  updatePill();
  if (state.phase === "panel" && state.tab === "dashboard") renderView();
}

async function doSave() {
  if (state.busy) return false;
  const errs = validate();
  if (errs.length) {
    toast(errs.slice(0, 3).join("\n"), "error", 8000);
    return false;
  }
  setBusy("save-draft");
  try {
    await saveDraft(state.content);
    if (!mounted) return true;
    state.dirty = false;
    clearBackup();
    toast("Draft saved. Visitors will not see it until you publish.", "ok");
    await refreshStatus();
    return true;
  } catch (err) {
    console.error(err);
    toast(friendlyError(err), "error", 8000);
    return false;
  } finally {
    if (mounted) {
      setBusy(null);
      updatePill();
    }
  }
}

async function doPublish() {
  if (state.busy) return;
  const errs = validate();
  if (errs.length) {
    toast(errs.slice(0, 3).join("\n"), "error", 8000);
    return;
  }
  if (!window.confirm("Publish these changes to the live website? Visitors will see them immediately.")) return;
  setBusy("publish");
  try {
    await publish(state.content);
    if (!mounted) return;
    state.dirty = false;
    clearBackup();
    toast("Published! Your website is updated.", "ok");
    await refreshStatus();
  } catch (err) {
    console.error(err);
    toast(friendlyError(err), "error", 8000);
  } finally {
    if (mounted) {
      setBusy(null);
      updatePill();
    }
  }
}

async function doPreview() {
  if (state.busy) return;
  if (state.dirty) {
    const ok = await doSave();
    if (!ok) return;
  }
  location.hash = "#/preview";
}

async function doLogout() {
  if (state && state.busy) return;
  if (state && state.dirty && !window.confirm("You have unsaved changes. Log out and discard them?")) return;
  clearBackup();
  if (state) state.dirty = false;
  try {
    await adminLogout();
  } catch (err) {
    toast(friendlyAuthError(err), "error");
  }
}

// ------------------------------------------------------------
// List actions
// ------------------------------------------------------------
function addItem(key) {
  const L = LISTS[key];
  if (!L) return;
  if (!Array.isArray(state.content[key])) state.content[key] = [];
  if (state.content[key].length >= MAX_ITEMS) {
    toast(`You can add up to ${MAX_ITEMS} items here.`, "error");
    return;
  }
  state.content[key].push({ id: makeId(L.prefix), ...L.blank() });
  markDirty();
  renderView();
  const items = root.querySelectorAll(".a-item");
  const last = items[items.length - 1];
  if (last) {
    last.scrollIntoView({ behavior: "smooth", block: "center" });
    const first = last.querySelector("input, textarea, select");
    if (first) first.focus({ preventScroll: true });
  }
}

function deleteItem(key, index) {
  const L = LISTS[key];
  const list = state.content[key];
  if (!L || !Array.isArray(list) || !list[index]) return;
  if (!window.confirm(`Delete this ${L.noun}? This only changes your draft until you publish.`)) return;
  list.splice(index, 1);
  markDirty();
  renderView();
}

function moveItem(key, index, dir) {
  const list = state.content[key];
  const j = index + dir;
  if (!Array.isArray(list) || j < 0 || j >= list.length) return;
  [list[index], list[j]] = [list[j], list[index]];
  markDirty();
  renderView();
}

// ------------------------------------------------------------
// Click + submit handlers
// ------------------------------------------------------------
async function copyUid() {
  const el = root && root.querySelector("#a-uid");
  if (!el) return;
  try {
    await navigator.clipboard.writeText(el.textContent);
    toast("UID copied.", "ok", 2500);
  } catch (err) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    toast("Select the UID and copy it manually (Ctrl+C).", "info", 5000);
  }
}

function onClick(ev) {
  const leave = ev.target.closest("[data-leave]");
  if (leave && state && state.dirty && !window.confirm("You have unsaved changes. Leave the Admin Panel anyway?")) {
    ev.preventDefault();
    return;
  }

  const tab = ev.target.closest("[data-tab]");
  if (tab && state && state.phase === "panel") {
    goTab(tab.dataset.tab);
    return;
  }

  const btn = ev.target.closest("[data-action]");
  if (!btn || btn.disabled) return;
  const idx = Number(btn.dataset.index);

  switch (btn.dataset.action) {
    case "save-draft": doSave(); break;
    case "publish": doPublish(); break;
    case "preview": doPreview(); break;
    case "logout": doLogout(); break;
    case "refresh-status": refreshStatus(); break;
    case "add-item": addItem(btn.dataset.list); break;
    case "delete-item": deleteItem(btn.dataset.list, idx); break;
    case "move-up": moveItem(btn.dataset.list, idx, -1); break;
    case "move-down": moveItem(btn.dataset.list, idx, 1); break;
    case "copy-uid": copyUid(); break;
    case "retry": onAuth(state.user); break;
    case "clear-field": {
      const input = root.querySelector(`[data-path="${btn.dataset.target}"]`);
      if (input) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      }
      break;
    }
    case "reset-appearance":
      if (window.confirm("Reset the whole design (colours, fonts, 3D and effects) to the default look?")) {
        state.content.appearance = cloneContent(DEFAULT_CONTENT.appearance);
        markDirty();
        syncAdminTheme();
        renderView();
        toast("Design reset to default.", "ok");
      }
      break;
    case "apply-preset": {
      const p = THEME_PRESETS.find((x) => x.id === btn.dataset.preset);
      if (!p) break;
      Object.assign(state.content.appearance, p.colors, { preset: p.id });
      markDirty();
      syncAdminTheme();
      renderView();
      toast(`${p.name} applied. Use Preview Draft to see it on your website.`, "ok");
      break;
    }
    case "pick-font": {
      const kind = btn.dataset.kind;
      const key = { display: "fontDisplay", body: "fontBody", mono: "fontMono" }[kind];
      const f = key && (FONT_CHOICES[kind] || []).find((x) => x.name === btn.dataset.name);
      if (!f) break;
      state.content.appearance[key] = f.name;
      btn.closest(".a-fontgrid").querySelectorAll(".a-fontcard").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      markDirty();
      paintLive();
      break;
    }
    case "layout-move": {
      const lay = layoutState();
      const i = lay.order.indexOf(btn.dataset.id);
      const j = i + Number(btn.dataset.dir);
      if (i < 0 || j < 0 || j >= lay.order.length) break;
      [lay.order[i], lay.order[j]] = [lay.order[j], lay.order[i]];
      markDirty();
      renderView();
      break;
    }
    case "layout-toggle": {
      const lay = layoutState();
      const id = btn.dataset.id;
      if (id === "contact") break;
      lay.hidden = btn.checked ? lay.hidden.filter((x) => x !== id) : [...new Set([...lay.hidden, id])];
      markDirty();
      renderView();
      break;
    }
    case "reset-layout":
      state.content.layout = cloneContent(DEFAULT_CONTENT.layout);
      markDirty();
      renderView();
      break;
    default: break;
  }
}

async function onSubmit(ev) {
  const form = ev.target.closest('[data-form="login"]');
  if (!form) return;
  ev.preventDefault();

  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  const errBox = form.querySelector("[data-login-error]");
  const submit = form.querySelector('button[type="submit"]');
  const showError = (text) => {
    errBox.textContent = text;
    errBox.hidden = false;
  };

  errBox.hidden = true;
  if (!email || !password) {
    showError("Please enter your email and password.");
    return;
  }
  submit.disabled = true;
  submit.classList.add("is-busy");
  try {
    await adminLogin(email, password);
    // Login ke baad onAuth apne aap chalta hai
  } catch (err) {
    if (!mounted || !root.contains(form)) return;
    showError(friendlyAuthError(err));
    submit.disabled = false;
    submit.classList.remove("is-busy");
  }
}

function onBeforeUnload(ev) {
  if (state && state.dirty) {
    ev.preventDefault();
    ev.returnValue = "";
  }
}

// ------------------------------------------------------------
// Auth flow
// ------------------------------------------------------------
function freshState() {
  return {
    phase: isFirebaseConfigured ? "checking" : "config",
    user: null,
    content: null,
    status: null,
    statusError: false,
    tab: "dashboard",
    dirty: false,
    busy: null,
    error: ""
  };
}

async function onAuth(user) {
  if (!mounted) return;
  const mySeq = ++authSeq;
  state.user = user || null;

  if (!user) {
    state.phase = isFirebaseConfigured ? "login" : "config";
    state.content = null;
    state.status = null;
    state.dirty = false;
    state.busy = null;
    render();
    return;
  }

  state.phase = "checking";
  render();
  try {
    const allowed = await checkAdminAccess();
    if (!mounted || mySeq !== authSeq) return;
    if (!allowed) {
      state.phase = "denied";
      render();
      return;
    }

    const { content } = await loadDraft();
    if (!mounted || mySeq !== authSeq) return;
    state.content = content;
    state.dirty = false;

    const backup = readBackup();
    if (backup) {
      if (window.confirm(`You have unsaved changes from ${fmtDate(backup.savedAt)}. Restore them?`)) {
        state.content = deepMerge(DEFAULT_CONTENT, backup.content);
        state.dirty = true;
      } else {
        clearBackup();
      }
    }

    state.tab = "dashboard";
    state.phase = "panel";
    render();
    refreshStatus();
  } catch (err) {
    console.error("Admin load failed:", err);
    if (!mounted || mySeq !== authSeq) return;
    state.error = friendlyError(err);
    state.phase = "error";
    render();
  }
}

// ------------------------------------------------------------
// Public API (app.js yahi dono functions call karta hai)
// ------------------------------------------------------------
export function mountAdmin(rootEl, deps = {}) {
  unmountAdmin();
  root = rootEl;
  iconSvg = typeof deps.iconSvg === "function" ? deps.iconSvg : () => "";
  state = freshState();
  mounted = true;

  const toasts = document.createElement("div");
  toasts.id = "a-toasts";
  document.body.appendChild(toasts);

  listen(root, "click", onClick);
  listen(root, "input", onInput);
  listen(root, "change", onInput);
  listen(root, "submit", onSubmit);
  listen(root, "pointermove", onTiltMove);
  listen(root, "pointerout", onTiltOut);
  listen(window, "beforeunload", onBeforeUnload);

  render();
  unsubAuth = watchAuth(onAuth);
}

export function unmountAdmin() {
  if (!mounted) return;
  if (state && state.dirty) writeBackup(); // unsaved kaam browser tab mein bacha rahe
  mounted = false;
  authSeq++;
  if (unsubAuth) {
    try { unsubAuth(); } catch (err) { /* ignore */ }
    unsubAuth = null;
  }
  cleanups.splice(0).forEach((fn) => {
    try { fn(); } catch (err) { /* ignore */ }
  });
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  clearTimeout(backupTimer);
  const toasts = document.getElementById("a-toasts");
  if (toasts) toasts.remove();
  ["--a-accent", "--a-accent-rgb", "--a-on-accent", "--a-accent2", "--a-accent2-rgb"].forEach((p) => document.body.style.removeProperty(p));
  root = null;
}
