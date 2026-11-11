# MASTER UI / Dashboard / Motion / Video / 3D Reference Guide

**File:** `UI_COMPONENT_REFERENCE_GUIDE.md`  
**Status:** Master / project-ready living reference — React, UI, data grids, finance, micro-interactions, motion, code-generated video and AI 3D  
**Last reviewed:** 2026-10-24 (new visual and component references; Open Generative AI official-source review). Historical release-watch notes remain below.
**Previous review:** 2026-10-18 (Mega Menu and Premium Kanban visual references)
**Review mode:** Official-source verification required before adopting a library, agent skill, premium component, cloud provider, generated asset, or major-version upgrade. Historical version snapshots are intentionally retained; always check a source’s releases before installing.

---



## How to use this master file

Put this Markdown file in the project root as `UI_COMPONENT_REFERENCE_GUIDE.md`, then instruct Codex, Claude Code, or another coding agent to read it **before** any UI/video/3D design decision. It is a **reference and selection policy**, not an instruction to install all dependencies. For production work, keep the project’s own source code, architecture, data model, and brand requirements authoritative.

**Jump to:** [UI source registry](#3-source-registry) · [Data grids](#4-table--data-grid-decision-guide) · [Finance charts](#5-finance-specific-visualization) · [A.S Motion Kit](#6-motion-design-reference--as-claude-motion-kit) · [Video workflow & source catalog](#19-code-generated-video-and-motion-sourcebook) · [Agent instructions](#20-copy-ready-agent-instructions) · [Latest review](#21-october-18-2026-update-summary) · [Visual palettes & landing-page design patterns](#22-visual-inspiration-color-pairs-and-landing-page-patterns--2026-10-18) · [Task dashboards, signup and tree navigation](#23-project-management-dashboard-animated-signup-and-tree-navigation--screenshot-references-2026-10-18) · [Notifications and 3D login](#24-notification-stack-and-3d-login-background--screenshot-references-2026-10-18) · [Vibe Board AI/QA workflow](#25-vibe-board--ai-assisted-testing-and-fixing-kanban-reference--2026-10-18) · [Premium Kanban comparison](#26-premium-kanban--basic-vs-upgraded-ui-comparison--2026-10-18) · [Premium Mega Menu](#27-premium-mega-menu--basic-vs-upgraded-navigation-reference--2026-10-18) · [20 Oct official-source watch](#28-official-source-watch--2026-10-20) · [Changelog](#17-changelog).

**Source confidence labels:**
- **Verified official:** claims confirmed against the identified official project/release/README at the noted review date.
- **Reference/inspiration:** a design example; rights to copy implementation or assets must be independently checked.
- **Candidate:** technically promising, but not automatically approved for deployment.
- **Historical snapshot:** may be accurate as of its dated review, not a claim about the latest version today.

## 1. Purpose

Shared decision guide for UI/UX, enterprise tables, dashboards, finance/fintech interfaces, charting, and selective 3D/WebGL work.

Before a significant redesign:
1. inspect the project's existing architecture and components;
2. consult this guide;
3. prefer proven patterns over unnecessary dependencies;
4. verify current official documentation and licensing;
5. preserve business logic and source-of-truth behavior;
6. test performance, accessibility, responsive behavior, and RTL where applicable;
7. record meaningful new sources or version changes in this file.

> **Core rule:** choose the smallest, safest solution that satisfies the real workflow. Do not install a library merely because a demo looks modern.

---

## 2. Preferred Reference Stack

| Need | Preferred reference/tool | Position |
|---|---|---|
| 3D / WebGL / immersive UI inspiration | ThreeUI | Inspiration first |
| Image-to-3D / textured 3D asset generation | Microsoft TRELLIS / TRELLIS.2 | Offline asset production candidate (GPU required) |
| KPI / analytics / dashboard components | DashboardCN | Preferred |
| Executive / finance / analytics dashboards | Tremor | Preferred |
| Polished application / fintech UI | Untitled UI | Strong visual + implementation reference |
| React UI primitives / blocks | shadcn/ui | Preferred foundation |
| Fully custom React tables | TanStack Table v9.3.1 | Preferred headless table engine |
| Complex enterprise data grid | AG Grid 36.2 | Preferred enterprise grid |
| Spreadsheet / Excel-like editing | Handsontable 18.1.2 | Spreadsheet workflows |
| Material-style advanced grid | MUI X Data Grid v9.15.0 | MUI projects |
| Financial market/time-series charts | TradingView Lightweight Charts 5.2.1 | Preferred market charting |
| Micro-interactions / interaction polish | Bencho | Preferred micro-interaction reference |
| People-ops / HR dashboard motion reference | Coterie (Code and Chill) | Visual/motion reference candidate |
| Enterprise tasks, Kanban, action-tracking & settings layouts | Code & Chill screenshot set (Section 23) | High-value visual/information-architecture reference |
| AI-assisted QA, bug triage & test-to-fix Kanban workflow | Vibe Board / Vibe Test screenshot (Section 25) | High-value workflow concept; real automation unverified |
| Kanban workflow polish / Review lane / card hierarchy | Design & Code With AV Premium Kanban screenshot (Section 26) | Visual component pattern; interactive code unverified |
| Animated auth / registration UX | Flow by InfiWeb Craft screenshot (Section 23) | Focus/feedback inspiration only; use existing auth stack |
| Nested folders, documents and resources | Premium Tree Navigation screenshot (Section 23) | Accessible information-architecture reference |
| Compact recent-notification display | Premium Notification Stack screenshot (Section 24) | Secondary visual reference; full accessible inbox required |
| 3D/wireframe-branded sign-in atmosphere | Aurora login screenshot (Section 24) | Optional decoration; preserve auth correctness & performance |
| Small interface experiments / tactile controls | The Kitchen (dqnamo) | Secondary micro-interaction inspiration |
| Web Components / framework-neutral patterns | Component Kitchen / Elix | Alternative UI architecture reference |
| Code-generated React videos | Remotion | Primary renderer for data/product explainers |
| HTML, CSS, GSAP and WebGL videos | HyperFrames | Primary candidate for web/UI motion |
| Agent-led video production orchestration | OpenMontage | Governed workflow reference; AGPL caveat |
| Cinematic shot language | Video Shotcraft | Preferred director/shot-reference layer |
| Style direction for code-generated films | Lemo Opuscar | Style-board research and techniques |


---

# 3. Source Registry

## 3.1 ThreeUI

**Official:** https://threeui.com/browse

Best for Three.js/WebGL inspiration, shaders, interactive backgrounds, 3D product scenes, hero visuals, and premium motion.

### Rules
- Treat primarily as an inspiration/reference source unless the exact component license is verified.
- Lazy-load heavy assets.
- Respect `prefers-reduced-motion`.
- Provide sensible fallbacks.
- Measure real mobile performance.
- Do not use WebGL where CSS/SVG can communicate the same thing more cheaply.
- Do not allow decorative 3D to compete with data-entry or decision workflows.

**2026-09-29 watch:** no verified change found that alters our current adoption guidance.

---

## 3.2 DashboardCN

**Official:** https://dashboardcn.com/  
**Docs:** https://dashboardcn.com/docs

DashboardCN remains one of the best matches for our data-heavy React/Tailwind/shadcn products.

### Current verified position
- React + Tailwind CSS v4
- shadcn-compatible
- TanStack Table v9 for tables
- Recharts/shadcn chart foundation
- source-copy installation
- MIT licensed
- commercial use allowed
- no Pro tier / seat license
- currently advertises **27 components** and **25 composed blocks**
- supports both Radix and Base UI flavors where applicable
- provides Markdown/`llms.txt` documentation and agent-oriented installation guidance

### Strong patterns
KPI cards, trend charts, composed charts, sparklines, funnels, heatmaps, gauges, distribution bars, ranked lists, timelines, period tabs, and full data tables.

### Default rule
Check DashboardCN before building a dashboard visualization from scratch.

**2026-09-29 watch:** no newer change materially alters the selection rule.

---

## 3.3 Tremor

**Official:** https://www.tremor.so/  
**Components:** https://npm.tremor.so/components  
**Changelog:** https://www.tremor.so/changelog

Strong reference for executive dashboards, financial reporting, revenue/cost views, KPI reporting, filters, trend cards, and analytical page composition.

Use Tremor as a design/interaction reference even when we do not import it directly.

### Preferred patterns
- compact analytical cards
- period comparisons
- sparklines
- line/area/bar/donut/scatter/funnel charts
- trackers and progress components
- date-range filters
- readable dashboard density

**2026-09-29 watch:** no verified update this week changes our adoption guidance.

---

## 3.4 Untitled UI

**Official:** https://www.untitledui.com/react  
**Changelog:** https://www.untitledui.com/changelog  
**License:** https://www.untitledui.com/license

Strong for fintech/application shells, balances, spending, transactions, sidebars, navigation, enterprise forms, tables, metric cards, and polished visual hierarchy.

### Important existing capabilities
- React + TypeScript + Tailwind direction
- React Aria patterns
- RTL support
- free/open-source and paid PRO assets coexist

### NEW — 2026-09-23: Lovable integration

Untitled UI React now has an official **Lovable integration**.

The official starter uses:
- **TanStack Start on Vite**
- providers and routing preconfigured
- direct opening/copying of many marketing and application examples into Lovable
- two-way GitHub sync through Lovable workflows

### Why this matters

This is a meaningful workflow trend: high-quality design systems are increasingly becoming **AI-builder-ready**, not just Figma/npm libraries.

For our projects:
- Untitled UI remains a visual/UX reference first.
- The Lovable integration is useful for rapid prototypes and design exploration.
- Do not let AI-builder convenience override our architecture, governance, security, database, or deployment standards.
- Production changes still require code review and normal regression testing.
- For Codex/ChatGPT workflows, prefer source-controlled implementation rather than treating a generated builder project as the source of truth.

### Licensing guardrail
Verify the exact Free vs PRO component/license before copying assets or implementation.

---

## 3.5 shadcn/ui

**Official:** https://ui.shadcn.com/  
**Blocks:** https://ui.shadcn.com/blocks  
**Changelog:** https://ui.shadcn.com/docs/changelog

Preferred base layer for React/Tailwind application UI when the project does not already have another established design system.

### Current September 2026 change — `cn` package

shadcn components now import `cn` from the dedicated `cn` package instead of maintaining the traditional local `clsx` + `tailwind-merge` helper.

Existing projects are not forced to break. A migration command is available, and the `utils` registry item can re-export `cn`.

### Adoption rule
Do not perform this migration merely for novelty in a stable production project. Apply it when:
- adding/updating shadcn components makes the migration worthwhile;
- dependency simplification has value;
- normal regression testing is available.

### 2026-10-07 CLI patch — shadcn 4.21.4

The official CLI/registry patch removes the `ts-morph` dependency from the registry and its code transformers, including the RTL transformer. This is a dependency/CLI maintenance change, **not** a reason to regenerate existing UI or rewrite working RTL. Test the generated diff and RTL behavior before applying updates.

**Source:** https://github.com/shadcn-ui/ui/releases/tag/shadcn%404.21.4

**Historical 2026-09-29 watch:** September `cn` migration remained the key prior change.

---


## 3.6 Bencho

**Official:** https://bencho.dev/  
**Finds:** https://bencho.dev/finds  
**Bench:** https://bencho.dev/bench  
**Sounds:** https://bencho.dev/sounds  
**License:** https://bencho.dev/licence

### Position in our stack

Bencho is **not** a full design system and should not replace shadcn, Tremor, DashboardCN, TanStack Table, AG Grid, or our project-specific component systems.

Its value is different:

> **Bencho = interaction polish + micro-interaction patterns + copyable live behaviors.**

The site currently presents live blocks that can be pressed, dragged, hovered, selected, retuned, and copied as code.

### Strong blocks/patterns for our projects

Useful examples include:

- Heat map hover
- Image compare drag
- Signature pad
- Voice note
- Dynamic island
- Time scrubber
- Upload dropzone
- Label input
- One-time code input
- Step player
- Action node
- Magnetic select
- Slide to confirm
- Assignees selector
- Checklist
- Carousel/swipe
- Tilt card
- Pull to refresh
- Create menu
- Reorder list
- Canvas toolbar
- Radial menu
- Drag stepper
- Inline confirm
- Notify
- Icon bar

### Best uses in our projects

#### CHEIRON / Incident Investigation
Use selectively for:
- `Slide to confirm` on irreversible or high-consequence workflow actions;
- `Inline confirm` for approve/reject/remove approval actions;
- `Assignees` interactions in Action Tracker;
- `Checklist` for investigation completeness;
- `Reorder list` where prioritization is meaningful;
- `Upload dropzone` for evidence;
- `Step player` for timeline/storyboard or investigation walkthroughs.

Do not over-animate operational tables or critical HSE decisions.

#### Finance / BoostMind OS
Useful for:
- amount/receipt transitions;
- inline confirmation;
- transaction/category controls;
- drag/reorder only when it maps to a real business action;
- one-time code/authentication patterns;
- polished create/add flows.

For financial data, interaction must never hide raw values, totals, auditability, or confirmation state.

#### Company / Product Website
Bencho can be used more aggressively for:
- magnetic controls;
- image compare;
- tilt cards;
- radial/create menus;
- dynamic island interactions;
- hover/press polish;
- product-demo interactions.

#### Forms / Data Entry
Useful for:
- label/input transitions;
- OTP fields;
- upload/dropzone behavior;
- clear validation/confirmation states;
- compact create menus.

### Finds

Bencho's **Finds** area is a curated inspiration wall of interaction details from other designers.

Use it as:
- an interaction-research feed;
- inspiration for transitions and state changes;
- a place to identify patterns worth recreating within our own design system.

Do not treat visual inspiration as implementation permission; verify the source/licensing when recreating third-party work.

### Bench

The **Bench** is an infinite canvas where live blocks can be arranged and tuned together.

Potential use in our workflow:
- rapid interaction moodboard;
- compare multiple micro-interactions before coding them into a project;
- test whether several motion patterns feel coherent together;
- create a small interaction language before a redesign.

### UI Sounds

Bencho also provides a categorized UI-sound reference for:
- actions;
- feedback;
- navigation;
- notifications;
- selection;
- movement;
- progress;
- system states.

#### Sound rule for our projects

Use UI sound **very selectively**.

Good candidates:
- marketing/product demos;
- kiosk/demo mode;
- deliberate completion/confirmation moments;
- optional training/e-learning interactions.

Normally avoid or default-mute sound in:
- HSE operational dashboards;
- finance/admin systems;
- repetitive data-entry workflows;
- shared office environments.

Sound must never be the only indicator of an important state.

### Licensing

Bencho states that the **blocks and code copied from the Code pane are MIT licensed**, including commercial use and modification.

Important distinction:
- blocks/code: MIT;
- Bencho site/application itself: not included;
- Bencho name/mark: not licensed for reuse;
- photographs/assets inside examples may have separate rights;
- external dependencies retain their own licenses.

### Adoption rule

Use Bencho when a page already works functionally and needs **interaction quality**, not when the project still lacks a stable layout, data model, validation, accessibility, or core business workflow.

Preferred sequence:
1. make workflow correct;
2. make hierarchy/readability correct;
3. make responsive/accessibility behavior correct;
4. then add Bencho-style interaction polish.

### Status

**Preferred secondary reference for micro-interactions.**

It complements:
- ThreeUI → 3D/WebGL
- A.S Motion Kit → motion storytelling
- shadcn/ui → application primitives
- DashboardCN/Tremor → dashboards
- Bencho → tactile interaction details



## 3.7 Coterie — Code and Chill

**Official:** https://store.hasib.site/templates/coterie  
**Store:** https://store.hasib.site/

### Verified positioning

The accessible product page identifies Coterie as:

> **“a people-ops dashboard with motion that behaves”**

The broader Code and Chill store presents itself around **interface parts that behave under pressure**.

### Position in our stack

Coterie is best treated as a **visual and interaction reference for people-operations / HR / admin dashboards**, especially where a dense business interface needs restrained, purposeful motion rather than decorative animation.

It does **not** replace:
- DashboardCN / Tremor for dashboard component systems;
- TanStack / AG Grid for data-table logic;
- Bencho for isolated micro-interactions;
- A.S Motion Kit for motion storytelling;
- shadcn/ui for application primitives.

### Where it can help us

Potentially useful for:
- employee/people directories;
- team status and availability;
- onboarding/offboarding;
- leave/attendance/admin flows;
- people analytics;
- task/action panels;
- management dashboards;
- dense admin screens where motion should communicate state and hierarchy.

### Motion principle to borrow

The strongest idea in the positioning is **motion that behaves**.

For our projects, interpret that as:
- motion follows state;
- transitions preserve orientation;
- animation supports hierarchy;
- dense data remains readable while things move;
- no gratuitous motion in repetitive workflows;
- reduced-motion behavior must remain usable.

This makes Coterie particularly relevant to enterprise dashboard design, where motion should clarify **what changed, what is active, and where the user is**, rather than attract attention for its own sake.

### Potential project fit

#### CHEIRON
Useful as inspiration for:
- investigation-team views;
- role/assignee panels;
- Action Tracker people/action ownership;
- availability/status cards;
- approval/task drawers;
- subtle page-to-panel transitions.

#### Executive / Objective dashboards
Useful for:
- right-side action panels;
- compact people/task modules;
- state-change animations;
- card hierarchy and focus transitions.

#### Finance / Admin products
Useful mainly for:
- admin workspace composition;
- contextual actions;
- navigation state;
- restrained motion around filters, drawers, and editable panels.

It is **not** a finance-specific source; use Tremor/Untitled UI/DashboardCN for finance visual language.

### Verification / licensing guardrail

At the 2026-10-01 review, the page title and high-level positioning were accessible, but the detailed template content, implementation stack, code-delivery model, pricing, and license terms were not reliably exposed to the crawler.

Therefore:
- treat Coterie as **inspiration/reference first**;
- do not copy production code or assets until license/usage rights are verified;
- do not assume the underlying framework or component stack;
- re-check the product page before any purchase or implementation decision.

### Status

**Approved visual/motion reference candidate** for people-ops and enterprise admin interfaces.


## 3.8 Microsoft TRELLIS / TRELLIS.2 — AI-generated 3D assets

**Official v1:** https://github.com/microsoft/TRELLIS  
**Official v2:** https://github.com/microsoft/TRELLIS.2  
**TRELLIS.2 project and examples:** https://microsoft.github.io/TRELLIS.2/  
**TRELLIS.2 model:** https://huggingface.co/microsoft/TRELLIS.2-4B  
**TRELLIS.2 browser demo:** https://huggingface.co/spaces/microsoft/TRELLIS.2

### What it is — not a UI library or animation renderer

TRELLIS is an **asset-generation model**, not a shadcn component, Three.js UI framework, or automatic movie editor.

- **TRELLIS (original):** image/text to 3D via Structured LATents (SLAT); supports radiance fields, 3D Gaussians and meshes; exports usable `.glb` textured mesh and `.ply` Gaussian data, and preview videos. Original repo suggests text → image → TRELLIS-image as higher-quality path than direct text conditioning.
- **TRELLIS.2:** a newer 4-billion-parameter **single-image to 3D** model using O-Voxel; supports complex surfaces/topology plus full physically based rendering materials (base color, metallic, roughness and alpha/opacity). It outputs textured 3D meshes, including GLB export and optional turntable-style MP4 renders.

**Selection:** prefer TRELLIS.2 for modern textured/PBR product or object assets when appropriate hardware is available. Keep original TRELLIS as a Gaussian/radiance-field and legacy reference; TRELLIS.2 is not a drop-in replacement for every v1 output representation or text workflow.

### Practical workflow for our projects

1. Produce or collect an approved, appropriately licensed **reference image** of an object.
2. Remove/clean background as necessary using properly licensed tooling.
3. Generate a draft model via official TRELLIS.2 demo or controlled Linux GPU worker.
4. Inspect the **full 360-degree geometry**, including the unseen back; do not assume the model reconstructs real engineering dimensions from one photograph.
5. Fix mesh defects, decimate polygons, check PBR texture maps/transparency and output size.
6. Export GLB and verify it in a real viewer (Blender / Three.js / React Three Fiber); optimize meshes/textures for web.
7. Use the same approved GLB in interactive websites or in the motion pipeline (Blender / Three.js → frames → HyperFrames / OpenMontage / Remotion / FFmpeg).
8. Archive source image, output GLB, license provenance, modifications, QA notes, and approved stills.

### Project fits

**BoostMind / corporate/product web:** 3D product/device visuals, branded hero objects, section illustrations, product configurator prototypes, interactive rotatable objects. Pair with ThreeUI/Three.js for presentation; TRELLIS produces the asset and Three.js displays it.

**CHEIRON / ANRPC / Oil & Gas safety:** optional illustrative equipment, PPE, physical hazard storytelling, process safety training visuals, or incident reconstruction *concept art*. Generated geometry must **never** be treated as an engineering-grade representation, dimensionally accurate model, forensic evidence, or as-built plant layout. Validate against engineering/CAD when precision matters.

**E-learning:** 360-degree learning objects, science props, simple equipment examples, teaching scenes and explainer assets.

**Marketing/video:** approved still → TRELLIS.2 GLB → camera/light/physics design in Blender or Three.js → sequence frames → Remotion/HyperFrames/OpenMontage compositing → final MP4 and sound. The 3D model alone does not invent a timeline, shots, or narration.

**Finance:** limited direct applicability; use only when a meaningful illustrative visual adds clarity, not for numerical charts/tables.

### Hardware and deployment

| | TRELLIS original | TRELLIS.2 |
|---|---|---|
| Main input | Image or text | Single image |
| GPU minimum in official README | NVIDIA ≥16GB VRAM | NVIDIA ≥24GB VRAM |
| Official tested OS | Linux | Linux |
| Compute | CUDA and compiled extensions | CUDA 12.4 recommended; compiled extensions |
| Export/use | GLB / PLY / preview video | PBR GLB / preview video |
| Example inference timings | Hardware dependent | ~3s 512³; ~17s 1024³; ~60s 1536³ **on H100 GPU only** |

**Deployment rule:** never attempt to run TRELLIS inference inside Cloudflare Pages, a typical shared server or each user's browser. Run it in a controlled GPU creation pipeline, then serve optimized static GLB assets from storage/CDN if web interactivity is needed. A 24GB GPU prerequisite does not imply the model will be fast on every 24GB card.

### Limitations / QA

- Single-image reconstruction invents geometry that was not visible in the input; do not rely on it for exact measurements.
- Official TRELLIS.2 model card warns generated meshes can have small holes/topological artifacts; post-process watertight models for 3D printing.
- Some output assets can be too dense or have large textures for the web. Optimize and benchmark on mobile.
- The example TRELLIS.2 GLB may default to OPAQUE even when a texture holds alpha: activate alpha/opacity explicitly in the target viewer when needed.
- The official inference time numbers are H100 benchmarks, not ordinary PC guarantees.

### Licensing & security — crucial

- **Official TRELLIS and TRELLIS.2 repo code:** MIT.
- **Official TRELLIS.2-4B Hugging Face model card:** MIT.
- **Important exception:** NVIDIA `nvdiffrast` / `nvdiffrec` dependencies have **separate** licenses; review actual terms before a commercial deployment. Other extensions/assets/model weights may also have their own licenses.
- **Project website media:** the official TRELLIS.2 project page contains an academic/research-only material disclaimer; do not assume sample images, videos, or page media are commercially reusable just because the model code is MIT.
- Verify source-image copyrights and end-client rights; never infer unrestricted rights in generated output based solely on repo license.
- Do not run unknown TRELLIS installer binaries, community Docker images, or unreviewed setup scripts in company production environments. Pin tested commits/dependencies, scan containers and avoid leaking proprietary customer images to public demo Spaces.

### Architecture status (reviewed 2026-10-09)

**Promote as preferred 3D asset-generation candidate, NOT as runtime UI dependency.**
The actual production choice depends on the asset's geometry/texture needs, verified legal rights, GPU availability, and output QA. No existing UI/table/video renderer selection changes because of TRELLIS.


## 3.9 The Kitchen — dqnamo (micro-interaction studies)

**Official:** https://www.dqnamo.com/kitchen  
**Reviewed:** 2026-10-18  
**Status:** Secondary inspiration, **not** a full design system.

The page explicitly describes itself as small interface studies, animation patterns and component demos. Examples visible in its collection include:
- **Hold to Confirm:** an intentional hold-to-delete action with a timed undo.
- **Magnetic Drop Zone:** a drag/drop target that reacts to an incoming file.
- **Dynamic Button:** label and button resizing transitions.
- **Receipt Printer:** a visual checkout/receipt state.
- **Scramble Text, Tactile Button, Audio Player, Animated Signature, Logo Trace Loader, Scroll Fade List, Model Selector**, and visual surface experiments.

**Useful for us:** sensitive approval confirmations and evidence uploads (CHEIRON); payment receipt/transaction acknowledgement (finance); tactile CTA/hover polish (product sites); narrowly scoped upload feedback (training and admin).

**Production rules:** prefer existing shadcn/React primitives as the accessible foundation; implement a Kitchen-inspired behavior **within our existing design system**. Any third-party component code and demo imagery require rights/license review. Do not assume every experiment has the same license or that it is accessibility-complete. Never make hold-to-confirm the *only* accessible path to a critical action.

**Relationship to Bencho:** both are interaction reference libraries. Bencho has interactive blocks + Bench/Finds/Sounds, while dqnamo’s Kitchen has focused experiments and delightful state transitions. They are complements, not competing app foundations.

## 3.10 Component Kitchen / Elix (Web Components)

**Official:** https://component.kitchen/elix/  
**Status:** Framework-neutral Web Components reference.

Elix documents reusable standard Web Components for **carousels, menus, dialogs, drawers, calendar/date inputs, listboxes, combo boxes, overlays, tabs, toast, pull-to-refresh**, plus customizable mixins for focus, selection, keyboard navigation and language direction. It is not the same project as dqnamo’s Kitchen.

**Good when:** working with framework-agnostic web interfaces or needing a standards-based component layer. **For existing React/Tailwind/shadcn projects:** do not replace the established stack just to use Elix; consult its interaction/keyboard patterns or deliberately wrap a focused Web Component after integration testing. Check actual license/version before importing code.

# 4. Table & Data Grid Decision Guide

## 4.1 TanStack Table v9.3.1

**Official:** https://tanstack.com/table/v9

Preferred headless/custom table engine.

### Key v9 reasons
- stable v9 architecture
- tree-shakable opt-in features
- fine-grained state backed by TanStack Store
- shared prototypes and substantially improved memory behavior
- stronger type safety
- reusable table composition (`tableOptions`, `createTableHook`)
- cell selection and spanning
- improved grouping, sorting, filtering, selection, resizing
- dedicated Devtools
- server-side processing remains available when client-side processing is not appropriate

TanStack reports large performance improvements over v8 in its published benchmark work, including significantly lower retained heap and faster row-model operations at large scale.

### Choose TanStack when
- we need full visual control;
- we use shadcn/Tailwind or a custom design system;
- requirements are custom but not a full spreadsheet;
- bundle and rendering control matter;
- we want a reusable project-specific table system.

### Preferred pairing
`TanStack Table v9 + shadcn/ui + project design system`

### 2026-10-12 patch — 9.3.1

- `@tanstack/react-table@9.3.1` fixes stale `AppTable` context/rows when options or data change under React Compiler, `useMemo`, or `memo`-cached elements.
- `@tanstack/table-core@9.3.1` improves feature-level tree-shaking (the maintainers report roughly 0.27 kB brotli savings for a minimal table), reduces memo allocation overhead, and prevents private types leaking into emitted `.d.ts` (TS2883).
- Vue/Svelte wrappers also received context synchronization fixes. **React applications should validate table state after replacing datasets/columns**, especially memoized dashboards.
- Patch does not change our headless-grid selection rule. Source: https://github.com/TanStack/table/releases

**Historical 2026-09-29 watch:** v9 remained the preferred headless architecture.

---

## 4.2 AG Grid 36.2

**Official:** https://www.ag-grid.com/react-data-grid/  
**What's new:** https://www.ag-grid.com/whats-new/  
**Pricing:** https://www.ag-grid.com/license-pricing/

Preferred when the grid itself is a major enterprise feature.

### 36.2 highlights — released 2026-09-16
- PDF Export
- Set Filter support in Advanced Filter
- custom filter options in Advanced Filter
- continuous column auto-sizing
- custom renderers for column items in Columns Tool Panel

The 36.2 minor migration guidance reports no breaking/behavior changes for this minor release.

### Finance relevance
PDF Export and richer Advanced Filter behavior are particularly useful for management reporting and analytical workflows.

### AG Grid 36 upgrade guardrail
When upgrading from older major versions, review the migration guide. Important v36-era considerations include:
- minimum TypeScript 5.8.3;
- shared `ag-stack` dependency;
- substantial scrolling/pinned-column DOM architecture changes;
- custom CSS or DOM-targeted tests may need adjustment.

### Licensing
- Community: free/MIT
- Enterprise: commercial license required for Enterprise features

Always check whether Community satisfies the requirement before choosing Enterprise.

**2026-09-29 watch:** 36.2.0 remains the latest verified release; no newer release found.

---

## 4.3 Handsontable 18.1.2

**Official:** https://handsontable.com/  
**Changelog:** https://handsontable.com/docs/react-data-grid/changelog/  
**Pricing:** https://handsontable.com/pricing

Choose when spreadsheet interaction is a real business requirement.

### Strong use cases
- budgeting
- planning
- forecasting
- cost models
- monthly input matrices
- bulk financial entry
- Excel-style workflows

### Important 18.1 capabilities
- selection handles for resizing ranges
- moving cell selections by dragging
- Persian RTL support
- layout/rendering controls

### 18.1.1 — released 2026-09-15
Patch fixes copying/cutting/pasting in grids embedded in Salesforce Lightning Web Components.

### Licensing
Commercial production requires a commercial license.

Do not choose Handsontable simply to make a normal table look like Excel.

### 18.1.2 — released 2026-10-07 (licensing-sensitive patch)

- Entitlement license keys now validate their human-readable text **and** bracketed payload. Editing/removing the text, or appending text after the key, can invalidate it; normal rewrapping, one-line keys and `\n`-escaped keys remain supported.
- Fixes keys whose bracketed payload was broken across lines by email clients and caused the grid to lock.
- **Upgrade gate:** test the actual production license-key format in staging before rolling out, particularly keys stored in env vars, secret managers or deployment templates. Never log the full key.
- Source: https://github.com/handsontable/handsontable/releases/tag/18.1.2

**Historical 2026-09-29 watch:** 18.1.1 was the latest release then.

---

## 4.4 MUI X Data Grid v9.15.0

**Official:** https://mui.com/x/react-data-grid/  
**What's new:** https://mui.com/x/whats-new/

Use primarily when Material UI is already part of the project.

### v9 direction
- stable Data Grid + Charts integration
- AI Assistant in Premium
- undo/redo in Premium
- drag fill in Premium
- `longText` column type
- stronger chart accessibility/interaction
- premium candlestick/range-bar/WebGL heatmap capabilities elsewhere in MUI X

### Licensing
Community/MIT and commercial Pro/Premium tiers coexist. Verify the exact feature tier.

### Default preference
For our custom-branded Tailwind/shadcn products:
1. TanStack for custom tables
2. AG Grid for enterprise-heavy grids
3. Handsontable for spreadsheet workflows
4. MUI X when MUI is already the product foundation

### 9.15.0 — released 2026-10-06

- New Data Grid `height` prop allows sizing without an extra wrapper; fixes flex/detail-panel jumps and data-source polling cleanup.
- Data Grid and Charts exports work under Content Security Policy (CSP), useful for hardened enterprise applications.
- Charts improve keyboard navigation with Home/End, Ctrl+Home/End and PageUp/PageDown.
- Scheduler adds `ru-RU`; date/time pickers gain `onCancel`.
- Source: https://github.com/mui/mui-x/releases/tag/v9.15.0

**Adoption:** still prefer MUI X when the application already uses MUI; do not migrate shadcn/TanStack dashboards solely for these improvements.

---

# 5. Finance-Specific Visualization

## 5.1 TradingView Lightweight Charts 5.2.1

**Official:** https://tradingview.github.io/lightweight-charts/  
**Releases:** https://github.com/tradingview/lightweight-charts/releases

Preferred for real market/asset time-series, not ordinary revenue/cost dashboard lines.

### Current verified library release
**5.2.1**

Notable current behavior:
- improved crosshair/hover performance with markers + large datasets;
- improved overlapping-series hover rendering;
- multiple bug fixes around autoscale, markers, crosshair/data replacement;
- AI Agent Skills for current v5 usage and plugin authoring.

### NEWLY EMPHASIZED — official plugin packages

TradingView released the first official plugin-package set on **2026-09-16**.

It includes:
- `@tradingview/lwc-toolkit` 1.0.0
- accessibility plugin
- brushable area series
- dual-range histogram series
- HLC area series
- image watermark
- pretty histogram series
- rounded candles
- stacked area series
- stacked bars
- vertical line
- `create-lwc-plugin` scaffolding

### Why this matters

This materially improves the library's extensibility story. We should now prefer an **official plugin** over writing a custom primitive/series when an official package covers the need.

The accessibility plugin is especially important: it packages keyboard navigation, ARIA markup, and screen-reader announcements into a reusable chart-level helper.

### Finance adoption rule
Use Lightweight Charts when we need genuine market/time-series interaction:
- asset prices
- candlesticks/OHLC
- portfolio history
- trading-style crosshair/scale behavior
- high-density financial time series

Use Tremor/DashboardCN/Recharts for normal business KPI trends.

### Licensing
Apache 2.0 plus TradingView attribution requirements. Include the required attribution notice/link; the built-in attribution logo option can satisfy the link requirement when used appropriately.

---


# 6. Motion Design Reference — A.S Claude Motion Kit

**Local reference files:**
- `effect.html`
- `Claude_Motion.pdf`
- `FIX_PROMPT.txt`
- `START_HERE.txt`

**Status:** Approved internal inspiration/workflow reference.

## What this kit gives us

The kit provides a reusable pattern for building short, polished HTML/CSS/JS motion sequences around product UI, dashboards, workflows, marketing messages, and brand reveals.

The starter implementation uses:
- a self-contained HTML working canvas;
- CSS variables for a consistent visual system;
- a seamless 8-second loop;
- readable paused states;
- minimal decorative noise;
- a strict "edit this file" workflow.

## Strong motion patterns worth reusing

### 1. CTA → Product Demo
Best for:
- landing pages;
- AI/product demos;
- feature-launch sections;
- onboarding previews.

Pattern:
small CTA → shared-element expansion → product/demo workspace.

### 2. Prompt → Result
Best for:
- AI assistants;
- automation products;
- "one instruction → many outputs" storytelling.

Pattern:
input typing → sequential result cards → return to input state.

### 3. Brief → Full Strategy Workspace
Best for:
- consulting products;
- AI strategy tools;
- planning modules;
- project kickoff visuals.

Pattern:
small brief card → expanding multi-panel strategic workspace.

### 4. Department Tabs / Operating System
Best for:
- internal business systems;
- BoostMind;
- executive operating systems;
- multi-module portals.

Pattern:
active tab glides across departments while the content panel changes underneath.

### 5. Data Morph
Best for:
- KPI dashboards;
- finance;
- HSE trends;
- case-study storytelling.

Pattern:
the same data morphs from bars to line while preserving visual identity, then highlights the final KPI.

### 6. CEO Dashboard Zoom
Best for:
- CHEIRON dashboard;
- ANRPC PSM KPI;
- executive reporting;
- finance dashboards.

Pattern:
show full dashboard → dim context → zoom one KPI card forward → highlight metric/value/change.

### 7. AI Tool Stack / Dock
Best for:
- product/AI capability pages;
- tool ecosystems;
- technology-stack explainers.

Pattern:
stacked cards or magnetic dock → focused item → small function label.

### 8. Keyword Reveal
Best for:
- hero sections;
- campaign launches;
- event pages;
- bold product statements.

Pattern:
outline typography → visual reveal inside letters → supporting subheadline.

### 9. Headline → Content System
Best for:
- marketing automation;
- content repurposing;
- campaign-management tools.

Pattern:
one core idea expands into multiple connected content assets.

### 10. Product / Course / Event Reveal
Best for:
- e-learning;
- launches;
- campaign announcements;
- event microsites.

Pattern:
retracting panels reveal the product/event visual and CTA.

### 11. Business System Layers
Best for:
- architecture explainers;
- platform overview;
- process safety systems;
- modular product architecture.

Pattern:
one flat interface separates into aligned perspective layers such as Data / AI / Automation / Operations / Dashboard.

### 12. KPI Glass Focus
Best for:
- management reports;
- financial summaries;
- performance reviews.

Pattern:
report stays softly blurred → moving focus lens sharpens one metric at a time → settles on key KPI.

### 13. Automation Flow
Best for:
- workflow/process explanations;
- incident/action workflows;
- MOC;
- approval flows;
- integrations.

Pattern:
input → animated pulse across process nodes → business output.

### 14. Chaos → System / Brand
Best for:
- brand reveals;
- launch videos;
- "manual → digital" stories;
- system transformation stories.

Pattern:
scattered particles → organized symbol/brand → clean final lockup.

## Recommended use in our projects

### CHEIRON HSE / Incident Investigation
Use selectively for:
- KPI card focus;
- Timeline/Storyboard transitions;
- Incident → Investigation → Recommendation → Action Tracker flow;
- causal-path or workflow pulses;
- module-to-module handoff animation;
- Safety Day demo/video scenes.

Do **not** animate operational tables continuously.

### ANRPC PSM KPI
Use for:
- KPI spotlight in executive review;
- PSM Committee workflow;
- score/trend morphs;
- process-safety architecture layers;
- subtle state transitions.

### BoostMind / Company Website
This is where the kit can be used most aggressively:
- hero motion;
- solution/product reveals;
- service architecture;
- AI/automation demos;
- case-study KPI morphs;
- brand reveal/outro.

### BoostMind OS / Finance
Use for:
- revenue/cost KPI focus;
- budget → actual transitions;
- partner distribution flows;
- transaction/finance explainers;
- module/department transitions.

Keep financial data interaction itself stable and readable.

### E-learning
Use for:
- lesson intro;
- concept reveal;
- progress visual;
- course/product reveal;
- diagram layers.

## Production adaptation rules

The uploaded kit is a motion **reference**, not a mandatory visual identity.

When reusing:
1. replace the A.S brand colors with project design tokens;
2. do not force every animation to 8 seconds—match interaction context;
3. preserve readability at pause/end states;
4. use `prefers-reduced-motion`;
5. avoid layout shifts;
6. avoid blocking navigation or critical actions;
7. lazy-load heavy animation code/assets;
8. keep business/data calculations separate from animation state;
9. ensure animation works on mobile;
10. use motion to explain hierarchy, state, or flow—not just decorate.

## "Fix One Thing" workflow — adopt as a project rule

The kit's repair prompt is a strong engineering pattern:

- identify one exact visual/motion issue;
- change only what is necessary;
- preserve timing, hierarchy, concept, and unrelated sections;
- report exactly what changed;
- repeat for the next issue separately.

Use this method for:
- animation tuning;
- UI polish;
- spacing bugs;
- typography overflow;
- loop glitches;
- card positioning;
- hover/focus behavior;
- visual regressions.

This is especially valuable when working with AI coding agents because it reduces accidental redesigns and side effects.

## Missing source

The starter instructions refer to a fifth file:

`04_AS_Brand_Motion_Style.pdf`

This file was **not included** in the currently stored set. The existing `effect.html` still provides enough of the core dark/purple visual variables to study and adapt the motion system.


# 7. Emerging Workflow Trend: AI-Ready Component Ecosystems

This trend is now important enough to track explicitly.

Across our preferred sources we increasingly see:
- Markdown/`llms.txt` documentation
- agent skills for Codex/other coding agents
- registry/MCP-friendly component installation
- direct AI-builder integrations
- version-specific coding guidance

Examples:
- DashboardCN provides agent-oriented docs/skill support.
- AG Grid provides version-aware AI coding guidance.
- TradingView Lightweight Charts ships Agent Skills.
- Untitled UI now integrates directly with Lovable.
- shadcn's registry model remains highly compatible with code-generation workflows.

### Project rule

Treat AI integration as a **developer-experience accelerator**, not as a reason to lower engineering standards.

AI-generated UI must still satisfy:
- project architecture
- security
- business logic
- licensing
- accessibility
- RTL
- responsive behavior
- performance
- source control
- tests/regression checks

Prefer official, version-matched agent guidance when a library provides it.

---

# 8. Recommended Patterns by Project Type

## Executive / KPI / HSE / Operations
`existing design system → DashboardCN → Tremor → shadcn → TanStack`

Use AG Grid only when grid power-user features justify it.

## Finance / Budget / Revenue / Cost
`Tremor + Untitled UI + DashboardCN + shadcn + appropriate table engine`

Use:
- TanStack for custom inspect/analyze tables
- AG Grid for heavy enterprise analysis
- Handsontable for editable spreadsheet models
- Lightweight Charts for true market/asset time series

## Monthly/Bulk Data Entry
- simple forms/table for small inputs
- TanStack for custom validated tabular workflows
- Handsontable when spreadsheet behavior is genuinely required

## High-impact visual/marketing screens
ThreeUI inspiration + lightweight project-specific implementation.

---

# 9. Enterprise Table Standard

Regardless of library:
- readable font sizes;
- consistent numeric alignment;
- explicit units/currency;
- sensible column widths;
- sticky/frozen headers where useful;
- keyboard accessibility;
- obvious filter state and reset;
- clear editable vs read-only states;
- safe destructive actions;
- bulk-action selected count;
- stable loading states;
- drilldown totals must reconcile with source records;
- dashboard filters must carry through to drilldown where expected;
- critical status must not rely on color alone.

---

# 10. Finance UX Standard

Always distinguish:
- raw value
- calculation
- display formatting

Always label comparison basis:
- vs previous month
- vs budget
- vs target
- vs prior year
- YTD
- rolling period
- fiscal-year total

Financial tables should support, when relevant:
- subtotal/grand total
- sticky summary/footer
- export
- variance amount
- variance %
- drilldown
- period filters
- explicit currency/scale

Avoid decorative 3D charts and overloaded multi-axis visuals.

---

# 11. Performance / Accessibility / RTL

Before adoption:
- check whether existing stack already solves the problem;
- estimate dependency/bundle cost;
- lazy-load heavy visuals;
- virtualize genuinely large datasets;
- use server-side filtering/sorting where needed;
- test production-sized data;
- test mobile;
- verify keyboard/focus behavior;
- verify contrast and semantic labels;
- support reduced motion;
- test Arabic/English RTL intentionally.

Do not blindly mirror charts in RTL. Verify arrows, pagination, pinned columns, sidebars, menus, and directional icons deliberately.

---

# 12. Licensing Checklist

Before copying code/assets:
- [ ] Free/MIT/open-source/commercial?
- [ ] Commercial production allowed?
- [ ] Is the needed feature Community or Enterprise/Pro?
- [ ] Attribution required?
- [ ] Source copying allowed?
- [ ] Modification allowed?
- [ ] Redistribution restrictions?
- [ ] Seat/client license required?
- [ ] Deployment model compatible?
- [ ] License decision documented?

Notable guardrails:
- DashboardCN: MIT.
- AG Grid Community: MIT; Enterprise features commercial.
- Handsontable: commercial license for commercial production.
- Untitled UI: Free and PRO assets coexist.
- Lightweight Charts: Apache 2.0 with TradingView attribution requirements.
- ThreeUI: verify exact component/asset license.

---

# 13. New Source Evaluation Scorecard

Score 0–5:

| Criterion | Score |
|---|---:|
| Visual quality | /5 |
| Enterprise suitability | /5 |
| Accessibility | /5 |
| Performance | /5 |
| Customization | /5 |
| React compatibility | /5 |
| Tailwind/shadcn compatibility | /5 |
| Table/data capability | /5 |
| Finance suitability | /5 |
| RTL readiness | /5 |
| Documentation | /5 |
| Maintenance/activity | /5 |
| Licensing clarity | /5 |

Guidance:
- **55+** Preferred candidate
- **45–54** Approved secondary
- **35–44** Selective
- **<35** Inspiration only / avoid dependency

Do not promote a new source merely because it is trending.

---

# 14. Continuous Update Procedure

During each review:
1. check official changelogs/releases;
2. check major/minor versions and breaking changes;
3. check accessibility/RTL/performance improvements;
4. check licensing/pricing changes;
5. check new components/blocks/templates;
6. check AI/agent tooling only where it materially improves implementation;
7. search for credible new enterprise/dashboard/grid/finance/WebGL sources;
8. compare any new candidate against the existing stack;
9. add only sources that fill a real capability gap;
10. update review date and changelog.

---

# 15. Watchlist

1. ThreeUI
2. DashboardCN
3. Tremor
4. Untitled UI
5. shadcn/ui
6. TanStack Table
7. AG Grid
8. Handsontable
9. MUI X Data Grid
10. TradingView Lightweight Charts
11. A.S Claude Motion Kit / local motion pattern library
12. Bencho — interactive blocks / micro-interactions / UI sounds
13. Code and Chill / Coterie — people-ops dashboard motion and enterprise interaction references
14. Microsoft TRELLIS and TRELLIS.2 — image-to-3D, PBR GLB output, licensing/GPU updates
15. The Kitchen by dqnamo — tactile interface studies and confirm/upload interactions
16. Component Kitchen / Elix — accessible standards-based Web Components
17. Remotion, its templates, Claude Code plugin, and agent skills
18. HyperFrames / HTML-to-video, Studio, render quality and security changes
19. OpenMontage official only — agent pipeline, Backlot, budgets, AGPLv3, safety fixes
20. Video Shotcraft — curated cinematic shots, Workbench and post-agent editing
21. Motion Skills, Animation Principles and Manim Skill
22. Lemo Opuscar and illustrated animation toolkits
23. All source catalogs and production case studies in Section 19

Also watch selectively:
- credible shadcn registries
- enterprise data-grid entrants
- fintech UI systems
- accessible charting libraries
- Three.js/WebGL UI sources
- AI-native design-system workflows

---

# 16. Review Snapshot — 2026-10-01

Meaningful new findings since 2026-09-30:

1. **Bencho added as a preferred secondary micro-interaction reference.** Use it for live tactile behaviors, confirmations, drag/press/hover/select patterns, interaction moodboarding, and optional UI-sound references—not as a full design system.

2. **Bencho licensing recorded.** The blocks/code are MIT licensed for commercial use, while the surrounding site/brand and some example assets are not part of that grant.

3. **Bencho Bench + Finds added to the workflow.** Bench can be used for interaction composition; Finds can be used as a curated interaction-research feed.

No changes were made to the preferred table/grid hierarchy.

Previously verified ecosystem findings remain valid:

1. **A.S Claude Motion Kit added as an internal motion-design reference.** The uploaded kit contributes reusable HTML/CSS/JS motion patterns for product demos, dashboard KPI focus, data morphs, workflow animations, system-layer reveals, and brand transitions.

2. **"Fix One Thing" adopted as a motion/UI iteration principle.** Small visual defects should be corrected surgically without redesigning unrelated sections.

3. **Project-specific reuse guidance added** for CHEIRON, ANRPC PSM, BoostMind/Finance, and e-learning.

No change was made to the preferred table/grid selection order.

Previously verified ecosystem findings remain valid:

1. **Untitled UI — Lovable integration (2026-09-23).** Official React examples can now flow into a Lovable starter based on TanStack Start/Vite, with two-way GitHub sync. This is recorded as a prototyping/developer-experience option, not a change to production governance.

2. **TradingView Lightweight Charts — official plugin ecosystem.** The 2026-09-16 plugin-package release is now explicitly incorporated into our selection guidance. Prefer official plugins when they cover the requirement, especially the new accessibility plugin.

3. **AI-ready component ecosystems are now a tracked design/development trend.** Multiple preferred libraries now publish agent skills, Markdown/LLM documentation, registry tooling, or AI-builder integrations. We will use these as accelerators while preserving architecture and review controls.

No new source was promoted into the core preferred stack this week. The existing curated stack still covers our identified needs without adding redundant dependencies.

Verified current positions:
- AG Grid: 36.2.0
- Handsontable: 18.1.1
- TanStack Table: v9
- TradingView Lightweight Charts: 5.2.1
- MUI X Data Grid: v9 family
- shadcn: September `cn` migration remains the current meaningful September update

---

# 16A. Code-Generated Video / Motion Production Watch — 2026-10-06

## HyperFrames — promote to active production candidate

**Official:** https://github.com/heygen-com/hyperframes  
**Historical 2026-10-06 reviewed release:** **v0.8.135 (2026-10-05)**; see Section 16C for v0.8.151.

HyperFrames is moving beyond a renderer into a practical editable production environment. Recent 0.8.12x–0.8.135 releases materially improve the Studio workflow:

- animation easing survives Studio edits;
- Undo reliably restores recent edits, including resize/nudge flows;
- Layers can be embedded in host-app layouts and reordered with undo support;
- long timeline clips virtualize picture tiles for smoother scrolling/zooming;
- keyframe/motion-path editing is safer;
- host apps can hold playback and participate in Studio history;
- sub-compositions follow host clips correctly;
- render now fails when a composition script throws before timeline binding instead of silently continuing;
- Three.js skill guidance now includes shared cut constants and fill-light guidance.

### Adoption impact

For **UI/product/dashboard videos**, HyperFrames should now be considered a first-class alternative to Remotion, not merely an HTML-to-video experiment. It is especially attractive when the source material is already HTML/CSS/GSAP/Three.js and when post-generation visual editing in Studio matters.

Our preferred rule remains:
- **Remotion** → React/data-driven motion, charts, captions, deterministic product/explainer compositions.
- **HyperFrames** → HTML/UI/web motion, GSAP/Three.js compositions, and workflows where a visual Studio/editing pass is valuable.

## Video Shotcraft — library expanded + browser workbench

**Official:** https://github.com/Vincentwei1021/video-shotcraft

At the 2026-10-06 review the repository reported **157 shot recipe cards and 214 motion previews/styles**, up from the previously recorded 152/209. It also documents a browser-based **Motion Workbench** that exposes shot, transition, caption, and SFX tracks, supports schema-driven text/style editing, clip trim/reorder/speed-ramp, and exports back through Remotion with preview/render parity.

### Adoption impact

Use Shotcraft as our **shot-language/directing layer** above Remotion rather than copying generic motion prompts. The Workbench makes it more useful after agent delivery because humans can continue editing without rewriting the whole film.

## Motion Skills — pack ecosystem expanded

**Official:** https://github.com/iart-ai/motion-skills

The project still centers on **50 open-source motion skills**, but the current documentation exposes **17 installable packs** and a clearer deliver-and-verify workflow: render/freeze frames, generate contact sheets, probe MP4s, and let the agent inspect its own output. It explicitly supports Codex and many other agents.

A related focused package, `iart-ai/motion-design-skills`, now provides higher-level craft guidance for animation principles, color motion, shot composition, and motion art direction.

### Adoption impact

Prefer installing only the pack relevant to the job. Do not install the whole ecosystem by default. The **deliver-and-verify** pattern should be reused even when we do not install these skills.

## Awesome Claude Video Skills — discovery index changed

**Official:** https://github.com/zhuyansen/awesome-claude-video-skills

At the 2026-10-06 snapshot the generated index reported **180 repositories** across frameworks/toolkits, promos/demos, explainers, editing, shorts/social, avatars, stories/animation, motion graphics, scripts/learning, and music video. The index is security-graded, but its own methodology is automated and remains a discovery filter rather than a security approval.

### Security rule

Every third-party skill must still receive our own review of:
- install scripts;
- shell commands;
- package dependencies;
- network/API behavior;
- permissions;
- license;
- asset provenance.

## OpenMontage — security and provenance guardrail strengthened

**Official repository only:** https://github.com/calesthio/OpenMontage

OpenMontage remains a major orchestration reference: 12 production pipelines, 100+ tools, 700+ agent-skill/production-knowledge files, Codex support, AGPLv3, and Remotion/provider-oriented production flows.

### Critical provenance warning

There are documented malicious/lookalike repositories using the OpenMontage name and distributing suspicious Windows binaries. **Never install OpenMontage from search-result clones, lookalike organizations, or arbitrary release binaries.** Pin the canonical repository owner `calesthio/OpenMontage`, inspect the commit/source, and prefer source-based setup.

The canonical GitHub repository currently shows **no official GitHub Releases**, which is another reason not to trust third-party “OpenMontage installer” releases.

### Current development signal

The project remains active; current pull requests include fixes around Remotion scene staging/caption spacing, concurrent video-stitch temp-file isolation, and SRT whitespace handling. Treat these as active development signals, not released guarantees.

### Existing license guardrail remains

OpenMontage is **AGPLv3**. Internal/local production use can be evaluated separately, but embedding/modifying it in a proprietary network service requires explicit license review.

## Lightweight Charts / core UI stack

As of the 2026-10-06 review, no new library release changed our selection rule. TradingView Lightweight Charts remained **v5.2.1** with the official plugin packages already recorded. MUI X remains on the v9 line. Existing AG Grid, Handsontable, TanStack, shadcn, Untitled UI, DashboardCN, Bencho, Coterie, ThreeUI, and A.S Motion guidance remains unchanged for this review.

# 16B. 3D Asset-Generation Review — 2026-10-09

TRELLIS.2 is the preferred candidate when the job is **creating a new 3D object from an image**. It supplies GLB/PBR assets to Three.js, Blender or the video production pipeline; it does not replace ThreeUI for rendering, Bencho for interactions, or OpenMontage/Remotion/HyperFrames for video orchestration/composition. Deployment is GPU-bound and commercial licensing must include auxiliary dependencies and artwork rights. See Section 3.8.

# 16C. Weekly UI / Motion / 3D Review — 2026-10-13

**Verification window:** 2026-10-09 through 2026-10-13. Official GitHub release metadata, READMEs, merged commits and open PRs were checked. Release dates are UTC; project-local publication times may differ. These are **reference updates**, not changes automatically installed into any of our projects.

## 1. HyperFrames — v0.8.151 (2026-10-13): inspector, frame fidelity and audio/render correctness

**Release:** https://github.com/heygen-com/hyperframes/releases/tag/v0.8.151  
**Previous notable release:** https://github.com/heygen-com/hyperframes/releases/tag/v0.8.150

- The **Inspector** now has a component/element map, live preview inspection, timeline queries and a Node runtime; CLI can snapshot a time range or composition. This directly supports our approved-keyframe → sampled-frame-review → fix workflow.
- Standard/high-quality output no longer adds JPEG-capture colour noise to graded footage. ProRes `.mov` output is encoded/tagged BT.709; transcript cuts and seek boundaries are more frame-accurate.
- 0.8.150 stops cached injected-video frames accumulating in render memory, improves scene in/out and audio export parity, and processes large audio mixes in windows.
- **Compatibility warning (0.8.150):** a top-level composition root's `data-fx-chain` now processes the **entire audio mix**; an old, previously ignored root attribute can change audio unexpectedly. `injectVideoFramesBatch` uses temporary image URLs that expire after decoding; never persist those temporary URLs as durable asset references.
- **Action:** keep HyperFrames as a first-class HTML/GSAP/Three.js motion option; validate audio mix, colour/BT.709 and seek parity on representative scenes before version bump.

## 2. Remotion — v4.0.535 (2026-10-12) and v4.0.534 (2026-10-07)

**Releases:** https://github.com/remotion-dev/remotion/releases/tag/v4.0.535 and https://github.com/remotion-dev/remotion/releases/tag/v4.0.534

- Studio now supports more precise drag/reorder and trim flows, `.cube` LUT drop onto video, clearer caption layers, better timeline performance and optional premount settings (default **2 seconds**).
- New `renderFramesOnLambda()` for image sequences; Python Lambda client gains `AsyncRemotionClient`. This can simplify scalable contact-sheet or frame-based QA workflows, subject to AWS cost/permissions.
- 4.0.534 upgrades Chromium to 157, shares memory between Chrome and FFmpeg and enables parallel encoding more often; nested HTML-in-canvas is supported during server-side rendering.
- Important fixes cover decoder thread caps to prevent hangs, stale HTML-in-canvas frames, media audio seek/crackle, reverse playback and final-frame playback.
- **Action:** retain Remotion as default for React/data-driven motion. Pin the version and regression-test representative scenes, audio, captions and Studio interaction before adopting the release. License/hosting terms still need independent review.

## 3. Video Shotcraft — quality curation, not an expansion

**Official:** https://github.com/Vincentwei1021/video-shotcraft  
**Merged overhaul:** https://github.com/Vincentwei1021/video-shotcraft/commit/e1d15d91

- **Correction to the 2026-10-06 snapshot:** the library previously listed 157 cards / 214 previews; the official October README now says **124 recipe cards / 150 curated shots** after reviewing 216 demo shots, keeping 92 redesigns, 50 polished versions and 8 originals, and retiring 66 weaker shots.
- This is a *quality-first reduction*, not lost functionality. The gallery and browser Motion Workbench remain useful, and the nine template themes and editable post-delivery workflows remain relevant.
- An optional finished-film social publishing route was added via Upload-Post on 2026-10-11. This should be **opt-in only**, never enabled in confidential client workflows without explicit permissions, destination review and asset-rights checks.
- **Action:** refresh our saved shot identifiers/gallery bookmarks; some old examples may be gone. Keep Shotcraft as a directing reference, not an automatically trusted skill.

## 4. OpenMontage — meaningful merged correctness and security fixes (2026-10-12)

**Official:** https://github.com/calesthio/OpenMontage  
**Latest commits:** https://github.com/calesthio/OpenMontage/commits/main/

Merged work includes:
- path-traversal prevention in clip-cache ingest/link/eviction and corpus candidate processing;
- per-job isolation for video-stitch and trimmer temporary workspaces;
- validation before persisting checkpoint decisions and pipeline-identity checks on resume;
- cost-tracker state-transition validation and content-addressed cache for reproducible outputs;
- audio-mixer fix preventing FFmpeg `amix` from unexpectedly scaling tracks by `1/N`;
- preservation of non-ASCII words in transcript/scoring tokenizers;
- optional ElevenLabs word-level timestamps; improved Remotion asset staging and local webfonts for offline rendering;
- a **BMTS-Lite fast beat-montage route** and provider-reference fixes.

**Still open / not guaranteed fixed:** CJK caption layout and line breaks, portrait output ratio, and several provider integrations are represented by open PRs as of the review. Do not treat open PR titles as released features. Continue independent checks of subtitle text, audio loudness, numeric chart labels and scene timing.

**License/security:** official repo is **AGPL-3.0**; no GitHub Releases were published at review time. Pin a reviewed commit, inspect setup/scripts/dependencies, do not trust lookalike repos or installers, and review AGPL obligations before networked/proprietary integration. These fixes improve the local-pipeline candidate but do **not** justify automatic production deployment.

## 5. Lemo Opuscar — 43 reusable core styles **plus** OPUSCAR 98 showcase

**Official:** https://github.com/lemomo-ai/lemo-opuscar  
**OPUSCAR 98 gallery:** https://lemomo-ai.github.io/lemo-opuscar/opuscar98/#styles

- The repo still has **43 core film styles** with individual reusable `STYLE.md` files. Separately, the **OPUSCAR 98** feature film now exposes **98 film-specific style prompts/shot notes** (77 in 2D, 4 in 2.5D, 17 in 3D) in the gallery/JSON.
- **Do not relabel the core library as 98 styles.** Treat the additional 98 as a research/style-ideation collection, with prompts tuned for Claude Opus 5.5 and no guarantee of identical results on other agents.
- On 2026-10-10 the repo switched to plain MIT license text for GitHub detection. Rights to third-party sample assets remain separate. Use the `DIRECTOR.md` + `TECHNIQUE.md` + storyboard gate concept as the reusable method.

## 6. TanStack, Handsontable, MUI X, shadcn — implementation-level changes

- **TanStack Table 9.3.1 (Oct 12):** React cached-table stale context fix, smaller opt-in feature bundles, and `.d.ts` private type fix. See Section 4.1.
- **Handsontable 18.1.2 (Oct 7):** changes entitlement-key validation and repairs wrapped keys; test real production keys before upgrading. See Section 4.3.
- **MUI X 9.15.0 (Oct 6):** CSP-compatible exports, keyboard chart navigation and grid sizing/polling fixes. See Section 4.4.
- **shadcn CLI 4.21.4 (Oct 7):** registry/transformers no longer depend on `ts-morph`, including RTL transformation. See Section 3.5.
- **AG Grid 36.2.0** and **TradingView Lightweight Charts 5.2.1** remain the latest verified official releases. No change to our preferred table/grid/chart selection order.

## 7. Video discovery and research — new evidence, not automatic dependency approvals

**Index:** https://github.com/zhuyansen/awesome-claude-video-skills  
**Research collection:** https://github.com/athemeroy/awesome-claude-5-5-videos

- Awesome Claude Video Skills now indexes **283 repos** and published an Oct 11 controlled end-to-end comparison: **16 skills** and a no-skill baseline produced a 15-second 1080p/30fps film with fixed copy. All passed four basic delivery checks, but completion time varied from **2.0 to 23.5 minutes**, and visual originality was judged subjectively. **Do not generalize this one brief into a universal ranking.** It reinforces the need to select skills for style, workflow and evidence—not star count.
- The separately maintained Claude 5.5 video research repo now identifies **424 distinct source posts** as of Oct 11, with 199 receiving nine-frame preview sampling. It explicitly separates source-post counts from older file-count studies and warns that previews cannot prove full motion or underlying model calls.
- **Action:** use these for discovery, comparison and storyboard inspiration; retain our independent code/install/license/security review.

## 8. TRELLIS / TRELLIS.2 and remaining UI watchlist

- **TRELLIS v1 and TRELLIS.2:** no newer mainline commit or official GitHub release was found in this window. TRELLIS.2 still requires the documented Linux/NVIDIA GPU stack and at least 24GB VRAM, with GLB/PBR output; the model-code MIT grant does not override auxiliary dependency and source-image rights. Open reports around BF16 on older GPUs reinforce the need to test exact hardware rather than assume all 24GB cards work.
- **ThreeUI, DashboardCN, Tremor, Untitled UI, Bencho, Code and Chill/Coterie, A.S Motion Kit, Animation Principles, Manim Skill, ClaudeAnimationBase and the other tracked animation repositories:** no newly verified release in this window changes our adoption hierarchy. Some repositories are active, but no unverified feature claim was promoted.

### Production priorities from this review

1. **For video quality:** compare HyperFrames 0.8.151 against Remotion 4.0.535 using the same approved storyboard, keyframes, captions and audio; inspect actual output frames, colour and final MP4 timing.
2. **For enterprise data:** update TanStack or MUI only after existing app regression tests; stage Handsontable key-validation changes before rollout.
3. **For safety/governance:** pin OpenMontage to an audited commit; validate paths, subtitle Unicode, audio loudness, cost states, license obligations and numeric truth against the source dataset.
4. **For motion direction:** refresh Shotcraft's curated gallery and keep Opuscar's 43-core/98-showcase distinction in research notes.

---

# 17. Changelog

## 2026-10-20 — Official-source release, correctness, RTL and governance watch

- **Remotion v4.0.537 (2026-10-19):** new effects (`cylinder`, `sphere`, `pageTurn`, `fractalNoise`, `turbulentDisplace`, `lensBlur`, `bevelAlpha`), `parseVtt()`, fixes for `HtmlInCanvas` flashing/nesting, render server now binds to localhost by default, Lambda directory-symlink rejection, and **Arabic/RTL guidance in official Agent Skills**. Verify license/pricing on official terms; release-note branding edits alone do not establish a price change.
- **HyperFrames v0.8.181 (2026-10-20):** long phone-video export timeout/stall fix and faster audio true-peak plan check; 0.8.180 fixed intermittent distributed-worker empty frames and added chunk subranges; 0.8.179 added Lambda deploy directly from npm and reduced per-chunk audio downloads; 0.8.177 fixed non-English transcription. Regression-test render reproducibility, HDR, audio and multilingual captions.
- **shadcn CLI v4.22.1 (2026-10-18):** `add --all`/component picker respects the project's selected style. **v4.22.0 (2026-10-16) introduced Zod 4 schemas** in `shadcn/schema` and `@shadcn/registry/schema`: compatibility break for consumers using Zod 3's `z.infer`/`z.array`; `ZodError.issues` replaces `errors`. Do not upgrade custom registry tooling without a compile/test pass.
- **OpenMontage:** official repo still has no GitHub Releases; no new main-branch commits were returned by the official API for the Oct 18–20 query. Open PRs highlight unmerged correctness/governance risks: Arabic/RTL captions (#820), checkpoint approval enforcement (#769), approval profiles (#395), caption burn (#556), and clip trimming/timestamps (#554). **Do not treat PR fixes as shipped.** Maintain AGPL review, pinned SHA, human approvals, tests and untrusted-skills isolation.
- **TRELLIS/TRELLIS.2 and other references:** no verified new model-quality benchmark, license change, or official release superseding the existing GPU/GLB/PBR/dependency warnings. TanStack Table 9.3.1, Handsontable 18.1.2, MUI X 9.15.0, AG Grid 36.2.0 and Lightweight Charts 5.2.1 remain the verified mainline versions at this check. Do not infer that unverified repos are unchanged.
- Added **Section 28** with official links, decisions, test gates, risk states and an explicit separation of released features from open proposals. No application code, dependency or runtime was upgraded automatically.

## 2026-10-18 — Premium Mega Menu visual reference (basic versus premium)

- Added Section 27 based on the new user screenshot `IMG_2442.png` (attributed to **Design & Code With AV / Giulio Cercato — Level Up** as shown in the social video).
- Compared a simple 3-column link-only dropdown with a richer menu combining a product/collection promo, category columns with icons, contextual `View All` links, and a right-side short-list of highlights/offers.
- Added desktop and mobile navigation rules, keyboard/focus management, hover bridging, touch interaction, semantic menu behavior, dynamic/authorized content, and RTL considerations.
- Clarified that promotional dates, item names and badges in the screenshot are reference content, not a current catalog. No copying of unverified screenshot code/assets.
- Added the reference image to the consolidated visual-reference ZIP; all previous images and master sections are preserved.


## 2026-10-18 — Premium Kanban UI Upgrade screenshot (basic versus premium)

- Added Section 26 based on newly supplied `IMG_2439.png`; visually attributed to **Design & Code With AV** as shown in the reel screenshot.
- Documented the **Basic** board (To Do / In Progress / Done) versus **Premium** board (To Do / In Progress / Review / Done): soft color-differentiated lane headers/backgrounds, clear task-card hierarchy, progress bars, assignee avatars, due dates, priority pills, secondary metadata, counts and contextual actions.
- Added a configurable Kanban pattern distinct from the existing **Vibe Board AI/testing automation reference** (Section 25); explicitly separated business-stage changes from side-effecting workflow or AI job execution.
- Added production rules for drag-and-drop, keyboard alternative, authorization, audit trail, server-truth persistence, optimistic rollback, mobile list view, RTL, accessibility and reduced motion.
- Created a dedicated image location in the visual-reference archive and deduplicated the previously supplied `IMG_2438(1).png` because it is byte-identical to the existing Vibe Board screenshot.
- Preserved all existing reference sources, selection policies, versions and previous changelog entries.


## 2026-10-18 — Vibe Board AI-assisted testing/fixing workflow screenshot

- Added Section 25 from user screenshot `IMG_2438.png` as a **visual/interaction reference**, not verified software documentation.
- Captured four Kanban stages (To Do, In Progress, Testing, Fixing), the displayed instruction that moving a card into Testing triggers a test and moving it into Fixing triggers a fix, plus issue badges, test progress, command bar and assistant controls.
- Separated **observed UI** from **proposed architecture**; do not imply confirmed autonomous testing, code editing or production deployment from a still screenshot.
- Specified permissions, explicit approval and sandbox branch controls for agent actions; audit trail, reproducible QA evidence, idempotent transitions, tests, CI and human verification required.
- Added Arabic/RTL, mobile, accessibility, motion and status-visibility guardrails; linked to CHEIRON, MOC/RFC, AASURIX and software development use cases.
- Added thirteenth screenshot to the visual-reference archive; all preceding references retained.


## 2026-10-18 — Notification stack and wireframe 3D login screenshot references

- Added two additional user-supplied still screenshots: Design & Code With AV basic/premium notification stack and Coding Withme Aurora-style dark 3D login.
- Documented notification stacking, count/overflow, accessible inbox fallback, per-item navigation/dismiss, critical versus ordinary alert priority, persistent state and audit rules.
- Documented wireframe/glass login composition, optional CSS/SVG/Canvas/WebGL background strategy, reduced-motion and mobile-performance guardrails, auth/security accessibility and real-provider handling.
- Recorded screenshot-source and license/behavior uncertainty; excluded video-platform UI overlays and unverified source snippets from implementation assumptions.
- Expanded copy-ready coding-agent guidance; bundled the original two screenshot files with the earlier ten visual references.

## 2026-10-18 — Task/dashboard, signup and tree-navigation screenshot references

- Analyzed five additional user-provided screenshots: Code & Chill task list, Kanban and settings; InfiWeb Craft signup; Design & Code With AV premium tree navigation.
- Added screenshot manifest, visibility/provenance limitations, enterprise task/list/board interaction rules, persistent settings, accessible authentication, tree semantics, responsive mobile treatment and project-specific reuse mapping.
- Kept Code & Chill project-management screenshots **separate** from the previously referenced Coterie product; identity/code licensing cannot be proven from static captures.
- Avoided treating social UI overlays, mock project names, example counts, demo code fragments and frozen video frames as working product functionality.
- Added copy-ready agent instructions and accompanying optional visual-reference asset package. No dependency or business-logic change is authorized by this update.


## 2026-10-18 — User-supplied color palettes and landing-page inspiration

- Added 9 verified two-color pairings extracted from screenshots supplied by the user; excluded the obscured Blueberry/Cream Soda pairing rather than guessing the missing HEX value.
- Computed WCAG relative-luminance contrast for foreground/background pairings; recorded that Neon Orange + Porcelain is **not sufficient for normal text** as shown and requires an accessible dark foreground or another treatment.
- Added two composition references: Duck Farm / agricultural product landing-page mockup, and Seafood Restaurant / menu-and-booking landing-page mockup. These are **source-image design inspiration**, not downloadable source templates or proof of the underlying implementation.
- Added project-fit guidance, reusable section patterns, mobile/responsive and image-performance rules, and a minimal CSS token example.
- No change to the established UI/data-grid/video/3D dependency selection hierarchy, licenses, or historical release snapshots.

## 2026-10-18 — Complete consolidated master guide

- Consolidated all previously supplied UI, table, finance, motion, video, and AI 3D references in one reusable file without removing historical review notes.
- Added **The Kitchen (dqnamo)** and **Component Kitchen / Elix**, explicitly distinguishing the unrelated projects and preserving licensing/production cautions.
- Added detailed code-video source registry covering all supplied index, design, animation, Remotion, HyperFrames, Shotcraft, Manim, Opuscar, prompt-study and complete-production resources; added source category and selection rules.
- Added copy-ready prompts for agents, an approved-keyframe production contract, rendering QA gates, licensing/security standards, and project-specific tool routing.
- Verified **HyperFrames v0.8.168** (2026-10-17): timeline scrubbing/scene visibility, distributed render and preview improvements.
- Verified **Remotion v4.0.536** (2026-10-16): updated Studio timeline, rolling edits, interactive custom components, and off-screen playback optimization.
- Verified **Lemo Opuscar now describes 51 code-generated film styles**; separate OPUSCAR 98 gallery remains a different reference set. Previous 43-style review is a historical snapshot, not the current count.
- No automatic dependency upgrades or license approvals are implied by this document revision.


## 2026-10-13 — Weekly UI, video and 3D watch

- **HyperFrames 0.8.151:** new live inspector/timeline queries and CLI snapshots, colour/ProRes fidelity fixes, plus 0.8.150 memory/audio export improvements and compatibility caveats.
- **Remotion 4.0.535/534:** Lambda image sequences, Studio timeline/premount/LUT improvements, Chromium 157, shared Chrome/FFmpeg memory and parallel-encoding reliability fixes.
- **Video Shotcraft:** updated from the prior 157/214 snapshot to **124 curated cards / 150 shots** after a deliberate quality overhaul; optional social publishing is permission-gated.
- **OpenMontage:** merged path-traversal/temp-file/checkpoint/cost/audio/Unicode fixes, word-level TTS timing and content-addressed cache; preserved AGPL/security guardrails and flagged still-open CJK/portrait/provider PRs.
- **Lemo Opuscar:** clarified **43 core reusable styles + 98 additional film-specific style/shot references**; MIT text clarified, third-party assets still require rights checks.
- **TanStack 9.3.1, Handsontable 18.1.2, MUI X 9.15.0, shadcn CLI 4.21.4:** documented patch-level UX/typing/performance/RTL/CSP and license-key changes.
- **Research:** video-skill index 283 repos; controlled 16-skill benchmark; separate Claude 5.5 collection 424 source posts / 199 sampled. Treat as evidence with methodological limits, not automatic security approval.
- **TRELLIS and other UI references:** no verified update requiring a new default choice. Existing table/grid, WebGL and 3D asset selection hierarchy preserved.


## 2026-10-09 — Microsoft TRELLIS / TRELLIS.2 asset-generation review

- Added both **official Microsoft TRELLIS repositories** and distinguished original TRELLIS (image/text → Gaussians/radiance fields/meshes) from TRELLIS.2 (single-image → high-quality PBR mesh/GLB with O-Voxel).
- Added approved **Reference image → GPU inference → GLB QA/optimization → Three.js/Blender → video or website** workflow.
- Added deployment requirements (original ≥16GB VRAM; TRELLIS.2 ≥24GB VRAM on Linux) and warned that reported 3/17/60-second runtimes are NVIDIA H100 benchmarks only.
- Added production use cases for corporate/product sites, CHEIRON/ANRPC illustrative safety content, e-learning and marketing videos; **explicitly rejected use of generated assets as engineering-accurate, forensic or as-built data** without independent validation.
- Recorded MIT code/model license and separate NVIDIA dependency licensing; added research-only disclaimer caution for project-page samples, source-image rights, and unreviewed public demo/installer risks.
- Preserved existing dashboard, finance table, micro-interaction and video production selection rules unchanged.


## 2026-10-06 — Weekly UI + code-video watch

Meaningful updates:
- HyperFrames advanced to **v0.8.135 (2026-10-05)** with materially stronger Studio editing, undo/history, layer embedding, long-timeline performance, keyframe safety, and render failure handling. Promoted to a first-class production candidate for HTML/UI/web-motion videos.
- Video Shotcraft now reports **157 shot recipes / 214 motion previews** and documents a browser Motion Workbench for editable post-agent delivery.
- Motion Skills now exposes **17 installable packs** around its 50-skill corpus; recorded its deliver-and-verify/contact-sheet workflow and the related motion-design-skills package.
- Awesome Claude Video Skills currently indexes **180 repos**; retained as discovery only, never as a security trust signal.
- Strengthened the **OpenMontage provenance warning**: use only `calesthio/OpenMontage`; malicious/lookalike repos and suspicious installer binaries have been documented. The canonical repo has no official GitHub Releases at review time.
- No core table/grid/chart selection change this week; Lightweight Charts remains v5.2.1 and MUI X remains v9.


## 2026-10-01 — Coterie / Code and Chill added

Added:
- Coterie as a visual/motion reference candidate for people-ops, HR, and enterprise admin dashboards.
- “Motion that behaves” as an enterprise motion principle: state-driven, orientation-preserving, restrained, readable, and reduced-motion-safe.
- Project-use notes for CHEIRON team/action views, executive dashboards, and admin workspaces.
- Verification guardrail: detailed stack, code model, pricing, and license must be checked before production reuse.
- Code and Chill store added to the ongoing UI reference watchlist.

## 2026-10-01 — Bencho integration

Added:
- Bencho as a preferred secondary reference for micro-interactions.
- Project-specific uses for CHEIRON, BoostMind/Finance, forms, and product websites.
- Bencho Bench as an interaction-composition/moodboard tool.
- Bencho Finds as a curated interaction-research source.
- UI sound usage rules.
- Bencho licensing guardrails: blocks/code MIT; site/brand/assets are separate.
- Clarified the role split between ThreeUI, A.S Motion Kit, shadcn, dashboard libraries, and Bencho.


## 2026-09-30 — Motion kit integration

Added:
- A.S Claude Motion Kit as an approved internal motion reference.
- 14 reusable motion patterns mapped to project use cases.
- Production adaptation rules for accessibility, mobile, performance, and reduced motion.
- Project-specific guidance for CHEIRON, ANRPC PSM, BoostMind/Finance, and e-learning.
- Adopted the kit's **Fix One Thing** approach for surgical AI-assisted UI/motion corrections.
- Recorded that `04_AS_Brand_Motion_Style.pdf` is referenced by the kit but has not yet been provided.


## 2026-09-29 — Weekly source watch

Added/updated:
- Untitled UI official Lovable integration (released 2026-09-23).
- Explicit official Lightweight Charts plugin-package guidance, including accessibility and custom-series plugins.
- New cross-source section: **AI-Ready Component Ecosystems**.
- Clarified that AI-builder/agent integrations accelerate implementation but do not replace architecture, security, licensing, accessibility, RTL, testing, or source-control governance.
- Confirmed AG Grid 36.2.0, Handsontable 18.1.1, TanStack Table v9, and Lightweight Charts 5.2.1 remain the current reviewed lines.
- No redundant new UI library promoted this week.

## 2026-09-22 — Weekly source watch

- Added AG Grid 36.2.0 guidance: PDF Export, stronger Advanced Filter support, continuous column auto-sizing, Columns Tool Panel renderer customization.
- Added AG Grid v36 upgrade guardrails.
- Updated Handsontable to 18.1.1.
- Preserved shadcn September `cn` migration guidance.
- Preserved Lightweight Charts 5.2/5.2.1 performance and AI Agent Skill guidance.

## 2026-09-15 — Initial consolidated reference

Initial curated stack:
ThreeUI, DashboardCN, Tremor, Untitled UI, shadcn/ui, TanStack Table, AG Grid, Handsontable, MUI X Data Grid, TradingView Lightweight Charts.

---

# 18. AI / Codex Project Instruction

When this file is present in a project:

> Before implementing or redesigning UI, inspect the existing architecture and this guide. Reuse existing project components where reasonable. Check the listed sources for applicable patterns. Do not add a dependency only for appearance. Preserve business logic and source-of-truth behavior. Verify licensing, accessibility, responsiveness, RTL, performance, and regression risk. Prefer official version-matched AI/agent guidance when available. If a useful new source or pattern is discovered, add it to this guide only after it passes the evaluation rules.

For a redesign, document:
- reference source(s);
- why they fit;
- copied vs adapted vs visual inspiration;
- dependency impact;
- licensing impact;
- performance impact;
- accessibility/RTL impact;
- regression checks.

---

**Maintenance principle:** keep this guide curated. A small set of well-understood, verified references is more valuable than a large bookmark list.


# 19. Code-Generated Video and Motion Sourcebook

**Use case:** produce professional editable motion, product demos, UI showcases, educational explainers, finance/KPI animation, and cinematic code-generated videos using any capable coding agent (Codex, Claude Code, Cursor, etc.). The source engine, not the agent’s brand, determines rendering.

## 19.1 The approved end-to-end production pipeline

**Reference → Storyboard → Approved still/keyframe per scene → Scene/code implementation → Frame/contact-sheet review → Fix one thing → Final render (MP4).**

1. **Reference audit:** user assets, target audience, brand tokens, aspect ratio, duration, factual constraints, examples that show pacing/style only. Confirm rights to use material.
2. **Shot plan:** shot IDs, scene durations, lens/camera framing, entrances/exits, text/VO, transitions, audio/SFX, visual hierarchy, and acceptance criteria. Keep the narrative understandable with motion disabled or paused.
3. **Approve a still for each scene:** verify composition, typography, logo usage, color, factual labels, safe margins, mobile crops and continuity. Use genuine screenshots where interface fidelity matters; do not invent a fake product interface.
4. **Implement motion:** build individual scenes with Remotion (React/data scenes), HyperFrames (HTML/GSAP/Three.js scenes), a specialized animation/Manim engine, or Blender/Three.js for true 3D. The agent interpolates and stages **approved** keyframes instead of replacing them with random alternatives.
5. **Frame review:** extract frames across each shot and at transition boundaries. Inspect contact sheets and individual full-resolution frames; verify no text clipping, black frames, wrong aspect/cropping, duplicated frames, missing assets, off-style segments, wrong data, or camera/character discontinuity.
6. **Audio & captions:** validate narration timing, loudness, clipping, music licenses, subtitles, right-to-left script handling and Unicode. Keep readable captions with mobile-safe margins.
7. **Fix one issue at a time:** preserve approved concepts/shot order and change the smallest possible code surface, then rerender affected frames; escalate major storyboard/provider changes.
8. **Deliver deterministically:** pin source/code versions, preserve source files, export MP4/H.264 (or the agreed codec), note resolution/FPS, and provide a clean playback preview.

### QA gates that no agent should bypass

| Gate | What to inspect | Block delivery if |
|---|---|---|
| Brand | Logo, palette, typography, actual product screens | Branding is incorrect |
| Data truth | Values, units, percentages, dates, budgets and chart labels vs source | Any factual number is wrong |
| Visual | Still frames, boundary frames, safe zones, clipping | Text or subjects are cropped |
| Motion | Easing, continuity, overlap, jump cuts, loop seams | Motion conceals meaning or jumps |
| Audio | Peak levels, narration clarity, sync, usage rights | Audio clips, desyncs or lacks license |
| Accessibility | Legible type, reduced-motion alternative where relevant, flashing avoidance | Unsafe flashing or unreadable content |
| Security | Untrusted skills/scripts/assets, secrets, external destinations | Unreviewed execution or leaked credentials |
| Delivery | Codec, FPS, resolution, file playback, ffprobe | Export invalid, wrong duration or corrupted |

## 19.2 Which engine or resource should we select?

| Job | First choice | Add-on |
|---|---|---|
| React product/feature demo | Remotion | Shotcraft, Motion Skills |
| Finance/KPI/data explainer | Remotion | Source-data verification; Manim for math |
| HTML website → animated showcase | HyperFrames | GSAP, Shotcraft |
| Kinetic typography / CSS / Three.js motion | HyperFrames | Motion Skills |
| Full agent-directed production with footage, music, TTS, approvals | OpenMontage **candidate** | Remotion/HyperFrames/FFmpeg; AGPL review |
| Shot/camera/transition planning | Video Shotcraft | Animation Principles |
| Engineering/math/process explainer | Manim / Remotion | Motion Skills |
| Illustrated character/hand-painted 2D | ClaudeAnimationBase / claude-animation-skill | Animation Principles |
| Full cinematic visual direction | Lemo Opuscar | Shotcraft, custom renderer |
| True editable 3D product model | TRELLIS.2 → GLB → Blender/Three.js | Remotion/HyperFrames for final film |

**Important:** Remotion and HyperFrames are render/composition engines; OpenMontage is an orchestrator; Shotcraft/Opuscar/skill packs are guidance; TRELLIS makes 3D *assets*. These are not interchangeable products.

## 19.3 Production engines — official

### Remotion

- Official: https://www.remotion.dev/
- Claude Code integration: https://www.remotion.dev/docs/ai/claude-code-plugin
- Agent skills: https://github.com/remotion-dev/skills
- Templates: https://www.remotion.dev/templates
- Releases: https://github.com/remotion-dev/remotion/releases
- Use for React components as video scenes, typography, timelines, animations, data visualizations and export.
- **Verified 2026-10-18:** v4.0.536 (released Oct 16) adds Studio timeline and rolling-edit improvements, interactive custom components and playback efficiency fixes. Test before upgrading existing projects.
- License: check Remotion’s current commercial terms for your specific organization/use; do not assume all enterprise deployment and cloud rendering are free.

### HyperFrames — HeyGen

- Source: https://github.com/heygen-com/hyperframes
- Claude Design → HyperFrames guide: https://github.com/heygen-com/hyperframes/blob/main/docs/guides/claude-design-hyperframes.md
- Releases: https://github.com/heygen-com/hyperframes/releases
- Use for HTML/CSS/GSAP/WebGL motion, website-to-video, typography, UI reels, browser-native compositions and exported MP4.
- **Verified 2026-10-18:** v0.8.168 (released Oct 17). Improvements include fixing hidden scenes when scrubbing back, render sizing for cloud workers, 25-fps distributed render support, downscaled 720p/480p output from higher-resolution compositions and better checks for dense scene overlaps. Earlier October fixes strengthened audio, SVG capture, distributed render, sandbox checks, and seeking.
- Do not automatically switch production runtime mid-project or reuse volatile temporary frame URLs as durable assets.

### OpenMontage — agentic video production orchestration

- **Canonical repo only:** https://github.com/calesthio/OpenMontage
- Workflow/agent instructions: https://github.com/calesthio/OpenMontage/blob/main/AGENT_GUIDE.md
- Codex entry: https://github.com/calesthio/OpenMontage/blob/main/CODEX.md
- Architecture: https://github.com/calesthio/OpenMontage/blob/main/docs/ARCHITECTURE.md
- Roles: reference-footage analysis; script/scene/shot plan; provider selection; budget caps; approvals and Backlot living storyboard; generation/stock footage; voice/music/captions; Remotion/HyperFrames/FFmpeg composition and post-render review.
- The **Backlot storyboard/contact-sheet gate** is a strong pattern to reuse even without installing OpenMontage.
- **License: AGPL-3.0**. Consult legal guidance before copying/embedding modified code in proprietary or network-facing products. Generated videos do not automatically have the same license as code, but provider terms/source-asset rights still matter.
- Security: never install from lookalike repositories, arbitrary binaries or unreviewed third-party installer links; inspect dependencies, setup scripts, file access and external-provider permissions. Independently verify numeric chart labels/diagram outputs, subtitle Unicode and audio levels—the project's automated self-review cannot guarantee all content is correct.

## 19.4 Shot language, style systems and specialized techniques

### Video Shotcraft

- Repo: https://github.com/Vincentwei1021/video-shotcraft
- Gallery: https://vincentwei1021.github.io/video-shotcraft/
- Best for shot recipes, camera moves, motion and transitions; storyboard and post-agent editing through Motion Workbench.
- **Verified current README:** **124 curated recipe cards / 150 shots** after its October quality review (even where stale GitHub description still says 152/209). Store previous counts only as dated history.
- Optional social publishing must never be used with confidential content without explicit authorization.

### Motion Skills

- Repo: https://github.com/iart-ai/motion-skills
- Covers kinetic typography, data-viz, explainers, social clips, WebGL and Manim-related skills.
- Treat as a selectively adopted instruction/skill library, not a renderer. Review the relevant files before installing/using them.

### Animation Principles

- Repo: https://github.com/dylantarre/animation-principles
- Twelve classical animation principles, with dedicated agent skills for timing, anticipation, staging, follow-through, squash/stretch and readable motion. Use for quality guidance even when not using the repo runtime.

### Manim Skill

- Repo: https://github.com/adithya-s-k/manim_skill
- Use for geometry, risk matrices, engineering concepts, formulas, technical process diagrams and 3Blue1Brown-style scenes. Validate technical claims independently.

### Lemo Opuscar

- Repo: https://github.com/lemomo-ai/lemo-opuscar
- Style gallery: https://lemomo-ai.github.io/lemo-opuscar/
- **Current project description reviewed 2026-10-18:** **51 code-generated film styles**, plus a distinct **OPUSCAR 98** film/showcase style collection. The 43-style figure in the earlier October snapshot is historical.
- Use as **style-board / directing inspiration**, not a guarantee of identical output from every coding agent. Respect third-party samples and rights.

### ClaudeAnimationBase

- Repo: https://github.com/JohnHeibel/ClaudeAnimationBase
- Code-drawn hand-painted character animation based on p5.js and p5.brush, a 31-expression reference character, `ANIMATION_GUIDE.md`, headless frame/contact-sheet/video render. Suitable for educational character stories and illustrated explainers. MIT on the repository; check rights for reused content.

### Claude Animation Skill

- Repo: https://github.com/buildwithhanif/claude-animation-skill
- Canvas/code-based watercolor/hand-drawn scenes, character rigs, animation references and sound. Use for educational narratives, not for UI dashboard functionality.

## 19.5 Indexes, real prompts and production examples

These are **discovery sources**, not tools that should automatically run in client repositories. Contents and counts change frequently.

| Source | Link | What to study |
|---|---|---|
| Awesome Claude Video Skills | https://github.com/zhuyansen/awesome-claude-video-skills | Categorized libraries and skill selection; verify each linked repo yourself |
| Awesome Opus 5.5 Videos / renamed Claude 5.5 Videos | https://github.com/athemeroy/awesome-claude-5-5-videos | Source-linked video outcomes, prompts, and methodological evidence; previous URL redirects |
| Li-Evan verified prompts | https://github.com/Li-Evan/awesome-opus-5.5-video-prompts | Prompt techniques and director toolkit, not reusable source code by default |
| X-RayLuan prompt collection | https://github.com/X-RayLuan/awesome-opus-5-5-video-prompts | Prompt examples categorized by video type |
| opusvideo gallery/workflows | https://github.com/opusvideo/awesome-claude-video | Examples paired with workflows, to be individually verified |
| PDoomVideo | https://github.com/JohnHeibel/PDoomVideo | Complete animation/film code, storyboard, rendering and sound |
| Functional Emotions | https://github.com/ledbetterljoshua/functional-emotions-video | Example of multi-agent/parallel-chapter animation production |

## 19.6 No-code tooling, tutorials and deeper reading

| Resource | Link | Notes |
|---|---|---|
| Claude Design announcement | https://www.anthropic.com/news/claude-design-anthropic-labs | Official product announcement; check availability and current features |
| Claude Design animation explainer | https://aiblewmymind.substack.com/p/claude-design-animations | Third-party tutorial, not official technical contract |
| Claude Design → HyperFrames | https://github.com/heygen-com/hyperframes/blob/main/docs/guides/claude-design-hyperframes.md | Bridge from design concept to code-rendered video |
| Charlie Hills motion article | https://charliehills.substack.com/p/claude-code-motion-graphics | End-to-end motion experimentation |
| Hugging Face coded-video walkthrough | https://huggingface.co/blog/karmen-beatapi/how-to-make-videos-with-claude-opus-5-5 | Tutorial to compare with the approved frame-review workflow |
| Claude + Remotion guide | https://github.com/ThamJiaHe/claude-code-handbook/blob/main/docs/motion-graphics-claude-remotion-guide.md | Prompt patterns and implementation examples |
| Brand motion system guide | https://www.claudecodeclub.ai/free-resources/claude-design-motion-graphics | Reference for consistent brand-specific motion language |
| Video: code + Remotion | https://www.youtube.com/watch?v=kXmY6yQa5q4 | Demonstration |
| Video: HyperFrames + Claude | https://www.youtube.com/watch?v=eOhomP4vees | Demonstration |

## 19.7 A.S Claude Motion Kit — accompanying local files

The project-specific motion starter is fully documented in [Section 6](#6-motion-design-reference--as-claude-motion-kit). Its source attachments were: `effect.html`, `Claude_Motion.pdf`, `FIX_PROMPT.txt`, and `START_HERE.txt`. **These are separate local files, not embedded byte-for-byte inside this MD.** The kit also references an unprovided `04_AS_Brand_Motion_Style.pdf`. The key reusable principle is **fix exactly one issue and preserve approved hierarchy, timing and unrelated sections**.

## 19.8 Security and licensing for skills and video source assets

- A repository called "awesome" or carrying thousands of stars is **not automatically secure or legally reusable**.
- Read installation scripts and skill instructions before running them. Never give arbitrary third-party code GitHub tokens, `.env`, cloud admin access, API keys or client footage.
- Pin known commit/tag or vetted package versions, and use isolated workspaces for new toolchains.
- Confirm code license, model/checkpoint license, music/stock rights, image permission, trademark/logo rights, and provider commercial terms **separately**.
- Keep user-approved **cost caps** for paid image/video/voice APIs and never silently swap providers or rendering engine.
- For financial/HSE/engineering videos, calculate KPI values from authoritative source data; visually compare each rendered text label to the source dataset.
- Avoid claiming an image-to-3D model is engineering-accurate CAD; verify geometry, topology, dimensions and material rights before use.
- Client material should not be submitted to a public Hugging Face demo or an unrelated SaaS without permission.

# 20. Copy-Ready Agent Instructions

Copy this file into the root of an existing React project or video-production workspace and use the relevant prompt below. The guide informs decisions; it does **not** authorize sweeping refactors.

## 20.1 UI / dashboard / table agent instruction

```text
Read UI_COMPONENT_REFERENCE_GUIDE.md before editing. The EXISTING project is the source of truth.
Audit its actual framework, CSS/design tokens, reusable components, API contracts, business logic, and data model.
Choose no more than 2-3 relevant references from the guide; explain briefly why they fit.
Prefer current project primitives (for React/Tailwind: usually shadcn + TanStack where already appropriate).
Never add a dependency solely because a demo looks beautiful.
Preserve all existing behaviors, permissions, data calculations, field semantics, and workflows.
Use purposeful motion only when it clarifies state. Follow accessibility, keyboard navigation, reduced motion, RTL and mobile checks.
If fixing a bug, change ONE THING ONLY and do not redesign unrelated parts.
Deliver complete changed files, build/test evidence and a concise change log.
Before copying third-party code, check its exact license.
```

## 20.2 Code-generated video agent instruction

```text
Read UI_COMPONENT_REFERENCE_GUIDE.md, especially Section 19.
Work independently of any specific model brand. Follow this pipeline:
1) inspect reference assets and real product screenshots;
2) produce a shot-by-shot storyboard;
3) obtain an approved still/keyframe for EACH scene;
4) choose the renderer (Remotion for React/data, HyperFrames for HTML/GSAP/Three.js; alternative only with justification);
5) animate scenes using approved compositions and source assets;
6) render an inspection-quality preview and frame contact sheet, including transition boundaries;
7) verify every numeric/text label against trusted source content, and check music/subtitle/audio legality and sync;
8) fix the smallest specific issue without unapproved creative changes;
9) export final MP4 at agreed aspect ratio/FPS/resolution with editable source.
Never run unreviewed third-party skills, never publish/upload confidential assets, and never exceed a paid API budget without permission.
Do not silently switch from full-motion video to a still-image slideshow or from one render engine to another.
```

## 20.3 Generated 3D asset agent instruction

```text
Read Section 3.8. Start from an approved reference image and intended use.
Use verified Microsoft TRELLIS/TRELLIS.2 model sources in an isolated Linux GPU environment when feasible.
Generate a draft GLB, inspect front/side/back and texture/material/alpha quality, optimize mesh and texture size.
Check whether engineering dimensions/physical accuracy are required; if so, do not assume model generation can replace CAD.
Keep high-cost GPU inference off the production website; deploy only vetted optimized assets to CDN.
Verify rights of source image, generated assets, dependency licenses and any cloud provider.
Use Three.js for interactive web presentation or Blender/Remotion/HyperFrames for film composition.
```

# 21. October 18, 2026 Update Summary

This section supersedes **dated version/quantity claims only** where more recent official evidence exists; historical sections above remain for auditability. It does not supersede established selection rules, business logic, or licensing precautions.

| Source | New verified position | Adoption consequence |
|---|---|---|
| HyperFrames | **v0.8.168**, released Oct 17, 2026 | Keep as strong HTML/GSAP/Three.js renderer; test scrubbing and distributed/low-res rendering before adopting |
| Remotion | **v4.0.536**, released Oct 16, 2026 | Stronger Studio timeline and interactive composition editing; regression-test existing timelines and exports |
| Lemo Opuscar | **51 code-generated film styles** in current repository description | Separate from OPUSCAR 98 gallery; do not cite old 43-style snapshot as current |
| Video Shotcraft | **124 curated cards / 150 shots** in current README | Prefer its current curated gallery over stale repository description numbers |
| The Kitchen (dqnamo) | Confirmed live experimental interaction gallery | Add as micro-interaction inspiration; check code/asset licenses per experiment |
| Component Kitchen / Elix | Confirmed open Web Components collection | Architecture/reference only for React projects unless intentionally adopting Web Components |
| TanStack Table | 9.3.1 remains the reviewed release in official GitHub list | No default-stack change |
| Handsontable | 18.1.2 remains the reviewed release | Keep commercial-license key QA before upgrades |

**Not a blanket up-to-the-minute release audit:** other tracked sources retain the most recent *dated* release/review in earlier sections. Before production upgrades re-open the official links, read migration notes, and validate security and licenses.

## Preferred stacks at a glance

- **CHEIRON / HSE / Oil & Gas dashboard:** project design system → shadcn/TanStack → DashboardCN/Tremor analytics → restrained Bencho/Kitchen polish; AG Grid only for a real enterprise-grid need.
- **Finance/admin:** Untitled UI/Tremor for hierarchy → TanStack custom grids or AG Grid analysis → Handsontable only for true spreadsheet editing → Lightweight Charts for true asset/market time series.
- **Corporate/product website:** lightweight core UI → Bencho/Kitchen interaction patterns → selected ThreeUI where mobile performance allows → Coterie for people/admin UI inspiration.
- **Code-rendered product demo:** actual screenshots + approved storyboard → Shotcraft → Remotion or HyperFrames → frame review → MP4.
- **3D interactive/model demo:** TRELLIS.2 on GPU → reviewed optimized GLB → Three.js/Blender → web/video.
- **Training video:** Manim/Remotion for technical diagrams and data, illustrated animation toolkits for character stories, explicit validation of technical content.

---

**Latest master revision:** 2026-10-18 (Section 23 added). Keep a single canonical file in each project, preserve past changelog entries, and never silently change the project architecture based on an external reference.


# 22. Visual Inspiration, Color Pairs, and Landing-Page Patterns — 2026-10-18

**Input:** Five images provided directly by the user: three screenshots of a designer's UI-color-palette reel (account text visible as `bhawna.io`), plus two tall website design mockups (Duck Farm and Seafood Restaurant). The screenshots are **visual references**, not authenticated source-code kits. Attribution in screenshots is not a license to redistribute their photographs, typography assets, illustrations, or site design verbatim.

**Intended use:** Use these as optional art-direction/design-token starting points when the existing brand does not already dictate its own palette, and as composition patterns for *new* landing pages. Do not override established brand colors or a project's existing layout without request.

## 22.1 Verified color pairs extracted from the supplied images

The HEX values below are transcribed from visible captions/screenshots. Contrast ratios are computed for one listed color used as *text* over the other listed color as a *solid background*; real screens may differ when using gradients, transparency, weight, antialiasing, or photographs.

| Palette | Base / dark or focal | Companion / light or accent | Contrast¹ | Suggested use | Verdict for a text pairing |
|---|---|---|---:|---|---|
| Signal Violet + Mist Gray | `#7A35FF` | `#F0F2F5` | 4.95:1 | AI, creative SaaS, strong CTA and light surfaces | Pass AA normal text when paired as tested |
| Prompt Blue + AI Green | `#0B132B` | `#39FF88` | 13.86:1 | Dark AI/product dashboards, AI demos | Pass AAA normal text |
| Quantum Blue + Ice Glass | `#2457FF` | `#DFF7FF` | 4.86:1 | B2B technology, training platforms | Pass AA normal text |
| Cyber Teal + Aqua Foam | `#03313A` | `#8FFFE0` | 11.67:1 | Data, sustainability, technology | Pass AAA normal text |
| Forest Graphite + Acid Mint | `#18251D` | `#B7FF72` | 13.29:1 | Sustainability, modern dark data interfaces | Pass AAA normal text |
| Neon Orange + Porcelain | `#FF6115` | `#FFFCF4` | **2.94:1** | Sales/restaurant CTAs, marketing accents | **Fails AA text contrast as paired**; use a dark text color such as `#0B132B` on orange (about 6.10:1), or use orange as non-text accent |
| Inkberry + Peach | `#1A0B2E` | `#FFB7A5` | 11.11:1 | Editorial/creative, consumer products | Pass AAA normal text |
| Clay Brown + Soft Butter | `#6B352A` | `#FFF1A6` | 8.48:1 | Hospitality, warm lifestyle products | Pass AAA normal text |
| Raspberry + Pale Sky | `#C2185B` | `#E0F2FE` | 5.12:1 | Lifestyle products, consumer onboarding | Pass AA normal text |

¹ Contrast ratio between the two *solid* HEX colors via WCAG 2.1 relative luminance. AA generally requires at least 4.5:1 for ordinary-sized text and 3:1 for large text. Check focus/hover/disabled states separately; `AAA` does not imply that every UI state or font size has been tested.

**Excluded rather than guessed:** `Blueberry + Cream Soda` appears in the reel, with `Blueberry #243B8F` visible, but the companion HEX is obscured by truncation or UI overlay. Do **not** invent it; request a clearer screenshot if it becomes important.

### Rules for using these pairs

- Use **one pair as a concept**, not all nine pairs in the same app.
- A two-color pair is **not** a complete token system. Derive foreground, surface, raised surface, muted foreground, border, focus, semantic success/warning/error, and chart-series palettes independently.
- Preserve brand identity and existing users' expectations. A color reference is weaker than the project's approved design system.
- Test normal/large text, icons, buttons, hover, focus, charts, error states, dark/light themes, contrast on images, and Arabic typography; do not assume a swatch's legibility generalizes.
- Separate *brand accents* from semantic statuses: green must not automatically mean success, nor violet mean approval.
- Avoid full-area neon green or saturated orange on reading-heavy pages; prefer use as highlights, focused CTAs, small badges or decoration.
- Accessible design comes first: do not degrade contrast to match a social-media screenshot exactly.

### Minimal example: Prompt Blue + AI Green tokens

```css
:root {
  /* Palette concept: dark technical interface with bright accent. */
  --brand-deep: #0B132B;
  --brand-accent: #39FF88;
  /* Supporting semantic tokens are project-specific; these are examples. */
  --surface-base: #0B132B;
  --text-on-base: #FFFFFF;
  --text-on-accent: #0B132B;
  --focus-ring: #39FF88;
}

.product-cta {
  background: var(--brand-accent);
  color: var(--text-on-accent);
}
```

**Note:** Do not copy these tokens wholesale into a Tailwind/shadcn theme without reconciling them with the existing theme variables and accessible interactive states.

## 22.2 Reference A: Duck Farm — agricultural/lifestyle product landing page

**Image evidence:** The long two-column composite shows a white/cream canvas, deep green brand areas, natural photography (ducks, farms, dishes), selective yellow CTA, rounded organic photo masks, simple iconography, and clear section sequencing. This is a composition reference; we do not know its original framework or whether the mockup maps to a functioning website.

### Reusable composition patterns

1. **Brand-forward navigation:** short header, logo, restrained links, primary CTA.
2. **Split hero:** benefit-led headline and product/lifestyle photo with clear negative space, two-tier CTAs, quick credibility icons.
3. **Trust bar:** three or four proof points such as quality, hygiene, farm-to-table, local origin; use truthful brand evidence rather than fabricated percentages.
4. **Featured-product cards:** one consistent image ratio, name, short description, action link.
5. **Story/mission panel:** deep-green band with one impactful organic image cutout and compact supporting copy.
6. **Why choose us:** short icon-based value propositions with clear hierarchy.
7. **Process timeline:** 4–6 steps with icon nodes and directional connector; reflow to a vertical stepper on mobile and support RTL ordering intentionally.
8. **Testimonials/blog/closing CTA:** optional and only when genuine content is available.
9. **Repeated image rhythm:** alternate visual-heavy sections and breathable information sections; avoid back-to-back dense card grids.

### Project fit

- **Brand/corporate websites:** strong fit when nature, wellbeing, agriculture, food, or consumer goods matter.
- **BoostMind / consulting:** borrow information architecture and trust-to-proof progression, but replace farms/ducks/colors with the actual company's content and identity.
- **E-commerce/catalog:** image-forward product cards and category filters may transfer.
- **Enterprise/HSE dashboards:** use the layout storytelling ideas for a marketing/public introduction **only**, not as an admin table template.

## 22.3 Reference B: Seafood Restaurant — hospitality/menu/booking landing page

**Image evidence:** The long mockup has a photographic navy hero, warm orange CTA buttons, small turquoise/cyan accents, signature dishes, a visual About section, categorized food/menu cards with prices, benefits on a dark section, testimonials, a book-a-table form, and an immersive closing/footer.

### Reusable composition patterns

1. **High-impact hero:** dark image/video area with text gradient overlay; strong title on left, food/product image on right, primary/secondary CTA.
2. **Feature strip:** concise trust/quality claims beneath the hero; evidence-based content only.
3. **Signature card row:** photo cards with product name, price/unit and a single action.
4. **Editorial image + story split:** optional video play affordance only if video truly exists.
5. **Category tabs:** segmented menu for meaningful product categories, with real keyboard/touch interaction and a fallback when JS is unavailable.
6. **Readable menu grid:** names, meaningful descriptions, prices and easy tap targets; menu data must come from the actual backend.
7. **Dark benefit block:** large image balanced by short differentiation claims.
8. **Social proof:** genuine guest testimonials; no placeholder stars presented as real customer data.
9. **Booking CTA panel:** date, time, guests and a clear reserve action; validate availability against the booking backend **before** claiming a real reservation.
10. **Destination footer:** quick links, location/contact, social icons and legal details.

### Project fit

- **Restaurant and hospitality websites:** strong fit for the full composition and conversion funnel.
- **Product/SaaS marketing:** borrow the photographic hero, collection cards, category navigation and final conversion section (change booking into demo/trial form).
- **Training/event websites:** borrow the event CTA panel as a registration UI with actual capacity checks.
- **Finance/HSE admin:** low suitability for the full aesthetic; can borrow hierarchy and sectional density only.

## 22.4 Responsive, quality, and implementation checklist

- [ ] Treat screenshots as visual briefs; rebuild **actual responsive DOM/components**, never a screenshot-as-background shortcut.
- [ ] Hero: desktop 2 columns, mobile stacked; important copy and action must remain visible without a giant image pushing them offscreen.
- [ ] Card grids: 3–4 desktop / 2 tablet / 1–2 mobile depending on image size and readable content.
- [ ] Process timeline: collapses into readable vertical stepper on small screens; avoid tiny labels or clipped connectors.
- [ ] Nav menu: accessible keyboard/mobile drawer, proper focus management and sufficient touch targets.
- [ ] Image performance: AVIF/WebP, responsive `srcset`, fixed aspect ratio, intentional cropping, lazy loading below the fold.
- [ ] Hero photo: high quality responsive source, clear focal point, contrast overlay and alt text; no arbitrary blur or stretching.
- [ ] All buttons/menus/filters/forms are functional, not purely decorative mockups.
- [ ] Real data and pricing: do not invent products, ratings, claims, availability or testimonials.
- [ ] Verify fonts, LTR/RTL, Arabic line wraps, mobile paddings and chart/form alignment.
- [ ] Motion from Bencho/Kitchen/Coterie/ThreeUI is **optional finishing polish**, not a substitute for clear composition.
- [ ] Don't duplicate logos, photographs, illustration assets or full copyrighted layouts without permission; adapt general design principles.

## 22.5 Project-specific selection guide

| Project type | Prefer these references | Palette direction |
|---|---|---|
| Product/SaaS/AI landing page | Duck Farm's product/story sequencing + Seafood's hero/conversion hierarchy + Bencho micro-interaction restraint | Signal Violet/Mist Gray; Quantum Blue/Ice Glass; Prompt Blue/AI Green |
| Finance / executive analytics | Existing dashboard/finance references remain primary; borrow only token ideas and contrast checks | Cyber Teal/Aqua Foam, Quantum Blue/Ice Glass, or existing approved brand |
| HSE / safety / enterprise workflow | No consumer-website cloning; clarity, density, hierarchy and contrast are the transferable parts | Approved corporate identity first; Forest Graphite/Acid Mint only for nonsemantic accent if appropriate |
| Food/agriculture/catalog | Duck Farm sections, product image grid, story/quality cues | Forest Graphite/Acid Mint or domain-specific greens/cream |
| Restaurant/hospitality/booking | Seafood hero, categorized menu, conversion/booking panel | Neon Orange/Porcelain with **dark** foreground; custom dark navy |
| E-learning / events | Story and process stepper; registration/conversion sections; accessible CTAs | Quantum Blue/Ice Glass or project brand |

### Copy-ready brief for agents

```text
Read Section 22 of UI_COMPONENT_REFERENCE_GUIDE.md and inspect the actual project.
The attached social screenshots provide color pairs and two landing-page composition references ONLY.
Do not replace the existing brand identity. Propose 1–2 applicable palettes/section patterns with reasons.
Implement the patterns as real semantic, responsive React/HTML components, not full-page screenshot backgrounds.
Preserve established business workflows. Do not invent products, metrics, prices, ratings, testimonials or bookings.
Audit WCAG text contrast and touch/keyboard interactions. Optimize images for mobile. If the project is a dense
enterprise dashboard, borrow only restraint and hierarchy from consumer marketing designs.
Document exactly which palette tokens and layout patterns were used and why.
```

---

**Revision note:** Section 22 is derived from screenshots supplied by the user, not from an independent source-code audit or official release. Historical version/release claims elsewhere in this guide retain their dated status.


# 23. Project-Management Dashboard, Animated Signup and Tree Navigation — Screenshot References (2026-10-18)

**Input:** Five screenshots supplied by the user. Three show a dark team/project management interface in a social-media reel credited on-screen to **Code & Chill** (the interface's settings text references "Pane"); one shows an animated-signup concept posted by **InfiWeb Craft**; one shows a basic/premium tree-navigation comparison posted by **Design & Code With AV** (Giulio Cercato, as displayed on-screen). Attribution is based on visible screenshot text only; it is **not** a verified product owner, code license, functioning demo, or source repository. The screenshots include WhatsApp/social-video chrome and creator overlays; these elements **are not part of the underlying UI reference**.

**Reference type:** image-only UI/UX inspiration; no permission to copy copyrighted source code, exact artwork, full design, names/logos, or external assets is implied. Motion timing cannot be verified from still screenshots. Do not merge these with the **Coterie** product merely because Code & Chill is also associated with Coterie. This is a separate project-management visual reference until a real template/source is provided.

### 23.1 Reference manifest

| Asset name in accompanying ZIP | Source shown in image | Extractable design pattern | Evidence limits |
|---|---|---|---|
| `IMG_2431.png` | Code & Chill social reel | My Tasks: today/late list, project chips, priority labels, completed strike-through | Cannot establish functionality, logic or animation from screenshot |
| `IMG_2432.jpeg` | Code & Chill social reel | Tasks dashboard: summary metrics, filter toolbar, board/list selector, Kanban task columns/cards, Focus timer chip | Desktop-looking interface shown in a phone video; **not** proof of responsive mobile layout |
| `IMG_2433.png` | Code & Chill social reel | Profile & Settings: nested navigation, notification controls, theme and wallpaper/theme choices | Visual reference only; no verified storage or preferences behavior |
| `IMG_2434.jpeg` | InfiWeb Craft reel | Flow signup concept: illuminated dark form, focus border, strength indicator, primary CTA and Google/Apple alternatives | Source-code preview is partial; animation and working validation not verifiable |
| `IMG_2435.png` | Design & Code With AV reel | Basic vs Premium tree view: workspace header, parent-child guide lines, locks, counts, browse-all footer | Example code visible only as partial social-video screenshot |

If this Markdown is used **without** the accompanying ZIP/image folder, all selection rules and descriptions remain usable, but the original visual evidence will not be embedded. When the full ZIP is supplied, images live in `visual-references/oct-18-project-ui/`.

## 23.2 Code & Chill: Team/Project Management — dark premium enterprise shell

### Three complementary screens

1. **My Tasks** (`IMG_2431.png`): compact title/subtitle ("Due today and late"), All tasks link, clearly separated task rows, circular completion action at left, task title, project-context pill, relative due label, compact Urgent/High indicator; completed entries use blue filled check circles + strike-through while metadata remains visible. A neighboring calendar/agenda panel is partially visible; do not infer its complete workflow.
2. **Tasks / Kanban** (`IMG_2432.jpeg`): sidebar icons, heading plus open-task/project context, compact KPI counters (Open / Due this week / Overdue / Done this week), view switch (Board/List), New task CTA, filter chips (All projects / Mine only / Any priority), a search box, and columns visibly labelled **To do**, **In progress**, **In review**. Task cards show project pill, title, due date, comments/assignees and sometimes a 2/3 checklist-progress bar. A Focus chip with countdown appears near the top; screenshot does **not** prove timer semantics or pause/resume implementation.
3. **Settings** (`IMG_2433.png`): narrow local settings navigation; Profile, Notifications, Appearance, Focus and Data items; main cards for name/email/role and notification preferences; theme options (Light / Dark / Auto) and multiple wallpaper/accent swatches. Use this as inspiration for compact but well-labeled preference management, not permission to implement nonfunctional toggles.

### Visual grammar worth extracting

- **Calm deep-charcoal base** with slightly lighter nested surfaces and subtle borders; occasional soft glass/translucency, not indiscriminate blur.
- **Large rounded section containers**, smaller inner task cards, consistent inset/padding/edge rhythm.
- **Cool blue as primary action/selection color**; **purple, green, orange and pink** as task/project differentiators only when paired with visible text labels.
- Priority warnings (Urgent/High) use restrained color-tinted badges, **not** full red/orange backgrounds.
- **Density with hierarchy:** compact text/labels and concise counts, but task titles and main actions remain legible.
- **Contextual controls:** search/filter where tasks live; settings navigation inside Settings; task status visible in both list and board views.
- The social-video overlay icons, handles and comment counts are **not** controls to reproduce.

### Data and interaction model to implement (engineering guidance, not claimed screenshot functionality)

- Single underlying `Task` state/data model with `id`, `title`, `projectId`, `status`, `priority`, `dueAt`, `assignees`, `completedAt`, and optional `checklistProgress`. Board and List views should show the **same source of truth**.
- Explicit status workflow and column rules; never claim that dragging a card saves successfully until persistence succeeds. Provide keyboard-accessible non-drag alternative.
- Filters must be composable and restorable; report `X open across Y projects` from real filtered/unfiltered data as labeled.
- `Overdue` must use correct timezone/due boundaries; completed tasks should not be mislabeled overdue.
- Comment counts, progress, priority, due date and person assignment must match backing data. Never fabricate demo values inside operational apps.
- Completion/approval should be reversible only if domain rules allow; more serious business actions use clear confirmation/audit trail.
- Focus mode is optional, not a dependency of task management. Provide stop/pause and notification-handling rules only if actually implementing a timer.

### Responsive translation

The screenshots are of an **apparent desktop layout displayed within mobile-captured social content**, not native phone-ready product screens. Do not shrink three Kanban columns until content becomes unreadable. For a real phone:
- prefer a clear **List** mode by default, or horizontally scrollable/snap-able single-column Kanban with obvious status headers;
- sidebar becomes accessible drawer or bottom navigation depending on existing app conventions;
- filter chips wrap/scroll without clipping, and full search remains discoverable;
- settings side navigation becomes a top/back stack or in-page tab list;
- touch actions are comfortably sized and not hover-only.

### Best fit

- **CHEIRON / action tracking:** My Tasks, assigned investigations, recommendations due, owner badges, task completion and review queues; retain actual investigation level, role/permissions and approval semantics.
- **MOC/RFC tracker:** group requests by real SOC/stage/status; move through permitted transitions only; preserve audit history and status colors.
- **Executive/admin dashboards:** small summary counts + contextual view of pending approvals/reviews; do not overload the overview.
- **E-learning/operations:** instructor/admin task queue, review and content publishing workflows.
- **Finance:** only task/workflow shell where appropriate; do not replace proven finance table designs with Kanban where a grid is better.

**Recommendation:** **Primary inspiration for enterprise tasks/project workspaces**, not a dependency recommendation; reproduce the information architecture and restrained motion using project-approved React/Tailwind/shadcn/TanStack foundations.

## 23.3 InfiWeb Craft: Flow animated signup reference

**Observed screenshot:** a centered, narrow rounded dark navy card on black/very-dark background, subtle cyan/blue highlight above, `Flow` heading, quiet supporting sentence, four stacked input zones (name, email, password, confirm password), outlined focused input, inline iconography, subtle password-strength segments, agreement checkbox, one gradient-blue primary action, secondary Google/Apple buttons. A code preview appears below the showcased form, but is not enough to verify a complete working implementation or animation timing.

### Pattern to reuse

- **Focus-led motion:** elevated focus ring/glow on the active field; avoid distracting continuous global animation.
- **Strong form hierarchy:** title → short purpose → labeled inputs → feedback → consent → single primary CTA → optional alternative sign-in.
- **Dark-on-dark dimensionality:** raised card and one bright blue CTA are enough; do not blur the inputs or reduce label contrast.
- **Short, functional transitions** for valid/invalid/focus/success state. Optional progressive entrance on first paint only if accessible and reduced-motion-safe.

### Required production behavior

- Keep labels visible after text entry (do not replace labels with placeholders alone).
- Validate email and password consistently with actual auth-provider rules; do not pretend color bars guarantee password security.
- Clarify terms/privacy consent; never pre-check consent where explicit agreement is needed.
- Show/hide password must be keyboard/touch accessible and labeled; submitting must display real pending, success and error states.
- Support password managers, autofill, paste, mobile keyboard, and autocomplete tokens; don't animate the DOM in a way that breaks input/focus.
- OAuth buttons are only shown when providers are configured and tested; follow provider logo/branding conditions.
- Respect `prefers-reduced-motion`; test dark-theme contrast, 200–400% zoom, RTL and responsive widths.

**Recommendation:** strong **auth/registration visual inspiration**, with implementation from the existing project auth stack (e.g. Supabase Auth where it is already established). Not evidence of a reusable signup library.

## 23.4 Design & Code With AV: premium hierarchical Tree Navigation

**Observed before/after:** a simple file/folder hierarchy becomes a structured workspace tree with avatar/workspace header, prominent Add new command, light connector rails showing nesting, folders and document leaves with distinctive icons, disclosure chevrons, small counts, locked items, selected/hover states, and bottom **Browse all** entry. The comparison is explicitly labeled **HTML | CSS | JS**, but source code is only partly visible.

### Reusable patterns

- Parent-child **indentation + connector lines** create hierarchy without relying solely on left margin.
- Distinct folder/document/locked-item iconography, with status represented by both icon/text and color.
- The whole row is a consistent hit target; chevron expands/collapses separately from opening the item.
- Folder counts should have a defined meaning (immediate children vs descendants) and be consistent across branches.
- Workspace switcher, Add new action, Browse all and context menu each need real actions and permission checks.
- Preserve position, selection, focus and expanded branches after navigation/reload where user value justifies it.

### Accessibility and data rules

- Use standard `tree` / `treeitem` semantics (or an accessible established tree component), correct levels, `aria-expanded`, `aria-selected`, and appropriate keyboard arrow/Home/End interactions.
- Lazy-load deeply nested children and virtualize only if scale requires it; never lose accessibility due to virtualization.
- Locked, read-only and hidden items must reflect **backend permissions**, not only an icon.
- Maintain file/folder identity by stable IDs, never by mutable display names or array indices.
- Handle empty directories, loading/error states, move/rename conflicts and deleted nodes.
- Mobile: allow drill-down/breadcrumb navigation when nested indentation would crush the content; support large touch targets and do not require hover.
- For thousands of nodes, consider an accessible existing primitive/tree view component before implementing a bespoke tree from scratch.

### Best fit

- CHEIRON Investigation evidence folders, reference libraries and documents.
- E-learning course/module/lesson navigation and resource libraries.
- Project file/documents navigation; structured audit evidence; HSE document hierarchy.
- Company admin knowledge bases and hierarchical settings where the information really is a tree.

**Recommendation:** **High-value enterprise navigation pattern**; first implement semantic data hierarchy and keyboard controls, then add gentle connecting lines, badges and transitions. Avoid copying an ornamental tree into a flat menu where it adds unnecessary complexity.

## 23.5 Cross-reference selection: choose by workflow, not by looks

| UI task | New reference | Existing complementary source | Implementation priority |
|---|---|---|---|
| Task queue, due/priority, owner list | Code & Chill My Tasks | shadcn/ui + TanStack Table | High for action-tracking products |
| Kanban/project progress | Code & Chill Tasks board | shadcn + tested drag-and-drop when necessary | High when stages represent genuine workflow states |
| Profile, notifications, theme settings | Code & Chill Settings | Untitled UI, Coterie, shadcn | Medium; only expose real persistent preferences |
| Signup/onboarding form | Flow by InfiWeb Craft | shadcn, Bencho/Kitchen polish | Medium; auth correctness dominates appearance |
| Nested documents and resource structure | Premium Tree Navigation | Existing accessible tree/file explorer component | High for document-heavy workflows |
| Marketing hero / video narration | Not these operational interfaces | A.S Motion / Remotion / HyperFrames / ThreeUI | Only when motion delivers a specific storytelling benefit |

**Sequencing standard:** business rules and state correctness → hierarchy/layout → keyboard/mobile accessibility → semantic status cues → restrained micro-interaction → performance/regression testing. Never install all showcased libraries. Existing design-system tokens take precedence over screenshot colors.

## 23.6 Copy-ready implementation guidance for coding agents

```text
Read Section 23 of UI_COMPONENT_REFERENCE_GUIDE.md and inspect the existing project UI and domain model first.
Use the five user-supplied screenshots ONLY as visual/interaction references, not as proof of reusable code or a license.
Separate social-video overlay controls from the product screen.
Choose only the patterns relevant to this project's real workflows: task list/Kanban, settings, signup, or hierarchical navigation.
Do not clone demo names/data, assume the captured desktop board is phone-responsive, or introduce gratuitous glass/blur/motion.
Preserve every existing route, permission, business rule, stored state and API contract.
Board and List must be two views of the same persisted data; validate status/priority/due counts against source records.
Forms must use the project's real authentication and validation system; support autofill, focus, errors and reduced motion.
Tree navigation must use stable IDs, permission checks, accessible keyboard interactions and reasonable mobile drill-down behavior.
Use design tokens rather than guessed HEX colors from compressed screenshots.
Implement working and accessible UI first; add subtle animation as progressive enhancement.
Document exactly which reference/pattern was adopted, what was adapted, and all responsive/keyboard/RTL/regression checks.
```

---

**Reference-date note:** these design observations are based strictly on screenshots attached by the user on 2026-10-18; no product-source-code audit or real-time implementation testing has been performed.

---

# 24. Notification Stack and 3D Login Background — Screenshot References (2026-10-18)

**Evidence:** Two screenshots directly provided by the user. Treat both as **visual/interaction inspiration**, not source code, functional verification, or licensing permission. The screenshots include third-party short-video overlays that are **not** parts of the UI to replicate. The visible lower code panels are too small/incomplete for a reliable code audit.

## 24.1 Source-image manifest

| Reference | Bundled image | Visible origin | Subject | Reuse status |
|---|---|---|---|---|
| R24-A | `visual-references/oct-18-notifications-3d-login/IMG_2437.png` | Design & Code With AV / Giulio Cercato, as credited in the screenshot | Basic versus premium notification stack | Screenshot inspiration only; code/license not verified |
| R24-B | `visual-references/oct-18-notifications-3d-login/IMG_2436.jpeg` | Coding Withme, as credited in the screenshot | Aurora-branded dark glass login card with decorative wireframe shapes | Screenshot inspiration only; code/license not verified |

The source screenshot itself is ground truth for visual structure; animation timing, real interaction, accessibility, and runtime behavior are **not** established by a still image. Ignore the social platform's like/comment/share/bookmark icons, search overlay, phone status bar, creator captions and video controls when interpreting the showcased app UI.

## 24.2 R24-A — Notification Stack: basic versus premium

### What is actually visible

- **Basic variant:** one large white container with a vertical list of independent rounded notification rows; each row has a softly colored icon tile, bold headline, brief descriptive text, relative timestamp and close affordance. The four example categories are message, like, comment, and follower.
- **Premium variant:** a rounded, light panel with the **front notification card** elevated, surrounded by multiple partially visible / translucent cards receding behind it. The visible front item shows message icon, headline, subtext, timestamp and close action.
- A small purple **`+3` counter** indicates additional grouped items; four small progress dots suggest navigation between notifications.
- The illustration emphasizes **depth, grouping, subtle gradients, shadow and controlled hierarchy**, not heavy animation or unbounded visual effects.

### Reusable design patterns

1. **Progressive disclosure:** show one actionable item clearly, then expose older items through an accessible expansion/list, not only via decorative dots.
2. **Visual depth communicates grouping:** use modest offsets, opacity/shadow differences and consistent radii. Never put real interactive controls on hidden / covered back cards.
3. **Clear information hierarchy:** type/icon → title → concise description → timestamp → contextual action.
4. **Compact overflow count:** derive `+N` from actual unviewed items; it should open the rest of the items and be understandable to assistive technology.
5. **One card, one intent:** clicking the notification body should navigate to its intended resource; clicking dismiss should not trigger navigation.
6. **Optional motion:** short transforms on next/previous/dismiss/expand that preserve spatial continuity. Use instant changes for reduced-motion users.

### Domain integration rules (high priority)

- **Never hide urgent safety or approval blockers behind the stack.** In HSE, critical incident/overdue/action-needed notices get a distinct accessible, persistently visible queue or explicit high-priority callout.
- Treat **read**, **acknowledged**, **dismissed**, **resolved**, and **archived** as different states when the business process distinguishes them. A UI close icon must not silently mark critical notifications as resolved.
- Store notification identity and state by **stable IDs**, not list positions. Feed state from the actual backend, not motion state or hard-coded sample data.
- Sorting: use deterministic priorities and timestamps; don't let card animations reshuffle or drop items on data refresh.
- Show errors, empty states, loading/skeleton, offline/retry and race-safe updates; when possible provide an undo for non-destructive dismissals.
- Respect actual user permissions and subscription preferences. A hidden notification isn't evidence that the user took a required action.
- Notifications with action buttons must provide clear labels, destinations and status; prevent accidental double actions.
- For time-sensitive operational notifications, show exact or inspectable date/time in addition to abbreviated relative time.
- Use screen-reader announcements selectively: do not announce the whole feed on each poll or animate live regions continuously.

### Accessibility / keyboard interaction

- Ensure **real button elements** for dismiss/next/previous/expand with an accessible name including which notification is affected.
- Provide a full list/drawer alternative and a visible “View all notifications” action; do not force users to discover content via dots/swipes.
- If using a carousel analogy, clearly announce position and count (`1 of 4`); use keyboard controls only when focus is within the widget and avoid trapping focus.
- Keep only the active card's interactive content in keyboard order. Hidden cards should be inert/unfocusable, not merely `opacity: 0`.
- Maintain adequate contrast on washed-out cards; decorative background cards can be low contrast **only if not required to read or operate**.
- Motion must honor `prefers-reduced-motion`, not interfere with text selection, and not steal focus after data refresh.
- On mobile, provide large enough tap targets and safe-area spacing; prefer a conventional list when cards contain long descriptions or multiple actions.

### Recommended implementation approach

- **React + shadcn/ui + existing icons + CSS transitions/Framer Motion only if already installed**. No new heavy motion dependency is necessary.
- Separate components: `NotificationFeed` (canonical accessible list), `NotificationStack` (compact visual summary), `NotificationCard` (shared presentation), and `NotificationInbox` (full history/drawer).
- Establish typed data contract, e.g. `{id, type, title, body, createdAt, priority, unread, acknowledgementRequired, destination, permissions}`. Add server-confirmed acknowledgement state where the domain requires it.
- Support stack sizes of 0 / 1 / 2 / many and long content; calculate the counter from canonical filtered state.
- Test rapid dismiss, undo, refresh, permission changes, keyboard navigation, RTL, 320px screens, reduced motion, high text zoom, and failure during mutation.

### Strongest project matches

- **CHEIRON:** noncritical recent updates, reviewer comments, mentions and assignment notices; keep mandatory HSE and high-severity signals in dedicated high-priority views.
- **MOC / RFC:** workflow handoffs, returns, approvals and assignment updates; preserve the authoritative stage/status and audit trail.
- **BoostMind / Finance:** activity summaries, noncritical reminders and task notices; critical finance verification should remain explicit.
- **E-learning:** course updates and announcements, with a separate clear tasks/due-assignment view.

**Verdict:** approved as a **secondary micro-interaction and grouping reference**, not the default for all notification feeds. Prefer a standard accessible list where density, audit history or actionable complexity matters more than visual compactness.

## 24.3 R24-B — Aurora 3D / wireframe Login Experience

### What is actually visible

- Dark black/indigo background and **sparse glowing geometric wireframe shapes** behind the login form.
- A centered rounded, translucent charcoal/purple **glass-style sign-in card** with a small security/shield badge visually floating above it.
- “Welcome to Aurora” heading, short subtitle, email and password inputs, focused purple field halo, **Remember me** and **Forgot password?** controls.
- A single high-contrast **purple-to-cyan gradient** primary Sign In button, followed by Google/GitHub/Apple buttons and create-account link.
- A code preview is visible below the showcased page. This does **not** establish the true runtime, exact 3D engine, interaction implementation or code completeness.

### What to borrow

1. **Distinctive product-auth atmosphere:** a tightly controlled brand background can make a login page feel premium without competing with the form.
2. **Single-card focus:** user attention stays on credentials; the environment is secondary.
3. **One vivid CTA:** emphasize the primary sign-in action instead of lighting up every control.
4. **Meaningful focus feedback:** focused inputs have clear border/glow, not only placeholder change.
5. **Decorative geometry with depth:** slowly orbiting/rotating wireframe shapes can establish visual identity; should not be mandatory to understand or operate auth.

### Correct engineering interpretation

- The **image alone cannot prove real 3D**. A similar visual can be built via CSS/SVG/Canvas; Three.js/WebGL is justified only if the planned motion genuinely requires perspective/depth interactions or visual complexity.
- Use the app's existing auth stack, session lifecycle and route guards (e.g. Supabase Auth where already in use). Do not replace auth logic to imitate a screenshot.
- Geometry is a **background layer**, normally `pointer-events: none` and below the form in stacking order. It must never overlap hit targets, password-manager/autofill prompts or focus rings.
- Start with a **static fallback** that looks finished before animation loads. Make motion optional, lazily initialized and removed for `prefers-reduced-motion` and slow devices.
- Test effect on startup time, memory, animation smoothness, input latency, battery, scroll and mobile GPU. Limit animation to a small number of simple shapes and avoid heavy postprocessing and always-on bloom.
- If an image/poster is enough on mobile, prefer it; never require WebGL for account access.

### Production authentication checklist

- [ ] Semantic `<form>` and visible labels for every field; working submit on Enter.
- [ ] Keyboard and screen-reader focus order, high-contrast focus states and sensible validation feedback.
- [ ] Actual server-backed login and error handling; no simulated success UI.
- [ ] Password manager, autocomplete, paste and mobile keyboard compatibility.
- [ ] Accessible show/hide password if provided; no credential handling in decorative scripts.
- [ ] Forgot-password route and reset flow tested.
- [ ] Rate limiting/abuse controls and secure session/cookie settings enforced by the existing auth architecture.
- [ ] Only display configured and tested OAuth providers; obey provider brand requirements.
- [ ] Remember-me behavior corresponds to a real and documented session policy.
- [ ] Loading, invalid-credentials, network-error and authenticated-redirect states tested.
- [ ] Reduced-motion, no-WebGL, offline/error and small-screen fallbacks.
- [ ] Responsive layout with reliable scrolling at 320px, on landscape phones and at 200%+ zoom; avoid clipped form content behind decorative layers.
- [ ] RTL and Arabic labels/errors tested; geometric background need not be mirrored.

### Implementation priority ladder

1. Correct auth behavior and form accessibility.
2. Auth-card typography/spacing/contrast/responsive layout.
3. Brand surface tokens + restrained gradient on primary CTA.
4. Static decorative background (CSS/SVG or compressed image).
5. Motion prototype in CSS/SVG/Canvas with performance measurement.
6. Add Three.js only if clearly warranted; otherwise keep the simpler implementation.
7. Check against actual production devices and regressions.

### Strongest project matches

- **BoostMind, AASURIX, e-learning and other branded SaaS login/onboarding:** potentially strong first-impression pattern after the existing auth flow is stable.
- **HSE enterprise operational dashboards:** use much more restrained decoration or a simple login card; reliability and clarity dominate.
- **Marketing/product demo videos:** adapt Aurora-like card entrances and wireframe background using HyperFrames/Remotion; code-generated demo motion is separate from the live login experience.

**Verdict:** approved **visual/auth atmosphere reference**; not authorization to add a real-time 3D engine to every app or to replace existing login/security architecture.

## 24.4 Selection rules: R24-A versus R24-B

| User need | Reference | Safest starting point | Avoid |
|---|---|---|---|
| Show recent updates in limited space | Notification Stack | Small stack + real View All inbox | Hiding urgent actions in back cards |
| Review many notifications or audit status | Conventional accessible list, informed by Basic Stack | Searchable/filterable list with states | Swiping through hundreds of items |
| Provide action confirmations | Bencho/Kitchen + conventional status feedback | Inline confirmations with explicit semantics | Mistaking dismissal for acknowledgement |
| Premium signup/login | Aurora | Correct existing auth + static decorative design | Decorative WebGL blocking input |
| Rich auth intro/marketing clip | Aurora + A.S Motion / HyperFrames / Remotion | Separate rendered demo | Continuous heavy motion on real auth form |
| Visual identity for a serious admin system | shadcn/Untitled UI / project tokens | Readable screens and restrained motion | Copying demo-brand colors/layout blindly |

## 24.5 Copy-ready agent instruction

```text
Read Section 24 of UI_COMPONENT_REFERENCE_GUIDE.md and inspect the current project architecture, real notification model and authentication flow before editing.
The two attached screenshots are visual references only, not proof of reusable working code or implementation rights.
For notifications, keep a canonical accessible list/inbox and use stacking only as a compact optional summary. Do not bury high-priority HSE or mandatory acknowledgement notices in an inaccessible stack. Preserve read vs dismissed vs acknowledged vs resolved semantics, backend permissions, persistent IDs and audit trails.
For login, preserve the existing authentication provider, session handling, routes, rate limits, form validation and OAuth configuration. Build a readable responsive card first; decorative wireframe geometry is optional, pointer-inert, lazy-loaded and disabled/replaced under reduced-motion or low-performance conditions.
Use existing React/Tailwind/shadcn/CSS capabilities before introducing motion or WebGL dependencies. Apply design tokens, never assume exact HEX values from compressed videos.
Verify keyboard and screen-reader access, mobile/RTL, 200% zoom, long content, error/loading/empty states, reduced motion, slow devices and regression tests. Report changed files and ensure no unrelated UI/business logic is modified.
```

---

**Provenance / scope:** These references were analyzed from two still screenshots shared by the user on 2026-10-18. Source implementations were not downloaded, and timing, code quality, license and actual interactions remain unverified. Each implementation decision must be justified independently.

---

# 25. Vibe Board — AI-Assisted Testing and Fixing Kanban Reference — 2026-10-18

**Reference ID:** `R25-A`  
**Origin:** user-provided still screenshot, `visual-references/oct-18-ai-qa-board/IMG_2438.png`  
**Visible credits/context:** social short from "WE WILL TECH", depicting a screen titled **Vibe Board** and terminology **Vibe Test / Vibe Fix**. The screenshot is an ad/video still, not independent evidence of a functioning product or the original codebase.  
**Classification:** strong **workflow/information architecture** reference; **not** a verified reusable component library, licensed code sample, or proof of actual automatic test/fix functionality.  
**Confidence:** high for visible composition and labels; unverified for automation execution, providers, framework, pricing and licensing.

## 25.1 Observations grounded in the screenshot

A light, compact project/QA board uses a left icon sidebar, a top project search, zoom controls, a notification indicator, and a user profile menu. The board heading reads **Vibe Board** with six cards; the central work area contains:

- **Primary actions:** `Write a story` and `Report a bug`.
- **Board search/filter controls:** `Search board`, `Filter` and `Group`.
- **Four lanes:** `TO DO`, `IN PROGRESS`, `TESTING`, `FIXING`, each with item counts and add controls. This resembles software development + QA stages, not just ordinary task completion columns.
- **Visible instruction:** “Drag a card between columns, or move it from its ··· menu. Into Testing runs a test — into Fixing runs a fix.” This is the **intended UI claim**; a static frame does not establish whether those transitions actually run test or code-fix jobs.
- **Card types:** `STORY` and bug items; examples include order cancellation, Mada/OTP payment failure, SMS-order tracking, Riyadh delivery fee exclusion and **Arabic product names cutting off in the order summary**.
- **Severity cues:** `Critical` and `High` tags, tiny workflow badges (`Bug test`, `Story test`, `Bug fix`) and small elapsed-time/progress lines.
- **Agent entry point:** a persistent bottom control labeled `Ask Vibe...`.
- **Visual emphasis:** cards under active work have restrained blue/purple/red/green glow or halo. Color is supporting feedback; it cannot be the only state indication.

The provided image does **not** show the full interaction, a repository, actual test logs, a completed successful code fix, or a license. Avoid claiming any of those as verified facts.

## 25.2 Design patterns worth borrowing

1. **Intent in the stage:** a status column may correspond to a meaningful operation, not simply a reporting label. Users need to know what moving to a column will do.
2. **Story-to-test-to-bug feedback loop:** link user stories, automated/manual test cases, failing evidence, bugs and fixes under one parent issue.
3. **Task/agent proximity:** an agent command bar is useful near the visible work, but agent actions must remain scoped to the selected board/project/issue.
4. **Evidence in compact cards:** show the latest action, a job-state label, progress, elapsed time, assignee and severity without requiring users to open every card.
5. **Multiple entry paths:** drag-and-drop, a card menu and accessible keyboard controls should lead to the same underlying transition API.
6. **Visible work-in-progress:** use animation subtly to show real background jobs, never to fake the presence of a running tool.
7. **QA localization:** the Arabic truncation, OTP, currency/delivery-fee and regional examples highlight why non-English UI and business-rule validation deserve explicit test coverage.

## 25.3 Proposed production model (our architecture, NOT visible/verified product capability)

### Explicit finite-state model

Suggested board lanes can stay `todo`, `in_progress`, `testing`, `fixing`, but **job outcome** must be modeled separately:

- `issue.workflow_status`: `todo | in_progress | testing | fixing | done | blocked`
- `automation_job.state`: `queued | running | awaiting_approval | passed | failed | cancelled | timed_out`
- `issue.type`: `story | bug | task | test_case`
- `issue.severity`: `critical | high | medium | low`, independent of `priority`, `due_at` and `assigned_to`.
- `source_issue_id`, `linked_test_run_id`, `proposed_fix_pr`, `evidence_refs`, `job_attempt`, `started_at`, `finished_at`.

**Rule:** dragging an issue must not itself silently change code or deploy software. Define and communicate the exact trigger semantics:

1. `Move to Testing` requests a *test run* with scope and expected cost; test runner uses a safe test environment and produces a durable result.
2. `Move to Fixing` can draft a *fix proposal*, create an isolated branch/PR and run checks, but must not push to protected branches or production without explicit authorized approval.
3. Use server-side permission validation before transition and before dispatch, plus idempotency keys so retries/double drags do not start multiple paid jobs.
4. Persist a **transition audit log** (actor, prior state, new state, job reference, timestamp, reason) independently of animation state.
5. If the automation is unavailable, permissions fail or a test is blocked, keep the true state visible and offer recovery; no optimistic “fixed” appearance.
6. For bug fixing, run regression tests, diff review and human approval before merge. A generated patch is not a verified bug fix.

### Minimal useful card contract

```ts
type IssueCard = {
  id: string;
  projectId: string;
  title: string;
  type: 'story' | 'bug' | 'task' | 'test_case';
  workflowStatus: 'todo' | 'in_progress' | 'testing' | 'fixing' | 'done' | 'blocked';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  assigneeId?: string;
  testRunId?: string;
  fixPullRequestUrl?: string;
  lastJobState?: 'queued' | 'running' | 'awaiting_approval' | 'passed' | 'failed' | 'cancelled' | 'timed_out';
  progress?: { completed: number; total: number };
  updatedAt: string;
};
```

Progress values must be grounded in real runner events, not a fake percentage based on elapsed time. Keep test logs, diffs, environment and result links accessible from the card detail/drawer.

## 25.4 Visual and interaction specification

- **Structure:** slim persistent sidebar on desktop; readable board title + compact global toolbar; column headings with counts and contextual add actions.
- **Cards:** strong title, abbreviated description, consistent issue-type/category tags, severity, real-time state text and optional progress; limit badges so important information remains scannable.
- **Status motion:** subtle glow while a job is running, stop/settle on success/failure, use a textual status and icon in addition to colors. Disable animated glow in reduced-motion mode.
- **Drag/drop:** a drag affordance can remain, but provide keyboard move controls and `Move to…` menu. Never trigger a dangerous or paid action purely on hover or an accidental drop.
- **Assistant:** `Ask Vibe`-style command bar is a pattern, not a permission bypass. Read-only questions can be immediate; any repository edits, paid generation or deployment should show scope, expected effects and an approval gate.
- **Responsive:** desktop multi-column board; on narrow viewports favor a single lane / horizontal lane selector or a list view, not a tiny scaled desktop board.
- **RTL:** ensure column ordering makes sense in Arabic, Arabic titles wrap without clipping, issue numbers/progress remain understandable and status icon direction is intentional.
- **Accessibility:** keyboard navigation, visible focus rings, screen-reader announcements for status transitions, meaningful accessible priority labels, no forced smooth-scroll or inaccessible hidden controls.
- **Failure cases:** missing credentials, job timeout, rate limit, concurrent edits, unauthorized transition, test infrastructure unavailable, stale issue versions and network disconnect.
- **Security:** no secrets in issue text/log previews; redact credentials; treat bug descriptions, test files and external repo text as untrusted; use tightly scoped agent permissions and isolated runners; audit every write.

## 25.5 Project fit and boundaries

| Project type | Potential use | Non-negotiable boundary |
|---|---|---|
| **Software projects / internal development** | AI-generated test proposals, issue triage, regression runs, suggested PR fixes | Protected branches and production deploy remain approval-gated |
| **Hazarix / 3D training platform** | Scenario QA, visual regressions, interaction/camera bug tracking, screenshot/frame evidence | AI tests do not certify physical or HSE training accuracy |
| **CHEIRON Investigation / HSE systems** | Engineering QA board for the product itself, test runs and release readiness | Do not confuse software QA with incident investigation findings; no AI auto-approval of HSE decisions |
| **MOC / RFC Tracker** | Internal development/test-release board or UI inspiration for stages | Business MOC approval steps must not trigger automatic code-fixing or approval actions |
| **AASURIX / Finance / assessment** | Regression coverage for forms, score/rule changes, Arabic long text and totals | Human validation of sensitive scores/calculations; verified formulas and audit trail required |

### Testing examples the screenshot suggests

- Checkout/payment: OTP step stalls; session expiry; safe retry; no duplicate transaction.
- Cart/order math: delivery fee by city included in final total; taxes/currency displayed correctly.
- Localization: long Arabic product names, RTL truncation/wrapping, exported PDF text and badges.
- Story acceptance: order cancellation rules and customer tracking via SMS deep links.

These are **our proposed test categories inferred from visible card titles**, not documented tests or shipped integrations of the depicted application.

## 25.6 Implementation recommendation

**For an existing React + Supabase project:** build this as a **feature pattern**, not as a replacement for our data-grid stack. Prefer existing React/Tailwind/shadcn components; use TanStack Query and current app services if present. Persist issues, transitions and job results on the backend; enforce access using RLS and server-side dispatch. CI/test runners should handle code tests; an AI agent can propose fixes in a separate branch after explicit approval.

Proposed rollout:

1. **Phase A — Board and semantics:** issue data model, kanban/list view, types, priorities, filters, Arabic/RTL, history and permission checks.
2. **Phase B — Safe testing:** attach approved test runners, test results, evidence and actionable failure states; no automatic fixes.
3. **Phase C — AI-assisted fixes:** isolated branch/PR creation, diff preview, budget/rate limits, unit/regression tests, manual merge approval.
4. **Phase D — Interaction polish:** progress indicators, subtle glow for true live jobs, assistant controls, optional animation and keyboard/reduced-motion audit.

### Acceptance checklist

- [ ] All status transitions enforced by backend authorization and logged.
- [ ] Drag and menu changes share one transition API.
- [ ] Test/fix job operations are idempotent and safely cancellable.
- [ ] No automatic merge, destructive edits or deployment without authorization.
- [ ] Issue states and job states cannot contradict the source of truth.
- [ ] AI suggestions distinguish generated hypotheses from confirmed test findings.
- [ ] Actual evidence, logs and links are visible from each test/fix card.
- [ ] Arabic labels and long strings fit without truncation errors.
- [ ] Desktop, mobile list, keyboard and screen-reader flows tested.
- [ ] Retry, failure, timeout, cost and protected-branch cases tested.

## 25.7 Copy-ready coding-agent instruction

```text
Read Section 25 of UI_COMPONENT_REFERENCE_GUIDE.md and inspect the existing codebase, business workflows, issue/test schemas and permission architecture.
Use the user-provided Vibe Board screenshot as a VISUAL/WORKFLOW REFERENCE ONLY. Do not assume the source app's actual capabilities, code, licensing or providers.
Build a readable Kanban/list interface where issue lifecycle and automation-job lifecycle are distinct. Preserve existing data models and permissions. Implement explicit, auditable transitions and expose real job states; never simulate a successful test or code fix.
The Testing lane may request a sandbox test run. The Fixing lane may suggest a patch or create an isolated PR only after the authorized user approves scope. Never merge, edit protected branches or deploy to production automatically.
Use existing React/Tailwind/shadcn and current backend. Make transitions keyboard-accessible, responsive and RTL-safe. Handle status failures, retries, concurrent edits, loading, empty and permission-denied states. Keep animations subtle, meaningful, and reduced-motion compatible.
Before delivering changes, run build/tests, check Arabic overflow and numeric/business-rule correctness, and report modified files, evidence and known limitations. Do not redesign unrelated modules.
```

**Verdict:** `R25-A` is an **approved high-value design and workflow reference** for AI-assisted software QA boards. It is **not** an approved autonomous debugging/deployment solution until a real product, its source/licensing, the execution environment and safety controls are verified independently.

---

# 26. Premium Kanban — Basic vs Upgraded UI Comparison — 2026-10-18

**Reference ID:** `R26-A`  
**Source image:** `visual-references/oct-18-premium-kanban/IMG_2439.png` (provided by user).  
**On-screen attribution:** **Design & Code With AV**, displayed in a social-media reel.  
**Nature of reference:** still-image comparison labelled **“KANBAN UI UPGRADE — HTML | CSS”** with a short partial JavaScript code panel. These screenshots **do not** establish the source code's license, production quality, full accessibility, security, drag behavior or actual persistence. Ignore the phone status bar, creator caption, reactions, video playback UI and other social-media overlays; none belongs to the app design.

**Duplicate note:** a second supplied image `IMG_2438(1).png` is byte-identical (SHA-256) to `IMG_2438.png`, the **Vibe Board** screenshot already catalogued as `R25-A`. It was not added again. Preserve the distinction between the new Premium Kanban *appearance* reference and the prior AI-assisted QA *workflow* concept.

## 26.1 What the screenshot actually shows

| UI element | Basic Kanban (upper panel) | Premium Kanban (lower panel) |
|---|---|---|
| Stages | To Do / In Progress / Done | To Do / In Progress / **Review** / Done |
| Column composition | Flat light-gray lanes and minimally differentiated cards | Individual rounded columns, soft colored lane tints and compact status icons |
| Task card | Title, short date/priority and assignee image | Stronger hierarchy with status accent, task title, avatar, priority/date metadata and compact secondary icons |
| Task progress | Not clearly shown | Several cards visibly show slim progress bars and percentage values |
| Counts/actions | Stage counts and Add Task button | Stage counts, per-column action/more menus, Add Task and compact search |
| Color grammar | Mostly monochrome surfaces with a small number of badges | Lavender To Do, blue In Progress, amber/yellow Review, green Done |
| Drag interaction | Not established by still image | Partial code shows a native `draggable`/`dragstart`/`drop` concept; this is **not** proof of a production-grade accessible drag-and-drop implementation |

**Visible design judgment:** the premium option increases glanceability, but the visual organization—not the colors by themselves—is its main value. It makes the stage boundaries, status, task context and work progress faster to scan. The screenshot is dense and appears reduced inside a vertical phone capture; do not treat it as evidence of an actual mobile layout.

## 26.2 Reusable design system patterns

### Four-lane workflow grammar

- Use an optional **Review** lane when work legitimately needs quality verification/sign-off before Done.
- Do **not** impose Review on systems where a different regulated approval pathway already exists.
- Display lane names, counts, matching status icons, and an explicit empty state.
- Stage color is a subtle background/left-edge cue rather than a full bright panel; typography and labels communicate the same information without color.
- Use tokens such as `--lane-todo`, `--lane-progress`, `--lane-review`, and `--lane-done`; map to the project's own brand and light/dark themes instead of copying exact screenshot hues.

### Progressive task-card information

Recommended visible hierarchy:

1. Task title (two-line clamp only when the full title remains available from accessible card detail).
2. Type / status / priority (consistent order and a readable textual label).
3. Due date and assignee avatar/name.
4. Genuine progress bar for measurable child tasks/checklist completion; label with numerator/denominator or percent derived from source data.
5. Attachment/comment indicator if the underlying records exist.
6. Compact `…` menu for Edit / Assign / Move to / View details / permissible actions.

Do not put all metadata on every card. Apply role/context-based progressive disclosure. Large cards and stale progress bars are worse than a compact honest card.

### Meaningful interaction polish

- Clear draggable affordance and a soft, short drag preview/ghost with visible target lane.
- Highlight *valid* drop targets; communicate invalid moves rather than pretending the drag succeeded.
- Animate reordering subtly, without moving other columns around abruptly or losing scroll/focus position.
- Keep a visible move action for keyboard, switch-control, touch and users who prefer not to drag.
- When updating a status, reconcile server truth; reverse optimistic motion and display actionable feedback if rejected.

## 26.3 Comparison to other saved references

| Source | Best role | What not to assume |
|---|---|---|
| **R23 — Code & Chill dark project board** | Full project-management shell, filters, team/workspace context, My Tasks, board/list modes, settings | No verified data architecture or animations |
| **R25 — Vibe Board** | Product-development QA stages, bug-testing/fixing orchestration idea, AI-assistant entry point | Do not assume genuine autonomous tests/fixes or authorization controls |
| **R26 — Premium Kanban** | Clear, practical visual card/column system; Review stage, progress, priorities, drag affordance | Do not mistake the partial source preview for production-ready code |

**Best synthesis for our own software:** use R23's information architecture; selectively reuse R26's clean, legible Kanban components; use R25's test/fix ideas only in explicitly authorized engineering workflows. The board is a **view over an existing domain state machine**, not a substitute for domain/business rules.

## 26.4 Fit for our projects

| Project | Candidate adaptation | Guardrail |
|---|---|---|
| **CHEIRON Investigation / Action Tracker** | Actions by lifecycle stage; priority, due date, owner, evidence and progress cards | HSE recommendations/close-out approval cannot be overridden by drag; retain the established review/evidence rules |
| **MOC / RFC Tracker** | Status lanes and progress with clear ownership/overdue indicators | Preserve SOC rules, staged approvals, rejected outcomes, comments, and audit history; do not replace approvals with generic Review |
| **Hazarix / AASURIX software-development work** | To Do → In Progress → Review/Testing → Done with bug status and test evidence | Development/QA board must remain distinct from competency or safety-assessment business records |
| **BoostMind / internal project workspaces** | Multi-project filters, task assignments, checklists, compact board/list views | Permission-scoped data, cross-project isolation, honest metrics |
| **Objectives / Finance / regulated workflows** | Kanban as secondary operational summary, if useful | Numeric scoring, official approval, payment and audit workflows remain authoritative |

## 26.5 Recommended engineering contract

- **Data:** explicit `task_id`, `project_id`, `status`, `sort_order`, `priority`, `assignee`, `due_date`, `version` and `updated_at`; maintain separate child checklist progress where relevant.
- **Transitions:** validate allowed `from → to` changes on the server. Use role restrictions and approval gates. A role without approval rights cannot trigger a sign-off by dragging a card.
- **Persistence:** one canonical transition endpoint/RPC used by drag, menu and keyboard controls. Persist ordering within each lane and history with actor/time/reason.
- **Concurrency:** handle stale cards/versions; do not silently overwrite other users' edits. If status writes fail, reset UI to confirmed truth.
- **Drag-and-drop:** use an existing accessible library/implementation where available; avoid copying the screenshot's minimal HTML drag snippet blindly. Touch and keyboard are required, not optional.
- **Responsive:** desktop displays multiple lanes; narrow screens show one lane at a time, a horizontal scroll of usable lanes, or a compact **List** mode with status tabs—never a shrunken desktop board.
- **RTL:** verify Arabic lane sequence, text wrapping, date/number formatting, drag placement and directional icons; keep identifiers legible.
- **Accessibility:** operable without mouse; focus retained after move; live-region success/failure announcements; meaningful labels for progress and priority; contrast on tinted lanes.
- **Performance:** lazy-load card details, paginate or virtualize very large columns, avoid heavy shadows/glows and unnecessary animations, respect `prefers-reduced-motion`.
- **Testing:** verify unauthorized moves, duplicate drop, race conditions, refresh persistence, filters/search, list/board parity, invalid transitions, mobile and Arabic long strings.

### Example status architecture (illustrative, not screenshot source code)

```ts
type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';

type BoardCard = {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  sortOrder: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assigneeId?: string;
  dueDate?: string;
  checklist?: { completed: number; total: number };
  version: number;
};

// Transition API enforces permission, valid state and version on the server.
// Dragging, keyboard 'Move to...', and menus call the same endpoint.
```

## 26.6 Acceptance checklist

- [ ] Screenshot-inspired four-lane layout is legible with text status labels and sensible color tokens.
- [ ] Review lane appears only if the actual workflow supports it.
- [ ] Drag-and-drop works with pointer/touch and has a full keyboard/menu equivalent.
- [ ] Move/reorder persists after reload and is auditable; server checks every transition.
- [ ] Card titles, priority, due dates, owners and progress are backed by real records.
- [ ] Layout works on mobile without scaling the whole desktop board down.
- [ ] Empty, loading, unauthorized, validation-error and concurrent-edit states are covered.
- [ ] Existing HSE, financial or MOC approval and scoring rules remain unchanged.
- [ ] High contrast, RTL, reduced-motion and focus tests pass.
- [ ] No third-party screenshot design/code/assets are directly reused without checking rights.

## 26.7 Copy-ready prompt for Codex / Claude Code

```text
Read UI_COMPONENT_REFERENCE_GUIDE.md Sections 23, 25 and 26, and inspect the current React/backend project first.
Treat the user-supplied Premium Kanban basic-vs-premium screenshot (R26-A) as UI/UX inspiration only, not a verified source-code template or licensed component.
Improve the existing Kanban's lane clarity, compact status colors, counts, task-card hierarchy, real progress indicators, avatar/priority/date metadata and drag feedback. Add a Review lane ONLY when the project's actual state machine calls for review.
Preserve the existing design system, task data, filters, role permissions, server-side transitions, audit logs and business-specific approval gates. Use one canonical backend transition path for drag and Move-to menus. Provide keyboard and touch alternatives, a mobile-friendly one-lane/list option, RTL support and reduced-motion handling.
Do not silently add automated tests/fixes, AI agents, deployments or approval side effects simply because the other Vibe Board reference (R25-A) illustrates them. The Vibe Board screenshot is a separate workflow concept with unverified implementation.
Implement only the agreed UI improvements, avoid unrelated redesign, run project builds/tests and report exact changed files and regression results.
```

**Verdict:** `R26-A` is an **approved visual/reference pattern** for a readable premium Kanban component system. It complements, but does not replace, the earlier Vibe Board AI/QA concept or domain-specific workflow controls.

---

# 27. Premium Mega Menu — Basic vs Upgraded Navigation Reference — 2026-10-18

**Reference ID:** `R27-A`  
**Supplied screenshot:** `IMG_2442.png`  
**Suggested archive path:** `visual-references/oct-18-mega-menu/IMG_2442.png`  
**Screenshot attribution:** social-video screenshot showing **Design & Code With AV / Giulio Cercato — Level Up**. The lower portion includes social-media overlays and partial HTML/CSS/JS snippets; those overlays are **not** part of the menu design.  
**Confidence:** verified **visual reference only**; no full source code, component package, runtime behavior, accessibility implementation, or reuse license has been verified.

## 27.1 What is visibly different

| Aspect | Basic Mega Menu (upper example) | Premium Mega Menu (lower example) |
|---|---|---|
| Navigation | Home, Products, Services, About | Home, Products, Collections, Offers; a small `NEW` label appears beside Offers |
| Active state | Products highlighted | Products highlighted with more distinct underline/active treatment |
| Container | Simple white dropdown with three columns | Wider framed surface with multiple content regions and separation |
| Grouping | Men / Women / Accessories text headings | Category headings combined with soft colored icons, subitems and `View All` |
| Promotional content | None | Left promotional collection tile with purple CTA and product illustration |
| Discovery/shortcuts | Category links only | Right-hand `Special For You` shortcuts (e.g. new arrivals, best sellers, sale) |
| Visual hierarchy | Mainly equal-weight links | Promotional hierarchy + clear category scan paths + concise short-list actions |
| Palette | White background, blue-purple accent | White surface, lavender/pastel accents, subtle column dividers, compact badges |

**Important:** the screenshot is from an ecommerce example. `Summer Vibes 2024`, product categories, new-arrival labels, and sale messages are **sample visual content**. Do not introduce them to our products as if they were current data.

## 27.2 Design patterns to reuse, without copying the storefront

1. **Navigation is a discoverable map, not just a list.** Show the main product/service families at a glance; use short labels and avoid duplicate routes.
2. **One featured tile, optional.** A small, targeted feature announcement can live at left (new capability, case study, learning resource, product launch); do not force marketing into internal administrative tools.
3. **Category columns with helpful icons.** Use compact semantic icons and dividers; maintain consistent click targets and one `View All` destination per group.
4. **Contextual quick links.** The right panel can offer relevant tasks such as `Getting started`, `Documentation`, `New releases`, or `Popular resources`. Do not label them `Personalized` unless preferences actually inform them.
5. **Restrained visual emphasis.** Subtle tints, hover/focus transitions, and limited `NEW`/`HOT` badges; do not make every link a visual call to action.
6. **Direct navigation must remain straightforward.** Every parent item needs a well-defined click behavior. Do not rely on hover alone.

## 27.3 Where this works best in our projects

| Project | Use the pattern for | Avoid / do not change |
|---|---|---|
| **BoostMind / Technica consulting website** | Services, Solutions, Industries, Learning, Case Studies, contact-oriented featured resources | Overstuffed menus, repetitive promo cards, hidden main CTA |
| **Flying Screens website** | Solutions, campaign options, partnerships, HOW IT WORKS; highlighted `Start Campaign` flow | Putting admin tasks inside public nav or burying campaign pricing/options |
| **KIKO / church project website** | Missions, service groups, monthly activities and public content discovery with lively featured tile | Revealing private scoring, confidential evaluations or admin-only controls |
| **E-learning platform** | Courses by track, learning paths, resources, certification areas | Unlicensed course imagery, overloaded mobile navigation |
| **CHEIRON / MOC / AASURIX enterprise apps** | Only a small global module switcher or a lightweight help/resources panel where it improves discoverability | Replacing task-oriented side navigation with a huge sales-style mega menu; changing role/security visibility |

**Default:** use the mega menu mainly on public/marketing or content-heavy websites. Existing enterprise sidebars/tree navigation remain preferable for repetitive authenticated workflows.

## 27.4 Interaction and layout contract

### Desktop

- Use one controllable open state (`openMenuId`) for the top-level navigation.
- Support pointer hover as a convenience **and** click to toggle; do not trap touch-device users in hover-only behavior.
- Maintain a safe pointer path between trigger and dropdown (no unexpected close while crossing small gaps). Consider delayed pointer-leave close; close when the pointer actually exits the combined region.
- Keyboard: `Tab` reaches top-level triggers and submenu links; `Enter`/`Space` toggles the relevant submenu; `Escape` closes and restores focus to its trigger.
- Use `aria-expanded`, `aria-controls`, suitable descriptive labels, and `aria-current="page"` for current destinations.
- Prefer native `<nav>`, `<button>` and `<a>` semantics. **Do not** blindly use `role="menu"` / `menuitem` for a site navigation group unless implementing the full application-menu keyboard pattern.
- Close on outside click, route navigation and appropriate focus departure, while avoiding premature close during submenu keyboard travel.
- Put visual content in a stable anchored panel; position within viewport and handle zoom up to 200% without clipping critical links.

### Mobile and tablet

- Convert mega menu into a dedicated **drawer/accordion** with clear categories and back/close navigation; never scale a five-column dropdown down to phone width.
- Prefer one accordion open per level if content is long; preserve direct navigation to category landing pages.
- Ensure usable ~44px touch targets, sensible scroll locking, visible focus, and no horizontal viewport overflow.
- Disable hover-only decorative dependencies; ensure the featured tile does not push critical destinations below long scroll unnecessarily.

### RTL, accessibility and performance

- Explicitly test Arabic label lengths, logical `start/end` spacing, columns order, arrow direction and dropdown alignment.
- Meet WCAG AA text contrast; verify tiny badge labels and muted links independently.
- Respect `prefers-reduced-motion`; animate opacity/transform only where beneficial rather than animating panel layout heights continuously.
- Use responsive images with dimensions/alt text and lazy-loading where appropriate; guard against cumulative layout shift.
- Search engines and assistive technologies must still have normal discoverable links, not content only constructed by decorative scripts.

## 27.5 Data and security rules

- Drive menu structure from a typed configuration or CMS data; separate **label**, **route**, **icon**, **badge**, **permission** and **featured** content.
- Validate internal hrefs against the site's route registry and external destinations against safe link policy.
- For authenticated products, filter unauthorized destinations server-side as appropriate; UI hiding alone is never authorization.
- Personalize quick links only when there is actual user context and consent; otherwise use neutral labels such as `Featured` or `Popular`.
- Avoid blindly copying `NEW` and `SALE` tags; they require current data and expiration rules.
- Avoid importing complete ecommerce mega-menu packages into existing apps solely for aesthetic changes; reuse the project navigation primitives if possible.

## 27.6 Framework-neutral component blueprint

```ts
export type SiteNavLink = {
  id: string;
  title: string;
  href: string;
  icon?: string;
  badge?: { label: string; expiresAt?: string };
  description?: string;
};

export type MegaMenuSection = {
  id: string;
  title: string;
  links: SiteNavLink[];
  allHref?: string;
};

export type MegaMenuModel = {
  id: string;
  label: string;
  landingHref?: string;
  sections: MegaMenuSection[];
  featured?: { title: string; detail?: string; href: string; imageUrl?: string };
  quickLinks?: SiteNavLink[];
};
```

Implement as **existing nav + optional mega panel**, not as a new application-wide dependency by default. Use a desktop CSS grid whose columns depend on available content, with featured/quick-link regions optional and a mobile accordion using the same typed data.

## 27.7 Acceptance checklist

- [ ] Primary nav works with mouse, keyboard and touch.
- [ ] Trigger and submenu share a safe hover/focus boundary.
- [ ] Escape closes and restores keyboard focus appropriately; click-outside behaves predictably.
- [ ] Every `View All`, category link, promotion and CTA resolves to a real destination.
- [ ] Phone navigation is an accordion/drawer, not a scaled desktop popover.
- [ ] Current route and active item are clearly marked; badges have an actual meaning.
- [ ] Brand colors and typography come from project tokens, not the purple ecommerce demo by default.
- [ ] AR/EN RTL, zoom, reduced motion, empty groups, long links and screen readers are tested.
- [ ] Permission-based navigation does not reveal admin-only destinations to unauthorized users.
- [ ] No reference-only images, product names or copied code are shipped without rights review.

## 27.8 Copy-ready instruction for a coding agent

```text
Read UI_COMPONENT_REFERENCE_GUIDE.md Section 27 and inspect the current project's navigation implementation first.
The user supplied screenshot R27-A compares a Basic Mega Menu with a Premium Mega Menu.
Borrow the stronger navigation hierarchy: structured category columns, optional featured card,
scannable quick links, semantic icons, contextually meaningful labels, active/hover/focus styles,
and optional lightweight badges. Do not copy the ecommerce brand, copy, images or code.
Maintain existing brand tokens, routes, permissions, desktop header layout and business logic.
Only add a mega menu where site content requires it; keep task-based enterprise side navigation.
Support click and hover on desktop, keyboard navigation and Escape-to-close, a robust hover boundary,
mobile drawer/accordion, RTL, reduced motion, contrast, semantic navigation, and accessible focus states.
Use a typed menu data model; do not invent routes, promotions, products or access privileges.
Make targeted changes, run production build and UI checks, and report changed files and tests.
```

**Verdict:** `R27-A` is an **approved visual/navigation pattern** for premium multi-category public websites. It complements the tree-navigation reference (Section 23) for hierarchical in-app files, but should **not** replace the app-specific navigation architecture automatically.



---

# 28. Official Source Watch — 2026-10-20

**Scope:** this section records verified official-source changes since the 2026-10-18 visual-reference consolidation. It **supplements** the historical version notes above rather than silently rewriting earlier snapshots. A release or merged change is not an instruction to upgrade production apps. Date is the publication date shown by the official source (UTC unless otherwise indicated).

## 28.1 Actionable release changes

| Project | Verified version/date | What changed | Decision / validation |
|---|---|---|---|
| **Remotion** | `v4.0.537`, 2026-10-19 | New procedural and projection effects (`cylinder`, `sphere`, `pageTurn`, `fractalNoise`, `turbulentDisplace`, `lensBlur`, `bevelAlpha`); `parseVtt()`; `HtmlInCanvas` flicker/nested crash fixes; render server binds to localhost by default; Lambda deployment rejects directory symlinks; official skills add Arabic/RTL text guidance. | **Candidate for tested upgrade.** Test actual Arabic shaping, mixed-direction numbers, VTT timing, effect performance, `HtmlInCanvas` composition and remote-render network assumptions. |
| **HyperFrames** | `v0.8.181`, 2026-10-20 | Fixes stalled/timed-out long phone-video exports; accelerates true-peak audio analysis. The intervening `0.8.180` adds chunk subranges and fixes intermittent empty frames on multiworker renders; `0.8.179` supports Lambda deploy from an npm install and downloads only needed audio slices per chunk; `0.8.177` fixes transcription of French, Spanish and other non-English audio. | **Candidate for render-pipeline regression tests.** Verify fixed-frame counts, seek accuracy, audio peaks, captions, distributed chunk joins, cloud permissions, AWS stack versions and provider costs. |
| **shadcn/ui CLI** | `shadcn@4.22.1`, 2026-10-18 | `add --all` and the picker now limit components to the project's style. **Compatibility note:** `4.22.0` upgrades registry/schema exports to **Zod 4**, breaking some Zod 3 consumers. | **Hold automatic CLI/registry upgrades** if project tooling imports `shadcn/schema` or `@shadcn/registry/schema`; check `z.infer`/`z.array` usage and `ZodError.issues`. Normal UI components need not be rewritten. |

**Official source links:**

- Remotion release: https://github.com/remotion-dev/remotion/releases/tag/v4.0.537
- Remotion AI/skills docs (updated 2026-10-19): https://www.remotion.dev/docs/ai ; official Codex/Claude agent entry points are linked there.
- HyperFrames releases: https://github.com/heygen-com/hyperframes/releases/tag/v0.8.181 ; https://github.com/heygen-com/hyperframes/releases/tag/v0.8.180 ; https://github.com/heygen-com/hyperframes/releases/tag/v0.8.179 ; https://github.com/heygen-com/hyperframes/releases/tag/v0.8.177
- shadcn CLI releases: https://github.com/shadcn-ui/ui/releases/tag/shadcn%404.22.1 ; https://github.com/shadcn-ui/ui/releases/tag/shadcn%404.22.0

### Why the new Remotion effects matter to the reference pipeline

The new official `@remotion/effects` operators can replace one-off shader/CSS tricks for **page turns, projected UI cards, spherical/cylindrical product visuals, depth-of-field-like defocus and procedural texture**. Use them only after checking output quality, GPU/CPU render time, transparent edges, flicker and deterministic seek behavior. They are **not a substitute for a genuine TRELLIS.2 GLB** when the output must remain an editable 3D mesh with PBR materials. For Arabic videos, the new skill guidance is a welcome reference, **not proof** that every font, mixed LTR/RTL caption or export is correct: inspect rendered frames and subtitles.

### Security/runtime guardrails for new Remotion/HyperFrames releases

1. Remotion now defaults its render server to **localhost**. Do not bypass this default just to restore remote access: configure intentional authenticated proxy/network boundaries and verify rendering architecture before migration.
2. Remotion's Lambda deploy symlink rejection is a useful hardening signal, but it does not remove the need to inspect project asset paths, third-party agent skills and supply-chain dependencies.
3. HyperFrames' Lambda-from-npm convenience does not make cloud deployment automatically safe: use reviewed IAM policies, spending caps, pinned CLI/Chrome, clean media rights and staging renders.
4. Confirm caption direction, line wrapping, voice timing and Unicode on actual Arabic/French/English source media; prefer visual frame review over passing CLI checks alone.
5. The Remotion changelog's change to licensing *wording/branding* is **not sufficient evidence of a changed license price or entitlement**. Verify the official pricing/terms for each production use before purchase or deployment: https://www.remotion.dev/license

## 28.2 OpenMontage — official repo, pending PRs and governance

**Canonical source:** https://github.com/calesthio/OpenMontage ; **license:** AGPL-3.0; **official GitHub Releases:** none as of this review. A repository-commits API query with `since=2026-10-18T00:00:00Z` returned no new mainline commits at review time. Open PRs are **proposals and known-risk indicators**, not installed features.

| Open PR / checked status | What it signals | Production gate |
|---|---|---|
| [#820 — RTL captions](https://github.com/calesthio/OpenMontage/pull/820), open 2026-10-19 | Current inline-block word layout can reverse Arabic/Hebrew/Persian/Urdu word order and karaoke highlighting. PR proposes explicit `ltr/rtl/auto` direction. | Until merged and tested, validate bidi text with Arabic captions, mixed brand names and RTL highlighting; apply an independently reviewed patch only if needed. |
| [#769 — proposal checkpoint approval](https://github.com/calesthio/OpenMontage/pull/769), open | Pending proposals may be marked complete before human approval; PR proposes stricter state/runtime validation. | Block paid/provider operations and completion until server-side approval and render runtime are verified. |
| [#395 — approval profiles](https://github.com/calesthio/OpenMontage/pull/395), open | Optional per-project checkpoint profiles; proposed preview-before-paid-avatar approval gate. Large change surface (177 files reported at check). | Do not rely on this policy before merge, tests and audit; independently enforce budget approval. |
| [#556 — Remotion caption burn](https://github.com/calesthio/OpenMontage/pull/556), open | Proposed fix for `staticFile()` repeated `public/` path and collapsed inter-word spacing. | Render-test word captions end to end; fail QA on missing captions or joined words. |
| [#554 — video trimmer](https://github.com/calesthio/OpenMontage/pull/554), open | Proposed fix for incorrect FFmpeg `-ss`/`-to` usage, wrong source ranges and non-zero clip timestamps. | Frame-check trim start/end, duration and caption alignment; don't trust exit code alone. |

**Governance & safety rule:** keep OpenMontage in a separate, audited worker or project; never grant its setup scripts, skills, video-source adapters or provider tools unrestricted access to credentials, production DBs, customer media or publishing accounts. Pin the canonical repository SHA and record a software bill of materials where possible. Treat AGPL network-use/source obligations as a legal review item for any proprietary integration. Do not equate permission to use a *generated video* with permission to redistribute source footage, voices, models or proprietary sample assets. Require human approval before paid generation, upload/publish, asset deletion, provider switching or automatic code edits. The project's stated Codex support (`CODEX.md`/`AGENT_GUIDE.md`) is a compatibility claim, not a security certification.

## 28.3 TRELLIS / TRELLIS.2 — no verified quality or license transition

- Checked the official Microsoft sources and recent repository activity. **No newly verified release, independent image-to-3D quality benchmark, model-card licensing change or inference-hardware reduction** is promoted by this watch. Keep Section 3.8 authoritative until a specific official artifact proves otherwise.
- **Current selection remains:** original TRELLIS for legacy Gaussian/radiance-field or text-to-image-assisted workflows; TRELLIS.2 for candidate textured mesh/GLB with PBR material channels (base color, metallic, roughness, alpha). Output quality is object-dependent; inspect mesh topology, UVs, alpha behavior, holes, shading and real render results rather than relying on gallery images.
- **Hardware:** controlled Linux/NVIDIA GPU worker with the previously documented **24GB VRAM minimum guidance** for TRELLIS.2; test CUDA/toolchain, BF16 support, throughput and peak memory on the exact GPU. Do not run inference in Cloudflare Pages or ordinary client browsers.
- **Licensing/safety:** the repo/model-card MIT statements do not automatically cover NVIDIA `nvdiffrast`/`nvdiffrec`, third-party example media, user-provided source images, or every downstream export. Review individual licenses and terms, plus PBR/GLB export rights, before commercial asset use. Unreviewed demo Spaces and setup scripts are untrusted for confidential images.
- Official source: https://github.com/microsoft/TRELLIS ; https://github.com/microsoft/TRELLIS.2 ; https://huggingface.co/microsoft/TRELLIS.2-4B ; https://huggingface.co/spaces/microsoft/TRELLIS.2

## 28.4 Remaining watchlist and deployment decisions

**Verified release checks with no newer mainline version replacing the previous snapshot:** TanStack Table `9.3.1` (2026-10-12), Handsontable `18.1.2` (2026-10-07), MUI X `9.15.0` (2026-10-06), AG Grid `36.2.0` (2026-09-16), TradingView Lightweight Charts `5.2.1` (2026-08-12). MUI X also maintains a separate v8 patch line; do not mistake its newer publication date for a v9 replacement. Video Shotcraft's latest GitHub Release is a media-showcase tag, not a new version of its curated 124-recipe/150-shot collection. Lemo Opuscar's 43-core-style/98-showcase distinction remains intact.

**Other monitored reference families:** ThreeUI, DashboardCN, Tremor, Untitled UI, Bencho, Code and Chill/Coterie, A.S Claude Motion Kit, Motion Skills, Animation Principles, Manim Skill, ClaudeAnimationBase, claude-animation-skill, the code-video prompt/full-project indexes, and Kitchen. No *independently verified, adoption-changing* release was established for these in this check; that is **not** a claim of zero repository activity. Keep their original curated rules and re-check official terms before code reuse.

**Project implementation decision:** no automatic changes to CHEIRON, BoostMind, AASURIX, MOC/RFC, Flying Screens or other live projects. Prioritize (a) Remotion Arabic/RTL caption and effects proof-of-concept, (b) HyperFrames 0.8.181 render benchmark with long iPhone footage and distributed chunks, (c) shadcn/Zod 4 compatibility check where registry tooling is imported, and (d) OpenMontage's open correctness/approval issues before considering commercial adoption. Preserve existing business logic, permissions, audit trails, performance budgets and source-of-truth data.

**Provenance & confidence:** version/date and listed change notes are from official GitHub release records or official documentation; OpenMontage PRs are explicitly **open/unmerged at check time**. Unverified third-party skill repositories, shell scripts and asset/model downloaders are **not trusted** by being included in this guide. This review is a source/documentation audit, not a claim that any library was installed, run or independently benchmarked.

## 29. React Big Schedule — calendar and resource scheduler (2026-10-21)

**Official project:** https://react-big-schedule.ansulagrawal.com/ ; source, releases, security policy and MIT license are linked from its official site. **Discovery:** https://www.wishlink.com/share/6v3mh5?source=fb (redirects to the official site); broader creator list: https://www.wishlink.com/ansulagrawal/post/9987473?utm_source=fb (does not expose a reliable complete product inventory in the page text).

**Current documented baseline:** v9, TypeScript-first and no required UI component library. Offers Calendar month/week/day/list/year views, Scheduler resource timeline and vertical resources, event drag/resize, RRULE recurrence, IANA time zones, asynchronous event feeds with cancellation, CSS-variable themes, and print styles. The core including resource timelines is stated to be MIT-licensed; exports, undo/redo and conflict/availability engines are listed as Pro features or forthcoming, so verify actual availability and pricing before committing.

**Adoption decision:** candidate for planning/training, equipment and personnel allocation, meeting/event scheduling in React applications; not an automatic replacement for existing calendar components. Prototype with actual dataset and permissions before production.

**Quality gates:** benchmark event density (10,000 events/day virtualization is planned, not shipped); manually audit keyboard/screen-reader behavior (NVDA/JAWS/VoiceOver audit is planned); test RTL/Arabic layout, week start and locales; mobile touch/long-press and competing scrolling; time-zone/DST boundaries; recurrence exceptions; drag/drop authorization, persistence and conflict handling; accessible print; bundle impact and dependency security. Do not assume roadmap items ship in free core.

**Changelog — 2026-10-21:** Added React Big Schedule to curated React calendar/scheduler candidates based on official v9 product documentation. Preserved all prior sections and rules; no application code changed.

---

## 30. Workspace Booking — Premium Mobile UI visual reference (2026-10-24)

**Source:** Three user-provided mobile UI reference images (nine screens total): `IMG_2496.jpeg`, `IMG_2495.jpeg`, `IMG_2494.jpeg`. Visual inspiration, not a verified reusable code library. Keep originals with the project visual-reference archive.

**Patterns:** light surfaces with restrained violet gradients, rounded content cards, soft shadows, compact image-first listings, category chips, fixed four-item mobile bottom navigation, personal greeting and search, profile header with compact KPIs, semantic notification icon colors, booking/payment summaries and strong single primary CTA. Screens: Home, Browse, Detail, Favorites, Profile, Notifications, Booking Confirmation, Payment Method, My Bookings.

**Reuse guidelines:** Apply visual hierarchy and spacing selectively to CHEIRON dashboards, observations, role-specific user profile and notifications, without replacing approved layouts or changing production behavior. Keep real data and permissions, mobile safe-area padding, large tap targets, keyboard navigation, semantic statuses, RTL/Arabic mirroring, reduced-motion fallback and contrast. Avoid copying brand imagery or assuming UI screenshots convey licensing rights.

## 31. Skiper UI, Vengeance UI, Animaster Lib — motion/component discovery (2026-10-24)

- **Skiper UI:** https://skiper-ui.com/ — animated component candidate for React interfaces. Review each component's source, package dependencies, attribution/commercial terms and motion accessibility individually; no blanket license assumption.
- **Vengeance UI:** https://www.vengenceui.com/components — React animation/visual component candidate. Check the exact repository/component license and current install guidance before reuse; useful inspiration includes interactive layouts, text motion, 3D/glass-like treatments and animated cards.
- **Animaster Lib:** name observed in user-provided screenshot, **official source not independently identified**. Do not install similarly named packages or execute scripts until exact canonical repository, maintainer, license and security posture are verified.

**Adoption:** Reference-only, not automatic code installation. Prefer selective micro-interactions (numbers, toasts, tab transitions) over animation-heavy whole-page redesigns. Test bundle size, hydration, GPU cost, low-end phones, keyboard, screen readers, `prefers-reduced-motion`, RTL and contrast.

## 32. Open Generative AI — AI media studio / model-provider gateway (2026-10-24)

**Official repository:** https://github.com/Anil-matcha/Open-Generative-AI  
**README:** https://github.com/Anil-matcha/Open-Generative-AI/blob/main/README.md  
**Releases:** https://github.com/Anil-matcha/Open-Generative-AI/releases  
**Issues:** https://github.com/Anil-matcha/Open-Generative-AI/issues

**Verified snapshot:** package declares v2.0.0 and MIT license; latest tagged v2.0.0 release (May 23, 2026) introduces Audio Studio, Vibe Motion, Clipping, Design Agent, language switcher, MCP/CLI playground and local model storage selection. The README advertises a multi-studio image/video/audio/lip-sync interface with numerous remote models via Muapi, plus selected local inference and Wan2GP integration. The advertised model count varies across README sections; do not treat it as a validated number of independently runnable local models.

**Role in production pipeline:** generate rough concepts and approved stills/keyframes; use OpenMontage for storyboard, approval gates and governance, and Remotion/HyperFrames/FFmpeg for deterministic compositing and renders. Do not substitute model output for approved footage, rights checks or human quality review.

**Risk gates:** MIT code does not license third-party model weights, training data, inputs, audio, images or generated output. Remote Muapi/API calls may incur charges and transmit content; self-hosted UI does **not** imply all generation stays local. Check current provider terms, commercial rights, privacy and per-generation billing. Audit secrets/key handling and storage; do not place privileged production keys in frontend or Electron renderer. Desktop installers may be unsigned; do not disable OS protections as a routine setup step. Inspect repository security issues before adoption, notably open report #309 alleging DOM XSS from unsanitized stored history; an open issue is not proof of exploitability or fix status. Test Windows/Linux GPU and runtime requirements per model; never promise a universal minimum VRAM. Treat downloaded models, community skills, scripts and binary installers as untrusted pending review.

**Decision:** high-priority *research candidate*, not production-approved. Keep separate from deterministic code-video tools and evaluate local-versus-provider costs and data protection before any pilot.

### Changelog — 2026-10-24

- Added §30: nine-screen Workspace Booking premium mobile UI reference and selective reuse/RTL/accessibility rules.
- Added §31: Skiper UI and Vengeance UI discovery plus unverified Animaster Lib identity; no unreviewed install scripts.
- Added §32: Open Generative AI official repository, v2.0.0 release, provider/local architecture, licensing and security gates, including open issue #309.
- Preserved sections 1–29 and all historical guidance; no live application code or Supabase data changed.