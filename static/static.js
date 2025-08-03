// ---- context setup ----
const context = [];
const MAX_CONTEXT_MESSAGES = 5;
let abortController = null;

// ---- DOM refs ----
const messagesDiv = document.getElementById('messages');
const userInput   = document.getElementById('userInput');
const sendBtn     = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');
const promptContainer = document.getElementById('promptButtons');

// ---- helper: scroll to bottom ----
function scrollToBottom() {
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ---- Markdown → tight HTML ----
function toTightHtml(text) {
  return marked
    .parse(text)
    .replace(/\n+/g, '')
    .replace(/>\s+</g, '><');
}

// ---- render a message bubble; returns its DOM node ----
function renderMessage(role, text, isLoading = false) {
  const msg = document.createElement('div');
  msg.className = `message ${role}` + (isLoading ? ' loading' : '');
  if (role === 'user') {
    msg.innerHTML = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\r?\n/g, '<br>');
  } else {
    msg.textContent = text;
  }
  messagesDiv.appendChild(msg);
  scrollToBottom();
  return msg;
}

// ---- send/stop button helper
function setBusy(state) {
  sendBtn.classList.toggle('busy', state);
}

// ---- citations helper ----
function addCitation(refs) {
  const container = document.querySelector('.sources');
  if (!container) return;

  // We know that <h2> "Bronnen:" is always present
  const header = container.querySelector('h2');
  // Insert new (or moved) citations immediately after the header
  const referenceNode = header.nextElementSibling;

  // Normalize to an array of filenames
  const files = Array.isArray(refs) ? refs : [refs];

  files.forEach(fn => {
    // Build selector for an existing citation
    const sel = `.citation[data-fn="${fn}"]`;
    let el = container.querySelector(sel);

    if (el) {
      // If it exists, remove it so we can re-insert at the top
      if (el !== referenceNode) {
              container.removeChild(el);
            }
    } else {
      // Otherwise, create a new citation element
      el = document.createElement('div');
      el.className = 'citation';
      el.setAttribute('data-fn', fn);
      el.textContent = fn;
      el.style.cursor = 'pointer';

      // Download-on-click handler
      el.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = `http://localhost:7000/${encodeURIComponent(fn)}`;
        a.download = fn;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    }

    // Insert (or re-insert) just below the header
    container.insertBefore(el, referenceNode);
  });
}

// ---- send flow with SSE parsing ----
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  setBusy(true);
  renderMessage('user', text);
  userInput.value = '';
  userInput.style.height = 'auto';

  // Create the assistant bubble in "loading" state
  const bubble = renderMessage('assistant', '...', true);

  // Build context payload
  context.push({ role: 'user', content: text });
  const payload = context.slice(-MAX_CONTEXT_MESSAGES);
  let fullText = '';      // ← accumulator for all deltas
  let citations = null;

  try {
    abortController = new AbortController();
    const response = await fetch('/api/openai/response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: payload }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let citations = null;

    // Read loop
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();  // leftover

      for (const chunk of parts) {
        if (chunk.startsWith('data: ')) {
          // regular delta frame
          const json = JSON.parse(chunk.slice(6));
          fullText += json.content;
          bubble.innerHTML = toTightHtml(fullText);

        } else if (chunk.startsWith('sources: ')) {
          // final citations frame
          citations = JSON.parse(chunk.slice(9));
        }
      }
    }

    // Done streaming: render Markdown & inject citations
    bubble.classList.remove('loading');
    bubble.innerHTML = toTightHtml(fullText);
    if (citations) {
      const textLow = bubble.textContent.toLowerCase();
      const filtered = citations.filter(fn =>
        textLow.includes(fn.toLowerCase())
      );
      if (filtered.length) addCitation(filtered);
    }

    // push assistant content into context
    context.push({ role: 'assistant', content: bubble.textContent });

  } catch (err) {
    // if we aborted, silently drop; otherwise surface the error
      if (err.name === 'AbortError') {
        bubble.classList.remove('loading');
        console.log('abort error');
      // reset aborted the request
      } else {
        console.error(err);
        bubble.classList.remove('loading');
        bubble.textContent = '⚠️ Sorry, er ging iets verkeerd.';
      }
  } finally {
    setBusy(false);
    userInput.focus();
  }
}

// ---- event listeners ----

// Auto-resize the task input textarea as the user types
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = userInput.scrollHeight + 'px';
  userInput.scrollTop = userInput.scrollHeight;
});

// example prompts functions
function hidePrompts() {
  if (promptContainer) promptContainer.style.display = 'none';
}

promptContainer.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      userInput.value = btn.textContent;
      hidePrompts();
      userInput.style.height = 'auto';
      userInput.style.height = userInput.scrollHeight + 'px';
      userInput.scrollTop = userInput.scrollHeight;
      userInput.focus();
    })
});
// sending messages
sendBtn.addEventListener('click', () => {
  if (sendBtn.classList.contains('busy')) {
    if (abortController) {
      abortController.abort();
      abortController = null
    }
  } else {
    sendMessage();
    hidePrompts();
  }
});

userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!(sendBtn.classList.contains('busy'))) sendBtn.click();
  }
});

resetBtn.addEventListener('click', () => {
  // 0. Abort any in‐flight request
  if (abortController) {
    abortController.abort();
    abortController = null
  }
  // 1. Clear citations
  const sources = document.querySelector('.sources');
  // remove all citation bubbles
  sources.querySelectorAll('.citation').forEach(el => el.remove());

  // 2. Clear chat messages
  const messagesDiv = document.getElementById('messages');
  messagesDiv.innerHTML = '';

  // 3. Clear context buffer
  context.length = 0;

  // 4. Clear input box
  userInput.value = '';
  userInput.style.height = 'auto';
  promptContainer.style.display = '';
  // re-focus the input
  userInput.focus();
});

window.addEventListener('load', () => userInput.focus());
