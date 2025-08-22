chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SHOW_SUMMARY") {
    showSummary(message.summary);
  } else if (message.type === "SHOW_ERROR") {
    showError(message.message);
  }
});

// Show summary in the bottom right
function showSummary(summary) {
  const existing = document.getElementById("tldr-card");
  if (existing) existing.remove();

  fetch(chrome.runtime.getURL("summary.html"))
    .then(res => res.text())
    .then(html => {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const popup = tempDiv.firstElementChild;

      // Load CSS if not already there
      if (!document.getElementById("summary-style")) {
        const link = document.createElement("link");
        link.id = "summary-style";
        link.rel = "stylesheet";
        link.href = chrome.runtime.getURL("summary.css");
        document.head.appendChild(link);
      }

      popup.querySelector("#summary-text").innerText = summary;

      document.body.appendChild(popup);

      // Auto-hide after 15 seconds
      const autoHideTimer = setTimeout(() => {
        if (popup && popup.parentNode) {
          popup.remove();
        }
      }, 15000);

      // Copy button functionality
      const copyBtn = popup.querySelector("#copy-btn");
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(summary).then(() => {
          const copyText = copyBtn.querySelector("span");
          if (copyText) {
            copyText.innerText = "Copied";
            setTimeout(() => {
              copyText.innerText = "Copy";
            }, 1500);
          }
        });
      });

      // Close button functionality
      document.addEventListener("click", function (e) {
        if (e.target && e.target.id === "close-card") {
          const popup = document.getElementById("tldr-card");
          if (popup && popup.parentNode) {
            popup.remove();
          }
        }
      });
    })
    .catch(error => {
      console.error('Error loading summary popup:', error);
    });
}

// Show error message in the bottom right
function showError(message) {
  const existing = document.getElementById("tldr-card");
  if (existing) existing.remove();

  fetch(chrome.runtime.getURL("summary.html"))
    .then(res => res.text())
    .then(html => {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const popup = tempDiv.firstElementChild;

      // Load CSS if not already there
      if (!document.getElementById("summary-style")) {
        const link = document.createElement("link");
        link.id = "summary-style";
        link.rel = "stylesheet";
        link.href = chrome.runtime.getURL("summary.css");
        document.head.appendChild(link);
      }

      // Change the popup to show error
      popup.querySelector("#summary-text").innerText = message;
      popup.querySelector("#summary-text").style.color = "#ff3f3fff";
      popup.querySelector("#copy-btn").style.display = "none";

      document.body.appendChild(popup);

      // Auto-hide error after 15 seconds
      const autoHideTimer = setTimeout(() => {
        if (popup && popup.parentNode) {
          popup.remove();
        }
      }, 15000);

      // Close button functionality for error popup
      document.addEventListener("click", function (e) {
        if (e.target && e.target.id === "close-card") {
          const popup = document.getElementById("tldr-card");
          if (popup && popup.parentNode) {
            popup.remove();
          }
        }
      });
    })
    .catch(error => { 
      console.error('Error loading error popup:', error); 
    });
}