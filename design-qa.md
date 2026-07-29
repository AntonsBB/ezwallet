# EzWallet design QA

## Comparison target

- Source visual truth:
  - `C:\Users\Anton\Documents\Codex\2026-07-29\realtime-voice-chat-2\work\ezwallet-analysis\first-demo-frames\first-028.jpg`
  - `C:\Users\Anton\Documents\Codex\2026-07-29\realtime-voice-chat-2\work\ezwallet-analysis\first-demo-frames\first-041.jpg`
- Implementation screenshots:
  - `C:\Users\Anton\Documents\EzWallet\qa\implementation-market-390x844.png`
  - `C:\Users\Anton\Documents\EzWallet\qa\implementation-work-390x844.png`
- Combined comparison evidence:
  - `C:\Users\Anton\Documents\EzWallet\qa\comparison-market-source-vs-implementation.png`
  - `C:\Users\Anton\Documents\EzWallet\qa\comparison-work-source-vs-implementation.png`
- Viewport: 390 × 844 CSS pixels, device scale factor 1.
- Source pixels: 1920 × 1080 for each source frame.
- Implementation pixels: 390 × 844 for each implementation capture.
- Density normalization: implementation captures were scaled to 1080 pixels high and placed beside the unchanged 1920 × 1080 source frames. Each combined comparison is 2420 × 1080.
- State: authenticated localhost demo profile, unconnected TON wallet, active Market and Work feeds.

The source is a landscape promotional video with a perspective-rendered phone, not a flat 390 × 844 product mock. The comparison therefore judges the visible product language, information hierarchy, marketplace/work states, imagery, and brand fidelity without claiming pixel-level equivalence to the angled device render.

## Full-view comparison evidence

The Market and Work comparisons preserve the source’s black-on-white composition, restrained monochrome brand, real marketplace imagery, oversized plain-language headings, subtle hexagonal depth, direct marketplace/work separation, and persistent four-part navigation. The implementation improves the mobile information hierarchy while remaining visibly part of the same EzWallet product.

No actionable P0, P1, or P2 differences remain.

## Required fidelity surfaces

- Fonts and typography: the geometric sans-serif character, heavy black hierarchy, compact labels, and quiet secondary copy are faithful to the source. Text wraps cleanly at 390 pixels and important prices and actions remain visually dominant.
- Spacing and layout rhythm: the 18-pixel mobile gutters, generous hero rhythm, two-column market cards, one-column work cards, and persistent navigation remain balanced without collisions or hidden primary controls.
- Colors and visual tokens: white, near-black, warm gray, soft green, TON blue, and calm semantic states are consistent and accessible. The source’s hexagonal background treatment is retained at a lower contrast suitable for app content.
- Image quality and asset fidelity: the real EzWallet logo and supplied product/listing assets are used. Images are sharp, correctly cropped, and never replaced with CSS art, text symbols, or placeholder drawings.
- Copy and content: product-specific language is concise, self-contained, and consistent with non-custodial TON payments, buying/selling, micro-jobs, services, reputation, and the disclosed 1% fee.
- Icons and affordances: one coherent icon family is used at consistent optical weights. Search, filter, favorite, create, wallet, navigation, safety, and deal actions have semantic controls and practical tap targets.
- Responsive and accessibility: the Telegram-focused 390 × 844 view has no blocking overflow. Focus-visible styles, semantic buttons and labels, reduced-motion handling, and disabled states are present.

## Focused-region comparison

A separate crop was not needed: the implementation panels in both 2420 × 1080 combined comparisons are rendered at 500 pixels wide and keep the logo, heading, controls, cards, prices, imagery, and bottom navigation legible enough to inspect at full resolution.

## Interaction and runtime evidence

Tested in the Codex in-app browser:

- Market search and filtering, including empty and single-result states.
- Market listing detail and authenticated moderation report submission.
- Work feed, job detail, application submission, and restored “Application sent” state.
- New Market and Work listing forms and persisted local publication.
- Wallet unconnected/verification-required state.
- Profile display, profile editor, and Safety route.
- Persistent bottom navigation and legal back navigation.

After a clean development-server start, the browser-rendered release candidate produced no application console errors. The only development diagnostics were missing third-party TON Connect source-map files, which do not affect runtime execution.

## Findings

No P0, P1, or P2 findings.

## Comparison history

This was the first formal combined-image comparison pass after interaction cleanup. It found no blocking visual issues, so no P0/P1/P2 fix iteration was required. Pre-QA cleanup corrected singular listing copy and replaced legal-page text arrows with plain accessible labels before the evidence captures.

## Follow-up polish

- P3: a custom bundled display font could bring the large headings even closer to the promotional video, but the current system stack is visually compatible, faster, and avoids an external font dependency.
- P3: the category rail intentionally reveals a clipped next chip as a horizontal-scroll cue on narrow screens.

## Implementation checklist

- [x] Source and implementation opened and compared together.
- [x] Market and Work states captured at the intended Telegram viewport.
- [x] Required fidelity surfaces reviewed.
- [x] Primary interactions exercised.
- [x] Clean-start console checked.
- [x] No actionable P0/P1/P2 findings remain.

final result: passed
