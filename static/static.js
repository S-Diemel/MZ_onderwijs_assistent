// ---- context setup ----
const context = [];
const MAX_CONTEXT_MESSAGES = 5;

// ---- DOM refs ----
const messagesDiv = document.getElementById('messages');
const userInput   = document.getElementById('userInput');
const sendBtn     = document.getElementById('sendBtn');

// ---- helper: scroll to bottom ----
function scrollToBottom() {
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function toTightHtml(text) {
// 1) parse Markdown → HTML
// 2) strip all newlines
// 3) collapse spaces between tags
  return marked
  .parse(text)
  .replace(/\n+/g, '')
  .replace(/>\s+</g, '><');
}

// ---- render a message bubble; returns its DOM node ----
function renderMessage(role, text, isLoading = false) {
  // Create wrapper
  const msg = document.createElement('div');
  msg.className = `message ${role}` + (isLoading ? ' loading' : '');

  // Fill contents
  if (role === 'user') {
    // Escape HTML chars and convert newlines
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\r?\n/g, '<br>');
    msg.innerHTML = escaped;

  } else {
    // Assistant: either show plain '...' when loading,
    // or render markdown when it's a real reply.
    if (isLoading) {
      msg.textContent = text;
    } else {
      msg.innerHTML = toTightHtml(text);
    }
  }

  // Append and scroll
  messagesDiv.appendChild(msg);
  scrollToBottom();
  return msg;
}

// ---- remove loading indicator ----
function removeLoadingBubble(elem) {
  if (elem && elem.classList.contains('loading')) {
    elem.remove();
  }
}

function addCitation(refs) {
  const sourcesContainer = document.querySelector('.sources');
  // Normalize to array
  const files = Array.isArray(refs) ? refs : [refs];

  files.forEach(filename => {
    const citeEl = document.createElement('div');
    citeEl.className = 'citation';
    // If you want these to be links instead of plain text, replace
    // citeEl.textContent = filename;
    // with something like:
    //
    //   const a = document.createElement('a');
    //   a.href = `/path/to/files/${filename}`;
    //   a.textContent = filename;
    //   citeEl.appendChild(a);
    //
    citeEl.textContent = filename;
    sourcesContainer.appendChild(citeEl);
  });
}

// ---- send flow ----
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  // disable send button only
  sendBtn.disabled = true;

  // show user message
  renderMessage('user', text);
  userInput.value = '';

  // show assistant "typing"
  const loadingBubble = renderMessage('assistant', '...', true);

  // call the API
  const [reply, sources] = await callChatGPT(text);

  // replace loader with real reply
  removeLoadingBubble(loadingBubble);
  if (reply) {
    renderMessage('assistant', reply);
    console.log(sources)
    addCitation(sources);
  } else {
    renderMessage('assistant', '⚠️ Sorry, er ging iets verkeerd.');
  }

  // re-enable send button
  sendBtn.disabled = false;
  userInput.focus();
}

// send on sendBtn click
sendBtn.addEventListener('click', sendMessage);

// send on Enter (with Shift+Enter for newline), but only if sendBtn is enabled
userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) {
      sendMessage();
    }
  }
});

// ---- your provided callChatGPT function ----
async function callChatGPT(text) {
  context.push({ role: 'user', content: text });
  const input_context = context.slice(-MAX_CONTEXT_MESSAGES);

  try {
    const response = await fetch("/api/openai/response", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input_context })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error: ${errorText}`, false);
      return [null, null];
    }

    const data = await response.json();
    const outputText = data.response;
    const sources = data.sources
    context.push({ role: 'assistant', content: outputText });
    return [outputText, sources];
  } catch (err) {
    console.error(`Error: ${err.message}`, false);
    return [null, null];
  }
}

// ---- auto-focus textarea on load ----
window.addEventListener('load', () => {
  userInput.focus();
});
