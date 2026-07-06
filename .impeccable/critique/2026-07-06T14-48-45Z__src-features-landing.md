---
target: Landing page (marketing surface)
total_score: 17
p0_count: 0
p1_count: 5
timestamp: 2026-07-06T14-48-45Z
slug: src-features-landing
---
# Critique — Landing page (marketing surface)

Method: dual-agent (A: design review · B: detector) — browser evidence skipped (dev server not running)
Paths: src/features/landing

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | Scroll-state header and active-tab states exist, but the assistant demo shows a disabled input beside an enabled Send button (dead control that looks live), and env-fallback '#' links give no feedback when clicked. |
| 2 | Match between system and real world | 1 | 'Pricing/-' literal typo in nav (header.tsx:276,413); assistant demo fabricates email/incident-management capabilities; FAQ contradicts the features section on whether the AI learns; 'Learn More' button routes to /pricin |
| 3 | User control & freedom | 1 | Module tabs switch on onMouseEnter only (feature-section.tsx:69) and AI-feature descriptions appear only on hover — content users cannot choose to reach by click/keyboard; zero prefers-reduced-motion handling with infini |
| 4 | Consistency & standards | 2 | Emoji icons in the mega menu vs lucide everywhere else; rainbow accents (blue/green/purple/indigo/cyan) dilute the purple/pink brand; Privacy Policy linked twice in footer; <Link><Button> nesting produces button-inside-a |
| 5 | Error prevention | 1 | Missing env vars silently ship href="#" links with external-link icons and a 'mailto:undefined' address (footer.tsx:129-183); Supademo iframe and module screenshots have no fallback; replacement-section arrows detach on  |
| 6 | Recognition over recall | 3 | Mega menu with name+description per module is genuinely scannable; but the mobile comparison table keeps a 3-column header while rows stack to 1 column, forcing users to remember which line is 'Traditional' vs 'Proddy'. |
| 7 | Flexibility & efficiency | 2 | Sticky header CTA and smooth anchor scroll help, but the home hero fold has no signup CTA at all, and the hover-open/hover-close mega menu has no forgiveness corridor. |
| 8 | Aesthetic & minimalist design | 1 | Blob backdrops x8, badge-pill kickers x6, highlighter underlines x4, 01-04 numbered card badges, floating fake-testimonial cards — template grammar with no POV; fails the brand register's 'go big or go home' bar and the  |
| 9 | Help users recover from errors | 1 | No error state anywhere: broken iframe, missing images, dead links, and misaligned SVG arrows all fail silently. |
| 10 | Help & documentation | 3 | FAQ is present and honestly written; footer exposes Help/Status/Feedback/Support (Tidio) — though all four depend on unset-able env vars. |
| **Total** | | **17/40** | |

## Anti-Patterns Verdict

This landing surface is the modal AI-generated SaaS template, executed almost verbatim: pill-badge kicker, twin blur-blob backdrop, bold headline with one brand-colored word and a highlighter-underline span, identical card grids, a green-check/red-X comparison table, and a CTA block ending in "No credit card required." The blob pair (`bg-primary/5 blur-3xl` + `bg-secondary/5 blur-3xl`) is copy-pasted into 8 of 9 sections — the exact "floating blur-blobs behind every section" anti-reference in the product's own PRODUCT.md. A user fluent in Linear/Notion/Figma would not trust it: they'd catch the literal "Pricing/-" typo in the primary nav within seconds, then notice a fabricated "4.9/5 average rating from over 1,000 teams" card sitting next to a "Free Public Beta" badge, an AI demo claiming email-triage capabilities the product doesn't have, and an FAQ that directly contradicts the feature card above it ("learns from team interactions" vs "doesn't currently learn"). There is no named aesthetic lane, no typographic voice (headings are the app's default font at text-4xl/6xl bold), and no color strategy beyond scattering off-palette blue/green/indigo accents around the brand purple. It fails both the brand slop test and the product's own anti-reference list.

**Deterministic scan**: 16 findings — side-tab ×8, gray-on-color ×4, bounce-easing ×4.
Suspected false positives: 1 (assistant/hero-section.tsx:259,263,267 — suspected FP: animate-bounce here implements a conventional three-dot 'typing…' indicator (staggered delays), a deliberate idiom rather than tacky element easing)

## Cognitive Load

