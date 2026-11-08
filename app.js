// ============================================================
// app.js: public website (render + router + animations + optional 3D hero)
// ============================================================
import { escapeHtml, safeUrl, isHexColor, loadPublished, loadDraft, FONT_CHOICES, SECTION_ORDER } from "./content.js";
import { watchAuth, currentUser } from "./firebase.js";

const e = escapeHtml;

// ------------------------------------------------------------
// 1. ICONS (inline SVG, 24x24)
// ------------------------------------------------------------
const ICON_PATHS = {
  screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  battery: '<rect x="2" y="8" width="17" height="9" rx="2"/><path d="M22 11v3M6 12.5h6"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
  power: '<path d="M12 3v9"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
  fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-6 3.5-6 2 0 2.5 2 1.5 4S13 10 12 10zM14 12c4 0 6 1 6 3.5 0 2-2 2.5-4 1.5S14 13 14 12zM12 14c0 4-1 6-3.5 6-2 0-2.5-2-1.5-4S11 14 12 14zM10 12c-4 0-6-1-6-3.5 0-2 2-2.5 4-1.5S10 11 10 12z"/>',
  storage: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  software: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  water: '<path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/>',
  hinge: '<rect x="3" y="3" width="8" height="18" rx="1.5"/><rect x="13" y="3" width="8" height="18" rx="1.5"/><path d="M11 8h2M11 16h2"/>',
  memory: '<rect x="2" y="8" width="20" height="8" rx="1.5"/><path d="M6 8v8M10 8v8M14 8v8M18 8v8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z"/>',
  speaker: '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.7 7L4 20l1.1-4.2A8 8 0 1 1 21 12z"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};

function iconSvg(key) {
  const path = ICON_PATHS[key] || ICON_PATHS.spark;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

// ------------------------------------------------------------
// 2. RENDER: content object se HTML
// ------------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");

function hexToRgb(hex) {
  const h = hex.trim().slice(1);
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

function linkAttrs(href) {
  const u = safeUrl(href, "link");
  if (!u) return 'href="#top" data-scroll="#top"';
  if (u.startsWith("#")) return `href="${e(u)}" data-scroll="${e(u)}"`;
  const external = /^https?:/i.test(u);
  return `href="${e(u)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}`;
}

const digits = (v) => String(v || "").replace(/\D/g, "");

function telHref(phone) {
  const d = digits(phone);
  if (!d) return "";
  if (String(phone).trim().startsWith("+")) return "tel:+" + d;
  return "tel:" + (d.length === 10 ? "+91" + d : "+" + d);
}

const waLink = (wa, text) => `https://wa.me/${digits(wa)}` + (text ? `?text=${encodeURIComponent(text)}` : "");
const mapsLink = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

function contactInfo(c) {
  const ct = c.contact || {};
  const email = String(ct.email || "").trim();
  const phone = String(ct.phone || "").trim();
  const phone2 = String(ct.phone2 || "").trim();
  return {
    email,
    emailOk: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    phone,
    phone2,
    tel: telHref(phone),
    tel2: telHref(phone2),
    wa: digits(ct.whatsapp),
    address: String(ct.address || "").trim(),
    hours: String(ct.hours || "").trim(),
    note: String(ct.note || "").trim()
  };
}

function words(text) {
  return String(text || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `<span class="word"><span class="word__in">${e(w)}</span></span>`)
    .join(" ");
}

function sentences(text) {
  const t = String(text || "").trim();
  const parts = (t.match(/[^.!?]+[.!?]*/g) || [t]).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [t];
}

let secNo = 0;
const nextNo = () => pad(++secNo);

function sectionHead(s) {
  const x = s || {};
  return `<div class="section__head" data-reveal>
    <p class="eyebrow"><b>(${nextNo()})</b><span>${e(x.eyebrow || "")}</span></p>
    <h2 class="section__title">${e(x.title)}</h2>
    ${x.subtitle ? `<p class="section__sub">${e(x.subtitle)}</p>` : ""}
  </div>`;
}

function brandHtml(c) {
  const b = c.brand || {};
  const logo = safeUrl(b.logoUrl, "image") || "logo.svg";
  return `<a class="brand" ${linkAttrs("#top")} aria-label="${e([b.name, b.suffix].filter(Boolean).join(" "))}">
    <img class="brand__logo" src="${e(logo)}" alt="" width="34" height="34" onerror="this.onerror=null;this.src='logo.svg'">
    <span class="brand__text"><strong>${e(b.name)}</strong><small>${e(b.suffix)}</small></span>
  </a>`;
}

const SECTION_LABEL = { about: "About", services: "Services", expertise: "Expertise", why: "Why us", gallery: "Gallery", process: "Process", testimonials: "Reviews", contact: "Contact" };

// Kaunse sections dikhane hain, aur kis order mein (Admin > Layout se control hota hai)
function sectionOrder(c) {
  const lay = c.layout || {};
  const hidden = new Set(Array.isArray(lay.hidden) ? lay.hidden : []);
  let order = (Array.isArray(lay.order) ? lay.order : []).filter((id) => SECTION_ORDER.includes(id));
  order = [...new Set(order)];
  SECTION_ORDER.forEach((id) => { if (!order.includes(id)) order.push(id); });
  return order.filter((id) => !hidden.has(id));
}

function visibleNav(c) {
  const hasGallery = (c.gallery || []).some((g) => safeUrl(g.imageUrl, "image"));
  const hasQuotes = (c.testimonials || []).some((t) => String(t.text || "").trim());
  const present = {
    about: true,
    services: (c.services || []).length > 0,
    expertise: (c.expertise || []).length > 0,
    why: (c.whyUs || []).length > 0,
    gallery: hasGallery,
    process: (c.process || []).length > 0,
    testimonials: hasQuotes,
    contact: true
  };
  return sectionOrder(c)
    .filter((id) => SECTION_LABEL[id] && present[id])
    .map((id) => ({ id, label: SECTION_LABEL[id], show: true }));
}

function renderHeader(c, items) {
  const ct = contactInfo(c);
  const cta = (c.hero && c.hero.primaryCta) || { label: "Book a Repair", href: "#contact" };
  const action = ct.tel
    ? `<a class="nav__call" href="${e(ct.tel)}" aria-label="Call ${e(ct.phone)}">${iconSvg("phone")}<span>${e(ct.phone)}</span></a>`
    : `<a class="nav__call" ${linkAttrs(cta.href)}><span>${e(cta.label)}</span></a>`;
  return `<header class="nav" id="nav">
    <div class="container nav__inner">
      ${brandHtml(c)}
      <nav class="nav__links" id="nav-links" aria-label="Main">
        ${items.map((i) => `<a href="#${i.id}" data-scroll="#${i.id}">${e(i.label)}</a>`).join("")}
      </nav>
      ${action}
      <button class="nav__toggle" id="nav-toggle" type="button" aria-label="Toggle menu" aria-expanded="false" aria-controls="nav-links"><span></span><span></span></button>
    </div>
  </header>`;
}

function renderHero(c) {
  const h = c.hero || {};
  const photo = safeUrl(h.imageUrl, "image");
  const lines = sentences(h.headline)
    .map((s, i) => `<span class="hero__line${i === 1 ? " hero__line--em" : ""}">${words(s)}</span>`)
    .join(" ");
  const p = h.primaryCta || {};
  const s = h.secondaryCta || {};
  const facts = [];
  if (h.experienceNumber) facts.push(`<li><b>${e(h.experienceNumber)}</b>${e(h.experienceLabel)}</li>`);
  (h.facts || []).filter((t) => String(t).trim()).forEach((t) => facts.push(`<li>${e(t)}</li>`));
  return `<section class="hero" id="top">
    <div class="hero__bg" aria-hidden="true">
      ${photo ? `<img class="hero__photo" src="${e(photo)}" alt="" fetchpriority="high" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
      <div class="hero__shade"></div>
    </div>
    <div class="container hero__inner">
      ${h.eyebrow ? `<p class="hero__kicker" data-hero>${e(h.eyebrow)}</p>` : ""}
      <h1 class="hero__title" aria-label="${e(h.headline)}">${lines}</h1>
      <div class="hero__row">
        <p class="hero__sub" data-hero>${e(h.subheadline)}</p>
        <div class="hero__actions" data-hero>
          <a class="btn btn--primary" ${linkAttrs(p.href)}>${e(p.label)} ${iconSvg("arrow")}</a>
          <a class="btn btn--ghost" ${linkAttrs(s.href)}>${e(s.label)}</a>
        </div>
      </div>
    </div>
    <span class="hero__cue" aria-hidden="true">Scroll to open it up</span>
    ${facts.length ? `<div class="hero__facts" data-hero><div class="container"><ul>${facts.join("")}</ul></div></div>` : ""}
  </section>`;
}

function renderMarquee(c) {
  const list = (c.services || []).filter((s) => String(s.title || "").trim());
  if (!list.length) return "";
  const one = list.map((s) => `<span class="marquee__item">${e(s.title)}</span>`).join("");
  return `<div class="marquee" aria-hidden="true"><div class="marquee__track">${one}${one}</div></div>`;
}

function renderAbout(c) {
  const a = c.about || {};
  const img = safeUrl(a.imageUrl, "image");
  const paras = (a.paragraphs || []).filter((t) => String(t).trim());
  const tags = (a.highlights || []).filter((t) => String(t).trim());
  const exp = c.hero || {};
  const badge = exp.experienceNumber
    ? `<div class="about__badge"><strong>${e(exp.experienceNumber)}</strong><span>${e(exp.experienceLabel)}</span></div>`
    : "";
  return `<section class="section on-paper" id="about">
    <div class="container about">
      <figure class="about__fig${img ? "" : " about__fig--empty"}" data-reveal>
        ${img ? `<img src="${e(img)}" alt="${e(a.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
        ${badge}
      </figure>
      <div class="about__copy" data-reveal>
        <p class="eyebrow"><b>(${nextNo()})</b><span>${e(a.eyebrow || "")}</span></p>
        <h2 class="section__title">${e(a.title)}</h2>
        ${paras.map((t, i) => `<p${i === 0 ? ' class="about__lead"' : ""}>${e(t)}</p>`).join("")}
        ${tags.length ? `<ul class="about__tags">${tags.map((t) => `<li>${e(t)}</li>`).join("")}</ul>` : ""}
      </div>
    </div>
  </section>`;
}

function renderServices(c) {
  const list = c.services || [];
  if (!list.length) return "";
  const ct = contactInfo(c);
  const withImg = list.find((s) => safeUrl(s.imageUrl, "image"));
  const def = safeUrl(withImg && withImg.imageUrl, "image") || safeUrl(c.about && c.about.imageUrl, "image");
  const rows = list.map((s, i) => {
    const img = safeUrl(s.imageUrl, "image");
    const ask = `Hi, I would like to enquire about: ${s.title}`;
    const to = ct.wa ? waLink(ct.wa, ask) : ct.emailOk ? `mailto:${ct.email}?subject=${encodeURIComponent("Enquiry: " + s.title)}` : "#contact";
    return `<li class="svc" data-reveal data-img="${e(img)}" data-part="${e(partFor(s))}" data-name="${e(s.title)}">
      <span class="svc__n">${pad(i + 1)}</span>
      <div><h3>${e(s.title)}</h3><p>${e(s.description)}</p></div>
      <a class="svc__go" ${linkAttrs(to)} aria-label="Enquire about ${e(s.title)}">Enquire ${iconSvg("arrow")}</a>
    </li>`;
  }).join("");
  return `<section class="section" id="services">
    <div class="container">
      ${sectionHead(c.sections && c.sections.services)}
      <div class="svc-wrap${def ? "" : " svc-wrap--solo"}">
        <ol class="svc-list">${rows}</ol>
        <aside class="svc-preview${def ? "" : " svc-preview--empty"}" aria-hidden="true" data-default="${e(def)}">
          ${def ? `<img src="${e(def)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ""}
          <p class="svc-cap" data-cap><b>Teardown</b> · point at a service</p>
        </aside>
      </div>
    </div>
  </section>`;
}

function renderBand(c) {
  const b = c.band || {};
  const quote = String(b.quote || "").trim();
  if (!quote) return "";
  const img = safeUrl(b.imageUrl, "image");
  return `<section class="band" aria-label="Our promise">
    ${img ? `<img class="band__photo" src="${e(img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
    <blockquote data-reveal>${e(quote)}</blockquote>
  </section>`;
}

function renderExpertise(c) {
  const list = c.expertise || [];
  if (!list.length) return "";
  return `<section class="section section--alt" id="expertise">
    <div class="container">
      ${sectionHead(c.sections && c.sections.expertise)}
      <div class="spec">
        ${list.map((x, i) => `<div class="spec__row" data-reveal>
          <div class="spec__top"><h3>${e(x.title)}</h3><i></i><span>${pad(i + 1)}</span></div>
          <p>${e(x.description)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;
}

function renderWhy(c) {
  const list = c.whyUs || [];
  if (!list.length) return "";
  return `<section class="section on-paper" id="why">
    <div class="container">
      ${sectionHead(c.sections && c.sections.whyUs)}
      <div class="why">
        ${list.map((w, i) => `<div class="why__item" data-reveal>
          <span>${pad(i + 1)}</span>
          <h3>${e(w.title)}</h3>
          <p>${e(w.description)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;
}

function renderGallery(c) {
  const list = (c.gallery || []).filter((g) => safeUrl(g.imageUrl, "image"));
  if (!list.length) return "";
  return `<section class="section" id="gallery">
    <div class="container">
      ${sectionHead(c.sections && c.sections.gallery)}
      <div class="gallery">
        ${list.map((g) => {
          const after = safeUrl(g.imageUrl, "image");
          const before = safeUrl(g.beforeUrl, "image");
          const alt = e(g.caption || "Repair photo");
          const frame = before
            ? `<div class="ba">
                <img class="ba__after" src="${e(after)}" alt="${alt} (after)" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.shot').classList.add('is-broken')">
                <img class="ba__before" src="${e(before)}" alt="${alt} (before)" loading="lazy" decoding="async" referrerpolicy="no-referrer">
                <span class="ba__handle"></span>
                <span class="ba__tag ba__tag--b">Before</span><span class="ba__tag ba__tag--a">After</span>
                <input class="ba__range" type="range" min="0" max="100" value="50" aria-label="Drag to compare before and after">
              </div>`
            : `<img src="${e(after)}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.shot').classList.add('is-broken')">`;
          return `<figure class="shot" data-reveal>
            <div class="shot__frame">${frame}</div>
            ${g.caption ? `<figcaption>${e(g.caption)}</figcaption>` : ""}
          </figure>`;
        }).join("")}
      </div>
    </div>
  </section>`;
}

function renderProcess(c) {
  const list = c.process || [];
  if (!list.length) return "";
  return `<section class="section" id="process">
    <div class="container">
      ${sectionHead(c.sections && c.sections.process)}
      <ol class="process">
        ${list.map((p, i) => `<li class="step" data-reveal>
          <span class="step__num">${pad(i + 1)}</span>
          <h3>${e(p.title)}</h3>
          <p>${e(p.description)}</p>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

function renderTestimonials(c) {
  const list = (c.testimonials || []).filter((t) => String(t.text || "").trim());
  if (!list.length) return "";
  return `<section class="section on-paper" id="testimonials">
    <div class="container">
      ${sectionHead(c.sections && c.sections.testimonials)}
      <div class="testimonials">
        ${list.map((t) => `<blockquote class="quote" data-reveal>
          <p>${e(t.text)}</p>
          <footer>${t.name ? `<strong>${e(t.name)}</strong>` : ""}${t.role ? `<span>${e(t.role)}</span>` : ""}</footer>
        </blockquote>`).join("")}
      </div>
    </div>
  </section>`;
}

function infoRow(label, valueHtml, big) {
  return `<li data-reveal><span class="info__label">${e(label)}</span><span class="info__value${big ? " info__value--big" : ""}">${valueHtml}</span></li>`;
}

function renderTicket(c, ct) {
  const brand = (c.brand && c.brand.name) || "";
  if (!ct.wa && !ct.emailOk) return "";
  return `<form class="ticket" data-ticket data-wa="${e(ct.wa)}" data-email="${e(ct.emailOk ? ct.email : "")}" data-shop="${e(brand)}" data-reveal novalidate>
    <div class="ticket__head"><b>Repair ticket</b><span>${e(brand)}</span></div>
    <label for="t-name">Your name</label>
    <input id="t-name" name="name" type="text" autocomplete="name" placeholder="Name">
    <label for="t-model">Laptop brand and model</label>
    <input id="t-model" name="model" type="text" placeholder="e.g. Dell Inspiron 15">
    <label for="t-issue">What is wrong?</label>
    <textarea id="t-issue" name="issue" rows="3" placeholder="No display, will not charge, cracked screen..."></textarea>
    <button class="btn btn--primary" type="submit">${ct.wa ? "Send on WhatsApp" : "Send by email"} ${iconSvg("arrow")}</button>
    <p class="ticket__note">${ct.wa ? "Opens WhatsApp with these details filled in." : "Opens your email app with these details filled in."}</p>
  </form>`;
}

function renderContact(c) {
  const ct = contactInfo(c);
  const rows = [];
  if (ct.tel || ct.tel2) {
    const nums = [];
    if (ct.tel) nums.push(`<a href="${e(ct.tel)}">${e(ct.phone)}</a>`);
    if (ct.tel2) nums.push(`<a href="${e(ct.tel2)}">${e(ct.phone2)}</a>`);
    rows.push(infoRow("Call", nums.join("<br>"), true));
  }
  if (ct.wa) {
    const shown = /^91\d{10}$/.test(ct.wa) ? `+91 ${ct.wa.slice(2, 7)} ${ct.wa.slice(7)}` : "+" + ct.wa;
    rows.push(infoRow("WhatsApp", `<a href="${e(waLink(ct.wa))}" target="_blank" rel="noopener noreferrer">${e(shown)}</a>`));
  }
  if (ct.emailOk) rows.push(infoRow("Email", `<a href="${e("mailto:" + ct.email)}">${e(ct.email)}</a>`));
  if (ct.address) {
    rows.push(infoRow("Workshop", `${e(ct.address)}<br><a class="info__sub" href="${e(mapsLink(ct.address))}" target="_blank" rel="noopener noreferrer">Open in Maps &rarr;</a>`));
  }
  if (ct.hours) rows.push(infoRow("Hours", e(ct.hours)));
  return `<section class="section" id="contact">
    <div class="container">
      ${sectionHead(c.sections && c.sections.contact)}
      <div class="contact">
        <div>
          <ul class="contact__lines">${rows.join("") || '<li><span class="info__value">Contact details coming soon.</span></li>'}</ul>
          ${ct.note ? `<p class="contact__badge">${e(ct.note)}</p>` : ""}
        </div>
        ${renderTicket(c, ct)}
      </div>
    </div>
  </section>`;
}

function renderFooter(c, items) {
  const f = c.footer || {};
  const b = c.brand || {};
  return `<footer class="footer">
    <div class="container">
      <div class="footer__top">
        <div class="footer__about">${brandHtml(c)}${f.text ? `<p>${e(f.text)}</p>` : ""}</div>
        <nav class="footer__links" aria-label="Footer">
          ${items.map((i) => `<a href="#${i.id}" data-scroll="#${i.id}">${e(i.label)}</a>`).join("")}
        </nav>
      </div>
      <div class="footer__mark" aria-hidden="true">${e(b.name || "")}</div>
      <div class="footer__bottom">
        <p>&copy; ${new Date().getFullYear()} ${e(f.copyrightName || b.name || "")}. All rights reserved.</p>
        ${f.credits ? `<p>${e(f.credits)}</p>` : ""}
      </div>
    </div>
  </footer>`;
}

const RENDERERS = {
  about: renderAbout,
  services: renderServices,
  band: renderBand,
  expertise: renderExpertise,
  why: renderWhy,
  gallery: renderGallery,
  process: renderProcess,
  testimonials: renderTestimonials,
  contact: renderContact
};

function renderSite(content, root) {
  secNo = 0;
  const items = visibleNav(content);
  const a = content.appearance || {};
  const body = sectionOrder(content).map((id) => (RENDERERS[id] ? RENDERERS[id](content) : "")).join("");
  root.innerHTML =
    `<canvas class="stage" id="stage" aria-hidden="true"></canvas><div class="cursor-glow" id="cursor-glow" aria-hidden="true"></div>` +
    renderHeader(content, items) +
    `<main id="main">` +
    renderHero(content) +
    (a.marquee === false ? "" : renderMarquee(content)) +
    body +
    `</main>` +
    renderFooter(content, items);
}

// ------------------------------------------------------------
// 3. APPEARANCE (colors, title, favicon)
// ------------------------------------------------------------
const THEME_VARS = ["accent", "accent2", "bg", "surface", "text", "paper", "ink"];
const SERIF_FONTS = new Set(["Fraunces", "Instrument Serif", "Playfair Display", "Cormorant Garamond"]);
const PRELOADED_FONTS = new Set(["Fraunces", "DM Sans", "JetBrains Mono"]); // index.html mein pehle se load hote hain
const FONT_VARS = { fontDisplay: ["display", "--font-display"], fontBody: ["body", "--font-body"], fontMono: ["mono", "--font-mono"] };

function relLum(hex) {
  const h = hex.trim().slice(1);
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrastRatio(a, b) {
  const l1 = relLum(a), l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function mixHex(a, b, t) {
  const pa = a.trim().slice(1), pb = b.trim().slice(1);
  const out = [0, 2, 4].map((i) => {
    const x = parseInt(pa.slice(i, i + 2), 16), y = parseInt(pb.slice(i, i + 2), 16);
    return Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  });
  return "#" + out.join("");
}
// Accent ko tab tak gehra karo jab tak light (paper) section par padhne layak na ho
function readableOn(hex, against, min = 4.5) {
  let c = hex;
  for (let i = 0; i < 40 && contrastRatio(c, against) < min; i++) c = mixHex(c, "#000000", 0.08);
  return c;
}

function loadFont(kind, name) {
  const list = FONT_CHOICES[kind] || [];
  const f = list.find((x) => x.name === name);
  if (!f) return null;
  if (!PRELOADED_FONTS.has(f.name)) {
    const id = "gf-" + f.name.replace(/\W+/g, "-").toLowerCase();
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${f.q}&display=swap`;
      document.head.appendChild(link);
    }
  }
  return f.name;
}

function applyAppearance(content) {
  const a = content.appearance || {};
  const brand = content.brand || {};
  const root = document.documentElement;

  // Pehle purane override hatao, phir naye lagao (draft/published switch ke liye)
  THEME_VARS.forEach((name) => {
    root.style.removeProperty(`--${name}`);
    root.style.removeProperty(`--${name}-rgb`);
    if (isHexColor(a[name])) {
      root.style.setProperty(`--${name}`, a[name].trim());
      root.style.setProperty(`--${name}-rgb`, hexToRgb(a[name]));
    }
  });

  // Colours se nikalne wali values (contrast hamesha theek rahe)
  const paper = isHexColor(a.paper) ? a.paper.trim() : "#EFE9DD";
  const ink = isHexColor(a.ink) ? a.ink.trim() : "#0B0C10";
  const accent = isHexColor(a.accent) ? a.accent.trim() : "#FF9F43";
  root.style.setProperty("--accent-deep", readableOn(accent, paper));
  root.style.setProperty("--on-accent", contrastRatio(accent, "#0B0C10") >= contrastRatio(accent, "#FFFFFF") ? "#0B0C10" : "#FFFFFF");
  root.style.setProperty("--ink-soft", mixHex(ink, paper, 0.38));
  root.style.setProperty("--paper-line", `rgba(${hexToRgb(ink)}, 0.16)`);

  // Fonts (sirf approved list se, koi bhi bahari naam CSS mein nahi jata)
  Object.keys(FONT_VARS).forEach((key) => {
    const [kind, cssVar] = FONT_VARS[key];
    root.style.removeProperty(cssVar);
    const name = loadFont(kind, a[key]);
    if (!name) return;
    const fallback = kind === "mono"
      ? 'ui-monospace, "SFMono-Regular", Menlo, monospace'
      : kind === "display" && SERIF_FONTS.has(name) ? '"Iowan Old Style", Georgia, serif' : 'system-ui, -apple-system, "Segoe UI", sans-serif';
    root.style.setProperty(cssVar, `"${name}", ${fallback}`);
  });

  const corners = { sharp: ["3px", "0px"], soft: ["10px", "16px"], round: ["999px", "28px"] }[a.corners] || ["3px", "0px"];
  root.style.setProperty("--radius", corners[0]);
  root.style.setProperty("--radius-lg", corners[1]);
  const grain = Number(a.grain);
  root.style.setProperty("--grain", String(Number.isFinite(grain) ? Math.min(0.25, Math.max(0, grain)) : 0.07));

  root.dataset.enable3d = a.enable3D === false ? "0" : "1";
  root.dataset.reveal = ["rise", "fade", "zoom", "none"].includes(a.reveal) ? a.reveal : "rise";
  root.dataset.tiltcards = a.tiltCards === false ? "0" : "1";
  root.dataset.cursorglow = a.cursorGlow === false ? "0" : "1";
  root.dataset.smooth = a.smoothScroll === false ? "0" : "1";

  document.title = [brand.name, brand.suffix].filter(Boolean).join(" ") || "Laptop Repair";

  const desc = document.getElementById("meta-desc");
  if (desc && content.hero && content.hero.subheadline) desc.setAttribute("content", content.hero.subheadline);

  const theme = document.getElementById("meta-theme");
  if (theme && isHexColor(a.bg)) theme.setAttribute("content", a.bg.trim());

  const fav = document.getElementById("favicon");
  if (fav) {
    fav.removeAttribute("type"); // PNG/ICO URL bhi chale
    fav.setAttribute("href", safeUrl(brand.faviconUrl, "image") || "favicon.svg");
  }
}

// ------------------------------------------------------------
// 4. SITE INTERACTIONS (nav, smooth scroll, reveal, intro, services preview, ticket)
// ------------------------------------------------------------
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const cleanups = [];
const addCleanup = (fn) => cleanups.push(fn);
function teardownSite() {
  while (cleanups.length) {
    try { cleanups.pop()(); } catch (err) { /* ignore */ }
  }
}

let lenis = null;
let siteToken = 0;

function scrollToSelector(sel) {
  const id = String(sel).replace(/^#/, "");
  const el = id ? document.getElementById(id) : null;
  if (!el && id !== "top") return;
  if (lenis) {
    lenis.scrollTo(el || 0, { duration: 1.2 });
  } else {
    const top = el ? el.getBoundingClientRect().top + window.scrollY : 0;
    window.scrollTo({ top, behavior: reducedMotion() ? "auto" : "smooth" });
  }
}

function initNav(root) {
  const nav = root.querySelector("#nav");
  const toggle = root.querySelector("#nav-toggle");
  if (!nav || !toggle) return;

  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 20);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const closeMenu = () => {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  };
  const onToggle = () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  };
  const onKey = (ev) => { if (ev.key === "Escape") closeMenu(); };
  const onClick = (ev) => {
    const a = ev.target.closest("[data-scroll]");
    if (!a) return;
    ev.preventDefault();
    closeMenu();
    scrollToSelector(a.getAttribute("data-scroll"));
  };

  toggle.addEventListener("click", onToggle);
  document.addEventListener("keydown", onKey);
  root.addEventListener("click", onClick);

  addCleanup(() => {
    window.removeEventListener("scroll", onScroll);
    toggle.removeEventListener("click", onToggle);
    document.removeEventListener("keydown", onKey);
    root.removeEventListener("click", onClick);
  });
}

function initServicePreview(root) {
  const aside = root.querySelector(".svc-preview");
  const list = root.querySelector(".svc-list");
  const img = aside && aside.querySelector("img");
  if (!aside || !list || !img) return;
  const fallback = aside.dataset.default || "";
  let current = img.getAttribute("src");
  const show = (url) => {
    const next = url || fallback;
    if (!next || next === current) return;
    current = next;
    img.style.display = "";
    img.classList.remove("is-swap");
    void img.offsetWidth; // animation dobara chalane ke liye
    img.src = next;
    img.classList.add("is-swap");
  };
  const over = (ev) => {
    const row = ev.target.closest(".svc");
    if (row) show(row.dataset.img || "");
  };
  const out = () => show("");
  list.addEventListener("mouseover", over);
  list.addEventListener("focusin", over);
  list.addEventListener("mouseleave", out);
  addCleanup(() => {
    list.removeEventListener("mouseover", over);
    list.removeEventListener("focusin", over);
    list.removeEventListener("mouseleave", out);
  });
}

function initBeforeAfter(root) {
  const onInput = (ev) => {
    const range = ev.target.closest(".ba__range");
    if (!range) return;
    range.closest(".ba").style.setProperty("--pos", range.value + "%");
  };
  root.addEventListener("input", onInput);
  addCleanup(() => root.removeEventListener("input", onInput));
}

// Repair ticket: details ko WhatsApp (ya email) message mein badal deta hai. Koi server nahi chahiye.
function initTicket(root) {
  const onSubmit = (ev) => {
    const form = ev.target.closest("[data-ticket]");
    if (!form) return;
    ev.preventDefault();
    const field = (n) => form.elements.namedItem(n);
    const name = field("name").value.trim();
    const model = field("model").value.trim();
    const issue = field("issue").value.trim();
    if (!model && !issue) {
      field("issue").focus();
      return;
    }
    const shop = form.dataset.shop || "";
    const lines = [`Hi${shop ? " " + shop : ""}, I need a laptop repair.`];
    if (name) lines.push(`Name: ${name}`);
    if (model) lines.push(`Laptop: ${model}`);
    if (issue) lines.push(`Problem: ${issue}`);
    const text = lines.join("\n");
    if (form.dataset.wa) {
      window.open(waLink(form.dataset.wa, text), "_blank", "noopener");
    } else if (form.dataset.email) {
      location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent("Repair enquiry")}&body=${encodeURIComponent(text)}`;
    }
  };
  root.addEventListener("submit", onSubmit);
  addCleanup(() => root.removeEventListener("submit", onSubmit));
}

function initParallax(root) {
  const { gsap, ScrollTrigger } = window;
  if (reducedMotion() || !gsap || !ScrollTrigger) return;
  const tweens = [];
  root.querySelectorAll(".hero__photo").forEach((img) => {
    tweens.push(gsap.to(img, { yPercent: 7, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } }));
  });
  root.querySelectorAll(".band__photo").forEach((img) => {
    tweens.push(gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: img.closest(".band"), start: "top bottom", end: "bottom top", scrub: true } }));
  });
  addCleanup(() => tweens.forEach((t) => { if (t.scrollTrigger) t.scrollTrigger.kill(); t.kill(); }));
}

function initSmoothScroll() {
  const { gsap, ScrollTrigger, Lenis } = window;
  if (reducedMotion() || !gsap || !ScrollTrigger || !Lenis) return;
  if (document.documentElement.dataset.smooth === "0") return;
  lenis = new Lenis({ duration: 1.1, smoothWheel: true });
  const onTick = (time) => lenis.raf(time * 1000);
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(onTick);
  gsap.ticker.lagSmoothing(0);
  addCleanup(() => {
    gsap.ticker.remove(onTick);
    gsap.ticker.lagSmoothing(500, 33);
    if (lenis) lenis.destroy();
    lenis = null;
  });
}

function initReveal(root) {
  const { gsap, ScrollTrigger } = window;
  if (reducedMotion() || !gsap || !ScrollTrigger) return;
  const items = Array.from(root.querySelectorAll("[data-reveal]"));
  if (!items.length) return;

  const clear = (el) => {
    el.style.opacity = "";
    el.style.transform = "";
    el.style.transition = "";
  };

  try {
    const mode = document.documentElement.dataset.reveal || "rise";
    if (mode === "none") { items.forEach(clear); return; }
    const from = { opacity: 0 };
    if (mode === "rise") from.y = 34;
    if (mode === "zoom") { from.scale = 0.92; from.y = 12; }
    gsap.set(items, from);
    ScrollTrigger.batch(items, {
      start: "top 90%",
      once: true,
      onEnter: (batch) => {
        batch.forEach((el) => { el.style.transition = "none"; });
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.08,
          overwrite: true,
          onComplete: () => batch.forEach(clear)
        });
      }
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
  } catch (err) {
    console.warn("Reveal animation failed, showing content normally.", err);
    items.forEach(clear);
  }

  addCleanup(() => {
    ScrollTrigger.getAll().forEach((t) => t.kill());
    items.forEach(clear);
  });
}

// Service par mouse le jao to 3D laptop ka wahi hissa chamakta hai
function initStageLinks(root) {
  const list = root.querySelector(".svc-list");
  const cap = root.querySelector("[data-cap]");
  if (!list) return;
  const defaultCap = cap ? cap.innerHTML : "";
  let lit = null;
  const set = (row) => {
    if (lit === row) return;
    if (lit) lit.classList.remove("is-lit");
    lit = row;
    if (row) row.classList.add("is-lit");
    stagePart = row ? row.dataset.part || null : null;
    if (stageApi) stageApi.setPart(stagePart);
    if (cap) cap.innerHTML = row ? `<b>${e(row.dataset.name || "")}</b> · ${e(PART_NAMES[row.dataset.part] || "")}` : defaultCap;
  };
  const over = (ev) => { const row = ev.target.closest(".svc"); if (row) set(row); };
  const out = () => set(null);
  list.addEventListener("mouseover", over);
  list.addEventListener("focusin", over);
  list.addEventListener("mouseleave", out);
  list.addEventListener("focusout", out);
  addCleanup(() => {
    list.removeEventListener("mouseover", over);
    list.removeEventListener("focusin", over);
    list.removeEventListener("mouseleave", out);
    list.removeEventListener("focusout", out);
    stagePart = null;
  });
}

// Cards par mouse ke saath halka 3D jhukav + roshni
function initTilt(root) {
  if (reducedMotion() || document.documentElement.dataset.tiltcards === "0") return;
  if (!window.matchMedia("(hover: hover)").matches) return;
  const targets = Array.from(root.querySelectorAll(".why__item, .step, .shot, .quote, .about__fig, .ticket, .spec__row"));
  targets.forEach((el) => el.setAttribute("data-tilt", ""));
  const MAX = 6;
  const move = (ev) => {
    const el = ev.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width;
    const py = (ev.clientY - r.top) / r.height;
    el.style.setProperty("--ry", ((px - 0.5) * 2 * MAX).toFixed(2) + "deg");
    el.style.setProperty("--rx", ((0.5 - py) * 2 * MAX).toFixed(2) + "deg");
    el.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
    el.style.setProperty("--my", (py * 100).toFixed(1) + "%");
    el.classList.add("is-tilting");
  };
  const leave = (ev) => {
    const el = ev.currentTarget;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.classList.remove("is-tilting");
  };
  targets.forEach((el) => {
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
  });
  addCleanup(() => targets.forEach((el) => {
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerleave", leave);
    el.removeAttribute("data-tilt");
    el.style.removeProperty("--rx");
    el.style.removeProperty("--ry");
  }));
}

function initCursorGlow(root) {
  const glow = root.querySelector("#cursor-glow");
  if (!glow || reducedMotion() || document.documentElement.dataset.cursorglow === "0") return;
  if (!window.matchMedia("(hover: hover)").matches) return;
  let x = 0, y = 0, tx = 0, ty = 0, raf = 0;
  const tick = () => {
    x += (tx - x) * 0.14;
    y += (ty - y) * 0.14;
    glow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    raf = requestAnimationFrame(tick);
  };
  const move = (ev) => {
    tx = ev.clientX; ty = ev.clientY;
    if (!glow.classList.contains("is-on")) { x = tx; y = ty; glow.classList.add("is-on"); }
  };
  const leave = () => glow.classList.remove("is-on");
  window.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerleave", leave);
  raf = requestAnimationFrame(tick);
  addCleanup(() => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", move);
    document.removeEventListener("pointerleave", leave);
  });
}

function initHeroIntro(root) {
  const { gsap } = window;
  if (reducedMotion() || !gsap) return;
  const wordEls = Array.from(root.querySelectorAll(".hero__title .word__in"));
  const rest = Array.from(root.querySelectorAll("[data-hero]"));
  if (!wordEls.length && !rest.length) return;

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  tl.from(wordEls, { yPercent: 110, duration: 0.9, stagger: 0.07 }, 0.15);
  tl.from(rest, { y: 24, opacity: 0, duration: 0.8, stagger: 0.12 }, 0.35);

  addCleanup(() => {
    tl.kill();
    gsap.set([...wordEls, ...rest], { clearProps: "transform,opacity" });
  });
}

// ------------------------------------------------------------
// 5. 3D STAGE (Three.js, sab kuch code se bana hai, koi 3D file download nahi hoti)
//    Ek fixed canvas: laptop hero mein khulta hai, Services mein parts mein
//    alag ho jata hai (teardown), aur service par mouse le jao to uska part chamakta hai.
//    Sirf tab chalta hai jab device capable ho. Warna photo wala CSS fallback dikhta hai.
// ------------------------------------------------------------
const ICON_PART = {
  screen: "screen", keyboard: "keyboard", battery: "battery", chip: "board", power: "board", water: "board",
  fan: "cooling", wrench: "cooling", storage: "memory", memory: "memory", software: "memory",
  hinge: "body", speaker: "speaker"
};
const PART_NAMES = {
  screen: "Display assembly", keyboard: "Keyboard deck", battery: "Battery pack", board: "Motherboard",
  memory: "RAM and SSD", speaker: "Speakers", body: "Chassis and hinges", cooling: "Fan and cooling"
};

function partFor(service) {
  const p = String((service && service.part) || "auto");
  if (PART_NAMES[p]) return p;
  return ICON_PART[service && service.icon] || "board";
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (err) {
    return false;
  }
}

function shouldRun3D() {
  if (document.documentElement.dataset.enable3d === "0") return false;
  if (reducedMotion()) return false;
  const conn = navigator.connection;
  if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ""))) return false;
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 1) return false;
  return webglAvailable();
}

