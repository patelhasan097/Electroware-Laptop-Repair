# Electroware Laptop Repair Website

A static, editorial-style website for Electroware Laptop Repair with a Firebase-powered Admin Panel.
Built with HTML, CSS, vanilla JavaScript, Three.js, GSAP, ScrollTrigger and Lenis. No build step needed.

## Files (all in one folder, no sub-folders)

- `index.html`: page shell, loads fonts, libraries and `app.js`
- `style.css`: public website design
- `admin.css`: Admin Panel design
- `app.js`: public website, routing, animations and the 3D hero
- `firebase.js`: Firebase configuration, startup and admin login
- `content.js`: default content, safe helpers, load / save draft / publish
- `admin.js`: the whole Admin Panel
- `firestore.rules`: Firestore security rules (publish them in the Firebase Console)
- `logo.svg`, `favicon.svg`: original logo and favicon
- `README.md`: this file

## Design notes

- Concept: a scroll-driven 3D laptop teardown. The laptop (built from code, no 3D files) opens in the hero, splits into layers in Services, and the part matching the service you point at glows.
- Look: near-black with copper and mint (default "Circuit Copper"), serif headlines, mono labels, film grain, glow that follows the mouse, 3D tilt cards.
- Phones and devices without WebGL automatically get the photo version. 3D can also be turned off in Admin.
- Contact: "repair ticket" form opens WhatsApp (or email) with details pre-filled. Nothing is stored.
- Gallery: add a "before" photo to any item and visitors get a drag slider. Gallery and Testimonials stay hidden until real content is added.

## Admin Panel: Design Studio

- Design Studio: 6 ready-made colour looks, 8 colour pickers, 18 Google fonts (headings, body, labels), 3D settings (on/off, particles, sway, teardown spread, glow, laptop colour), motion settings (appear animation, corners, grain, smooth scroll, cursor glow, tilt, marquee) and a live preview.
- Sections & Order: show, hide and re-order sections.
- Services: each service can choose which part of the 3D laptop lights up.
- The Admin Panel itself follows the accent colour the client picks.
- Every change goes to the draft first. Preview Draft, then Publish.

## Photos and credits

The starter photos are free-licence Unsplash images linked directly (see credits line in the footer, editable in Admin > Logo & Footer).
They are mood photos only, not Electroware's own work. Replace them with the workshop's real photos by pasting new links in the Admin Panel.
If a stock photo ever disappears, a neutral placeholder is shown instead of a broken image.

## Routes (hash based, so refresh always works)

- `#/` public website (published content only)
- `#/preview` draft preview (admin login required)
- `#/admin` Admin Panel

## How content works

- The website text lives in Firestore: `site/published` (public) and `site/draft` (admin only).
- Save Draft stores work privately. Preview Draft shows it. Publish copies the draft to the live website.
- If Firebase is not configured or has no content yet, built-in starter content from `content.js` is shown.
- Gallery and Testimonials sections stay hidden until real content is added.

## Images

Images are managed by pasting public image links (https://...). The Admin Panel shows a preview.
Uploading from a phone or computer gallery needs an image storage service, which is not part of this version.
Tip: image files placed in the project folder can be used with a relative path such as `images/photo1.jpg`.

## Security

- Only Firebase UIDs listed in `firestore.rules` can write content or read the draft.
- The public can only read `site/published`. Everything else is denied.
- The Firebase web config in `firebase.js` is public by design. Never put service-account keys or private keys in this project.
- There is no sign-up screen. Admin accounts are created in the Firebase Console.

## Hosting

- Demo: GitHub Pages. Upload all files to the repository root and enable Pages.
- Production: upload the same files to the `public_html` folder on Hostinger, then add the new domain under
  Firebase Console > Authentication > Settings > Authorized domains.
- All asset paths are relative, so no code changes are needed when moving hosts.

## Good to know

- Open the site through a local server (for example VS Code Live Server). Opening `index.html` by double-click does not work because the code uses ES modules.
- Some websites block their images from being shown on other sites. If a pasted image does not load, use a different direct image link.
