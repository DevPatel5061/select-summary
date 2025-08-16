chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "summarizeWithGemini",
    title: "Summarize with Google Gemini",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "summarizeWithGemini" && info.selectionText) {

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

          // Wait longer for content script to be ready
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id, {
                type: "SHOW_ERROR",
                message: "Please set your Google API key in the extension popup first."
              });
            } catch (error) {
              console.warn('Could not send message to tab:', error);
              // Fallback: show alert
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
        const summary = await summarizeWithGemini(info.selectionText, result.geminiApiKey);

        // Store it in history
        chrome.storage.local.get({ summaries: [] }, (data) => {
          const summaryWithTimestamp = {
            text: summary,
            timestamp: Date.now()
          };
          const updated = [summaryWithTimestamp, ...data.summaries].slice(0, 7);
          chrome.storage.local.set({ summaries: updated });
        });

        // Inject content script and wait for it to be ready
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });

          // Wait longer for content script to initialize, then send message
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id, {
                type: "SHOW_SUMMARY",
                summary: summary
              });
            } catch (error) {
              console.warn('Could not send summary to tab:', error);
              // Fallback: show alert with summary
              alert(`Summary: ${summary}`);
            }
          }, 200);
        } catch (error) {
          console.error('Error injecting content script for summary:', error);
          // Fallback: show alert with summary
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
              // Fallback: show alert
              alert("Error generating summary. Please check your API key and try again.");
            }
          }, 200);
        } catch (error) {
          console.error('Error injecting content script for error:', error);
          // Fallback: show alert
          alert("Error generating summary. Please check your API key and try again.");
        }
      }
    });
  }
});

async function summarizeWithGemini(text, apiKey) {
  const body = {
    model: "models/gemini-2.0-flash",
    contents: [{
      parts: [{ text: `Only present the important information and nothing more. Don't use any markdowns. Summarize the following text: ${text}'` }]
    }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 200
    }
  };

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(`API Error: ${errorData.error?.message || res.statusText}`);
  }

  const data = await res.json();
  let summary = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No summary returned.";

  return summary;
}