function cssColor(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

function rgba(hex, a) {
  return `rgba(${hexToRgb(hex)}, ${a})`;
}

function seededRandom(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasEl(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

// ----- Textures (2D canvas se banti hain) -----
function drawScreen(brand, accent, accent2, bg, fontDisplay, fontMono) {
  const c = canvasEl(768, 480);
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 768, 480);
  grad.addColorStop(0, rgba(bg, 1));
  grad.addColorStop(1, "#14161d");
  g.fillStyle = grad;
  g.fillRect(0, 0, 768, 480);

  g.fillStyle = rgba(accent, 0.1);
  g.beginPath(); g.arc(640, 80, 220, 0, Math.PI * 2); g.fill();
  g.strokeStyle = rgba("#ffffff", 0.05);
  g.lineWidth = 1;
  for (let x = 0; x <= 768; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 480); g.stroke(); }
  for (let y = 0; y <= 480; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(768, y); g.stroke(); }

  g.fillStyle = "#F4EFE8";
  g.font = `600 52px ${fontDisplay}`;
  g.fillText(String(brand.name || "").toUpperCase(), 56, 112);
  g.fillStyle = accent;
  g.font = `500 20px ${fontMono}`;
  g.fillText(String(brand.suffix || "").toUpperCase(), 58, 150);

  const rows = ["DISPLAY", "BATTERY", "MOTHERBOARD", "MEMORY"];
  rows.forEach((r, i) => {
    const y = 214 + i * 38;
    g.fillStyle = rgba("#ffffff", 0.55);
    g.font = `400 17px ${fontMono}`;
    g.fillText(r, 58, y);
    g.fillStyle = accent2;
    g.fillText("OK", 270, y);
    g.fillStyle = rgba(accent2, 0.9);
    g.beginPath(); g.arc(250, y - 6, 4, 0, Math.PI * 2); g.fill();
  });

  g.shadowColor = accent;
  g.shadowBlur = 20;
  g.strokeStyle = accent;
  g.lineWidth = 5;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  g.moveTo(56, 420);
  g.lineTo(250, 420); g.lineTo(290, 350); g.lineTo(344, 452); g.lineTo(392, 380); g.lineTo(428, 420);
  g.lineTo(712, 420);
  g.stroke();
  g.shadowBlur = 0;
  return c;
}

function drawBoard(accent, accent2) {
  const W = 1024, H = 640, S = 32;
  const c = canvasEl(W, H);
  const g = c.getContext("2d");
  const rand = seededRandom(11);
  g.fillStyle = "#06080b";
  g.fillRect(0, 0, W, H);
  g.lineCap = "round";
  g.lineJoin = "round";
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (let n = 0; n < 110; n++) {
    let x = Math.floor((rand() * W) / S) * S;
    let y = Math.floor((rand() * H) / S) * S;
    g.beginPath();
    g.moveTo(x, y);
    const segs = 3 + Math.floor(rand() * 4);
    for (let s = 0; s < segs; s++) {
      const d = dirs[Math.floor(rand() * 8)];
      const len = (1 + Math.floor(rand() * 4)) * S;
      x = Math.max(S, Math.min(W - S, x + d[0] * len));
      y = Math.max(S, Math.min(H - S, y + d[1] * len));
      g.lineTo(x, y);
    }
    g.strokeStyle = rand() > 0.72 ? rgba(accent2, 0.7) : rgba(accent, 0.62);
    g.lineWidth = rand() > 0.8 ? 4 : 2.5;
    g.stroke();
    g.fillStyle = rgba(accent, 0.95);
    g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
  }
  for (let n = 0; n < 9; n++) {
    const w = (2 + Math.floor(rand() * 3)) * S;
    const h = (2 + Math.floor(rand() * 2)) * S;
    const x = S * 2 + Math.floor((rand() * (W - w - S * 4)) / S) * S;
    const y = S * 2 + Math.floor((rand() * (H - h - S * 4)) / S) * S;
    g.fillStyle = "#0c0f14";
    g.fillRect(x, y, w, h);
    g.strokeStyle = rgba(accent, 0.8);
    g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
    for (let p = 8; p < w - 4; p += 14) {
      g.beginPath(); g.moveTo(x + p, y); g.lineTo(x + p, y - 8); g.stroke();
      g.beginPath(); g.moveTo(x + p, y + h); g.lineTo(x + p, y + h + 8); g.stroke();
    }
  }
  return c;
}

function drawLabel(lines, accent, size = 256) {
  const c = canvasEl(size, size);
  const g = c.getContext("2d");
  g.fillStyle = "#0a0b0e";
  g.fillRect(0, 0, size, size);
  g.strokeStyle = rgba(accent, 0.9);
  g.lineWidth = 6;
  g.strokeRect(10, 10, size - 20, size - 20);
  g.fillStyle = "#F4EFE8";
  g.textAlign = "center";
  g.font = `600 ${Math.round(size / 9)}px "JetBrains Mono", monospace`;
  lines.forEach((t, i) => g.fillText(t, size / 2, size / 2 + (i - (lines.length - 1) / 2) * (size / 7)));
  return c;
}

function drawBattery(accent) {
  const c = canvasEl(768, 256);
  const g = c.getContext("2d");
  g.fillStyle = "#0b0c10";
  g.fillRect(0, 0, 768, 256);
  for (let i = 0; i < 6; i++) {
    const x = 24 + i * 120;
    g.fillStyle = "#15171d";
    g.fillRect(x, 28, 108, 140);
    g.strokeStyle = rgba(accent, 0.7);
    g.lineWidth = 3;
    g.strokeRect(x, 28, 108, 140);
    g.fillStyle = rgba(accent, 0.8);
    g.fillRect(x + 8, 38 + (i % 3) * 6, 92, 8);
  }
  g.fillStyle = "#F4EFE8";
  g.font = '600 26px "JetBrains Mono", monospace';
  g.fillText("LI-ION  11.4V  ·  CELL PACK", 28, 222);
  return c;
}

function drawRadial(stops, size) {
  const c = canvasEl(size, size);
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

let stageApi = null;
let stagePart = null;

async function startStage(root, content, token) {
  if (!shouldRun3D()) return;
  const canvas = root.querySelector("#stage");
  if (!canvas) return;

  let THREE;
  try {
    THREE = await import("three");
  } catch (err) {
    console.warn("Three.js could not load. Using photo fallback.", err);
    return;
  }
  let env = null;
  try {
    env = await import("three/addons/environments/RoomEnvironment.js");
  } catch (err) {
    env = null; // reflections ke bina bhi chalega
  }
  if (document.fonts && document.fonts.ready) {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
  }
  if (token !== siteToken || !canvas.isConnected) return; // route badal chuka hai

  try {
    stageApi = buildStage(THREE, env, canvas, root, content);
    document.documentElement.dataset.stage = "on";
    addCleanup(() => {
      document.documentElement.removeAttribute("data-stage");
      if (stageApi) stageApi.destroy();
      stageApi = null;
    });
    if (stagePart) stageApi.setPart(stagePart);
  } catch (err) {
    console.warn("3D scene failed. Using photo fallback.", err);
    document.documentElement.removeAttribute("data-stage");
  }
}

function buildStage(THREE, env, canvas, root, content) {
  const a = content.appearance || {};
  const num = (v, d, lo, hi) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const spin = num(a.spin, 1, 0, 2);
  const explodeK = num(a.explode, 1, 0.4, 1.5);
  const glowK = num(a.glow, 1, 0, 2);
  const density = { low: 260, medium: 640, high: 1300 }[a.particleDensity] || 640;
  const wantParticles = a.particles !== false;
  const cursorLight = a.cursorLight !== false;

  const accent = cssColor("--accent", "#FF9F43");
  const accent2 = cssColor("--accent2", "#2EE6C5");
  const bg = cssColor("--bg", "#07080B");
  const bodyHex = isHexColor(a.laptopColor) ? a.laptopColor.trim() : "#2B2F39";
  const brand = content.brand || {};
  const fontDisplay = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "serif";
  const fontMono = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "monospace";

  const isMobile = () => window.innerWidth <= 920;
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile(), alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.25 : 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  if (env && env.RoomEnvironment) {
    try {
      const pm = new THREE.PMREMGenerator(renderer);
      const envTex = pm.fromScene(new env.RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      track(envTex);
      pm.dispose();
    } catch (err) { /* ignore */ }
  }

  // ----- Lights -----
  scene.add(new THREE.HemisphereLight(0x8fa0c0, 0x0a0a0c, 0.55));
  const key = new THREE.DirectionalLight(new THREE.Color(accent), 1.7);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.PointLight(new THREE.Color(accent2), 70 * glowK, 30, 2);
  rim.position.set(-6, 2, -4);
  scene.add(rim);
  const cursor = new THREE.PointLight(0xffffff, 0, 16, 2);
  cursor.position.set(0, 0, 4);
  scene.add(cursor);

  // ----- Rig -----
  const rig = new THREE.Group();
  scene.add(rig);
  const model = new THREE.Group();
  rig.add(model);

  const W = 4.4, D = 3.0;
  const parts = {};
  let curPart = null;
  const mkPart = (name) => {
    const g = new THREE.Group();
    model.add(g);
    const lineMat = track(new THREE.LineBasicMaterial({ color: new THREE.Color(accent), transparent: true, opacity: 0.28 }));
    parts[name] = { g, h: 0, fade: 1, lift: 0, mats: [], all: [], lineMat };
    curPart = parts[name];
    return curPart;
  };
  const mat = (color, o = {}) => {
    const m = track(new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.34, envMapIntensity: 0.9, emissive: new THREE.Color(accent), emissiveIntensity: 0, transparent: true, ...o }));
    if (curPart) curPart.all.push(m);
    return m;
  };
  const glowable = (p, m, base = 0) => { p.mats.push({ m, base }); return m; };
  const box = (p, w, h, d, m, x = 0, y = 0, z = 0, edges = false, parent = null) => {
    const geo = track(new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    (parent || p.g).add(mesh);
    if (edges) mesh.add(new THREE.LineSegments(track(new THREE.EdgesGeometry(geo)), p.lineMat));
    return mesh;
  };
  const tex = (canvasSrc) => {
    const t = track(new THREE.CanvasTexture(canvasSrc));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };

  // BODY: bottom case + hinge + feet
  const body = mkPart("body");
  const bodyMat = glowable(body, mat(bodyHex));
  box(body, W, 0.1, D, bodyMat, 0, 0, 0, true);
  const hingeMat = glowable(body, mat("#8a8f9a", { metalness: 0.9, roughness: 0.25 }));
  const hinge = new THREE.Mesh(track(new THREE.CylinderGeometry(0.09, 0.09, W * 0.82, 20)), hingeMat);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, 0.14, -D / 2 + 0.02);
  body.g.add(hinge);
  [[-1.9, 1.25], [1.9, 1.25], [-1.9, -1.25], [1.9, -1.25]].forEach(([x, z]) => {
    box(body, 0.34, 0.03, 0.2, mat("#050506", { metalness: 0.1, roughness: 0.9 }), x, -0.06, z);
  });

  // SPEAKERS
  const spk = mkPart("speaker");
  const spkMat = glowable(spk, mat("#16181e", { metalness: 0.4, roughness: 0.6 }));
  [-1.55, 1.55].forEach((x) => {
    box(spk, 0.9, 0.06, 0.3, spkMat, x, 0, 1.15, true);
    for (let i = 0; i < 6; i++) box(spk, 0.08, 0.02, 0.2, mat(accent, { emissive: new THREE.Color(accent), emissiveIntensity: 0.5, metalness: 0.2 }), x - 0.34 + i * 0.136, 0.04, 1.15);
  });

  // BATTERY
  const bat = mkPart("battery");
  const batTex = tex(drawBattery(accent));
  const batTop = glowable(bat, mat(0xffffff, { map: batTex, metalness: 0.2, roughness: 0.6 }));
  const batSide = glowable(bat, mat("#101217", { metalness: 0.3, roughness: 0.6 }));
  const batGeo = track(new THREE.BoxGeometry(3.0, 0.12, 1.0));
  const batMesh = new THREE.Mesh(batGeo, [batSide, batSide, batTop, batSide, batSide, batSide]);
  batMesh.position.set(0, 0, 0.85);
  batMesh.add(new THREE.LineSegments(track(new THREE.EdgesGeometry(batGeo)), bat.lineMat));
  bat.g.add(batMesh);

  // MOTHERBOARD
  const board = mkPart("board");
  const boardTex = tex(drawBoard(accent, accent2));
  const boardTop = glowable(board, mat(0xffffff, { map: boardTex, emissiveMap: boardTex, emissive: new THREE.Color(0xffffff), metalness: 0.3, roughness: 0.55 }), 0.35 * glowK);
  const boardSide = mat("#0b0d10", { metalness: 0.2, roughness: 0.7 });
  const boardGeo = track(new THREE.BoxGeometry(3.8, 0.05, 2.4));
  const boardMesh = new THREE.Mesh(boardGeo, [boardSide, boardSide, boardTop, boardSide, boardSide, boardSide]);
  boardMesh.add(new THREE.LineSegments(track(new THREE.EdgesGeometry(boardGeo)), board.lineMat));
  board.g.add(boardMesh);
  const cpuTex = tex(drawLabel([String(brand.name || "EW").slice(0, 3).toUpperCase(), "CPU"], accent));
  const cpuTop = glowable(board, mat(0xffffff, { map: cpuTex, metalness: 0.5, roughness: 0.4 }));
  const cpuSide = mat("#c8ccd4", { metalness: 0.9, roughness: 0.3 });
  const cpuMesh = new THREE.Mesh(track(new THREE.BoxGeometry(0.78, 0.09, 0.78)), [cpuSide, cpuSide, cpuTop, cpuSide, cpuSide, cpuSide]);
  cpuMesh.position.set(0.5, 0.07, -0.2);
  board.g.add(cpuMesh);
  const chipMat = glowable(board, mat("#0d0e12", { metalness: 0.3, roughness: 0.5 }));
  [[-0.4, 0.5, 0.5, 0.3], [-0.9, -0.5, 0.35, 0.35], [1.4, 0.55, 0.45, 0.28], [1.45, -0.7, 0.3, 0.3], [0.0, 0.75, 0.3, 0.22]].forEach(([x, z, w, d]) => {
    box(board, w, 0.06, d, chipMat, x, 0.05, z, true);
  });

  // MEMORY (RAM + SSD)
  const mem = mkPart("memory");
  const pcbMat = glowable(mem, mat("#0f3a2a", { metalness: 0.3, roughness: 0.5 }));
  const blk = glowable(mem, mat("#0a0a0c", { metalness: 0.3, roughness: 0.4 }));
  const gold = mat("#d9b35a", { metalness: 1, roughness: 0.25 });
  [0.55, 0.98].forEach((z) => {
    box(mem, 1.5, 0.035, 0.32, pcbMat, 1.0, 0, z, true);
    for (let i = 0; i < 4; i++) box(mem, 0.26, 0.04, 0.2, blk, 0.55 + i * 0.32, 0.04, z);
    box(mem, 1.3, 0.04, 0.03, gold, 1.0, -0.01, z + 0.16);
  });
  const ssdTex = tex(drawLabel(["NVMe", "SSD"], accent2));
  const ssdTop = glowable(mem, mat(0xffffff, { map: ssdTex, metalness: 0.4, roughness: 0.5 }));
  const ssdSide = mat("#101217", { metalness: 0.4, roughness: 0.6 });
  const ssdGeo = track(new THREE.BoxGeometry(0.62, 0.04, 1.8));
  const ssd = new THREE.Mesh(ssdGeo, [ssdSide, ssdSide, ssdTop, ssdSide, ssdSide, ssdSide]);
  ssd.position.set(-1.45, 0, 0.4);
  ssd.add(new THREE.LineSegments(track(new THREE.EdgesGeometry(ssdGeo)), mem.lineMat));
  mem.g.add(ssd);

  // COOLING (fan + heatpipe)
  const cool = mkPart("cooling");
  const copper = glowable(cool, mat("#c77b3c", { metalness: 1, roughness: 0.28 }));
  const fanGroup = new THREE.Group();
  fanGroup.position.set(-1.25, 0, -0.55);
  cool.g.add(fanGroup);
  const ring = new THREE.Mesh(track(new THREE.TorusGeometry(0.62, 0.05, 10, 40)), glowable(cool, mat("#15171c", { metalness: 0.6, roughness: 0.4 })));
  ring.rotation.x = Math.PI / 2;
  fanGroup.add(ring);
  const rotor = new THREE.Group();
  fanGroup.add(rotor);
  const bladeMat = glowable(cool, mat("#20232b", { metalness: 0.5, roughness: 0.45 }));
  for (let i = 0; i < 9; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i / 9) * Math.PI * 2;
    const blade = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.012, 0.16)), bladeMat);
    blade.position.x = 0.33;
    blade.rotation.x = 0.5;
    arm.add(blade);
    rotor.add(arm);
  }
  const hub = new THREE.Mesh(track(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 20)), copper);
  rotor.add(hub);
  const pipe = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 14)), copper);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(-0.05, 0, -0.3);
  cool.g.add(pipe);
  const finMat = glowable(cool, mat("#9aa0ab", { metalness: 0.9, roughness: 0.3 }));
  for (let i = 0; i < 12; i++) box(cool, 0.02, 0.22, 0.7, finMat, -2.05 + i * 0.045, 0.02, -0.55);

  // KEYBOARD DECK
  const kb = mkPart("keyboard");
  const deckMat = glowable(kb, mat(new THREE.Color(bodyHex).offsetHSL(0, 0, 0.03)));
  box(kb, W, 0.07, D, deckMat, 0, 0, 0, true);
  const cols = 14, rows = 5;
  const keyGeo = track(new THREE.BoxGeometry(0.22, 0.05, 0.22));
  const keyMat = glowable(kb, mat("#0c0d11", { metalness: 0.3, roughness: 0.55 }), 0.1 * glowK);
  const keys = new THREE.InstancedMesh(keyGeo, keyMat, cols * rows);
  const m4 = new THREE.Matrix4();
  let ki = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      m4.setPosition((c - (cols - 1) / 2) * 0.285, 0.06, -1.2 + r * 0.285);
      keys.setMatrixAt(ki++, m4);
    }
  }
  keys.instanceMatrix.needsUpdate = true;
  kb.g.add(keys);
  track(keys);
  box(kb, 1.9, 0.05, 0.22, keyMat, 0, 0.06, 0.225);
  box(kb, 1.3, 0.012, 0.72, glowable(kb, mat("#1a1c22", { metalness: 0.5, roughness: 0.4 })), 0, 0.04, 1.0, true);

  // SCREEN (lid)
  const scr = mkPart("screen");
  const lidPivot = new THREE.Group();
  scr.g.add(lidPivot);
  const lidMat = glowable(scr, mat(bodyHex));
  const lidH = D * 0.96;
  const lidGeo = track(new THREE.BoxGeometry(W, lidH, 0.07));
  const lid = new THREE.Mesh(lidGeo, lidMat);
  lid.position.set(0, lidH / 2, 0);
  lid.add(new THREE.LineSegments(track(new THREE.EdgesGeometry(lidGeo)), scr.lineMat));
  lidPivot.add(lid);
  const screenTex = tex(drawScreen(brand, accent, accent2, bg, fontDisplay, fontMono));
  const screenMat = track(new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, transparent: true }));
  scr.all.push(screenMat);
  const screenPlane = new THREE.Mesh(track(new THREE.PlaneGeometry(W - 0.28, lidH - 0.3)), screenMat);
  screenPlane.position.set(0, lidH / 2, 0.037);
  lidPivot.add(screenPlane);
  const logoMat = track(new THREE.MeshBasicMaterial({ map: track(new THREE.CanvasTexture(drawRadial([[0, rgba(accent, 0.95)], [0.35, rgba(accent, 0.5)], [1, rgba(accent, 0)]], 128))), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const logo = new THREE.Mesh(track(new THREE.PlaneGeometry(0.9, 0.9)), logoMat);
  logo.position.set(0, lidH / 2, -0.04);
  logo.rotation.y = Math.PI;
  lidPivot.add(logo);

  // Pedestal glow + scanner ring
  const glowTex = track(new THREE.CanvasTexture(drawRadial([[0, rgba(accent, 0.55)], [0.45, rgba(accent, 0.14)], [1, rgba(accent, 0)]], 256)));
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(11, 11)), track(new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 * Math.min(glowK, 1.3) })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.45;
  model.add(floor);
  const scanMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(accent2), transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  const scan = new THREE.Mesh(track(new THREE.RingGeometry(3.15, 3.18, 96)), scanMat);
  scan.rotation.x = -Math.PI / 2;
  scan.position.y = -0.44;
  model.add(scan);

  // Particles
  let points = null;
  if (wantParticles) {
    const n = density;
    const pos = new Float32Array(n * 3);
    const rand = seededRandom(5);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rand() - 0.5) * 26;
      pos[i * 3 + 1] = (rand() - 0.5) * 14;
      pos[i * 3 + 2] = (rand() - 0.5) * 14 - 2;
    }
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    points = new THREE.Points(geo, track(new THREE.PointsMaterial({ color: new THREE.Color(accent), size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
    scene.add(points);
  }

  // ----- Scroll keyframes -----
  const NEUTRAL = { fx: 0, fy: 0, sc: 1, ry: 0, rx: 0.3, ex: 0, lid: 1, op: 0, focus: 0 };
  const STATES = {
    hero: () => isMobile()
      ? { fx: 0, fy: 0.46, sc: 0.62, ry: -0.45, rx: 0.38, ex: 0, lid: 1, op: 0.9, focus: 0 }
      : { fx: 0.5, fy: 0.01, sc: 0.88, ry: -0.55, rx: 0.4, ex: 0, lid: 1, op: 1, focus: 0 },
    marquee: () => isMobile()
      ? { ...NEUTRAL, fy: 0.3, sc: 0.8, op: 0 }
      : { fx: 0.34, fy: 0.04, sc: 0.95, ry: 0.15, rx: 0.5, ex: 0.4, lid: 1, op: 1, focus: 0 },
    about: () => ({ fx: -0.5, fy: 0, sc: 0.95, ry: 0.7, rx: 0.3, ex: 0.3, lid: 1, op: isMobile() ? 0 : 1, focus: 0 }),
    services: () => isMobile()
      ? { ...NEUTRAL, op: 0 }
      : { fx: 0.5, fy: -0.02, sc: 0.78, ry: -0.42, rx: 0.62, ex: 1, lid: 1, op: 1, focus: 1 }
  };
  const PART_VIEW = {
    screen: { ry: -0.1, rx: 0.1, sc: 0.7 },
    keyboard: { ry: -0.3, rx: 0.9, sc: 0.7 },
    battery: { ry: -0.55, rx: 1.0, sc: 0.7 },
    board: { ry: -0.5, rx: 1.05, sc: 0.7 },
    memory: { ry: -0.35, rx: 1.0, sc: 0.7 },
    speaker: { ry: -0.25, rx: 0.8, sc: 0.7 },
    body: { ry: -0.75, rx: 0.4, sc: 0.7 },
    cooling: { ry: -0.5, rx: 1.0, sc: 0.7 }
  };
  const OFFAFTER = ["band", "expertise", "why", "gallery", "process", "testimonials", "contact"];

  let keys_ = [];
  function layout() {
    const H = window.innerHeight;
    const topOf = (sel) => {
      const el = root.querySelector(sel);
      return el ? el.getBoundingClientRect().top + window.scrollY : null;
    };
    const list = [{ y: 0, s: STATES.hero() }];
    const mq = topOf(".marquee");
    if (mq !== null) list.push({ y: Math.max(1, mq - H * 0.6), s: STATES.marquee() });
    const ab = topOf("#about");
    if (ab !== null) list.push({ y: ab - H * 0.1, s: STATES.about() });
    const sv = topOf("#services");
    if (sv !== null) list.push({ y: sv - H * 0.25, s: STATES.services() });
    // services ke baad pehla section jo transparent nahi hai
    const svEl = root.querySelector("#services");
    if (svEl) {
      const end = svEl.getBoundingClientRect().bottom + window.scrollY;
      list.push({ y: end - H * 0.85, s: STATES.services() });
      list.push({ y: end - H * 0.2, s: { ...STATES.services(), op: 0 } });
    }
    OFFAFTER.forEach((id) => {
      const t = topOf("#" + id);
      if (t !== null) list.push({ y: t - H * 0.5, s: { ...NEUTRAL, op: 0 } });
    });
    keys_ = list.sort((p, q) => p.y - q.y);
  }

  const smooth = (t) => t * t * (3 - 2 * t);
  const lerp = (p, q, t) => p + (q - p) * t;
  function target(scrollY) {
    if (!keys_.length) return { ...NEUTRAL };
    if (scrollY <= keys_[0].y) return { ...keys_[0].s };
    const last = keys_[keys_.length - 1];
    if (scrollY >= last.y) return { ...last.s };
    for (let i = 0; i < keys_.length - 1; i++) {
      const p = keys_[i], q = keys_[i + 1];
      if (scrollY >= p.y && scrollY <= q.y) {
        const t = smooth((scrollY - p.y) / Math.max(1, q.y - p.y));
        const out = {};
        Object.keys(NEUTRAL).forEach((k) => { out[k] = lerp(p.s[k], q.s[k], t); });
        return out;
      }
    }
    return { ...NEUTRAL };
  }

  // ----- Size -----
  let halfW = 6, halfH = 3.78, aspect = 1.6;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.25 : 1.75));
    renderer.setSize(w, h, false);
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    halfW = halfH * aspect;
    layout();
  }
  resize();
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => layout()) : null;
  if (ro) ro.observe(document.body);
  window.addEventListener("resize", resize);

  // ----- Pointer -----
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, on: false };
  const onMove = (ev) => {
    mouse.tx = (ev.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = -((ev.clientY / window.innerHeight) * 2 - 1);
    mouse.on = true;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  // ----- Loop -----
  const cur = { ...STATES.hero(), op: 0, lid: 0, ex: 0 };
  let activePart = null;
  let activeAmt = 0;
  let raf = 0;
  let running = true;
  let destroyed = false;
  let wasVisible = true;
  const clock = new THREE.Clock();
  const t0 = performance.now();
  let elapsed = 0;

  function frame() {
    if (destroyed || !running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.12);
    elapsed = (performance.now() - t0) / 1000;

    const T = target(window.scrollY);
    const k = 1 - Math.exp(-dt * 4.2);
    ["fx", "fy", "sc", "ry", "rx", "ex", "op", "focus"].forEach((key) => { cur[key] = lerp(cur[key], T[key], k); });
    // Shuru mein laptop ka dhakkan khulta hai
    const intro = Math.min(1, Math.max(0, (elapsed - 0.35) / 1.6));
    cur.lid = smooth(intro) * T.lid;
    const introFade = Math.min(1, elapsed / 0.9);

    activeAmt = lerp(activeAmt, activePart ? 1 : 0, 1 - Math.exp(-dt * 5));
    const view = PART_VIEW[activePart] || null;
    const f = cur.focus * activeAmt;
    const ry = lerp(cur.ry, view ? view.ry : cur.ry, f);
    const rx = lerp(cur.rx, view ? view.rx : cur.rx, f);
    const sc = lerp(cur.sc, view ? view.sc : cur.sc, f);

    mouse.x = lerp(mouse.x, mouse.tx, 1 - Math.exp(-dt * 3));
    mouse.y = lerp(mouse.y, mouse.ty, 1 - Math.exp(-dt * 3));
    const sway = Math.sin(elapsed * 0.45) * 0.14 * spin;
    const drift = (1 - intro) * -1.3;
    const fit = Math.min(1, Math.max(0.62, aspect / 1.75));

    rig.visible = cur.op > 0.02;
    canvas.style.opacity = String(Math.min(1, cur.op) * introFade);
    rig.position.set(cur.fx * halfW, cur.fy * halfH, 0);
    rig.scale.setScalar(sc * fit);
    rig.rotation.set(rx + mouse.y * 0.1, ry + sway + mouse.x * 0.22 + drift + elapsed * 0.05 * spin * (1 - cur.focus), 0);
    model.position.y = -1.15 * cur.ex;

    const ex = cur.ex * explodeK;
    const Y = { body: 0, speaker: 0.09, battery: 0.1, board: 0.15, memory: 0.21, cooling: 0.22, keyboard: 0.3 };
    const EX = { body: 0, speaker: 0.36, battery: 0.75, board: 1.2, memory: 1.62, cooling: 1.62, keyboard: 2.2 };
    const LEVEL = { body: 0, speaker: 1, battery: 2, board: 3, memory: 4, cooling: 4, keyboard: 5, screen: 6 };
    Object.keys(parts).forEach((name) => {
      const p = parts[name];
      const tgt = activePart === name ? 1 : 0;
      p.h = lerp(p.h, tgt, 1 - Math.exp(-dt * 7));
      // Jo parts active part ke upar hain unhe door uthao, baaki ko halka karo, taaki andar ka part saaf dikhe
      const above = activePart && LEVEL[name] > LEVEL[activePart];
      p.lift = lerp(p.lift, above ? 1.25 * cur.ex : 0, 1 - Math.exp(-dt * 5));
      const fadeTo = !activePart || activePart === name ? 1 : above ? 0.16 : 0.45;
      p.fade = lerp(p.fade, fadeTo, 1 - Math.exp(-dt * 6));
      p.all.forEach((m) => { m.opacity = p.fade; });
      p.mats.forEach(({ m, base }) => { if (m.emissiveIntensity !== undefined) m.emissiveIntensity = base + p.h * 0.5 * glowK; });
      p.lineMat.opacity = Math.min(1, (0.28 + p.h * 0.72) * (0.6 + 0.4 * Math.min(glowK, 1.5))) * p.fade;
      if (name !== "screen") {
        p.g.position.set(0, (Y[name] || 0) + (EX[name] || 0) * ex + p.h * 0.18 * cur.ex + p.lift, 0);
        p.g.scale.setScalar(1 + p.h * 0.025);
      }
    });
    // Screen: hinge par ghoomta hai; explode mein peeche aur upar jata hai
    scr.g.position.set(0, 0.46 + cur.ex * explodeK * 1.45 + scr.lift, -D / 2 + 0.02 - cur.ex * explodeK * 0.95);
    lidPivot.rotation.x = lerp(Math.PI / 2 - 0.04, -0.28 - 0.4 * cur.ex * explodeK, cur.lid);
    scr.g.scale.setScalar(1 + scr.h * 0.02);

    rotor.rotation.y += dt * (3.2 + cur.ex * 6) * (0.4 + spin * 0.6);
    scan.scale.setScalar(0.9 + Math.sin(elapsed * 1.4) * 0.05 + cur.ex * 0.25);
    scanMat.opacity = (0.25 + 0.25 * cur.ex) * Math.min(glowK, 1.5);
    floor.material.opacity = 0.55 * Math.min(glowK, 1.3);

    if (points) {
      points.rotation.y = elapsed * 0.02 * spin;
      points.position.y = (window.scrollY * 0.0012) % 3;
      points.material.opacity = 0.55 * Math.max(0.35, cur.op);
    }

    if (cursorLight && mouse.on) {
      cursor.position.set(mouse.x * halfW, mouse.y * halfH, 4.2);
      cursor.intensity = lerp(cursor.intensity, 55 * glowK * Math.min(1, cur.op + 0.2), 0.08);
    } else {
      cursor.intensity = 0;
    }

    renderer.render(scene, camera);
  }
  frame();

  const onVis = () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (!running && !destroyed) {
      running = true;
      clock.getDelta();
      frame();
    }
  };
  document.addEventListener("visibilitychange", onVis);

  const api = {
    debug() { return { cw: canvas.width, ch: canvas.height, aspect, halfW, halfH, rigPos: rig.position.toArray(), scale: rig.scale.x, cur: { ...cur }, keys: keys_.map((k) => [Math.round(k.y), k.s.op, k.s.ex]), op: canvas.style.opacity }; },
    setPart(name) { activePart = PART_NAMES[name] ? name : null; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      if (ro) ro.disconnect();
      disposables.forEach((o) => { try { if (o && o.dispose) o.dispose(); } catch (err) { /* ignore */ } });
      try { renderer.dispose(); renderer.forceContextLoss(); } catch (err) { /* ignore */ }
      canvas.style.opacity = "";
    }
  };
  if (window.__EW_DEBUG) window.__ewStage = api;
  return api;
}


