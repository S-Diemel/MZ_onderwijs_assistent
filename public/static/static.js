// ====== Configuration ======
const MAX_CONTEXT_MESSAGES = 5;
const CITATIONS_DOWNLOAD_BASE = 'http://localhost:7000/';

// ====== State ======
const context = [];               // rolling context buffer
let abortController = null;       // in-flight request cancellation

// ====== DOM refs ======
const messagesDiv     = document.getElementById('messages');
const userInput       = document.getElementById('userInput');
const sendBtn         = document.getElementById('sendBtn');
const resetBtn        = document.getElementById('resetBtn');
const promptContainer = document.getElementById('promptButtons');
const sourcesContainer= document.querySelector('.sources');

// ====== SVG icons (inline) ======
const ICON_COPY = `
<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M16 8V5.2C16 4.0799 16 3.51984 15.782 3.09202C15.5903 2.71569 15.2843 2.40973 14.908 2.21799C14.4802 2 13.9201 2 12.8 2H5.2C4.0799 2 3.51984 2 3.09202 2.21799C2.71569 2.40973 2.40973 2.71569 2.21799 3.09202C2 3.51984 2 4.0799 2 5.2V12.8C2 13.9201 2 14.4802 2.21799 14.908C2.40973 15.2843 2.71569 15.5903 3.09202 15.782C3.51984 16 4.0799 16 5.2 16H8M11.2 22H18.8C19.9201 22 20.4802 22 20.908 21.782C21.2843 21.5903 21.5903 21.2843 21.782 20.908C22 20.4802 22 19.9201 22 18.8V11.2C22 10.0799 22 9.51984 21.782 9.09202C21.5903 8.71569 21.2843 8.40973 20.908 8.21799C20.4802 8 19.9201 8 18.8 8H11.2C10.0799 8 9.51984 8 9.09202 8.21799C8.71569 8.40973 8.40973 8.71569 8.21799 9.09202C8 9.51984 8 10.0799 8 11.2V18.8C8 19.9201 8 20.4802 8.21799 20.908C8.40973 21.2843 8.71569 21.5903 9.09202 21.782C9.51984 22 10.0799 22 11.2 22Z" fill="currentColor" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
</svg>`;

const ICON_CHECK = `
<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M20.6097 5.20743C21.0475 5.54416 21.1294 6.17201 20.7926 6.60976L10.7926 19.6098C10.6172 19.8378 10.352 19.9793 10.0648 19.9979C9.77765 20.0166 9.49637 19.9106 9.29289 19.7072L4.29289 14.7072C3.90237 14.3166 3.90237 13.6835 4.29289 13.2929C4.68342 12.9024 5.31658 12.9024 5.70711 13.2929L9.90178 17.4876L19.2074 5.39034C19.5441 4.95258 20.172 4.87069 20.6097 5.20743Z" fill="#000"></path>
</svg>`;

// ====== Utilities ======

/** Scroll the container so that the given message is at the top, with bottom padding. */
function scrollToBottomWithPadding(msgEl) {
  if (!msgEl) return;
  messagesDiv.style.paddingBottom = `${messagesDiv.clientHeight - msgEl.offsetHeight}px`;
  msgEl.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
}

/** Render Markdown → compact HTML (strip extra whitespace between tags). */
function toTightHtml(text) {
  return marked
    .parse(text)
    .replace(/\n+/g, '')
    .replace(/>\s+</g, '><');
}

/** Toggle the send button busy state. */
function setBusy(isBusy) {
  sendBtn.classList.toggle('busy', isBusy);
}

/** Create and append a copy-to-clipboard button inside a message bubble. */
function addCopyButton(msgEl) {
  if (!msgEl) return;
  const contentToCopy = msgEl.innerText;

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.type = 'button';
  copyBtn.innerHTML = ICON_COPY;

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(contentToCopy);
      copyBtn.innerHTML = ICON_CHECK;
      setTimeout(() => (copyBtn.innerHTML = ICON_COPY), 1500);
    } catch (err) {
      console.error('Clipboard error:', err);
    }
  });

  msgEl.appendChild(copyBtn);
}

/**
 * Add source citation chips. Clicking a chip downloads the file from the local server.
 * @param {string|string[]} refs - file names
 */
function addCitation(refs) {
  const files = Array.isArray(refs) ? refs : [refs];
  files.forEach((fn) => {
    // Move existing chip to top if present; otherwise create it.
    const existing = Array.from(sourcesContainer.querySelectorAll('.citation'))
      .find((el) => el.dataset.fn === fn);

    let chip = existing || document.createElement('div');

    if (!existing) {
      chip.className = 'citation';
      chip.dataset.fn = fn;
      chip.textContent = fn;
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = `/api/citations/${encodeURIComponent(fn)}`;
        // a.download = fn;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    } else {
      // Remove so we can re-insert at the top
      sourcesContainer.removeChild(chip);
    }

    sourcesContainer.insertBefore(chip, sourcesContainer.firstChild);
  });
}

/**
 * Render a message bubble and return its element.
 * - role: 'user' | 'assistant'
 * - text: markdown (assistant) or plain text (user)
 */