- Chunking <=4 FAILED: feature-section renders every entry of features-data's 'features' array — Tasks shows 10 bullets, Reports 9, Boards 9 — as a flat 'Key Features' list (features-data.tsx:88-99 rendered at feature-section.tsx:110-120).
- <=4 visible options per decision point FAILED: the Features mega menu presents 9 simultaneous destinations (8 modules + assistant highlight) in one dropdown (header.tsx:193-238).
- No working-memory bridges FAILED: on mobile, comparison-section's header row stays grid-cols-3 while data rows collapse to grid-cols-1 (comparison-section.tsx:27 vs 111), so users must remember which stacked line is 'Traditional Tools' vs 'Proddy'.
- Progressive disclosure FAILED (inverted): ai-features-section hides all four descriptions at opacity-0 until mouse hover on desktop (ai-features-section.tsx:102-117) — disclosure is gated on a pointer, not on user intent.
- Single focus FAILED: comparison-section's right column stacks a dashboard screenshot, a floating check bubble, and two floating testimonial cards (comparison-section.tsx:137-184) — three competing focal elements in one composition; home hero similarly splits attention between headline, badge, demo iframe, and animated scroll cue with no CTA to anchor it.

## What's Working

- FAQ copy is plain-spoken and honest — it admits the assistant does not learn from usage over time and states beta pricing plainly; closest section to PRODUCT.md's brand voice.
- Mega menu IA is good: 8 modules each with a name plus a 4-6 word plain-verb description, plus a differentiated assistant entry — scannable and honest.
- Mobile menu has full nav parity with desktop and closes on navigation; header handles Escape on the dropdown.
- features-data.tsx is a single source of truth consumed by both the home feature explorer and /features — content edits happen in one place.
- Consistent max-w-7xl container rhythm and py-16/24 section spacing gives the pages a stable structural grid.
- Footer content is real (support chat hook, status page, careers, feedback) rather than placeholder filler, and 'Made with love in Bengaluru' is an actual human note.

## Priority Issues

### [P1] Fabricated social proof and capabilities: comparison-section renders a fake 'Customer Quote' ('cut our tool costs by 40%') and a '4.9/5 average rating from over 1,000 teams' card, while the assistant hero's demo transcript claims email triage ('12 unread emails - 2 urgent from stakeholders') and P1-incident management — features Proddy does not have.

**Why**: PRODUCT.md explicitly bans dark patterns and fake urgency; the target audience is 'competent operators' who will spot invented ratings on a free-public-beta product instantly. This is a trust and potentially legal (false advertising) problem, and it torpedoes conversion with exactly the buyers Proddy wants.

**Fix**: Delete both floating cards in comparison-section.tsx (lines 153-184) until real testimonials/ratings exist. Rewrite the assistant demo transcript in assistant/hero-section.tsx (lines 194-241) to only show real capabilities: channel summaries, task status, calendar lookups.
**Files**: src/features/landing/home/comparison-section.tsx, src/features/landing/assistant/hero-section.tsx

### [P1] Keyboard and touch users cannot reach most of the content: module tabs in feature-section switch only via onMouseEnter (no onClick, so Enter/Space on the focused button does nothing); ai-features descriptions render at opacity-0 unless hovered on desktop; use-cases tabs become icon-only below sm with no aria-label.

**Why**: 7 of 8 module descriptions and all 4 AI-feature descriptions are permanently invisible to keyboard-only users (Sam), and icon-only tabs are unnamed for screen readers. PRODUCT.md calls keyboard paths 'non-negotiable'.

**Fix**: Add onClick={() => setActiveTab(feature.id)} plus role=tablist/tab/aria-selected semantics in feature-section.tsx:61-79 (keep mouseenter as an enhancement). In ai-features-section.tsx, show descriptions by default or expand on focus-within as well as hover, and remove cursor-pointer from non-clickable cards. In use-cases-section.tsx:139 add aria-label={tab.label} to each TabsTrigger.
**Files**: src/features/landing/home/feature-section.tsx, src/features/landing/home/ai-features-section.tsx, src/features/landing/assistant/use-cases-section.tsx

### [P1] Literal typo 'Pricing/-' in the primary navigation, shipped in both desktop (line 276) and mobile (line 413) menus.

**Why**: It's on every marketing page's most-scanned element. A single stray '/-' in the nav reads as 'nobody looked at this page', which is fatal on a surface whose entire job is first impressions.

**Fix**: Change both link labels to 'Pricing' in header.tsx.
**Files**: src/features/landing/components/header.tsx

