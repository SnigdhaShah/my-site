# Connecting The Dots — Website Design Reference

## Brand Overview

**Connecting The Dots** is the consulting practice of Snigdha Aggarwal Shah — philanthropy strategy advisory for CSR-eligible companies, HNIs, and foundations working in India. The design direction for the website is **Quiet Authority**: warm, credible, and editorial — sitting at the intersection of a trusted senior advisor and a thoughtful institution.

---

## The Logo

The logo is three stylized human figures connected at shoulder level, each rendered in one of the brand's three primary colours. Together they form the letters C–T–D and visually embody the firm's core idea: bringing people, capital, and causes into connection.

- **Left figure** — terracotta red, representing the corporate/donor world
- **Centre figure** — warm sand, representing the bridge / the connector
- **Right figure** — forest green, representing the social sector / nonprofits
- **Wordmark** — "Connecting The Dots" in dark brown, set in a rounded bold sans-serif below the mark

Two versions of the logo exist (landscape and square crop). Both use a white background. For web use, the JPEG at `CTD logo.jpeg` is used in the navigation bar at 40px height.

---

## Colour Palette

All four colours are drawn directly from the brand guidelines PDF.

| Name | Hex | Use |
|---|---|---|
| **Terracotta** | `#C35331` | Primary accent — CTAs, hover states, decorative rules, eyebrow labels, pull quote borders |
| **Warm Sand** | `#D8B99D` | Secondary accent — light backgrounds, subtle highlights (used sparingly on the website) |
| **Forest Green** | `#406052` | Brand secondary — closing CTA band background, future section variants |
| **Dark Brown** | `#412312` | Brand text colour in logo wordmark; reserved — not used as primary web text |
| **Deep Slate** | `#1C2B3A` | Web-specific — primary text, nav, footer backgrounds |
| **Cream** | `#F8F4EE` | Web-specific — primary page background; warm, not clinical white |
| **Cream Alt** | `#F1ECE3` | Web-specific — alternating section background |

### Colour Logic on the Website

- **Terracotta** carries the brand through the page — section numbers, accent lines, hover states, CTA buttons, and the italic hero emphasis.
- **Forest Green** appears once, deliberately, in the closing CTA band — giving it weight and visual finality.
- **Slate** anchors the page in authority — headlines, nav, footer.
- **Cream** provides warmth that plain white cannot; combined with a subtle grain texture overlay, it gives the site a tactile, editorial feel.

---

## Typography

### Brand Guidelines Fonts (from CTD Brand Guidelines PDF)

| Font | Role in guidelines |
|---|---|
| **Agrandir Grand Bold** | Section title pages in the brand guidelines |
| **Aileron** | Body text in the brand guidelines |
| **Open Sans** | Email and contact details on letter heads |
| **Blinker** | Supporting text use |
| **Century Gothic** | Visiting card elements |

### Website Typography

The website uses a separate but harmonious type pairing selected for web performance and the editorial "Quiet Authority" aesthetic:

| Font | Source | Use |
|---|---|---|
| **Cormorant Garamond** | Google Fonts | All display headlines, section titles, pull quotes, testimonials, credentials — weight 300–500 |
| **DM Sans** | Google Fonts | Body copy, navigation, labels, buttons, form fields — weight 300–500 |

**Why this pairing:** Cormorant Garamond's refinement and warmth echo the brand's philanthropic seriousness — it reads like a well-designed annual report, not a startup pitch. DM Sans keeps navigation and body copy legible and clean without competing.

**Type scale:**
- Hero headline: `clamp(50px, 6.8vw, 86px)` — Cormorant Garamond 400
- Section titles: `clamp(34px, 4.2vw, 54px)` — Cormorant Garamond 400
- CTA headline: `clamp(36px, 4.8vw, 58px)` — Cormorant Garamond 400
- Body: `16–17px` — DM Sans 300
- Labels / eyebrows: `11–12px`, `letter-spacing: 0.14–0.20em`, uppercase — DM Sans 500
- Buttons: `12px`, `letter-spacing: 0.12em`, uppercase — DM Sans 500

---

## Design Direction: Quiet Authority

The overarching aesthetic is deliberately **not** a typical nonprofit website (soft, cause-imagery-heavy, primary colours on white) and **not** a standard consulting website (cold, corporate, dense). It sits between — editorial and considered.

**What it looks like:** Warm cream pages, generous negative space, large serif headlines, thin ruled lines as structural dividers, a single consistent accent colour (terracotta) used with restraint.

**What it feels like:** A trusted advisor's workspace — warm but structured, personal but credible. The grain texture overlay adds tactility. The scroll-reveal animations are slow and deliberate, not snappy.

**What makes it distinctly CTD:** The three logo colours (terracotta, sand, green) each appear in the website at meaningful moments — terracotta throughout as the primary connective thread, the warm sand background tones in the alternating sections, and forest green as the single most important section close.

---

## Page Structure

| Section | Notes |
|---|---|
| **Navigation** | Fixed, transparent → frosted glass on scroll. Logo image left, nav links right, "Let's talk" CTA button |
| **Hero** | Full viewport. Large serif headline with italic terracotta emphasis. Eyebrow label, subhead, CTA |
| **About (01)** | 2-column: narrative left, pull quote + credential stats right |
| **Services (02)** | 2-column ruled grid, 5 capabilities. Hover turns title terracotta |
| **Clients (03)** | 3-column cards with expanding terracotta rule on hover |
| **Testimonials (04)** | Single testimonial (Erica Yaeger, Aatmic Philanthropy). Placeholders removed — to be added when received |
| **CTA Band** | Forest green `#406052` background. Cream headline + subhead + ghost button |
| **Contact (05)** | 2-column: contact info left, form right. Focus states in terracotta |
| **Footer** | Deep slate. Brand name + firm name left, legal right |

---

## CSS Variables (styles.css)

```css
--cream:        #F8F4EE;
--cream-alt:    #F1ECE3;
--slate:        #1C2B3A;
--slate-mid:    #3C4F63;
--slate-soft:   #6B7F94;
--slate-muted:  #98A9B7;
--terra:        #C4775A;   /* brand terracotta, slightly softened for web */
--gold:         #B49B6E;
--forest:       #406052;   /* brand green — exact from guidelines */
--border:       #D8CFC3;
--border-light: #E8E1D7;
--white:        #FFFFFF;

--display: 'Cormorant Garamond', Georgia, serif;
--sans:    'DM Sans', -apple-system, sans-serif;
```

---

## Contact & Brand Identity Details

- **Website (future):** ctdforgood.org
- **Email:** snigdha.a.shah@gmail.com
- **LinkedIn:** https://www.linkedin.com/in/snigdhaas/
- **Social handle:** @ctdforgood
- **Founded:** 2026
- **Guidelines created:** May 2026 (Canva, designed by Macaulay Lewis)

---

## Files in `/my-site`

| File | Description |
|---|---|
| `index.html` | Full single-page website |
| `styles.css` | All styles — no framework, pure CSS |
| `CTD logo.jpeg` | Primary logo (JPEG, white background) — used in nav |
| `Connecting_The_Dots.png` | Logo variant (PNG) — higher quality, suitable for print/export |
| `CTD Brand Guidelines.pdf` | Full brand guidelines document |
| `design.md` | This file |