function renderMessage(role, text, isLoading = false) {
  const msgEl = document.createElement('div');
  msgEl.className = `message ${role}${isLoading ? ' loading' : ''}`;

  if (role === 'user') {
    // Escape + convert newlines for user text to prevent HTML injection.
    const safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\r?\n/g, '<br>');

    msgEl.innerHTML = safe;
    messagesDiv.appendChild(msgEl);
    scrollToBottomWithPadding(msgEl);
  } else {
    msgEl.textContent = text; // temporary placeholder; will be replaced while streaming
    messagesDiv.appendChild(msgEl);
  }

  return msgEl;
}

// ====== Prompt buttons (example prompts) ======
function hidePrompts() {
  if (promptContainer) promptContainer.style.display = 'none';
}

if (promptContainer) {
  promptContainer.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      userInput.value = btn.textContent;
      hidePrompts();
      userInput.style.height = 'auto';
      const maxHeight = window.innerHeight * 0.25; // px limit before scrollbar appears
      const newHeight = Math.min(userInput.scrollHeight, maxHeight);
      userInput.style.height = `${newHeight}px`;
      userInput.style.overflowY = userInput.scrollHeight > maxHeight ? 'auto' : 'hidden';
      userInput.focus();
    });
  });
}

// ====== Streaming send flow (SSE-like over fetch) ======
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  setBusy(true);
  renderMessage('user', text);
  userInput.value = '';
  userInput.style.height = 'auto';

  // Create the assistant bubble in "loading" state
  const bubble = renderMessage('assistant', '...', true);

  // Build context payload (keep last N messages)
  context.push({ role: 'user', content: text });
  const payload = context.slice(-MAX_CONTEXT_MESSAGES);

  let fullText = '';
  let citations = null;

  try {
    abortController = new AbortController();

    const response = await fetch('/.netlify/functions/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: payload }),
      signal: abortController.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(await response.text());
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Read loop — protocol frames are separated by blank lines ("\n\n").
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop(); // leftover partial frame

      for (const chunk of parts) {
        if (chunk.startsWith('data: ')) {
          // Regular delta frame: { content: string }
          try {
            const json = JSON.parse(chunk.slice(6));
            fullText += json.content || '';
            bubble.innerHTML = toTightHtml(fullText);
          } catch (e) {
            console.warn('Bad data frame:', chunk, e);
          }
        } else if (chunk.startsWith('sources: ')) {
          // Final citations frame: ["file1.pdf", ...]
          try {
            citations = JSON.parse(chunk.slice(9));
          } catch (e) {
            console.warn('Bad sources frame:', chunk, e);
          }
        }
      }
    }

    // Done streaming
    bubble.classList.remove('loading');
    bubble.innerHTML = toTightHtml(fullText || '');

    if (citations && Array.isArray(citations) && citations.length) {
      // Only add citations that are mentioned in the text (case-insensitive contains)
      const textLow = bubble.textContent.toLowerCase();
      const filtered = citations.filter((fn) => textLow.includes(fn.toLowerCase()));
      if (filtered.length) addCitation(filtered);
    }

    // Persist assistant message into context (plain text, no HTML)
    context.push({ role: 'assistant', content: bubble.textContent });
  } catch (err) {
    if (err.name === 'AbortError') {
      // Silently finalize the bubble after a manual stop
      bubble.classList.remove('loading');
      context.push({ role: 'assistant', content: bubble.textContent });
    } else {
      console.error(err);
      bubble.classList.remove('loading');
      bubble.textContent = '⚠️ Sorry, er ging iets verkeerd.';
    }
  } finally {
    setBusy(false);
    addCopyButton(bubble);
    userInput.focus();
  }
}

// ====== Event listeners ======

// Auto-resize the textarea as the user types (simpler)
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  const maxHeight = window.innerHeight * 0.25; // px limit before scrollbar appears
  const newHeight = Math.min(userInput.scrollHeight, maxHeight);
  userInput.style.height = `${newHeight}px`;
  userInput.style.overflowY = userInput.scrollHeight > maxHeight ? 'auto' : 'hidden';
});

// Send/stop button
sendBtn.addEventListener('click', () => {
  if (sendBtn.classList.contains('busy')) {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  } else {
    sendMessage();
    hidePrompts();
  }
});

// Enter to send (Shift+Enter for newline)
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.classList.contains('busy')) sendBtn.click();
  }
});

// Reset conversation
resetBtn.addEventListener('click', () => {
  // 0) Abort in-flight request
  if (abortController) {
    abortController.abort();
    abortController = null;
  }

  // 1) Clear citations
  const sources = document.querySelector('.sources');
  if (sources) sources.querySelectorAll('.citation').forEach((el) => el.remove());

  // 2) Clear chat messages
  messagesDiv.innerHTML = '';

  // 3) Clear context buffer
  context.length = 0;

  // 4) Clear input & show prompts
  userInput.value = '';
  userInput.style.height = 'auto';
  if (promptContainer) promptContainer.style.display = '';

  // 5) Re-focus input
  userInput.focus();
});

// Focus input on load
window.addEventListener('load', () => userInput && userInput.focus());