### [P1] Dark-mode collision on non-/home marketing routes: only /home force-removes the .dark class (src/app/home/layout.tsx MutationObserver); /assistant, /features, /pricing etc. keep a logged-in user's dark theme, where globals.css's `.dark [class*="bg-white"]` override forces every landing bg-white card/header to hsl(var(--card)) with !important while child text stays hard-coded text-gray-900/600/700.

**Why**: A dark-theme workspace user clicking 'AI Assistant' or 'Features' from the marketing nav gets dark card surfaces with mid-gray text — contrast ratios collapse well below 4.5:1 and headings on forced-dark cards become near-invisible. This is the highest-traffic path from product back to marketing.

**Fix**: Either give the whole marketing route group one layout that scopes light mode (a route-group layout wrapping in a .light container plus tokens, not a MutationObserver), or replace hard-coded gray-*/bg-white utilities with theme tokens (bg-background, text-foreground, text-muted-foreground, border-border) so the pages are legitimately theme-aware.
**Files**: src/app/home/layout.tsx, src/features/landing/components/header.tsx, src/features/landing/components/footer.tsx, src/features/landing/assistant/hero-section.tsx, src/features/landing/assistant/faq-section.tsx, src/features/landing/assistant/features-section.tsx

### [P1] Home hero has no call to action: the first fold contains a badge, headline, one sentence, and a Supademo iframe — the only actions are the header's Get Started and a 'Discover More' scroll cue that fades in after a 1.5s delay.

**Why**: The single most important conversion element of the site is missing from the fold. Impatient evaluators (Alex) must hunt back to the header; on mobile the header CTA is buried inside the hamburger menu, so mobile visitors see no signup path at all without opening the menu.

**Fix**: Add a primary 'Get started free' button (and secondary 'See how it works' anchor) directly under the subheadline in home/hero-section.tsx, before the demo embed; drop the 1.5s-delayed scroll cue.
**Files**: src/features/landing/home/hero-section.tsx

### [P2] Template slop grammar violating explicit bans: identical blur-blob backdrop pair in 8 sections, badge-pill kickers on 6 sections (two in shouting caps: 'AI-POWERED FEATURES', 'WHY PRODDY?'), the secondary/20 highlighter-underline motif repeated 4 times, 01-04 numbered card badges (ai-features-section computes them as `0{delay - 2}` from an overloaded delay prop), and 4px left-stripe accent borders on the use-cases chat bubbles (side-stripe ban).

**Why**: PRODUCT.md's anti-references ban blur-blobs and buzzword badge-pills; the brand register bans repeated kickers-as-section-grammar, numbered scaffolding, and >1px side-stripes. Together they make the page read as AI-generated, which for a brand surface is the failure condition itself.

