chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "summarizeWithGemini",
    title: "Summarize with Google Gemini",
    contexts: ["selection"]
  });
});

// --- Shared summarize logic ---
async function handleSummarize(selectionText, tab) {
  // Prevent injection on restricted pages
  if (!tab.url || tab.url.startsWith("chrome://") ||
    tab.url.startsWith("https://chrome.google.com/")) {
    console.warn("Cannot inject into this page:", tab.url);
    alert("Cannot display summary due to Chrome preventation. Click on the extension button to view the summary.")
    return;
  }

  // Check if tab is still valid
  try {
    await chrome.tabs.get(tab.id);
  } catch (error) {
    console.warn('Tab is no longer valid:', error);
    alert("Cannot display summary. The tab may have been closed or is no longer accessible.");
    return;
  }

  // Check if API key exists
  chrome.storage.local.get(['geminiApiKey'], async (result) => {
    if (!result.geminiApiKey) {
      // No API key set, inject content script and show error message
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });

        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: "SHOW_ERROR",
              message: "Please set your Google API key in the extension popup first."
            });
          } catch (error) {
            console.warn('Could not send message to tab:', error);
            alert("Please set your Google API key in the extension popup first.");
          }
        }, 200);
      } catch (error) {
        console.error('Error injecting content script:', error);
        alert("Please set your Google API key in the extension popup first.");
      }
      return;
    }

    try {
      const summary = await summarizeWithGemini(selectionText, result.geminiApiKey);

      // Store it in history
      chrome.storage.local.get({ summaries: [] }, (data) => {
        const summaryWithTimestamp = {
          text: summary,
          timestamp: Date.now()
        };
        const updated = [summaryWithTimestamp, ...data.summaries].slice(0, 10);
        chrome.storage.local.set({ summaries: updated });
      });

      // Inject content script and wait for it to be ready
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });

        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: "SHOW_SUMMARY",
              summary: summary
            });
          } catch (error) {
            console.warn('Could not send summary to tab:', error);
            alert(`Summary: ${summary}`);
          }
        }, 200);
      } catch (error) {
        console.error('Error injecting content script for summary:', error);
        alert(`Summary: ${summary}`);
      }
    } catch (error) {
      console.error('Error summarizing text:', error);
      // Inject content script and show error message
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });

        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: "SHOW_ERROR",
              message: "Error generating summary. Please check your API key and try again."
            });
          } catch (error) {
            console.warn('Could not send error message to tab:', error);
            alert("Error generating summary. Please check your API key and try again.");
          }
        }, 200);
      } catch (error) {
        console.error('Error injecting content script for error:', error);
        alert("Error generating summary. Please check your API key and try again.");
      }
    }
  });
}

// --- Keyboard shortcut handler ---
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "summarize-selection") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    try {
      const [{ result: selectionText }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString()
      });

      if (selectionText && selectionText.trim()) {
        handleSummarize(selectionText, tab);
      } else {
        alert("Please select some text to summarize.");
      }
    } catch (e) {
      console.error("Could not get selection:", e);
      alert("Could not access selected text.");
    }
  }
});

// --- Context menu handler ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "summarizeWithGemini" && info.selectionText) {
    handleSummarize(info.selectionText, tab);
  }
});

// --- Gemini API call ---
async function summarizeWithGemini(text, apiKey) {
  const body = {
    model: "models/gemini-2.5-flash-lite",
    contents: [{
      role: "user",
      parts: [{ text: `You are an expert summarizer who can extract all the important information in a text and create a super short summary. Return a short but informative 3 sentence paragraph with no markdowns  and don't answer questions. Text: ${text}` }]
    }],
    generationConfig: {
      temperature: 0.4
    }
  };

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`API Error: ${data.error?.message || res.statusText}`);
  }

  let summary = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No summary returned.";
  return summary;
}