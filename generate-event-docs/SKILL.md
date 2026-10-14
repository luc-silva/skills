---
name: generate-event-docs
description: Documents asynchronous events (SQS/SNS/message queues) of this repository in AsyncAPI 3.0 and generates a single self-contained HTML file to view them. Use whenever asked to document, update, or view events/queues/messages, or to generate event documentation HTML.
---

# Event Documentation (AsyncAPI)

Deliverables, both versioned in the repository:

- `docs/asyncapi/<repo>.asyncapi.yaml` — single source of truth (AsyncAPI 3.0).
- `docs/asyncapi/<repo>.asyncapi.html` — single-file viewer; opens with a double-click, no web server required.

The YAML is never uploaded to public sites (rendering is 100% local). Do not paste the content into online editors.

## 1. Discover Events

Search the codebase for what **publishes** and what **consumes**, without assumptions:

- Publishing: `SqsApi::sendMessage`, `SnsClient::publish`, general `sendMessage`/`publish` calls.
- Consuming: services/commands reading queues (ReceiveMessage, workers, `Fetcher`, `GetLoadQueues`...).
- Queue/topic names: URLs/ARNs usually come from configuration or code parameters — document the **parameter key/code**, never real URLs/ARNs.
- Payload: derive directly from the code constructing the array/JSON (`json_encode`), field by field, including types and required status.
- Also record `MessageGroupId`/`MessageDeduplicationId` for FIFO queues.

Internal framework events (e.g. Symfony events) are not broker messages: keep them out, or mention them only in a note.

## 2. Write / Update the YAML

Use the repository's existing `docs/asyncapi/<repo>.asyncapi.yaml` (or create a new one adhering to the AsyncAPI 3.0 specification) as a template for structure and style:

- `channels` (one per queue/topic), `operations` (`send`/`receive`), `components.messages`, and `components.schemas`.
- Bindings SQS require `queue.fifoQueue` (true/false) — omitting this causes rendering errors.
- Payload schema: define schemas accurately under `components.schemas` mirroring the actual payload structure found in code, including property types, required fields, and examples.
- `x-publishers` / `x-consumers`: location in code publishing/consuming (class/method).
- Anything that cannot be verified should go into a "Pending / Unverified" section in `description` — never fill values based on speculation.
- Do not include secrets, real URLs, ARNs, API keys, or real personal data in examples.

## 3. Generate the HTML

```bash
node .agents/skills/generate-event-docs/build.mjs docs/asyncapi/<repo>.asyncapi.yaml
# -> docs/asyncapi/<repo>.asyncapi.html   (use -o for a custom output path, --title for tab title)
```

- Requires Node ≥ 18 and `npm`/`tar` in PATH. On the first run it downloads `@asyncapi/react-component` and `js-yaml` (pinned versions in the script, tarballs only) from npm and caches them in the temporary directory; subsequent runs work offline.
- The HTML bundles the embedded YAML, light/dark theme, sidebar search, and floating buttons (bottom right): download `.md`, generate PDF (triggers browser print → "Save as PDF"; outputs content only, without header/sidebar, always in light theme), and copy Markdown. The Markdown is generated from the YAML (servers, operations, channels, messages with payload table and examples, schemas).
- No file upload needed: the YAML is loaded directly from the repo.
- Schema errors appear directly on the page when opening the HTML — review before committing.

Verify if the committed HTML is up to date (useful in CI):

```bash
node .agents/skills/generate-event-docs/build.mjs docs/asyncapi/<repo>.asyncapi.yaml --check
```

Exits with code 1 if the HTML is out of sync with the YAML.

## 4. Wrap-up

1. Regenerate the HTML whenever the YAML changes and commit both together.
2. Inform the user about any items left under "Pending / Unverified" in the YAML.
3. This skill is self-contained (`SKILL.md`, `build.mjs`, `app.js`, `export.js`, `app.css`); to use it in another repo, copy the entire directory to `.agents/skills/`.
