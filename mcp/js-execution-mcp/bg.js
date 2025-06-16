const sock = new WebSocket('ws://127.0.0.1:9235');

sock.onopen = () => {
  console.log("Connected to JS Execution MCP Server.");
};

sock.onmessage = async evt => {
  if (evt.data === 'ping') {
    sock.send('pong');
    return;
  }
  const { id, type, script } = JSON.parse(evt.data);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    sock.send(JSON.stringify({ id, ok: false, error: "No active tab found" }));
    return;
  }

  if (tab.url.startsWith("chrome://")) {
    sock.send(JSON.stringify({ id, ok: false, error: "Cannot access chrome:// URLs" }));
    return;
  }

  try {
    if (type === "read_dom") {
      // First inject jQuery
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['inject.js'],
        world: 'MAIN'
      });

      // Then read the DOM
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: () => document.documentElement.outerHTML
      });
      
      sock.send(JSON.stringify({ id, ok: true, result: { html: result } }));
    } else if (type === "execute_jquery") {
      // First inject jQuery
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['inject.js'],
        world: 'MAIN'
      });

      // Then execute the jQuery script
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: (code) => {
          try {
            const evalResult = eval(code);
            // Check if the result is a primitive type or a plain object/array
            if (evalResult === null || ['undefined', 'boolean', 'number', 'string', 'symbol'].includes(typeof evalResult)) {
              return evalResult;
            }
            // For jQuery objects, we can return a summary
            if (evalResult.jquery) {
              return {
                jquery: evalResult.jquery,
                length: evalResult.length,
                selector: evalResult.selector,
              };
            }
            // For other complex objects, attempt to serialize, but handle circular references
            try {
              return JSON.parse(JSON.stringify(evalResult));
            } catch (e) {
              return 'Result is a complex or circular object that cannot be serialized.';
            }
          } catch (e) {
            throw new Error(e.message);
          }
        },
        args: [script]
      });
      
      sock.send(JSON.stringify({ id, ok: true, result: { result } }));
    }
  } catch (e) {
    sock.send(JSON.stringify({ id, ok: false, error: e.message }));
  }
};

sock.onclose = () => {
  console.log("Disconnected from JS Execution MCP Server.");
};

sock.onerror = (error) => {
  console.error("WebSocket error:", error);
};
