---
target: Account & Billing (billing, usage, preferences, pomodoro, email)
total_score: 20
p0_count: 0
p1_count: 4
timestamp: 2026-07-06T14-48-45Z
slug: src-features-billing
---
# Critique — Account & Billing (billing, usage, preferences, pomodoro, email)

Method: dual-agent (A: design review · B: detector) — browser evidence skipped (dev server not running)
Paths: src/features/billing, src/features/usage, src/features/preferences, src/features/pomodoro, src/features/email

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | Manage Billing button (billing-section.tsx:509-521) shows a spinner bound to portalLoading, which that handler never sets — the spinner belongs to a different button inside the details dialog; portal-open failure (line 2 |
| 2 | Match between system and real world | 3 | "Deducted / net paid" and "Activity-based usage" (upgrade-modal.tsx:561) are billing-engine jargon; subscription status is rendered raw with CSS capitalize (billing-section.tsx:567) so "on_hold" prints as "On_hold"; "Wat |
| 3 | User control & freedom | 2 | Cancel plan is a native window.confirm followed by immediate cancellation + refund (billing-section.tsx:240-247) — no review of what's lost, no undo; the X on the minimized pomodoro pill silently resets a running focus s |
| 4 | Consistency & standards | 1 | Four visual dialects in one module group: token-driven billing, hard-coded slate palette in usage, green/red/blue one-offs in preferences (green master switch at notification-settings.tsx:475, blue privacy box at 672), a |
| 5 | Error prevention | 2 | Seat minimums are enforced and pomodoro minutes clamp in the hook — good — but the immediate-cancel confirm() invites misclicks on an irreversible action, DurationStepper +/- buttons never disable at min/max so they appe |
| 6 | Recognition over recall | 2 | notification-settings.tsx requires holding the hierarchy channel-toggle > master-toggle > per-type-toggle in your head across three separate cards; the master "All Notifications" toggle actually governs only the browser  |
| 7 | Flexibility & efficiency | 2 | Seat count is stepper-only with maxSeats=1000 (upgrade-modal.tsx:360-390) — an Enterprise buyer needs ~200 clicks; every switch on the notification page disables during any single save (isUpdating, notification-settings. |
| 8 | Aesthetic & minimalist design | 2 | usage-dashboard.tsx renders the same healthy/attention/reached counts three times (hero strip 535-575, SummaryCard grid 578-606, per-section mini-stats 290-308) plus a meaningless "Metrics: 8" card; notification page sta |
| 9 | Error recovery | 2 | Most mutations toast on failure, but payment-portal open fails silently to console (billing-section.tsx:212-214), status-tracking toggle swallows errors entirely, and a denied push permission yields only "Failed to send  |
| 10 | Help & documentation | 2 | Per-toggle descriptions and the empty billing-history state ("No payments recorded yet…") teach well; but the permission-denied state offers no help, "Fair billing today" is unexplained, and there are no links to docs fr |
| **Total** | | **20/40** | |

## Anti-Patterns Verdict

Split verdict. The pomodoro timer and billing plan cards read like real product work — restrained tokens, tabular numerals, sensible progressive disclosure — and a Linear-fluent user would trust them. But the usage dashboard is recognizable AI-slop template work: a hero-metric header with uppercase tracked eyebrow labels, an identical 4-card summary grid that repeats numbers already shown twice elsewhere on the same screen, and a hard-coded slate/sky/rose/emerald palette (including `bg-[#fbfcfe]` and bespoke rgba shadows) that belongs to a different product than the purple/pink token system every other surface uses. Preferences read as accreted rather than designed — three separate cards all controlling browser notifications, a one-off green master switch, `Saved ✅` emoji status text — and the 8 email templates ship three different accent colors (indigo #4F46E5, blue #0070f3, blue #3b82f6), none of them the brand purple. A user fluent in Linear/Stripe would trust billing and pomodoro, pause at preferences, and correctly suspect the usage page and emails were generated without reading the rest of the app.

**Deterministic scan**: 3 findings — side-tab ×3.
Suspected false positives: 1 (Possibly all 3: these are HTML email templates (inline styles required for email clients); the 4px yellow left-border is a conventional email warning-callout pattern, arguably intentional rather than an AI-UI tell — flagging as suspected, not confirmed, since it is still real product-facing design)

## Cognitive Load

- Single focus — FAIL: usage-dashboard.tsx has no focal point; the same limit-health information competes from the hero utilization tile, the 3-cell strip, the 4 SummaryCards, and the section chips before the first actual quota row appears.
- Chunking <=4 — FAIL: the 'Individual Notification Settings' card (notification-settings.tsx:499-702) stacks ~10 concerns: 6 type rows, online status, weekly digest + day select, timing select, privacy notice, and a save-status line.
- Visual grouping — FAIL: browser-notification control is split across three sibling cards (permission/test card, Delivery Channels card, Master Control card) that look unrelated but form one dependency chain.
- One decision at a time — FAIL: each notification row presents two simultaneous decisions (Browser + Email switches) x 7 rows = 14 live controls in one viewport.
- <=4 visible options per decision point — PARTIAL FAIL: the notification page exposes ~16 switches and 2 selects at once; plan choice (3 cards) and pomodoro modes (3 buttons) pass.
- No working-memory bridges — FAIL: the user must remember that the 'All Notifications' master toggle governs only the browser channel (and skips onlineStatus), and that per-type Email switches are inert while the Email channel two cards up is off; nothing on screen states either rule.
- Clear hierarchy — PASS with a caveat: billing's Current Plan card > Available Plans ordering is right; usage's h2 sits below a badge row and equal-weight card grids flatten importance.
- Progressive disclosure — PASS: pomodoro settings behind gear, weekly-digest day only when enabled, targetPlan collapsing the upgrade modal to one card are all correct uses.

## What's Working

- pomodoro-timer.tsx is genuinely good product design: settings behind a gear (progressive disclosure), tabular-nums timer, draggable minimized pill, persisted state in the hook with clamping, active:scale press feedback — the strongest file in the group.
- Billing plan cards (PlanOptionCard) mark the current plan with a quiet ring + check chip instead of shouting, and the current-plan slot swaps the button for a static 'Current Plan' pill — correct affordance removal.
- MetricRow in usage-dashboard.tsx is solid in isolation: role=progressbar with aria-valuenow/max, distinct 0%/healthy/warn/danger bar states, '{n} remaining' plain-language helper, tabular-nums.
- The per-type Browser/Email switch matrix in notification-settings is the right mental model, and dependent switches correctly disable when their delivery channel is off.
- Empty billing history teaches ('No payments recorded yet. New Dodo payments and fair-billing refunds will appear here.') rather than saying 'nothing here'.
- Upgrade modal enforces minimum seats with a clear inline reason ('Minimum N required') and pre-clamps the initial seat count from workspace membership.

## Priority Issues

### [P1] The module group has no shared visual system: usage-dashboard.tsx is built entirely from hard-coded slate/sky/rose/amber/emerald/violet utilities, an arbitrary hex surface (bg-[#fbfcfe], line 270) and bespoke rgba shadows instead of the card/border/muted/primary tokens; preferences hard-code green-600/red-600/blue-50; the 8 email templates use three different accent colors (#4F46E5, #0070f3, #3b82f6) — none of them brand purple/pink.

**Why**: PRODUCT.md's first system principle is 'One system — every module speaks one grammar.' A user moving from billing (purple/pink tokens) to usage (slate/white) experiences two different products; emails from 'one coherent surface' arrive in three accent colors. It also breaks class-based dark mode: fixed text-slate-500 uppercase labels (usage-dashboard.tsx:221, 501, 537) drop below 4.5:1 on the dark background because they have no dark: variant.

**Fix**: Rebase usage-dashboard on tokens (bg-card, border-border, text-muted-foreground, shadow-sm) keeping only semantic emerald/amber/rose for state; replace green master switch and blue notice in notification-settings with the standard switch and a muted callout; extract one shared email layout (container/heading/button/footer styles) with the brand primary as the single button color and reuse it in all 8 templates.
**Files**: src/features/usage/components/usage-dashboard.tsx, src/features/preferences/components/notification-settings.tsx, src/features/email/components/card-assignment.tsx, src/features/email/components/invite-mail.tsx, src/features/email/components/weekly-digest-template.tsx, src/features/email/components/mention-template.tsx, src/features/email/components/direct-message-template.tsx, src/features/email/components/thread-reply-template.tsx

### [P1] usage-dashboard.tsx is the banned hero-metric + identical-card-grid template, and it triplicates data: healthy/attention/reached counts appear in the hero bottom strip (535-575), again as a 4-card SummaryCard grid (578-606, including a permanently-useless 'Metrics: 8' card), and again as mini-stat chips inside each UsageSection (290-308). Uppercase tracked eyebrow labels sit on every stat.

**Why**: This is a dashboard that impresses in a screenshot and exhausts in daily use — an explicit anti-reference in PRODUCT.md. The operator's actual question ('am I about to hit a limit, on what, and what do I do') is answered by MetricRow alone; everything above it is chrome that pushes the answer below the fold. 'Average utilization' across quotas of wildly different scale (50,000 messages vs 20 boards) is also a statistically meaningless headline number.

**Fix**: Delete the SummaryCard grid and the per-section Average/Watchlist chips. Keep one compact header: plan badge, month, status badge, and an Upgrade button that is always visible (not buried inside the 'Limits reached' cell at line 567). Lead with the two MetricRow sections; surface at-risk quotas first (sort by percent desc).
**Files**: src/features/usage/components/usage-dashboard.tsx

### [P1] Form controls throughout preferences have no accessible names: every Label/Switch pair is rendered as siblings with no htmlFor/id association (notification-settings.tsx:353-370, 409-428, 473-478, 528-547; status-selector.tsx:72-84; status-tracking-settings.tsx:47-60), the pomodoro DurationStepper +/- icon buttons have no aria-label (pomodoro-timer.tsx:339-357), and ToggleChip conveys on/off state only by color variant with no aria-pressed (369-384).

**Why**: A screen-reader user hears ~16 anonymous 'switch, off' controls on the notification page and cannot tell Mentions-browser from Weekly Digest. This directly violates the brief's 'Accessible by default — non-negotiable'. Keyboard users also can't perceive the stepper hitting min/max since the buttons never disable.

**Fix**: Give each Switch an id and each Label the matching htmlFor (or wrap the Switch in the Label); add aria-label="Decrease focus length"/"Increase focus length" to DurationStepper buttons and disable them at MIN_MINUTES/MAX_MINUTES; add aria-pressed={active} to ToggleChip.
**Files**: src/features/preferences/components/notification-settings.tsx, src/features/preferences/components/status-selector.tsx, src/features/preferences/components/status-tracking-settings.tsx, src/features/pomodoro/components/pomodoro-timer.tsx

### [P1] Destructive actions are under-protected and off-vocabulary: 'Downgrade to Free' runs window.confirm then cancels the paid plan immediately (billing-section.tsx:240-247), and the X on the minimized pomodoro pill resets a running focus session instantly (pomodoro-timer.tsx:308-319) with only a hover title as warning.

**Why**: Cancelling a subscription is the highest-stakes click in the product; a native browser confirm has no styling, no detail (seats lost, refund amount, effective date), and is inconsistent with the Radix dialogs used everywhere else — one 'save button that looks different' is wrong per the register. Riley clicking the pill's X at minute 24 of 25 loses the session with no recourse.

**Fix**: Replace window.confirm with an AlertDialog that states plan, seat count, refund estimate, and effective date, with a destructive-variant confirm button. For the pomodoro pill, make X only dismiss the pill (keep the timer running) or pause-then-dismiss; never reset silently.
**Files**: src/features/billing/components/billing-section.tsx, src/features/pomodoro/components/pomodoro-timer.tsx

### [P2] Money is rendered unformatted in the upgrade modal: `$${proTotalPrice}` and `$${enterpriseTotalPrice}` (upgrade-modal.tsx:398, 520) and `$${proPriceMonthly}` (337, 457) bypass the formatMoney helper defined in the same file.

**Why**: livePrices come back in cents and are divided by 100; any non-integer per-seat price times seat count produces '$25.5/month' or floating-point artifacts like '$25.500000000000004/month' on the primary purchase surface — an instant trust-killer at the moment of payment.

**Fix**: Route all four displays through the existing formatMoney (keeping cents units), or Intl.NumberFormat with currency style; same for the plan price in billing-section's formatPlanPrice.
**Files**: src/features/billing/components/upgrade-modal.tsx, src/features/billing/components/billing-section.tsx

### [P2] Feedback plumbing is broken in three places: the top-level 'Manage Billing' button shows a spinner driven by portalLoading which its own handler never sets (billing-section.tsx:509-521 vs 198-205); handleOpenPaymentPortal swallows errors to console with no toast (212-214); status-tracking-settings' toggle has try/finally with no catch, so a failed save shows nothing and the switch silently snaps back.

**Why**: System status lies: users see a loading spinner on a button that opens a local dialog, and see nothing at all when the payment portal or a preference save fails — 'calm under load' requires telling the user what happened.

**Fix**: Drop the portalLoading spinner from Manage Billing (it opens a dialog synchronously); add toast.error to the portal catch; add a catch with toast.error in handleStatusTrackingToggle.
**Files**: src/features/billing/components/billing-section.tsx, src/features/preferences/components/status-tracking-settings.tsx

### [P2] weekly-digest-template.tsx builds its stats row with raw <div>s and display:flex (81-94, 254-258), uses a white page background unlike every other template, and leans on emoji section markers (📊 ✅ 👥 🔥 📋 ⏳); seat selection in the upgrade modal is stepper-only with maxSeats=1000.

**Why**: Flexbox is unsupported in Outlook/Windows Mail — the flagship weekly email renders broken for a large share of business recipients. Emoji-as-iconography contradicts the plain-spoken brand voice. And an Enterprise buyer purchasing 150 seats must click the + button ~149 times (Alex walks away).

**Fix**: Rebuild the digest stats with react-email Row/Column (table-based) and align its shell with the shared template; strip emoji markers for plain labels; add an editable numeric input between the +/- steppers in upgrade-modal.tsx.
**Files**: src/features/email/components/weekly-digest-template.tsx, src/features/billing/components/upgrade-modal.tsx

## Persona Red Flags

- Alex (impatient power user): ~200 clicks to set 200 Enterprise seats via the +/- stepper in upgrade-modal.tsx; every switch on notification-settings disables during any single save (global isUpdating) so rapid batch toggling stalls; 'Manage Billing' opens an intermediate dialog instead of the portal he asked for.
- Sam (screen reader / keyboard): all Switches in notification-settings.tsx / status-selector.tsx / status-tracking-settings.tsx have no programmatic label (sibling Label without htmlFor/id); DurationStepper +/- in pomodoro-timer.tsx are unnamed icon buttons that never disable at min/max; ToggleChip state is color-only (no aria-pressed); usage SummaryCard uppercase text-slate-500 labels fall below 4.5:1 in dark mode.
- Riley (stress-tester): clicking X on the minimized pomodoro pill at minute 24 resets the session with no confirm or undo (pomodoro-timer.tsx:308); window.confirm 'Downgrade to Free now?' immediately cancels a paid subscription; raw subscriptionStatus strings like 'on_hold' render as 'On_hold' in the Status card (billing-section.tsx:567); a long workspace name blows out the 'View {workspaceName}' email button in weekly-digest-template.tsx.

## Minor Observations

- Sparkles icon on both the billing Upgrade button and the upgrade modal title — mild 'AI-magic' trope the brief warns against; a plain arrow-up or nothing reads calmer.
- 'Growth'/'Scale' badge pills on the upgrade modal plan cards are marketing-tier labels on a product surface; the plan name and price already say it.
- billing-section.tsx uses `bg-white/80` on outline buttons, relying on the global `.dark [class*="bg-white"]` !important hack in globals.css to survive dark mode — fragile; use tokens.
- Usage copy 'Track quota health across… with one clear operational view' is self-congratulatory; say what it is: 'Monthly usage against your plan limits.'
- PLANS feature lists in upgrade-modal are hard-coded strings duplicated from convex/billing/plans quotas — drift risk between advertised and enforced limits.
- notification-settings weekly-digest day select and timing select have no visible saved confirmation near them (feedback appears at the card's very bottom, 400px away).
- status-selector keeps local isDndEnabled state synced via useEffect instead of deriving from preferences — brief flash of stale switch state on load.
- pomodoro popover trigger hard-codes text-white/hover:bg-white/15, coupling it to the purple toolbar; fine today, breaks if reused elsewhere.
- billing details dialog metric labels ('Plan amount', 'Tax paid', 'Refunded', 'Deducted / net paid') mix tenses and registers; align as noun phrases.
- globals.css animate-fade-in/slide-up utilities and framer-motion in pomodoro both ignore prefers-reduced-motion — the brief calls for reduced-motion awareness.

## Per-Component Notes

- `src/features/usage/components/usage-dashboard.tsx` — Delete SummaryCard grid + section Average/Watchlist chips (data shown 3x); rebase slate/hex/rgba styling onto card/border/muted tokens; make Upgrade always visible instead of only inside the 'Limits reached' cell; replace the pulsing-icon loader with skeleton rows; add an error state (query failure currently loads forever); add dark: variant to fixed text-slate-500 labels.
- `src/features/preferences/components/notification-settings.tsx` — Merge the three browser-notification cards into one; associate every Label/Switch (htmlFor/id); rename 'Master Notification Control' honestly ('All browser notifications'); drop 'Saved ✅'/'Success ✅'/'Error ❌' emoji and pick ONE save-feedback channel (inline, not toast+inline+toast); remove the one-off green switch and gradient row; scope isUpdating per control; on permission 'denied', show how to unblock instead of a dead test button; remove unused 'enabled' field in notificationTypes.
- `src/features/billing/components/upgrade-modal.tsx` — Format all prices via formatMoney (fixes $25.5 / float artifacts); add numeric seat input between steppers; the Pro and Enterprise card blocks are ~180 duplicated lines — extract one PlanCard; title says 'Upgrade your plan' even for Enterprise→Pro downgrades; when preview fetch fails for an active subscription the fallback copy ('New subscriptions start with…') is wrong — show a retry; 'Activity-based usage' label needs plain language; DialogContent has no max-height/scroll for short viewports.
- `src/features/billing/components/billing-section.tsx` — Replace window.confirm with a destructive AlertDialog showing refund estimate; toast on portal-open failure; unbind portalLoading spinner from Manage Billing; the non-owner lock state hard-codes text-gray-900/bg-amber-100 (invisible heading in dark mode) — use tokens; humanize subscriptionStatus instead of CSS capitalize; 'Deducted / net paid' label is bookkeeping jargon; initial load is a bare spinner — use a skeleton of the plan card.
- `src/features/pomodoro/components/pomodoro-timer.tsx` — Make pill X dismiss (not reset) a running session; aria-labels + min/max disabled states for DurationStepper; aria-pressed on ToggleChip; align mode-button labels with header labels (Deep Work vs 'work'); wrap framer-motion in MotionConfig reducedMotion='user' for the height/scale animations; fixed bottom-24 right-8 pill may cover the mobile footer.
- `src/features/email/components/weekly-digest-template.tsx` — Rebuild stats row with Row/Column (flex divs break in Outlook); align background/shell with the other templates (it's the only white-bg one); replace emoji section markers (🔥📋✅⏳) with text labels; button color #3b82f6 is a third accent — use the shared brand button; wrap 'View {workspaceName}' for long names.
- `src/features/preferences/components/status-selector.tsx` — Drop the '💡 Automatic Status' emoji callout styling for a plain muted note; when status tracking is disabled the component returns null — leave a disabled row explaining why DND is unavailable instead of vanishing; skip the toast on toggle (the switch already shows state) or keep only error toasts.
- `src/features/preferences/components/status-tracking-settings.tsx` — Add catch + toast.error to handleStatusTrackingToggle (currently silent failure); associate Label with Switch via htmlFor/id.
- `src/features/email/components/invite-mail.tsx` — 4px yellow side-stripe warning box (borderLeft #ffc107) with '⚠️ Security Notice' — restyle as a bordered muted callout without emoji; button is #0070f3 while sibling templates use #4F46E5 — adopt the shared brand button; duplicated style block belongs in a shared email layout.
- `src/features/email/components/otp-verification-mail.tsx` — OTP code color #0070f3 and footer email highlight hard-coded off-brand; same 4px side-stripe '🔒 Security Notice' pattern; no unsubscribeUrl block unlike notification templates (acceptable for transactional, but footer voice differs from siblings).
- `src/features/email/components/password-reset-mail.tsx` — Same off-brand #0070f3 button and side-stripe warning as OTP mail; good practice already present (plain-link fallback + expiry) — keep when consolidating into shared layout.
- `src/features/email/components/card-assignment.tsx` — Heading 'Card Assignment' is robotic — use '{assignedBy} assigned you a card' like the mention template's voice; `style={cardTitle ? cardTitleStyle : {}}` is dead conditional; button #4F46E5 → brand token; deep-link the View Card button to the card, not the app root default.
- `src/features/email/components/mention-template.tsx` — Solid structure; move to shared layout, swap #4F46E5 for brand primary, and deep-link 'View Message' to the actual message rather than NEXT_PUBLIC_APP_URL fallback.
- `src/features/email/components/direct-message-template.tsx` — Same as mention template: shared layout, brand button color, deep link; footer says 'sent from {workspaceName}, your team collaboration platform' — workspace name isn't the platform; say 'sent by Proddy'.
- `src/features/email/components/thread-reply-template.tsx` — Two stacked italic quotes + bold labels get noisy — visually differentiate 'Your message' vs the reply (indent or muted vs default); otherwise same shared-layout/brand-button/deep-link consolidation as its siblings.

## Questions to Consider

- Is the usage dashboard intended to eventually show trends (its TrendingUp/ArrowUpRight iconography implies history), or is it snapshot-only? That decides whether the hero block earns any space at all.
- Are the email templates rendered anywhere with a dark-mode-aware client strategy, and is Poppins actually loaded via a Head font in production sends (no @font-face is declared in any template)?
- Can seats be changed without a plan change (pure seat add/remove)? The UI only exposes seat count inside the upgrade/downgrade flow, which forces a 'plan change' to add one teammate.
- Is the master notification toggle's browser-only scope intentional product behavior, or should it also gate email prefs (it's labeled 'All Notifications')?
