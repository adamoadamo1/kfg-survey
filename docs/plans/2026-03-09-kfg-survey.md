# KFG Conversational Positioning Survey — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a conversational survey web app that guides KFG stakeholders through 5 AI-facilitated positioning questions, distills structured insights, and writes results to Google Sheets.

**Architecture:** Single HTML file frontend (vanilla JS, no framework, no build step) + two Vercel Edge Functions for API proxying via OpenRouter (streaming chat + non-streaming distill) + Google Apps Script for Sheets persistence. All conversation logic, state management, and prompt assembly runs client-side.

**Tech Stack:** Vanilla HTML/CSS/JS, OpenRouter API (Claude Sonnet 4, OpenAI-compatible streaming), Vercel Edge Functions, Google Apps Script, Google Sheets

**Design Style:** Serif editorial — Playfair Display headlines, Source Sans 3 body, ivory backgrounds (#FAFAF8), burnished gold accent (#B8860B), warm monochrome palette, rule lines, small caps labels, generous whitespace.

---

## Critical Context: API Provider

**OpenRouter** (not Anthropic direct). This affects edge functions and client-side SSE parsing:

- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`
- **Auth header:** `Authorization: Bearer $OPENROUTER_API_KEY`
- **Body format:** OpenAI-compatible (`model`, `messages`, `max_tokens`, `temperature`, `stream`)
- **Model ID:** `anthropic/claude-sonnet-4`
- **System prompt:** Sent as first message with `role: "system"` (OpenAI format), NOT as a top-level `system` field
- **Streaming format:** OpenAI SSE — `data: {"choices":[{"delta":{"content":"token"}}]}`, end signal is `data: [DONE]`
- **Non-streaming format:** `choices[0].message.content` (not `content[0].text`)
- **Env var:** `OPENROUTER_API_KEY` (not `ANTHROPIC_API_KEY`)

## Critical Context: Design System

Merging the PRD's KFG-specific design (green #3E503C for user bubbles, cream backgrounds, editorial warmth) with the Serif design style system. Key mappings:

| PRD Token | Serif Style Value | Notes |
|-----------|------------------|-------|
| `--cream` (page bg) | `#FAFAF8` (ivory) | Warmer, more refined |
| `--cream-dark` | `#F5F3F0` (muted) | Secondary surfaces |
| `--white` | `#FFFFFF` | Cards, AI bubbles |
| `--ink` | `#1A1A1A` | Rich black, same |
| `--ink-soft` | `#444444` | Body text (keep PRD value for readability) |
| `--ink-muted` | `#6B6B6B` | Warm gray labels |
| `--green` | `#3E503C` | Keep for user bubbles (KFG brand) |
| `--green-light` | `#4A6347` | Hover states |
| `--green-pale` | `#F0F4EF` | Subtle green bgs |
| `--gold` | `#B8860B` | Burnished gold (Serif style accent) |
| `--gold-pale` | `#FAF6F1` | Warm gold backgrounds |
| `--border` | `#E8E4DF` | Warm gray (Serif style) |
| `--serif` | `'Playfair Display', Georgia, serif` | Editorial headlines |
| `--sans` | `'Source Sans 3', system-ui, sans-serif` | Clean body text |
| `--mono` | `'IBM Plex Mono', monospace` | Small caps labels |

**Google Fonts import:** Playfair Display (400, 600, 700) + Source Sans 3 (300, 400, 500, 600) + IBM Plex Mono (400, 500)

**Serif style elements to incorporate:**
- Rule lines (1px warm gray) as section dividers
- Small caps labels (IBM Plex Mono, 12px, tracking 0.15em, uppercase) for "YOUR NAME", "YOUR ROLE", progress labels
- Generous whitespace (larger padding than PRD spec)
- Paper texture overlay (subtle noise at 30% opacity) on page background
- Ambient glow (large blurred accent circle at 2% opacity)
- Cards with optional top accent border (2px gold)
- No aggressive animations — refined 200ms ease-out transitions
- Button hover: subtle lift (-translate-y-0.5) on primary, underline on ghost

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vercel.json`

**Step 1: Create package.json**

```json
{
  "name": "kfg-survey",
  "version": "1.0.0",
  "private": true
}
```

**Step 2: Create vercel.json**

```json
{
  "routes": [
    { "src": "/api/chat", "dest": "/api/chat.js" },
    { "src": "/api/distill", "dest": "/api/distill.js" },
    { "src": "/(.*)", "dest": "/index.html" }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "POST, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type" }
      ]
    }
  ]
}
```

**Step 3: Commit**

```bash
git init
git add package.json vercel.json
git commit -m "chore: scaffold project with package.json and vercel.json"
```

---

## Task 2: Streaming Chat Proxy — api/chat.js (OpenRouter)

**Files:**
- Create: `api/chat.js`

**Step 1: Write the edge function**

```javascript
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.json();

  // Build messages array: system prompt as first message (OpenAI format)
  const messages = [];
  if (body.system) {
    messages.push({ role: 'system', content: body.system });
  }
  messages.push(...body.messages);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': req.headers.get('origin') || 'https://kfg-survey.vercel.app',
      'X-Title': 'KFG Positioning Survey',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      max_tokens: body.max_tokens || 300,
      temperature: body.temperature || 0.7,
      messages: messages,
      stream: true,
    }),
  });

  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