// ------------------------------------------------------------
// 6. ROUTER + BOOT
//    #/ = published site, #/preview = draft site, #/admin = admin panel
// ------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const els = {
  site: $("#site-root"),
  admin: $("#admin-root"),
  banner: $("#preview-banner"),
  loader: $("#loader")
};

let currentView = null;
let routeSeq = 0;
let adminModule = null;
let authReadyPromise = null;

function hideLoader() {
  if (els.loader) els.loader.classList.add("is-hidden");
}

// Firebase ka pehla login-state aane tak ruko (preview ke liye zaroori).
function authReady() {
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      watchAuth(() => resolve());
    });
  }
  return authReadyPromise;
}

function parseRoute() {
  const h = location.hash || "";
  if (/^#\/admin/i.test(h)) return "admin";
  if (/^#\/preview/i.test(h)) return "preview";
  return "home";
}

function showSite(content) {
  const token = ++siteToken;
  applyAppearance(content);
  els.site.hidden = false;
  els.admin.hidden = true;
  renderSite(content, els.site);
  window.scrollTo(0, 0);

  initNav(els.site);
  initServicePreview(els.site);
  initStageLinks(els.site);
  initBeforeAfter(els.site);
  initTicket(els.site);
  initSmoothScroll();
  initReveal(els.site);
  initParallax(els.site);
  initHeroIntro(els.site);
  initTilt(els.site);
  initCursorGlow(els.site);
  startStage(els.site, content, token);
  hideLoader();
}

async function leaveCurrent() {
  teardownSite();
  if (currentView === "admin" && adminModule) {
    try { adminModule.unmountAdmin(); } catch (err) { console.warn(err); }
  }
  els.admin.hidden = true;
  els.admin.innerHTML = "";
  els.banner.hidden = true;
  document.body.classList.remove("is-admin");
  currentView = null;
}

async function enterHome(seq) {
  await leaveCurrent();
  const { content } = await loadPublished();
  if (seq !== routeSeq) return;
  showSite(content);
  currentView = "home";
}

async function enterPreview(seq) {
  await leaveCurrent();
  await authReady();
  if (seq !== routeSeq) return;
  if (!currentUser()) {
    location.hash = "#/admin"; // login ke bina preview nahi
    return;
  }
  const { content } = await loadDraft();
  if (seq !== routeSeq) return;
  showSite(content);
  els.banner.hidden = false;
  currentView = "preview";
}

async function enterAdmin(seq) {
  await leaveCurrent();
  els.site.hidden = true;
  els.site.innerHTML = "";
  els.admin.hidden = false;
  document.body.classList.add("is-admin");
  document.title = "Admin Panel";
  window.scrollTo(0, 0);

  try {
    adminModule = adminModule || (await import("./admin.js"));
  } catch (err) {
    console.error("admin.js load nahi hua:", err);
    els.admin.innerHTML = '<p style="padding:32px;text-align:center">The Admin Panel could not be loaded. Check that admin.js exists and refresh the page.</p>';
    hideLoader();
    return;
  }
  if (seq !== routeSeq) return;
  adminModule.mountAdmin(els.admin, { iconSvg });
  currentView = "admin";
  hideLoader();
}

async function route() {
  const seq = ++routeSeq;
  const view = parseRoute();
  if (view === currentView) return;
  try {
    if (view === "admin") await enterAdmin(seq);
    else if (view === "preview") await enterPreview(seq);
    else await enterHome(seq);
  } catch (err) {
    console.error("Routing error:", err);
    els.site.hidden = false;
    els.site.innerHTML = '<p style="padding:48px 16px;text-align:center">Something went wrong while loading the page. Please refresh.</p>';
    hideLoader();
  }
}

function boot() {
  if (window.gsap && window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);
  window.addEventListener("hashchange", route);
  route();
  setTimeout(hideLoader, 8000); // loader kabhi atka na rahe
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
