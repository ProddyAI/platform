---
target: Workspace & Admin (auth, workspaces, members, manage)
total_score: 22
p0_count: 0
p1_count: 4
timestamp: 2026-07-06T14-48-45Z
slug: src-features-auth
---
# Critique — Workspace & Admin (auth, workspaces, members, manage)

Method: dual-agent (A: design review · B: detector) — browser evidence skipped (dev server not running)
Paths: src/features/auth, src/features/workspaces, src/features/members, src/features/manage

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Good: import Progress bars, seat-pending states, per-action loading labels in service-integration-card. Gaps: sign-in/sign-up 'Continue' and create-workspace 'Create' show no pending spinner/text (button just greys out); |
| 2 | Match between system and real world | 2 | Vendor/internal jargon in user copy: 'New Dodo quantity: 12 seats' and 'Dodo is processing the prorated seat charge' (invite-member-modal.tsx), 'Composio's unified AgentAuth system' (integrations-management.tsx:209-212), |
| 3 | User control and freedom | 2 | Edit Channel dialog (channels-management.tsx:600-611) has no Cancel button; closing invite-member-modal silently discards a typed invitation note; profile.tsx gives an admin viewing their own profile no Leave action (lin |
| 4 | Consistency and standards | 1 | Two invite surfaces with different visual dialects (invite-member-modal marketing register vs members-management plain panel); three role vocabularies (owner/admin/member vs +viewer vs admin/member in profile.tsx); passw |
| 5 | Error prevention | 3 | Good: typed 'delete my account' confirmation, only-owner demotion guard, file type/size validation, seat stepper clamps to >=1. Gap: Delete Workspace (whole team's data) needs only one click-through AlertDialog while per |
| 6 | Recognition rather than recall | 2 | Icon-only UserCog/Trash2/Edit buttons in members/channels tables have no labels or tooltips; members-management join-code refresh button controls a code that is never displayed in that view; 'Max 5MB for images' hint sit |
| 7 | Flexibility and efficiency of use | 2 | Enter submits in members-management email field but not in invite-member-modal (no form element); OTP auto-submits on mobile only — desktop users must click Verify (otp-verification-card.tsx:151-156); no keyboard shortcu |
| 8 | Aesthetic and minimalist design | 2 | invite-member-modal hero header + blobs + scroll-FAB; workspace-management 3-stat-card overview of near-zero utility ('Created 412 days ago'); capability pills + gradient stripes + pulse dots on integration cards; integr |
| 9 | Help users recognize, diagnose, recover from errors | 3 | channels-management has genuinely excellent status-code-specific error mapping; failed imports get a Retry button; OTP distinguishes expired vs invalid with distinct banner colors. Gap: members-management shows inline er |
| 10 | Help and documentation | 2 | Docs/status/support links exist in user-button menu (env-gated); field-level helper text is present but sparse; no contextual help on roles (what does Admin vs Owner actually permit? — the only explanation is an 11px upp |
| **Total** | | **22/40** | |

## Anti-Patterns Verdict

Split verdict. The manage/* core (tables, section headers, confirm dialogs, import flows) reads like credible shadcn admin UI a Linear-fluent operator would mostly trust. But the surfaces around it would make that same user pause: invite-member-modal is a marketing splash inside a product flow (gradient hero with two blur-3xl blobs, "Grow Your Team" hype title, gradient CTA, uppercase tracked micro-eyebrows, a floating scroll-FAB inside a 500px dialog), service-integration-card ships the banned 3px gradient top-stripe plus pulsing status dot, workspace-management opens with a three-identical-stat-card hero-metric grid, and user copy leaks internal vendors ("New Dodo quantity: 12 seats", "Composio's unified AgentAuth system"). Add two competing invite UIs with three different role vocabularies and a save button that is purple-600 in one form and bg-primary everywhere else, and the "one system" promise of PRODUCT.md breaks exactly where admins do their most sensitive work. Core: trustworthy. Flourish layer: recognizable template slop that needs stripping, not polishing.

**Deterministic scan**: 0 findings.

## Cognitive Load

- Single focus / one decision at a time: invite-member-modal.tsx interleaves a billing purchase (SeatFullWarningBanner: stepper, 'Add N Seats' amber CTA, Dodo quantity math) into the middle of a 3-field invite form — the user is deciding who to invite and whether to spend money in the same viewport
- Visual grouping: channels-management.tsx puts the 'Max 5MB for images' constraint under the Channel Name input (line 593) instead of the upload zone it governs; members-management.tsx places the join-code RefreshCw button inside the email-invite row although it has nothing to do with email invites
- No working-memory bridges: members-management.tsx lets you regenerate a join code that is never displayed anywhere in the view — the user must remember that the join link lives in a different modal (workspace-management's InviteModal) to use what they just regenerated
- Chunking <=4: user-profile-modal profile tab stacks 5 unrelated blocks in one scroll (identity panel, Personal Information, Privacy Settings, Change Password, Danger Zone) with no progressive disclosure
- Progressive disclosure: avatar and banner editing affordances (camera/trash buttons) only materialize after clicking 'Edit Profile' with no prior hint they exist — first-time users can't discover that the banner is editable at all

## What's Working

- channels-management.tsx error handling is best-in-module: HTTP-status-specific, human-readable messages with recovery guidance for every failure mode
- Destructive-action grammar is mostly right: AlertDialogs with explicit consequence copy, typed confirmation for account deletion, only-owner demotion guard with a clear explanation toast
- manage/* sections share one heading grammar (h3 text-lg font-medium + muted description + Separator) — the IA of the admin area is easy to scan
- service-integration-card covers the full interaction-state matrix: connect/verify/disconnect each with distinct disabled+loading labels (Checking…/Disconnecting…/Redirecting…)
- Import pipeline has real status visibility: per-job Progress bars with currentStep text, cancel for in-progress, retry for failed, results summarized per platform
- integrations-management LoadingCard skeleton mirrors the final card layout instead of a generic shimmer block
- Password strength indicator gives live per-requirement feedback with met/unmet checkmarks — teaches instead of rejecting

## Priority Issues

### [P1] The invite experience is fractured into two competing UIs with three different role vocabularies

**Why**: invite-member-modal.tsx offers owner/admin/member in a marketing-styled modal; members-management.tsx EmailInviteSection offers the same task in a plain panel and its role-change dropdown adds a 'viewer' role that exists nowhere else; profile.tsx offers only admin/member. An admin cannot build a stable mental model of the permission system, and the register explicitly bans inconsistent component vocabulary — 'if the save button looks different in two places, one is wrong.'

**Fix**: Collapse to one invite component (the plain EmailInviteSection pattern, restyled with tokens) used by both entry points; define the role set once (single constant with label + one-line description) and consume it in invite, table role menu, and profile panel; either ship 'viewer' everywhere or remove it.
**Files**: src/features/members/components/invite-member-modal.tsx, src/features/manage/components/members-management.tsx, src/features/members/components/profile.tsx

### [P1] user-profile-modal is structurally unusable below ~700px and overloaded as a settings surface

**Why**: DialogContent is max-w-6xl h-[90vh] with a fixed w-80 (320px) left panel in a non-wrapping flex row; on a 375px phone the right panel — containing tabs, profile form, password change, notifications, and account deletion — gets ~20px. Casey on mobile is fully blocked from Account Settings. The inner grid-cols-2 form grids don't collapse either. This is also 'modal as first thought': five settings domains plus a nested delete dialog crammed into one modal.

**Fix**: Stack the panels below md (flex-col, banner as a header strip), make form grids sm:grid-cols-2, cap DialogContent at max-w-4xl; longer term move Account Settings to a route with a sidebar like the workspace manage pages.
**Files**: src/features/auth/components/user-profile-modal.tsx

### [P1] invite-member-modal is a marketing surface inside a product flow

**Why**: Gradient hero header with two blur-3xl blob circles (lines 43-45), 'Grow Your Team' hype title, gradient from-primary to-secondary CTA button, 11px uppercase tracked eyebrow labels, 500ms zoom-in logo choreography, and a floating scroll-down FAB reinventing scrolling — every one of these is named in PRODUCT.md anti-references or the product-register bans. Operators invite teammates mid-work; they get a pitch deck.

**Fix**: Replace the hero with a standard DialogHeader ('Invite to {workspace}' + one-line description), use default Button variants, delete the blobs, eyebrows, and ScrollToActionsButton (size the modal to fit its 3 fields), and drop entry animations to <=250ms or none.
**Files**: src/features/members/components/invite-member-modal.tsx

### [P1] Internal vendor and system jargon leaks into user-facing copy

**Why**: 'New Dodo quantity: 14 seats', 'Dodo is processing the prorated seat charge' (invite-member-modal.tsx:255, 687), 'Connect your personal accounts... using Composio's unified AgentAuth system for AI-powered automation and enhanced productivity features' (integrations-management.tsx:208-212), 'Seats Finished' (line 168), 'Resend OTP'. Users don't know Dodo or Composio; 'enhanced productivity features' is exactly the hype the brand voice bans. This erodes trust precisely at billing moments.

**Fix**: Rewrite in plain operator voice: 'You're out of seats' / 'Adds N seats to your plan, prorated today' / 'Your plan will have N seats' / 'Connect your accounts so Proddy's assistant can act on them. Connections are private to you.' / 'Resend code'.
**Files**: src/features/members/components/invite-member-modal.tsx, src/features/manage/components/integrations-management.tsx, src/features/auth/components/otp-verification-card.tsx

### [P2] Accessibility gaps: killed focus indicator, unlabeled icon buttons, sub-4.5:1 text

**Why**: user-button.tsx puts outline-none on the avatar DropdownMenuTrigger with no focus-visible replacement — keyboard users can't see focus on the primary account control. UserCog/Trash2 (members-management), Edit/Trash2 (channels-management), and the icon-clear X buttons ship with no aria-label or tooltip. Contrast failures at small sizes: text-zinc-400 11px 'Workspace' eyebrow (~2.4:1), text-green-600 success line (~3.1:1), text-secondary pink 11px role descriptions (~3:1), text-yellow-600 strength label (~2.9:1).

**Fix**: Add focus-visible:ring-2 focus-visible:ring-ring to the avatar trigger; aria-label every icon-only button; move small-text colors to >=4.5:1 shades (green-700, amber-700, foreground for eyebrows) or increase size/weight.
**Files**: src/features/auth/components/user-button.tsx, src/features/manage/components/members-management.tsx, src/features/manage/components/channels-management.tsx, src/features/auth/components/password-strength-indicator.tsx, src/features/members/components/invite-member-modal.tsx

### [P2] Token discipline drift: parallel palettes and light-only hard-coded colors in a class-dark-mode app

**Why**: password-change-form submit is bg-purple-600 hover:bg-purple-700 with a text-purple-500 icon — a second 'primary' next to bg-primary. profile.tsx hard-codes text-[#1264a3] — literally Slack's link blue. Role badges (bg-purple-100/text-purple-800), emerald status chips, platform tiles (bg-red-100 etc.), the gray upload zone, and the red/orange OTP error banners have no dark: variants, so they render as light-mode islands under .dark.

**Fix**: Swap to tokens (bg-primary, text-primary, hsl ring); define one semantic set for role/status colors with dark variants; replace #1264a3 with text-primary.
**Files**: src/features/auth/components/password-change-form.tsx, src/features/members/components/profile.tsx, src/features/manage/components/members-management.tsx, src/features/manage/components/import-data-management.tsx, src/features/auth/components/otp-verification-card.tsx, src/features/manage/components/channels-management.tsx

### [P2] Loading/empty-state grammar violates the register and empty states don't teach

**Why**: members-management and channels-management center an h-8 spinning RefreshCw in content instead of skeleton rows; integrations-management shows a 'Loading integrations…' spinner block AND skeleton cards at once. Empty states say 'No members — Invite members to your workspace' and 'No channels — Create a channel to get started' with no action button, even though the invite section/New Channel button exist on the same screen.

**Fix**: Replace spinners with 3-row table skeletons; delete the redundant spinner block in integrations; put the primary action (Invite / New Channel) inside the empty state.
**Files**: src/features/manage/components/members-management.tsx, src/features/manage/components/channels-management.tsx, src/features/manage/components/integrations-management.tsx

## Persona Red Flags

- Alex (impatient power user): sign-in-card.tsx 'Continue' shows zero pending feedback during the network round-trip (no spinner, no label change) — feels dead on slow connections; invite-member-modal has no Enter-to-submit (EmailField isn't in a <form>); otp-verification-card auto-submits only on mobile (isMobile gate, line 153) so desktop Alex types 6 digits then must reach for the mouse; profile.tsx demands a confirm dialog for every single role flip
- Sam (keyboard/screen-reader): user-button.tsx avatar trigger has outline-none with no focus-visible ring — the account menu is invisible to keyboard focus; members-management UserCog/Trash2 and channels-management Edit/Trash2 icon buttons announce as unlabeled buttons; the invite modal's zinc-400 11px 'Workspace' eyebrow and pink 11px role descriptions fall well below 4.5:1; ScrollToActionsButton appears/disappears based on scroll position — a moving focus target
- Casey (distracted mobile): user-profile-modal.tsx fixed w-80 left panel inside max-w-6xl leaves ~20px for the entire settings content on a 375px phone — password change and notification settings are unreachable; invite-member-modal's sticky footer + hero header consume most of a small viewport leaving a slot for roughly one field
- Riley (stress-tester): invite-member-modal footer workspace name (line 357) has no truncate — a 20-char name plus long translations pushes Cancel/Send Invite; seat stepper Input accepts arbitrary typed numbers (only floor/min-1 clamped) so '999' silently becomes a 999-seat Dodo quantity request; user-profile-modal bio renders as an italic quote in the fixed left panel — 160 chars of unbroken string tests break-words against a bg-image banner

## Minor Observations

- Exclamation-mark toasts throughout ('Workspace created!', 'Avatar updated successfully!', 'Seat added successfully!', 'authorization completed!') against a brand voice where 'exclamation marks are rare' — and 'Invalid email or password!' shouts at a failing user
- sign-in-card.tsx inline 'Sign up' button is text-primary while sign-up-card.tsx's equivalent is text-secondary, and sign-up's footer paragraph is text-primary vs sign-in's text-muted-foreground — the twin cards disagree with each other
- workspace-management.tsx carries dead join-code code (_handleGenerateNewCode, _handleCopyJoinCode, _showJoinCode) — the copy-join-link UI was removed but the members page still has a regenerate button, suggesting a half-deleted feature
- Two different email regexes: sign-up-card.tsx's 6-line RFC-ish monster vs members-management/invite-modal's simple /^[^\s@]+@[^\s@]+\.[^\s@]+$/ — same validation, two grammars
- import-data-management.tsx formatDate uses toLocaleString while workspace-management uses toLocaleDateString — inconsistent date rendering across adjacent admin tabs
- otp-verification-card.tsx repeats the identical 6-utility-class slot className six times — extract a constant
- profile.tsx DropdownMenuContent className='w-full' does nothing (popper content doesn't inherit trigger width) — role menu renders narrower than its trigger
- 500ms animate-in durations (invite header zoom-in, seat banner slide-in) double the register's 150-250ms ceiling; no prefers-reduced-motion handling anywhere in the module
- service-integration-card 'Active' badge dot uses animate-pulse — decorative motion on a static state
- user-button.tsx hasHelpLinks is hard-coded true, so the 'Help & Resources' section label renders even when all env-gated links are absent (only Chat Support remains under it)

## Per-Component Notes

- `src/features/members/components/invite-member-modal.tsx` — Strip hero/blobs/gradient CTA/eyebrows/scroll-FAB to standard dialog grammar; wrap fields in a <form> for Enter submit; add inline email error state; truncate footer workspace name; aria-label the seat number input; replace zinc-* with tokens; rewrite 'Seats Finished' and all 'Dodo' copy.
- `src/features/auth/components/user-profile-modal.tsx` — Make responsive (stack w-80 panel below md, sm:grid-cols-2 forms); reduce to <=3 chunks per tab or split Security into its own tab; surface avatar/banner edit affordances on hover in view mode; nested delete Dialog inside the settings Dialog is modal-in-modal — consider inline expansion in Danger Zone.
- `src/features/manage/components/members-management.tsx` — Remove or relocate the join-code refresh button (code isn't visible here); stop double-reporting invite errors (inline + toast); add dark variants to getRoleBadgeColor; put an Invite CTA in the empty state; swap loading spinner for skeleton rows; reconcile 'viewer' role with the rest of the app.
- `src/features/auth/components/password-change-form.tsx` — bg-purple-600 submit → bg-primary; text-purple-500 icon → text-primary; move pre-submit validation errors inline under fields instead of four different toast.error paths.
- `src/features/members/components/profile.tsx` — Replace text-[#1264a3] with text-primary; give admins a Leave path (condition at line 215 excludes them); label the close icon button; role menu offers admin/member only — align with the owner/viewer model; drop the ineffective w-full on DropdownMenuContent.
- `src/features/manage/components/service-integration-card.tsx` — Delete the 3px gradient IntegrationTopBar (banned stripe accent) and the pulsing dot; add dark: variants to the emerald badge/meta chips; hover:-translate-y-0.5 lift is decorative motion — border/shadow change suffices.
- `src/features/manage/components/channels-management.tsx` — Move 'Max 5MB for images' under the upload zone; add Cancel to the edit dialog footer; aria-label Edit/Delete/X icon buttons; replace gray-50/300 upload zone with tokens + dark variants; remove the !leading-[1.5] class + inline style double-hack on the name input.
- `src/features/manage/components/workspace-management.tsx` — Replace the 3-stat-card hero grid with a single compact meta line (created · N members · N channels); disable Save until name is dirty; add maxLength=20 to the input; delete dead join-code handlers or restore the copy-join-link UI they belonged to; consider typed confirmation for workspace deletion to match account-deletion friction.
- `src/features/auth/components/otp-verification-card.tsx` — Extract the repeated slot className; replace pink-500/pink-200 focus and red/orange banners with ring/destructive/warning tokens + dark variants; enable auto-submit on desktop too; rename 'Resend OTP' to 'Resend code'.
- `src/features/manage/components/integrations-management.tsx` — Remove the spinner block above the skeletons; rewrite the intro paragraph without Composio/AgentAuth/'enhanced productivity' (two plain sentences); type authConfigs/connectedAccounts instead of any[].
- `src/features/auth/components/sign-in-card.tsx` — Add pending state to Continue ('Signing in…' + spinner); drop the '!' from the error message; align inline link color with sign-up-card; backdrop-blur-sm on the card is decorative glass — remove unless the auth page has content behind it.
- `src/features/auth/components/sign-up-card.tsx` — Same pending-state and link-color fixes as sign-in; footer paragraph text-primary → text-muted-foreground; share one email validator with the invite flows.
- `src/features/manage/components/import-data-management.tsx` — Replace the native <select> for Import Destination with the shadcn Select used everywhere else; capitalize status badge labels ('In progress', not 'in progress'); add dark variants to PLATFORMS color chips; unify date formatting with the rest of manage.
- `src/features/auth/components/password-strength-indicator.tsx` — bg-gray-200 → bg-muted for empty bars; bump label colors to >=4.5:1 shades at text-xs (yellow-600 and orange-600 fail); the score-color ladder duplicated as nested ternaries wants a lookup map.
- `src/features/auth/components/user-button.tsx` — Restore keyboard focus visibility on the avatar trigger (outline-none → focus-visible:ring-2 focus-visible:ring-ring rounded-full); gate the 'Help & Resources' label on the actual link flags instead of hasHelpLinks=true; swap HeartPulse for a chat icon on Chat Support.
- `src/features/workspaces/components/create-workspace-modal.tsx` — Give Create a loading state ('Creating…'); shorten the placeholder ('e.g. Acme, Personal') — three quoted examples overflow at narrow widths.

## Questions to Consider

- Is mobile web a supported surface for Account Settings and the manage pages? user-profile-modal is currently unusable there — the answer determines whether that issue is P0 or P1.
- Is 'viewer' a shipped role? It appears only in members-management's role-change dropdown and integration types, never in invite flows, badges, or profile.tsx.
- Is the join-code invite flow deprecated? workspace-management carries dead regenerate/copy handlers and members-management has a regenerate button for a code that's never displayed — half the feature seems removed.
- Should the seat-purchase flow live inside the invite modal at all, or belong to the billing surface with the invite modal deep-linking to it?