**Fix**: One design pass: delete all decorative blob divs; keep at most one kicker on the page (hero) and cut the rest; remove the highlighter spans, number badges, and border-l-4 stripes; then commit to a named lane (e.g. a confident purple-drench Committed strategy consistent with the product's 280/326 tokens) with a deliberate display type choice.
**Files**: src/features/landing/home/hero-section.tsx, src/features/landing/home/feature-section.tsx, src/features/landing/home/ai-features-section.tsx, src/features/landing/home/comparison-section.tsx, src/features/landing/home/replacement-section.tsx, src/features/landing/components/cta-section.tsx, src/features/landing/assistant/hero-section.tsx, src/features/landing/assistant/use-cases-section.tsx

### [P2] Replacement-section mechanics are broken three ways: (1) `fill="var(--primary)"` on the SVG circles is invalid — --primary holds raw HSL components ('280 77% 23%'), and var() doesn't work in presentation attributes, so the animated dots render black; (2) tool positions are measured once on mount while framer-motion still holds cards at their x:-50 entrance offset and are never re-measured on resize, so arrows start ~50px off and detach entirely when the window resizes; (3) arrows converge at (85% width, 50% height) but the Proddy logo card is positioned at left-[70%]/top-[40%], so they point at empty space.

**Why**: This is the section making the core 'replaces five tools' pitch; misaligned black dots flying toward nothing undercuts the exact claim of coherence the section exists to sell.

**Fix**: Use style={{ fill: 'hsl(var(--primary))' }}; re-measure positions in a ResizeObserver and after entrance animation completes (or measure a static layout and animate only opacity); derive endX/endY from the logo card's own measured rect instead of magic percentages.
**Files**: src/features/landing/home/replacement-section.tsx

## Persona Red Flags

- Sam (screen reader/keyboard): feature-section module buttons have onMouseEnter but no onClick — focusing and pressing Enter does nothing, so 7 of 8 modules are unreachable (feature-section.tsx:61-79); header's Features trigger is a div role="button" wrapping a Link with no aria-expanded/aria-haspopup (header.tsx:145-162); use-cases TabsTriggers are icon-only below sm with no aria-label (use-cases-section.tsx:139); <Link><Button> nesting creates button-inside-anchor double announcements (header.tsx:296-331, cta-section.tsx:71-87); emoji module icons (💬✅📅) are read literally.
- Casey (distracted mobile): use-cases TabsList is locked to h-16 while grid-cols-2 wraps tabs into two ~44px rows plus gap — the second row overflows/clips the container (use-cases-section.tsx:123); the interactive Supademo iframe is the hero's only content at ~350px wide on a phone; the 'Pricing/-' typo also ships in the mobile menu (header.tsx:413); comparison table loses its column headers' alignment when rows stack.
- Alex (impatient power user): no CTA in the home hero fold — headline staggers in over ~0.8s (delayChildren 0.3 + 0.2 stagger), demo at 0.6s, scroll cue at 1.5s, and the fastest path to signup is scrolling back up; mega menu closes instantly on mouseleave with no hover corridor, so a slightly diagonal mouse path to the menu items dismisses it.
- Riley (stress-tester): resize the window and replacement-section arrows stay pinned to stale coordinates (positions measured once in a []-dep effect, replacement-section.tsx:107-119); unset NEXT_PUBLIC_GITHUB_URL/STATUS_URL/FEEDBACK_URL/DOCS_URL/CAREERS_URL and the header/footer ship href="#" links styled as external, plus a 'mailto:undefined' contact link (footer.tsx:180-183).

## Minor Observations

- No prefers-reduced-motion handling anywhere in the module: framer-motion useReducedMotion is never imported, and infinite loops run unconditionally (ChevronDown animate-bounce in home hero, typing-dots animate-bounce in assistant hero, SVG animateMotion dots repeatCount=indefinite in replacement-section). PRODUCT.md calls reduced-motion awareness non-negotiable.
- Same-page contradiction: assistant/features-section.tsx:143 claims 'Learns from team interactions over time' while faq-section.tsx:99-102 says it 'doesn't currently learn from your team's usage patterns over time'. One of them is false.
- cta-section.tsx:60-61 uses the literally banned phrase 'boost productivity' ('streamline their workflow and boost productivity'); use-cases-section.tsx:109 repeats it; ai-features headline 'Smart Tools That Amplify Your Productivity' is the same hype register.
- cta-section 'Learn More' secondary button routes to /pricing — label/destination mismatch; call it 'See pricing'.
- footer description says 'AI-powered' and 'enhanced by artificial intelligence' in the same sentence; Privacy Policy is linked twice (Company column and bottom bar).
- home hero subheadline 'unifies canvas, meetings, messaging, notes' is missing a serial 'and' and omits tasks/boards/calendar — the modules the product leads with.
- Hard-coded gray-50/100/400/500/600/700/800/900 utilities throughout instead of background/muted/muted-foreground/foreground/border tokens — the direct cause of the dark-mode collision.
- features-data.tsx: 'calender.png' misspelled asset path (calendar module); only 'dashboard' has a benefits array (inconsistent data shape); off-palette module colors (bg-blue-500, bg-cyan-500, bg-yellow-500...) ignore the brand's two-color system.
- ai-features number badge '0{delay - 2}' overloads the animation-delay prop as a display index — renders '010' at index 10 and is unreadable; if numbering survives the redesign, pass an explicit index.
- replacement-section drop-shadow uses rgba(99,102,241) (indigo-500), not the brand purple; hover ring on tool cards uses border-primary/20 inconsistently.
- header scroll listener is unthrottled/non-passive; the isScrolled cn() branches for nav links are identical in both arms (dead conditional, header.tsx:164-171).
- Supademo iframe has no loading/error fallback and loading="lazy" on the hero's primary (LCP) content; the aspect-ratio inline-style hack with maxHeight 95vh will letterbox oddly on short viewports.
- assistant hero demo: Send button is enabled and focusable next to a disabled input — a dead interactive control; the 500px overflow-y-auto fake transcript invites scrolling a mock.
- src/app/home/layout.tsx enforces light mode with a MutationObserver that fights any other code touching the class attribute — a hack that also masks the missing theme story on sibling marketing routes.

## Per-Component Notes

- `src/features/landing/components/header.tsx` — Fix 'Pricing/-' (lines 276, 413). Replace the div role=button hover dropdown with Radix NavigationMenu/DropdownMenu for aria-expanded/haspopup, Escape, and hover-intent. Use Button asChild inside Links. Swap emoji module icons for the lucide icons already defined in features-data. Add a mobile-visible CTA outside the hamburger.
- `src/features/landing/home/comparison-section.tsx` — Delete the fabricated quote and 4.9/5 rating cards. Make the header row collapse with the data rows on mobile (or restructure as stacked labeled pairs). Drop the floating check-bubble decoration and blob backdrop.
- `src/features/landing/assistant/hero-section.tsx` — Rewrite the demo transcript to only real capabilities (no email counts, no P1 incidents); disable the Send button with the input or make the whole composer visibly a mock; remove the infinite typing indicator; add hero CTA spacing after removing the highlighter underline and kicker pill.
- `src/features/landing/home/feature-section.tsx` — Add onClick + tablist/tab/aria-selected to module buttons (keep hover as enhancement). Cap visible Key Features at 4-5 with a 'See all in Features' link. Remove 'perfectly' from the intro copy; give the screenshot pane an alt-driven fallback for missing images.
- `src/features/landing/home/ai-features-section.tsx` — Show descriptions by default (or reveal on focus-within too); remove 01-04 badges and the delay-prop indexing hack; remove cursor-pointer from non-clickable cards or make them link to /features anchors; rewrite 'Amplify Your Productivity' headline.
- `src/features/landing/home/replacement-section.tsx` — fill must be style={{fill:'hsl(var(--primary))'}}; re-measure tool positions via ResizeObserver after entrance animation; aim arrows at the measured logo-card center instead of left-[70%]/top-[40%] vs endX 0.85 mismatch; consider a static SVG diagram on mobile.
- `src/features/landing/assistant/use-cases-section.tsx` — Remove h-16 from TabsList (let it size to content) or keep tabs single-row scrollable on mobile; add aria-label to icon-only triggers; replace border-l-4 chat-bubble stripes with background tint only; converge the 4 persona colors onto brand tokens.
- `src/features/landing/home/hero-section.tsx` — Add primary signup CTA in the fold; fix subheadline grammar and module list; remove kicker pill and highlighter underline; add useReducedMotion gate for stagger and bouncing chevron; give the Supademo embed a poster/fallback and remove lazy-loading from the LCP element.
- `src/features/landing/components/cta-section.tsx` — Rewrite body copy without 'boost productivity' (state what happens: 'Create a workspace. Invite your team. Free during beta.'); rename 'Learn More' to 'See pricing'; use Button asChild; drop the blob backdrop and highlighter underline.
- `src/features/landing/components/footer.tsx` — Conditionally render env-driven links (hide when unset) and guard the mailto against undefined; dedupe Privacy Policy; tighten the description to one plain sentence without the doubled AI mention.
- `src/features/landing/assistant/features-section.tsx` — Remove or correct 'Learns from team interactions over time' to match the FAQ; replace the text-bullet div dots with a semantic list style; cards are fine but inherit the token migration (text-gray-* to tokens).
- `src/features/landing/features/features-data.tsx` — Fix 'calender.png'; trim features arrays to the 4-5 that sell; either give every module a benefits array or drop the field; map module colors onto the brand palette rather than the full Tailwind rainbow.
- `src/features/landing/assistant/faq-section.tsx` — Strongest copy in the module — keep the tone. Only work needed is the token migration and losing the entrance-stagger for reduced-motion users.

## Questions to Consider

- Is the Supademo embed ID current and is there analytics on whether visitors actually engage with it? If not, a captioned product screenshot may convert better as the LCP element.
- Are NEXT_PUBLIC_GITHUB_URL, STATUS_URL, FEEDBACK_URL, DOCS_URL, CAREERS_URL, and RESEND_FROM_EMAIL all set in production? Several footer/header links dead-end at '#' or 'mailto:undefined' without them.
- Does any real testimonial or usage data exist to replace the fabricated rating/quote cards, or should social proof be removed entirely until it does?
- What aesthetic lane does Proddy want the marketing site to own (named reference, per the brand register)? The purple-280/pink-326 tokens support a committed purple-drench direction, but that's a decision the team should make deliberately before a redesign pass.