```

**Key differences from Anthropic direct:**
- OpenAI-compatible endpoint and auth
- System prompt goes in messages array as `role: "system"`, not top-level `system` field
- OpenRouter requires `HTTP-Referer` and `X-Title` headers
- Streaming format is OpenAI SSE (parsed differently client-side)

**Step 2: Commit**

```bash
git add api/chat.js
git commit -m "feat: add streaming chat proxy via OpenRouter"
```

---

## Task 3: Non-Streaming Distill Proxy — api/distill.js (OpenRouter)

**Files:**
- Create: `api/distill.js`

**Step 1: Write the edge function**

```javascript
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.json();

  const messages = [];
  if (body.system) {
    messages.push({ role: 'system', content: body.system });
  }
  messages.push(...body.messages);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': req.headers.get('origin') || 'https://kfg-survey.vercel.app',
      'X-Title': 'KFG Positioning Survey',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      max_tokens: body.max_tokens || 500,
      temperature: 0.3,
      messages: messages,
      stream: false,
    }),
  });

  const data = await response.json();

  // Extract the content from OpenAI format and return it simply
  const content = data.choices?.[0]?.message?.content || '';

  return new Response(JSON.stringify({ content }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
```

**Key difference:** Response extracts `choices[0].message.content` (OpenAI format) and returns it as `{ content }` so the client doesn't need to know about OpenRouter's response shape.

**Step 2: Commit**

```bash
git add api/distill.js
git commit -m "feat: add non-streaming distill proxy via OpenRouter"
```

---

## Task 4: Google Apps Script

**Files:**
- Create: `scripts/google-apps-script.js`

**Step 1: Copy the Apps Script exactly from PRD Appendix C**

The script handles two POST types:
- `type: "response"` → appends row to "Responses" tab (columns A-X)
- `type: "transcript"` → appends row to "Transcripts" tab (columns A-G)
- `doGet` returns a health check JSON

Copy the full script from PRD Appendix C verbatim.

**Step 2: Commit**

```bash
git add scripts/google-apps-script.js
git commit -m "feat: add Google Apps Script for Sheets integration"
```

---

## Task 5: Complete Frontend — index.html

This is the main build task. The entire frontend — HTML, CSS, and JS — lives in one file.

**Files:**
- Create: `index.html`

**Step 1: Build the complete index.html**

### Structure Overview

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Meta, fonts, title -->
</head>
<body>
  <style>/* All CSS */</style>
  <!-- All HTML screens -->
  <script>/* All JS */</script>
</body>
</html>
```

### CSS Requirements (in order)

1. **Google Fonts import:** Playfair Display (400;600;700), Source Sans 3 (300;400;500;600), IBM Plex Mono (400;500)

2. **CSS Custom Properties (`:root`):**
   ```css
   --bg: #FAFAF8;
   --bg-muted: #F5F3F0;
   --white: #FFFFFF;
   --ink: #1A1A1A;
   --ink-soft: #444444;
   --ink-muted: #6B6B6B;
   --green: #3E503C;
   --green-light: #4A6347;
   --green-pale: #F0F4EF;
   --gold: #B8860B;
   --gold-secondary: #D4A84B;
   --gold-pale: #FAF6F1;
   --border: #E8E4DF;
   --error: #DC2626;
   --error-bg: #FEF2F2;
   --serif: 'Playfair Display', Georgia, serif;
   --sans: 'Source Sans 3', system-ui, sans-serif;
   --mono: 'IBM Plex Mono', monospace;
   ```

3. **Global resets:** box-sizing border-box, margin/padding 0, `background: var(--bg)`, `color: var(--ink)`, `font-family: var(--sans)`, `font-size: 16px`, `line-height: 1.75`

4. **Paper texture overlay:** `body::before` with a CSS noise pattern or very subtle grain, `opacity: 0.03`, `pointer-events: none`, fixed position covering viewport

5. **Layout:**
   - `.app-container`: max-width 640px, margin 0 auto, min-height 100dvh, display flex, flex-direction column, padding 0 32px (24px on mobile)
   - `header`: padding-top 32px, flex-shrink 0
   - `main`: flex 1, overflow-y auto, padding-bottom 100px (room for fixed bottom elements)

6. **Header:**
   - Label: font-family var(--mono), 12px, weight 500, tracking 0.15em, uppercase, color var(--gold) — small caps style
   - Title: font-family var(--serif), 22px, weight 400, color var(--ink), margin-top 4px

7. **Progress bar:**
   - Container: height 3px, background var(--bg-muted), border-radius 2px, margin-top 20px, overflow hidden
   - Fill: height 100%, background var(--gold), border-radius 2px, transition width 500ms cubic-bezier(0.22, 1, 0.36, 1)
   - Label: font-family var(--mono), 11px, weight 500, tracking 0.12em, uppercase, color var(--ink-muted), margin-top 8px

8. **Step containers:** `.step { display: none; }` `.step.active { display: block; }`

9. **Welcome screen:**
   - Headline: var(--serif), 28px, line-height 1.2, letter-spacing -0.01em, color var(--ink), margin-top 48px
   - Rule line: 1px solid var(--border), margin 32px 0
   - Context card: background var(--white), border 1px solid var(--border), border-radius 8px, padding 28px 24px, border-top 2px solid var(--gold)
   - Card paragraphs: 15px, var(--sans), color var(--ink-soft), line-height 1.75, margin-bottom 16px
   - Preview grid: 2x2 grid, gap 12px, margin-top 32px
   - Preview items: background var(--bg-muted), border-radius 6px, padding 14px 16px, font-family var(--mono), font-size 12px, tracking 0.1em, uppercase, color var(--ink-muted)

10. **Name/Role screen:**
    - Headline: var(--serif), 28px, margin-top 40px
    - Subtext: var(--sans), 15px, color var(--ink-muted), margin-top 8px
    - Input label: var(--mono), 11px, weight 500, tracking 0.15em, uppercase, color var(--ink-muted), margin-bottom 8px, margin-top 32px
    - Text input: width 100%, height auto, padding 14px 16px, font-size 16px (!important for iOS), font-family var(--sans), background var(--white), border 1px solid var(--border), border-radius 6px, transition border-color 200ms. Focus: border-color var(--gold), box-shadow 0 0 0 3px rgba(184,134,11,0.08), outline none
    - Role grid: display grid, grid-template-columns repeat(2, 1fr), gap 10px, margin-top 12px. On < 480px: grid-template-columns 1fr
    - Role card: background var(--white), border 1px solid var(--border), border-radius 8px, padding 16px 18px, cursor pointer, transition all 200ms ease-out. Hover: border-color var(--border), shadow-sm. Selected: border-color var(--green), background var(--green-pale), border-width 1.5px
    - Role title: var(--sans), 15px, weight 600, color var(--ink)
    - Role subtitle: var(--sans), 13px, color var(--ink-muted), margin-top 2px

11. **Chat interface:**
    - Messages thread: flex-direction column, padding-bottom 24px, overflow-y auto
    - AI bubble: align-self flex-start, background var(--white), border 1px solid rgba(0,0,0,0.06), border-radius 2px 12px 12px 12px, max-width 85%, padding 14px 16px, font-size 15px, line-height 1.6, color var(--ink-soft), margin-bottom 12px, animation fadeSlideUp 250ms ease
    - User bubble: align-self flex-end, background var(--green), color white, border-radius 12px 2px 12px 12px, max-width 85%, padding 14px 16px, font-size 15px, line-height 1.6, margin-bottom 12px, animation fadeSlideUp 150ms ease
    - Typing indicator: 3 dots, 6px each, color var(--ink-muted), gap 4px, animation scale 1→1.4→1 600ms ease-in-out infinite, stagger 150ms per dot
    - Chat input area: position fixed, bottom 0, left 0, right 0, background var(--bg), border-top 1px solid var(--border), padding 12px 16px, padding-bottom max(12px, env(safe-area-inset-bottom))
    - Chat input wrapper: max-width 640px, margin 0 auto, position relative
    - Textarea: width 100%, rows=1, font-size 16px, font-family var(--sans), background var(--white), border 1.5px solid var(--border), border-radius 24px, padding 12px 48px 12px 18px, resize none, max-height 120px, overflow-y auto. Focus: border-color var(--gold), box-shadow 0 0 0 3px rgba(184,134,11,0.08)
    - Send button: position absolute, right 8px, bottom 8px, width 32px, height 32px, border-radius 50%, border none, cursor pointer, display flex, align-items center, justify-content center. SVG arrow-up icon. Color var(--green) when active, var(--border) when disabled. Transition color 200ms

12. **Thank you screen:**
    - Centered text-align, padding-top 80px
    - Checkmark: 56px circle, background var(--green-pale), inline SVG checkmark in var(--green), border-radius 50%
    - Headline: var(--serif), 28px, margin-top 24px
    - Body: var(--sans), 15px, color var(--ink-soft), max-width 400px, margin 12px auto 0

13. **Bottom bar:**
    - Position fixed, bottom 0, left 0, right 0, background var(--bg), border-top 1px solid var(--border), padding 12px 16px, padding-bottom max(16px, env(safe-area-inset-bottom))
    - Inner: max-width 640px, margin 0 auto, display flex, justify-content space-between, align-items center
    - Back button: background transparent, border none, color var(--ink-muted), font-family var(--sans), font-size 14px, weight 500, cursor pointer, padding 8px 16px. Hover: color var(--ink)
    - Continue/Get Started button: background var(--green), color white, border none, border-radius 6px, padding 12px 28px, font-family var(--sans), font-size 14px, weight 600, cursor pointer, transition all 200ms ease-out. Hover: background var(--green-light), transform translateY(-0.5px), box-shadow 0 4px 12px rgba(62,80,60,0.15). Disabled: opacity 0.35, pointer-events none

14. **Animations:**
    ```css
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes dotPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.4); }
    }
    ```
    - Step fade-out: opacity 1→0, translateY 0→-20px, 200ms ease
    - Step fade-in: opacity 0→1, translateY 20px→0, 300ms cubic-bezier(0.22, 1, 0.36, 1)

15. **Responsive:**
    - ≤ 640px: .app-container padding 0 24px
    - ≤ 480px: role grid single column, headline 24px
    - ≤ 380px: reduce font sizes slightly

### HTML Requirements

All screens within `.app-container`:

**Header** (always visible):
- `<div class="header-label">Kitchens for Good</div>` (small caps mono)
- `<h1 class="header-title">Positioning Survey</h1>` (serif)
- `<div class="progress-container">` with `.progress-track` > `.progress-fill` + `.progress-label`
- Progress hidden on steps 0 and 7

**Step 0 — Welcome:**
- `<h2>` serif: "We're figuring out how to talk about what we do."
- `<hr>` rule line
- Card div with 3 paragraphs (exact copy from PRD Section 6.1)
- Paragraph 3 bold: "Takes about 5-10 minutes."
- Preview grid: 4 items — "What is KFG?", "Who matters most?", "What do we replace?", "What makes us different?"

**Step 1 — Name/Role:**
- `<h2>` serif: "First, who are you?"
- `<p>` subtext: "So we can tailor the conversation to your perspective."
- Label "YOUR NAME" (small caps mono)
- `<input type="text" id="nameInput" placeholder="First and last name" autocomplete="name">`
- Label "YOUR ROLE" (small caps mono)
- Role grid: 6 cards, each with data-role attribute
  - Leadership / "CEO, Director, VP"
  - Program Staff / "Instructor, Coach, Case Manager"
  - Development / "Fundraising, Comms, Marketing"
  - Operations / "Admin, Finance, HR"
  - Board Member / (no subtitle)
  - Other / (no subtitle)
- Other-role input (hidden): `<input type="text" id="otherRoleInput" placeholder="Your role">`

**Steps 2-6 — Chat:**
- Single shared container `.chat-container`
- `.messages-thread` div (messages appended dynamically)
- Typing indicator div (hidden by default): 3 `.dot` spans

**Step 7 — Thank You:**
- Checkmark SVG in circle
- `<h2>` serif: "Thank you."
- `<p>`: "Your perspective helps us build something that actually sounds like us. We'll share what we learn from everyone's responses soon."

**Bottom bar** (outside main, fixed):
- `.back-btn` (hidden on step 0 and 7)
- `.continue-btn` text varies: "Get Started" on step 0, "Continue" on step 1, hidden during chat steps

**Chat input area** (outside main, fixed, hidden except during steps 2-6):
- `.chat-input-wrapper` with textarea + send button SVG

### JavaScript Requirements

Organized with clear comment section headers:

**// ============ CONFIG ============**
- `const GOOGLE_SCRIPT_URL = '';` (placeholder — hardcoded after Apps Script deploy)
- Question metadata:
  ```javascript
  const QUESTIONS = {
    q1: { key: 'q1', title: 'What is KFG?', step: 2, progress: 28 },
    q2: { key: 'q2', title: 'Who matters most?', step: 3, progress: 42 },
    q3: { key: 'q3', title: 'What does KFG replace?', step: 4, progress: 57 },
    q4: { key: 'q4', title: 'What makes KFG different?', step: 5, progress: 71 },
    q5: { key: 'q5', title: 'The 10-second belief', step: 6, progress: 85 },
  };
  ```

**// ============ STATE ============**
- Full `appState` object per PRD Section 7.1 (currentStep, respondent, questions q1-q5 each with messages/exchangeCount/phase/distilled/transcript, submissions)

**// ============ PROMPT CONSTANTS ============**
- `BASE_PROMPT` — exact text from PRD Section 8.2
- `ROLE_PROMPTS` object with keys: Leadership, "Program Staff", Development, Operations, "Board Member", Other — exact text from PRD Section 8.3
- `QUESTION_PROMPTS` object with keys q1-q5 — exact text from PRD Section 8.4
- `EXCHANGE_PROMPTS` — function or object returning the right block for exchangeCount 0-4+ — exact text from PRD Section 8.5
- `DISTILLATION_SYSTEM_PROMPT` — exact text from PRD Section 9.2

**// ============ DOM REFERENCES ============**
- Cache: all step elements, nameInput, otherRoleInput, role cards, continue button, back button, messages thread, chat input textarea, send button, progress fill, progress label, typing indicator, chat input area, bottom bar

**// ============ SYSTEM PROMPT BUILDER ============**
- `buildSystemPrompt(respondent, questionKey, exchangeCount)`:
  - Gets role prompt from `ROLE_PROMPTS[respondent.role]` (for "Other", interpolates roleCustom)
  - Gets question prompt from `QUESTION_PROMPTS[questionKey]`
  - Gets exchange prompt from `EXCHANGE_PROMPTS` for the given count
  - Returns: `BASE_PROMPT + "\n\n---\n\n" + rolePrompt + "\n\n---\n\n" + questionPrompt + "\n\n---\n\n" + exchangePrompt`

**// ============ API CALLS ============**
- `sendChatMessage(systemPrompt, messages)`:
  - POST to `/api/chat` with `{ system: systemPrompt, messages, max_tokens: 300, temperature: 0.7 }`
  - Returns the Response object (caller handles streaming)
- `sendDistillRequest(systemPrompt, userMessage)`:
  - POST to `/api/distill` with `{ system: systemPrompt, messages: [{ role: 'user', content: userMessage }], max_tokens: 500 }`
  - Parses JSON response, returns `data.content` (the text)

**// ============ STREAMING PARSER (OpenRouter/OpenAI SSE) ============**
- `parseSSEStream(response, onToken, onComplete, onError)`:
  - Gets reader from `response.body.getReader()`
  - TextDecoder for UTF-8
  - Maintains a `buffer` string
  - On each chunk: append decoded text to buffer, split on `\n`
  - For each complete line:
    - If starts with `data: `: extract the data payload
    - If data is `[DONE]`: call `onComplete()`, return
    - Otherwise: `JSON.parse(data)`, extract `parsed.choices?.[0]?.delta?.content`
    - If content exists: call `onToken(content)`
  - Handle partial lines by keeping remainder in buffer
  - Catch errors → `onError(err)`

**// ============ CONVERSATION ENGINE ============**
- `getQuestionKeyForStep(step)`: maps step 2→q1, 3→q2, etc.
- `startQuestion(questionKey)`:
  - Reset question state: messages=[], exchangeCount=0, phase='opening'
  - Clear messages thread DOM
  - Show typing indicator
  - Build system prompt with exchangeCount=0
  - Call sendChatMessage with empty messages array (AI generates opening)
  - Stream the response via parseSSEStream:
    - First: create an empty AI bubble, hide typing indicator
    - onToken: append to bubble + accumulate full text
    - onComplete: store full message, check for control tokens (shouldn't happen on opening), set phase='probing', enable input
- `handleUserMessage(text)`:
  - Get current question key
  - Add user bubble to DOM
  - Append `{role:'user', content:text}` to messages
  - Increment exchangeCount
  - Clear input, disable input
  - Show typing indicator
  - Build system prompt with current exchangeCount
  - Call sendChatMessage
  - **Control token buffering:** accumulate first ~15 chars before displaying
    - Create AI bubble but don't show text yet
    - `let tokenBuffer = ''`, `let tokenChecked = false`
    - onToken: if not checked, append to buffer. Once buffer.length >= 15 OR hits sentence boundary:
      - Check if starts with `[CONFIRM]`: strip, set phase='confirming', display rest
      - Check if starts with `[CAPTURED]`: strip, set phase='distilling', display rest
      - Else: display full buffer
      - Set tokenChecked=true
    - After check, stream remaining tokens directly to bubble
    - onComplete: finalize message, append to messages array
    - If phase became 'distilling': call `handleCapture(questionKey)`

- `handleCapture(questionKey)`:
  - Disable input, show "Processing..." state
  - Call `runDistillation(questionKey)`
  - On success: submit question data to Sheets, wait 500ms, advance to next step (or thank you if q5)

**// ============ DISTILLATION ============**
- `formatTranscript(messages, respondentName)`:
  - Maps messages: assistant → "Interviewer: {content}", user → "{respondentName}: {content}"
  - Joins with `\n`
- `runDistillation(questionKey)`:
  - Get question state
  - Format transcript
  - Build distillation user message (PRD Section 9.3 format): "RESPONDENT: {name} ({role})\nQUESTION: {title}\n\nTRANSCRIPT:\n---\n{transcript}\n---"
  - Call `sendDistillRequest(DISTILLATION_SYSTEM_PROMPT, userMessage)`
  - Parse response with `parseDistillation()`
  - Store in `appState.questions[questionKey].distilled`
  - Store formatted transcript in `appState.questions[questionKey].transcript`
- `parseDistillation(responseText)`:
  - Strip markdown fences if present
  - JSON.parse
  - Validate required fields (core_insight, stories, notable_language, confirmed_summary)
  - On parse error: return `{ core_insight: responseText, stories: null, notable_language: null, confirmed_summary: null }`

**// ============ GOOGLE SHEETS SUBMISSION ============**
- `postToSheet(type, data)`:
  - `fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ type, ...data }) })`
  - Fire-and-forget (no-cors means opaque response)
  - Wrap in try/catch, log errors
- `submitQuestionData(questionKey, questionTitle)`:
  - Calls `postToSheet('transcript', { name, role, question: questionKey, question_title: questionTitle, transcript: formattedTranscript, exchange_count: exchangeCount })`
  - Sets `appState.submissions[questionKey] = true`
- `submitFinalResponse()`:
  - Builds row with all distilled data (q1_core through q5_confirmed) + name + role + completed:true
  - Calls `postToSheet('response', row)`
  - Sets `appState.submissions.complete = true`
- Retry wrapper: `retryPost(fn, maxRetries=3)` with exponential backoff (2s, 4s, 8s)
- localStorage fallback: on total failure, `localStorage.setItem('kfg_backup_' + Date.now(), JSON.stringify(data))`

**// ============ UI RENDERING ============**
- `addMessage(role, content)`:
  - Creates div with class `message ${role}-message`
  - Sets textContent (or innerHTML if we want to support line breaks — use textContent and white-space: pre-wrap in CSS)
  - Appends to messages thread
  - Scrolls thread to bottom: `thread.scrollTop = thread.scrollHeight`
  - Returns the element (so streaming can update it)
- `createEmptyAIBubble()`:
  - Creates AI message div, appends to thread, returns it
- `updateBubbleText(bubble, text)`:
  - Sets bubble.textContent = text
  - Scrolls thread to bottom
- `showTypingIndicator()` / `hideTypingIndicator()`:
  - Toggle display on the typing indicator div
  - Scroll to bottom when showing
- `updateProgressBar(step)`:
  - If step 0 or 7: hide progress container
  - If step 1: show, set fill width 10%, label "About you"
  - If step 2-6: show, set fill width from QUESTIONS[qKey].progress, label "Question N of 5"
- `setInputEnabled(enabled)`:
  - Set textarea disabled property
  - Set send button disabled
  - If enabled: focus textarea after 100ms delay

**// ============ STEP NAVIGATION ============**
- `goToStep(newStep)`:
  - If same step, return
  - Get current step element and new step element
  - Fade out current (add fade-out class, wait 200ms)
  - Remove active from current, add active to new
  - Fade in new (add fade-in class, wait 300ms, remove class)
  - Update `appState.currentStep = newStep`
  - Update progress bar
  - Show/hide bottom bar vs chat input area:
    - Steps 0-1: show bottom bar, hide chat input
    - Steps 2-6: hide bottom bar, show chat input
    - Step 7: hide both
  - Show/hide back button (hidden on 0 and 7)
  - Update continue button text ("Get Started" on 0, "Continue" on 1)
  - If newStep is 2-6: call `startQuestion(getQuestionKeyForStep(newStep))`
  - If newStep is 7: call `submitFinalResponse()`
- `validateNameRole()`:
  - Check name input non-empty (trimmed)
  - Check a role is selected
  - If role is "Other", check otherRoleInput non-empty
  - Enable/disable continue button accordingly
  - Store values in appState.respondent

**// ============ EVENT LISTENERS ============**
- Continue button click → if step 0: goToStep(1). If step 1: goToStep(2)
- Back button click → goToStep(currentStep - 1)
- Role cards: forEach → click toggles selection (remove selected from all, add to clicked), update appState, show/hide otherRoleInput, validateNameRole()
- Name input: input event → validateNameRole()
- Other role input: input event → validateNameRole()
- Send button: click → if textarea has content and input enabled, call handleUserMessage(textarea.value.trim())
- Textarea: keydown → if Enter without Shift, preventDefault, trigger send. If Shift+Enter, allow default.
- Textarea: input → auto-resize (style.height = 'auto', style.height = Math.min(scrollHeight, 120) + 'px'). Also update send button color (green if has text, muted if empty).

**// ============ INIT ============**
- DOMContentLoaded → goToStep(0)

**Step 2: Verify locally**

Open in browser (or `npx serve .`):
- Welcome screen: ivory bg, Playfair Display headline, gold-topped card, mono small-caps labels, rule line
- "Get Started" → Name/Role screen with smooth transition
- Name + role validation works
- Chat screen shows empty thread + input bar
- Mobile: test on 375px viewport width

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: complete frontend — all screens, conversation engine, streaming, distillation, Sheets submission"
```

---

## Task 6: Deploy & Verify End-to-End

**Step 1: Initialize git and push**

```bash
cd ~/Desktop/Projects/kfg-survey
git remote add origin <repo-url>
git push -u origin main
```

**Step 2: Configure Vercel**

- Connect repo
- Set environment variable: `OPENROUTER_API_KEY`
- Deploy

**Step 3: Deploy Google Apps Script**

- Create Google Sheet with "Responses" and "Transcripts" tabs (headers per PRD Section 10.1 and 10.2)
- Paste `scripts/google-apps-script.js` into Apps Script editor
- Deploy as Web App (execute as self, access: anyone)
- Copy the URL and hardcode into `index.html` as `GOOGLE_SCRIPT_URL`
- Push update

**Step 4: End-to-end test**

- Open deployed URL
- Complete full survey as "Leadership" role
- Verify: streaming works, [CONFIRM] stripped, [CAPTURED] triggers distillation, transitions work
- Check Google Sheet: response row + 5 transcript rows

---

## Post-Build Verification Checklist

1. [ ] Welcome screen: Playfair Display headline, ivory bg, gold-accent card, mono labels
2. [ ] Name/Role validation: disabled button until valid
3. [ ] "Other" role shows text input
4. [ ] Chat Q1 opening message appears via streaming
5. [ ] User messages display as green bubbles (right)
6. [ ] AI responses stream token-by-token (left, white bubbles)
7. [ ] Typing indicator (3 dots) shows during wait
8. [ ] `[CONFIRM]` stripped, conversation continues normally
9. [ ] `[CAPTURED]` stripped, "Processing..." shown, distillation fires
10. [ ] Distillation returns parseable JSON
11. [ ] Q1→Q2→Q3→Q4→Q5 transitions with progress bar update
12. [ ] Thank you screen after Q5
13. [ ] Transcript rows in Google Sheet (5 per respondent)
14. [ ] Response row in Google Sheet (1 per respondent, all distilled data)
15. [ ] Mobile: single-column roles, safe area padding, no iOS zoom
16. [ ] Enter sends, Shift+Enter newlines
17. [ ] Send button color: green when text, muted when empty
18. [ ] Disabled during AI response
19. [ ] Retry on API error
20. [ ] localStorage fallback on Sheets failure
