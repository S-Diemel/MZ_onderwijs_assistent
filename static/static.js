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
const sourcesContainer = document.querySelector('.sources');

// ---- helper: scroll function ----
function scrollToBottomWithPadding(msg) {
  // ensure padding for bottom space
  messagesDiv.style.paddingBottom = messagesDiv.clientHeight - msg.offsetHeight + 'px';

  // scroll the container so that msgEl lands at the start
  msg.scrollIntoView({
    behavior: 'smooth',
    block: 'start',     // align msgEl to the top
    inline: 'nearest'   // no horizontal scroll
  });
}

// ---- Markdown → tight HTML ----
function toTightHtml(text) {
  return marked
    .parse(text)
    .replace(/\n+/g, '')
    .replace(/>\s+</g, '><');
}

// ---- add copy button function ----
function addCopyButton(msg) {
    if (!msg) return;

    const contentToCopy = msg.innerText;

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none"><path d="M16 8V5.2C16 4.0799 16 3.51984 15.782 3.09202C15.5903 2.71569 15.2843 2.40973 14.908 2.21799C14.4802 2 13.9201 2 12.8 2H5.2C4.0799 2 3.51984 2 3.09202 2.21799C2.71569 2.40973 2.40973 2.71569 2.21799 3.09202C2 3.51984 2 4.0799 2 5.2V12.8C2 13.9201 2 14.4802 2.21799 14.908C2.40973 15.2843 2.71569 15.5903 3.09202 15.782C3.51984 16 4.0799 16 5.2 16H8M11.2 22H18.8C19.9201 22 20.4802 22 20.908 21.782C21.2843 21.5903 21.5903 21.2843 21.782 20.908C22 20.4802 22 19.9201 22 18.8V11.2C22 10.0799 22 9.51984 21.782 9.09202C21.5903 8.71569 21.2843 8.40973 20.908 8.21799C20.4802 8 19.9201 8 18.8 8H11.2C10.0799 8 9.51984 8 9.09202 8.21799C8.71569 8.40973 8.40973 8.71569 8.21799 9.09202C8 9.51984 8 10.0799 8 11.2V18.8C8 19.9201 8 20.4802 8.21799 20.908C8.40973 21.2843 8.71569 21.5903 9.09202 21.782C9.51984 22 10.0799 22 11.2 22Z" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></path> </g></svg>
    `;

    copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(contentToCopy).then(() => {
            copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M20.6097 5.20743C21.0475 5.54416 21.1294 6.17201 20.7926 6.60976L10.7926 19.6098C10.6172 19.8378 10.352 19.9793 10.0648 19.9979C9.77765 20.0166 9.49637 19.9106 9.29289 19.7072L4.29289 14.7072C3.90237 14.3166 3.90237 13.6835 4.29289 13.2929C4.68342 12.9024 5.31658 12.9024 5.70711 13.2929L9.90178 17.4876L19.2074 5.39034C19.5441 4.95258 20.172 4.87069 20.6097 5.20743Z" fill="#000000"></path> </g></svg>
            `;
            setTimeout(() => {
                copyBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none"><path d="M16 8V5.2C16 4.0799 16 3.51984 15.782 3.09202C15.5903 2.71569 15.2843 2.40973 14.908 2.21799C14.4802 2 13.9201 2 12.8 2H5.2C4.0799 2 3.51984 2 3.09202 2.21799C2.71569 2.40973 2.40973 2.71569 2.21799 3.09202C2 3.51984 2 4.0799 2 5.2V12.8C2 13.9201 2 14.4802 2.21799 14.908C2.40973 15.2843 2.71569 15.5903 3.09202 15.782C3.51984 16 4.0799 16 5.2 16H8M11.2 22H18.8C19.9201 22 20.4802 22 20.908 21.782C21.2843 21.5903 21.5903 21.2843 21.782 20.908C22 20.4802 22 19.9201 22 18.8V11.2C22 10.0799 22 9.51984 21.782 9.09202C21.5903 8.71569 21.2843 8.40973 20.908 8.21799C20.4802 8 19.9201 8 18.8 8H11.2C10.0799 8 9.51984 8 9.09202 8.21799C8.71569 8.40973 8.40973 8.71569 8.21799 9.09202C8 9.51984 8 10.0799 8 11.2V18.8C8 19.9201 8 20.4802 8.21799 20.908C8.40973 21.2843 8.71569 21.5903 9.09202 21.782C9.51984 22 10.0799 22 11.2 22Z" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></path> </g></svg>
                `;
            }, 1500);
        });
    });

    msg.appendChild(copyBtn);
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
    messagesDiv.appendChild(msg);
    scrollToBottomWithPadding(msg);
  } else {
    msg.textContent = text;
    messagesDiv.appendChild(msg);
  }
  return msg;
}

// ---- send/stop button helper
function setBusy(state) {
  sendBtn.classList.toggle('busy', state);
}

// ---- citations helper ----
function addCitation(refs) {
  // Normalize refs to an array
  const files = Array.isArray(refs) ? refs : [refs];

  files.forEach(fn => {
    const sel = `.citation[data-fn="${fn}"]`;
    let el = sourcesContainer.querySelector(sel);

    if (el) {
      // Remove existing so we can move it to the top
      sourcesContainer.removeChild(el);
    } else {
      // Create a new citation element
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

    // Insert (or re-insert) at the very top of the container
    sourcesContainer.insertBefore(el, sourcesContainer.firstChild);
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
        // push assistant content into context
        context.push({ role: 'assistant', content: bubble.textContent });;
      // reset aborted the request
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
