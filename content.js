// ============================================================
// content.js: helpers + default content + Firestore content operations
// ============================================================
import {
  doc,
  getDoc,
  setDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db, auth, isFirebaseConfigured } from "./firebase.js";

// ------------------------------------------------------------
// 1. SAFE HELPERS (admin se aaya text page par yahin se safe hoke jata hai)
// ------------------------------------------------------------
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

// kind = "image": sirf http(s) ya relative path.
// kind = "link": http(s), mailto, tel, #anchor ya relative path.
// "javascript:" jaise URLs block ho jate hain (empty string return hoti hai).
export function safeUrl(url, kind = "link") {
  const u = String(url ?? "").trim();
  if (!u || u.startsWith("//")) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (kind === "image") return HAS_SCHEME.test(u) ? "" : u;
  if (/^(mailto:|tel:)/i.test(u)) return u;
  if (u.startsWith("#")) return u;
  return HAS_SCHEME.test(u) ? "" : u;
}

export function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function cloneContent(value) {
  return clone(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Naye items ke liye unique id.
export function makeId(prefix = "item") {
  return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ------------------------------------------------------------
// 2. DEFAULT CONTENT
// ------------------------------------------------------------

// Icons jo services mein select ho sakte hain.
export const ICON_KEYS = [
  "screen", "battery", "keyboard", "chip", "power", "fan",
  "storage", "software", "water", "hinge", "memory", "search",
  "shield", "clock", "spark", "wrench", "speaker"
];

// 3D laptop ke hisse jinhe service se jodkar chamkaya ja sakta hai
export const STAGE_PARTS = [
  ["auto", "Automatic"],
  ["screen", "Screen"],
  ["keyboard", "Keyboard"],
  ["battery", "Battery"],
  ["board", "Motherboard"],
  ["memory", "RAM and SSD"],
  ["speaker", "Speakers"],
  ["body", "Body and hinges"],
  ["cooling", "Fan and cooling"]
];

// Ready-made colour looks. Client ek click mein badal sakta hai.
export const THEME_PRESETS = [
  { id: "circuit-copper", name: "Circuit Copper", note: "Warm copper on black. Feels like a real circuit board.",
    colors: { accent: "#FF9F43", accent2: "#2EE6C5", bg: "#07080B", surface: "#0E1015", text: "#F4EFE8", paper: "#EFE9DD", ink: "#0B0C10", laptopColor: "#2B2F39" } },
  { id: "electric-cyan", name: "Electric Cyan", note: "Cool, clean and technical.",
    colors: { accent: "#22D3EE", accent2: "#6366F1", bg: "#05080F", surface: "#0B1220", text: "#F1F6FC", paper: "#E8EDF2", ink: "#0A0F18", laptopColor: "#243044" } },
  { id: "neon-volt", name: "Neon Volt", note: "Acid lime on near-black. Loud and confident.",
    colors: { accent: "#C6FF3D", accent2: "#FF4D8D", bg: "#070806", surface: "#101209", text: "#F5F7EC", paper: "#EEF0E2", ink: "#0B0D07", laptopColor: "#2A2E22" } },
  { id: "royal-violet", name: "Royal Violet", note: "Deep violet with a soft pink glow. Premium.",
    colors: { accent: "#A78BFA", accent2: "#F472B6", bg: "#08060F", surface: "#110D1E", text: "#F5F1FC", paper: "#EEE9F6", ink: "#0D0916", laptopColor: "#2E2840" } },
  { id: "crimson-forge", name: "Crimson Forge", note: "Hot red and amber. Workshop energy.",
    colors: { accent: "#FF4D4D", accent2: "#FFB020", bg: "#0B0606", surface: "#150D0D", text: "#FBF1EE", paper: "#F1E8E3", ink: "#110808", laptopColor: "#352A2A" } },
  { id: "mint-lab", name: "Mint Lab", note: "Fresh green on deep teal-black. Calm and clean.",
    colors: { accent: "#3DF2A6", accent2: "#38BDF8", bg: "#05090A", surface: "#0B1414", text: "#EEF8F5", paper: "#E6EFEC", ink: "#08100F", laptopColor: "#22332F" } }
];

// Google Fonts jo client chun sakta hai. "q" = Google Fonts ka family query.
export const FONT_CHOICES = {
  display: [
    { name: "Fraunces", q: "Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600", note: "Editorial serif" },
    { name: "Instrument Serif", q: "Instrument+Serif:ital@0;1", note: "Elegant, high contrast" },
    { name: "Playfair Display", q: "Playfair+Display:ital,wght@0,400..700;1,400..700", note: "Classic luxury" },
    { name: "Cormorant Garamond", q: "Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600", note: "Refined and light" },
    { name: "Bricolage Grotesque", q: "Bricolage+Grotesque:opsz,wght@12..96,400..700", note: "Modern, characterful" },
    { name: "Space Grotesk", q: "Space+Grotesk:wght@400..700", note: "Technical and sharp" },
    { name: "Syne", q: "Syne:wght@400..700", note: "Bold and artistic" },
    { name: "Unbounded", q: "Unbounded:wght@400..700", note: "Wide, futuristic" }
  ],
  body: [
    { name: "DM Sans", q: "DM+Sans:opsz,wght@9..40,400..600", note: "Clean" },
    { name: "Inter", q: "Inter:wght@400..600", note: "Neutral" },
    { name: "Manrope", q: "Manrope:wght@400..600", note: "Friendly modern" },
    { name: "Outfit", q: "Outfit:wght@400..600", note: "Geometric" },
    { name: "Plus Jakarta Sans", q: "Plus+Jakarta+Sans:wght@400..600", note: "Soft and premium" },
    { name: "Work Sans", q: "Work+Sans:wght@400..600", note: "Sturdy" }
  ],
  mono: [
    { name: "JetBrains Mono", q: "JetBrains+Mono:wght@400;500", note: "Developer favourite" },
    { name: "IBM Plex Mono", q: "IBM+Plex+Mono:wght@400;500", note: "Engineered" },
    { name: "Space Mono", q: "Space+Mono:wght@400;700", note: "Retro tech" },
    { name: "Fira Code", q: "Fira+Code:wght@400;500", note: "Crisp" }
  ]
};

// Section order ke liye (hero, marquee aur footer fixed rehte hain)
export const SECTION_ORDER = ["about", "services", "band", "expertise", "why", "gallery", "process", "testimonials", "contact"];
export const SECTION_LABELS = {
  about: "About", services: "Services", band: "Photo band (quote)", expertise: "Technical expertise",
  why: "Why choose us", gallery: "Repair gallery", process: "Repair process", testimonials: "Testimonials", contact: "Contact"
};

// Photos: Unsplash (free licence). Credits footer mein dikhte hain.
const U = "https://images.unsplash.com/";
const Q = "?auto=format&fit=crop&q=80&w=";
const IMG = {
  hero: U + "photo-1518770660439-4636190af475" + Q + "2000",
  about: U + "photo-1721333089073-215a56fd710c" + Q + "1400",
  band: U + "photo-1785947058973-43d5e9c64ef7" + Q + "2000",
  board: U + "photo-1705494833979-9377fbdee229" + Q + "1200",
  battery: U + "photo-1769085794153-54fd3d57efaf" + Q + "1200",
  drive: U + "photo-1620368523635-df9d83338fc1" + Q + "1200",
  parts: U + "photo-1620283085439-39620a1e21c4" + Q + "1200",
  bench: U + "photo-1721332154191-ba5f1534266e" + Q + "1200"
};

export const DEFAULT_CONTENT = {
  brand: {
    name: "Electroware",
    suffix: "Laptop Repair",
    logoUrl: "logo.svg",
    faviconUrl: "favicon.svg"
  },

  appearance: {
    preset: "circuit-copper",
    accent: "#FF9F43",
    accent2: "#2EE6C5",
    bg: "#07080B",
    surface: "#0E1015",
    text: "#F4EFE8",
    paper: "#EFE9DD",
    ink: "#0B0C10",
    laptopColor: "#2B2F39",

    fontDisplay: "Fraunces",
    fontBody: "DM Sans",
    fontMono: "JetBrains Mono",

    enable3D: true,
    particles: true,
    particleDensity: "medium",
    spin: 1,
    explode: 1,
    glow: 1,
    cursorLight: true,

    smoothScroll: true,
    reveal: "rise",
    cursorGlow: true,
    tiltCards: true,
    grain: 0.07,
    corners: "sharp",
    marquee: true
  },

  layout: {
    order: ["about", "services", "band", "expertise", "why", "gallery", "process", "testimonials", "contact"],
    hidden: []
  },

  hero: {
    eyebrow: "Laptop repair workshop · Mumbai",
    headline: "Precision Repairs. Powerful Performance.",
    subheadline: "Screens, batteries, keyboards, motherboards and more. Diagnosed honestly and repaired with genuine parts.",
    experienceNumber: "7+",
    experienceLabel: "Years Experience",
    imageUrl: IMG.hero,
    facts: ["All major brands", "Genuine parts", "Honest pricing"],
    primaryCta: { label: "Book a Repair", href: "#contact" },
    secondaryCta: { label: "Explore Services", href: "#services" }
  },

  about: {
    eyebrow: "About us",
    title: "A workshop built on careful diagnosis.",
    paragraphs: [
      "Electroware Laptop Repair is a laptop and computer repair workshop with 7+ years of hands-on experience.",
      "From dead motherboards to cracked bodies, every laptop is checked carefully, the fault is explained in plain language, and the repair is done with genuine parts."
    ],
    imageUrl: IMG.about,
    highlights: ["All major brands", "Genuine parts", "Honest diagnosis"]
  },

  band: {
    quote: "Honest diagnosis. Genuine parts. Your laptop, brought back to life.",
    imageUrl: IMG.band
  },

  sections: {
    services: {
      eyebrow: "Services",
      title: "What we repair",
      subtitle: "Every fault gets the same care, from a worn-out battery to a dead motherboard."
    },
    expertise: {
      eyebrow: "Expertise",
      title: "Technical expertise",
      subtitle: "What goes into every repair."
    },
    whyUs: {
      eyebrow: "Why choose us",
      title: "Why people bring their laptops here",
      subtitle: ""
    },
    gallery: {
      eyebrow: "Gallery",
      title: "Repair gallery",
      subtitle: "Real repairs from the bench. Drag the slider to see before and after."
    },
    process: {
      eyebrow: "Process",
      title: "How a repair works",
      subtitle: "Simple, clear and transparent."
    },
    testimonials: {
      eyebrow: "Testimonials",
      title: "What customers say",
      subtitle: ""
    },
    contact: {
      eyebrow: "Contact",
      title: "Let's fix your laptop.",
      subtitle: "Call, message or fill in the ticket. We will come back with a quick diagnosis and quote."
    }
  },

  // Sab services equal importance ki hain.
  services: [
    { id: "svc-screen", part: "screen", icon: "screen", title: "Screen Replacement", description: "Cracked, flickering or dead displays replaced.", imageUrl: "" },
    { id: "svc-battery", part: "battery", icon: "battery", title: "Battery Replacement", description: "Restore long-lasting battery life with quality cells.", imageUrl: IMG.battery },
    { id: "svc-keyboard", part: "keyboard", icon: "keyboard", title: "Keyboard Replacement", description: "Faulty or missing keys replaced with matching keyboards.", imageUrl: "" },
    { id: "svc-board", part: "board", icon: "chip", title: "Motherboard Chip-Level Repair", description: "Power, no-display and short-circuit faults fixed at the chip level.", imageUrl: IMG.board },
    { id: "svc-speaker", part: "speaker", icon: "speaker", title: "Speaker Replacement", description: "Clear sound again. Distorted or silent speakers fixed.", imageUrl: "" },
    { id: "svc-upgrade", part: "memory", icon: "storage", title: "RAM & SSD Upgrades", description: "Faster speed and more storage for your laptop.", imageUrl: IMG.drive },
    { id: "svc-body", part: "body", icon: "hinge", title: "Body Fabrication", description: "Broken bodies, hinges and casings repaired and rebuilt.", imageUrl: "" },
    { id: "svc-parts", part: "cooling", icon: "wrench", title: "Parts & Accessories", description: "Genuine replacement parts for all major laptop brands.", imageUrl: IMG.parts }
  ],

  expertise: [
    { id: "exp-chip", title: "Chip-level repair", description: "Tracing power, no-display and short-circuit faults on the board." },
    { id: "exp-diag", title: "Diagnostics", description: "Testing step by step to find the real cause before anything is replaced." },
    { id: "exp-comp", title: "Component replacement", description: "Batteries, speakers and other parts swapped with matching replacements." },
    { id: "exp-up", title: "RAM / SSD upgrades", description: "Memory and storage upgrades, installed and tested." },
    { id: "exp-dk", title: "Display & keyboard", description: "Screens and keyboards replaced and checked end to end." },
    { id: "exp-body", title: "Body fabrication", description: "Hinges, lids and casings repaired or rebuilt." }
  ],

  whyUs: [
    { id: "why-chip", title: "Faults traced to the component", description: "We look for the actual failure instead of swapping parts and hoping." },
    { id: "why-parts", title: "Genuine parts", description: "Replacement parts that match your laptop." },
    { id: "why-honest", title: "Honest diagnosis", description: "A clear explanation of the fault and the price before the repair starts." },
    { id: "why-quick", title: "Quick turnaround", description: "Repairs are done as quickly as the fault allows." }
  ],

  // Khaali: jab tak real repair photos na daalo, section hidden rahega.
  // Har item: imageUrl (after), beforeUrl (optional), caption
  gallery: [],

  process: [
    { id: "pro-1", title: "Diagnose", description: "We inspect the laptop and find the cause of the fault." },
    { id: "pro-2", title: "Explain", description: "You get a clear explanation and a quote before work begins." },
    { id: "pro-3", title: "Repair", description: "The repair is carried out carefully, with genuine parts." },
    { id: "pro-4", title: "Test & handover", description: "We test the laptop and hand it back to you." }
  ],

  // Khaali: jab tak asli testimonials na hon, section hidden rahega.
  testimonials: [],

  contact: {
    email: "ahmadmeuwa8879@gmail.com",
    phone: "99207 09340",
    phone2: "88798 22576",
    whatsapp: "919920709340",
    address: "Pathanwadi, Malad East, Mumbai 400097",
    hours: "",
    note: "Genuine parts · Honest pricing"
  },

  footer: {
    text: "Precision laptop and computer repair.",
    copyrightName: "Electroware Laptop Repair",
    credits: "Photography via Unsplash: Alexandre Debiève, Samsung Memory, Claudimir Pachioni, Andrey Matveev, Zoshua Colah, Artiom Vallat."
  }
};

export function getDefaultContent() {
  return clone(DEFAULT_CONTENT);
}

// Default content ke upar saved content merge karta hai.
// Arrays (services, gallery, etc.) poori tarah replace hote hain.
export function deepMerge(base, override) {
  if (override === undefined || override === null) return clone(base);
  if (Array.isArray(override)) return clone(override);
  if (isPlainObject(base) && isPlainObject(override)) {
    const out = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(override)]);
    keys.forEach((key) => {
      out[key] = deepMerge(base[key], override[key]);
    });
    return out;
  }
  return clone(override);
}

// ------------------------------------------------------------
// 3. FIRESTORE OPERATIONS
//    site/published = public site ka content
//    site/draft     = admin ka working copy
// ------------------------------------------------------------
const publishedRef = () => doc(db, "site", "published");
const draftRef = () => doc(db, "site", "draft");

// Public website: sirf published content.
export async function loadPublished() {
  if (!isFirebaseConfigured || !db) {
    return { content: getDefaultContent(), source: "default" };
  }
  try {
    const snap = await getDoc(publishedRef());
    if (snap.exists() && snap.data().content) {
      return { content: deepMerge(DEFAULT_CONTENT, snap.data().content), source: "published" };
    }
  } catch (err) {
    console.warn("Could not load published content, using default content.", err);
  }
  return { content: getDefaultContent(), source: "default" };
}

// Admin: draft load karo. Draft na ho to published/default se shuru karo.
export async function loadDraft() {
  if (!isFirebaseConfigured || !db || !auth || !auth.currentUser) {
    return { content: getDefaultContent(), source: "default" };
  }
  try {
    const snap = await getDoc(draftRef());
    if (snap.exists() && snap.data().content) {
      return { content: deepMerge(DEFAULT_CONTENT, snap.data().content), source: "draft" };
    }
  } catch (err) {
    console.warn("Could not load draft.", err);
  }
  return loadPublished();
}

function requireAdminSession() {
  if (!isFirebaseConfigured || !db || !auth || !auth.currentUser) {
    throw new Error("Please log in as admin first.");
  }
  return auth.currentUser.uid;
}

// Kya logged-in user firestore.rules ke admin allowlist mein hai?
// Rules asli security dete hain; ye check sirf admin screen dikhane ke liye hai.
export async function checkAdminAccess() {
  if (!isFirebaseConfigured || !db || !auth || !auth.currentUser) return false;
  try {
    await getDoc(draftRef());
    return true;
  } catch (err) {
    if (err && err.code === "permission-denied") return false;
    throw err;
  }
}

// Draft save karo (public site par kuch nahi badlega).
export async function saveDraft(content) {
  const uid = requireAdminSession();
  await setDoc(draftRef(), {
    content: clone(content),
    updatedAt: serverTimestamp(),
    updatedBy: uid
  });
}

// Publish: published aur draft dono ek saath update (ek batch mein).
export async function publish(content) {
  const uid = requireAdminSession();
  const clean = clone(content);
  const batch = writeBatch(db);
  batch.set(publishedRef(), {
    content: clean,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    publishedAt: serverTimestamp()
  });
  batch.set(draftRef(), {
    content: clean,
    updatedAt: serverTimestamp(),
    updatedBy: uid
  });
  await batch.commit();
}

// Dashboard ke liye: draft aur published ki timing.
export async function getWorkflowStatus() {
  requireAdminSession();
  const [pubSnap, draftSnap] = await Promise.all([getDoc(publishedRef()), getDoc(draftRef())]);
  const pub = pubSnap.exists() ? pubSnap.data() : null;
  const draft = draftSnap.exists() ? draftSnap.data() : null;

  const ms = (ts) => (ts && typeof ts.toMillis === "function" ? ts.toMillis() : null);
  const publishedAt = pub ? ms(pub.publishedAt) : null;
  const draftAt = draft ? ms(draft.updatedAt) : null;

  let hasUnpublished = false;
  if (draft && !pub) hasUnpublished = true;
  else if (draft && pub && draftAt && publishedAt) hasUnpublished = draftAt > publishedAt;

  return {
    hasPublished: !!pub,
    hasDraft: !!draft,
    publishedAt,
    draftAt,
    hasUnpublished
  };
}
