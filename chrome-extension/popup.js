document.addEventListener("DOMContentLoaded", () => {
  const apiSetup = document.getElementById("api-setup");
  const mainContent = document.getElementById("main-content");
  const apiKeyInput = document.getElementById("api-key-input");
  const saveApiKeyBtn = document.getElementById("save-api-key");
  const settingsBtn = document.getElementById("settings-btn");
  const settingsModal = document.getElementById("settings-modal");
  const closeSettingsBtn = document.getElementById("close-settings");
  const currentApiKeyInput = document.getElementById("current-api-key");
  const showHideKeyBtn = document.getElementById("show-hide-key");
  const changeApiKeyBtn = document.getElementById("change-api-key");
  const deleteApiKeyBtn = document.getElementById("delete-api-key");
  const clearPopupBtn = document.getElementById("clear-popup");

  // API editing state tracking
  let isEditingApiKey = false;

  // Check if API key exists
  chrome.storage.local.get(['geminiApiKey'], (result) => {
    if (result.geminiApiKey) {
      showMainContent();
      migrateOldSummaries(); 
    } else {
      showApiSetup();
    }
  });

  // Load summaries from storage
  function loadSummaries() {
    const listContainer = document.getElementById("summary-list");

    chrome.storage.local.get({ summaries: [] }, (data) => {
      const summaries = data.summaries;
      listContainer.innerHTML = "";

      if (summaries.length === 0) {
        listContainer.innerHTML = "<p style='color: #d1d5db; text-align: center;'>No summaries yet.</p>";
        return;
      }

      summaries.forEach((summaryData) => {
        const card = document.createElement("div");
        card.className = "summary-card";

        // Create timestamp element
        const timestampElement = document.createElement("div");
        timestampElement.className = "summary-timestamp";
        
        // Handle both new format (with timestamp) and old format (just text)
        if (summaryData.timestamp) {
          timestampElement.textContent = formatTimeAgo(summaryData.timestamp);
        } else {
          // For old summaries without timestamp, show "Unknown time"
          timestampElement.textContent = "Unknown time";
        }

        const summaryText = document.createElement("div");
        summaryText.className = "summary-text";
        summaryText.innerText = summaryData.text || summaryData; // Handle both new and old format

        const buttonRow = document.createElement("div");
        buttonRow.className = "btn-row";

        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        
        const copyIcon = document.createElement("svg");
        copyIcon.setAttribute("width", "14");
        copyIcon.setAttribute("height", "14");
        copyIcon.setAttribute("viewBox", "0 0 24 24");
        copyIcon.setAttribute("fill", "none");
        copyIcon.setAttribute("stroke", "currentColor");
        copyIcon.setAttribute("stroke-width", "2");
        copyIcon.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
        
        const copyText = document.createElement("span");
        copyText.innerText = "Copy";
        
        copyBtn.appendChild(copyIcon);
        copyBtn.appendChild(copyText);
        
        copyBtn.addEventListener("click", () => {
          const textToCopy = summaryData.text || summaryData;
          navigator.clipboard.writeText(textToCopy).then(() => {
            copyText.innerText = "Copied!";
            setTimeout(() => (copyText.innerText = "Copy"), 1500);
          }).catch(err => {
            console.error('Failed to copy text:', err);
            // Fallback: show a message that copy failed
            copyText.innerText = "Failed";
            setTimeout(() => (copyText.innerText = "Copy"), 1500);
          });
        });

        buttonRow.appendChild(copyBtn);
        card.appendChild(timestampElement);
        card.appendChild(summaryText);
        card.appendChild(buttonRow);
        listContainer.appendChild(card);
      });
    });
  }

  // Show API setup modal
  function showApiSetup() {
    apiSetup.style.display = "block";
    mainContent.style.display = "none";
  }

  // Show main content
  function showMainContent() {
    apiSetup.style.display = "none";
    mainContent.style.display = "block";
    loadSummaries();

    // Reset settings modal state when main content is shown
    resetSettingsModalState();
  }

  // Save API key
  saveApiKeyBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey && apiKey.length > 10) { 
      
      // Store API key securely in chrome.storage.local
      chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving API key:', chrome.runtime.lastError);
          return;
        }
        showMainContent();
        apiKeyInput.value = "";
      });
    } else {

      // Show error for invalid API key
      apiKeyInput.style.borderColor = "#ef4444";
      setTimeout(() => {
        apiKeyInput.style.borderColor = "#EBEBEB";
      }, 2000);
    }
  });

  // Open settings modal
  function openSettingsModal() {
    settingsModal.style.display = "block";
    loadSettingsData();
  }

  // Close settings modal
  function closeSettingsModal() {
    settingsModal.style.display = "none";
    resetSettingsModalState();
  }

  // Reset settings modal state
  function resetSettingsModalState() {
    
    // Reset editing state
    isEditingApiKey = false;
    
    // Reset API key input to readonly and masked state
    currentApiKeyInput.setAttribute('readonly', true);
    currentApiKeyInput.type = "password";
    
    // Reset to masked display
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      if (result.geminiApiKey) {
        const maskedKey = result.geminiApiKey.substring(0, 8) + "..." + result.geminiApiKey.substring(result.geminiApiKey.length - 4);
        currentApiKeyInput.value = maskedKey;
      }
    });
    
    // Hide confirm and cancel buttons, show change button
    const checkmarkBtn = document.getElementById("confirm-api-key");
    const cancelBtn = document.getElementById("cancel-api-key");
    if (checkmarkBtn) {
      checkmarkBtn.style.display = "none";
    }
    if (cancelBtn) {
      cancelBtn.style.display = "none";
    }
    changeApiKeyBtn.style.display = "inline-flex";
    
    // Reset eye icon state
    const eyeIcon = showHideKeyBtn.querySelector('.eye-icon');
    const eyeOffIcon = showHideKeyBtn.querySelector('.eye-off-icon');
    if (eyeIcon && eyeOffIcon) {
      eyeIcon.style.display = "block";
      eyeOffIcon.style.display = "none";
    }
    
    // Re-enable the eye icon
    showHideKeyBtn.style.opacity = "1";
    showHideKeyBtn.style.pointerEvents = "auto";
  }

  function loadSettingsData() {
    // Only load API key data if the input is not currently being edited
    if (!isEditingApiKey && currentApiKeyInput.hasAttribute('readonly')) {
      chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
          const maskedKey = result.geminiApiKey.substring(0, 8) + "..." + result.geminiApiKey.substring(result.geminiApiKey.length - 4);
          currentApiKeyInput.value = maskedKey;
          currentApiKeyInput.type = "password";
        }
      });
    }
  }

  // Open settings modal
  settingsBtn.addEventListener("click", () => {
    openSettingsModal();
  });

  // Close settings modal
  closeSettingsBtn.addEventListener("click", () => {
    closeSettingsModal();
  });

  // Close modal when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === settingsModal) {
      closeSettingsModal();
    }
  });

  // Show/Hide API key
  showHideKeyBtn.addEventListener("click", () => {
    // Don't allow toggling during editing
    if (isEditingApiKey) {
      return;
    }
    
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      if (result.geminiApiKey) {
        const eyeIcon = showHideKeyBtn.querySelector('.eye-icon');
        const eyeOffIcon = showHideKeyBtn.querySelector('.eye-off-icon');
        
        // Toggle visibility of the API key
        if (currentApiKeyInput.type === "password") {
          currentApiKeyInput.value = result.geminiApiKey;
          currentApiKeyInput.type = "text";
          eyeIcon.style.display = "none";
          eyeOffIcon.style.display = "block";
        } else {
          const maskedKey = result.geminiApiKey.substring(0, 8) + "..." + result.geminiApiKey.substring(result.geminiApiKey.length - 4);
          currentApiKeyInput.value = maskedKey;
          currentApiKeyInput.type = "password";
          eyeIcon.style.display = "block";
          eyeOffIcon.style.display = "none";
        }
      }
    });
  });

  // Change API key
  changeApiKeyBtn.addEventListener("click", () => {
    isEditingApiKey = true;
    currentApiKeyInput.removeAttribute('readonly');
    currentApiKeyInput.focus();
    
    // Load the full API key for editing
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      if (result.geminiApiKey) {
        currentApiKeyInput.value = result.geminiApiKey;
        currentApiKeyInput.type = "text";
      }
    });
    
    // Disable the eye icon during editing
    showHideKeyBtn.style.opacity = "0.5";
    showHideKeyBtn.style.pointerEvents = "none";
    
    // Show confirm and cancel buttons
    const checkmarkBtn = document.getElementById("confirm-api-key");
    const cancelBtn = document.getElementById("cancel-api-key");
    if (checkmarkBtn) {
      checkmarkBtn.style.display = "inline-flex";
    }
    if (cancelBtn) {
      cancelBtn.style.display = "inline-flex";
    }
    
    // Hide the change button
    changeApiKeyBtn.style.display = "none";
  });

  // Cancel API key change
  document.getElementById("cancel-api-key").addEventListener("click", () => {
    isEditingApiKey = false;
    // Reset to readonly state
    currentApiKeyInput.setAttribute('readonly', true);
    
    // Reload the original API key (masked)
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      if (result.geminiApiKey) {
        const maskedKey = result.geminiApiKey.substring(0, 8) + "..." + result.geminiApiKey.substring(result.geminiApiKey.length - 4);
        currentApiKeyInput.value = maskedKey;
        currentApiKeyInput.type = "password";
      }
    });
    
    // Hide confirm and cancel buttons, show change button
    const checkmarkBtn = document.getElementById("confirm-api-key");
    const cancelBtn = document.getElementById("cancel-api-key");
    if (checkmarkBtn) {
      checkmarkBtn.style.display = "none";
    }
    if (cancelBtn) {
      cancelBtn.style.display = "none";
    }
    changeApiKeyBtn.style.display = "inline-flex";
    
    // Reset eye icon state and re-enable it
    const eyeIcon = showHideKeyBtn.querySelector('.eye-icon');
    const eyeOffIcon = showHideKeyBtn.querySelector('.eye-off-icon');
    eyeIcon.style.display = "block";
    eyeOffIcon.style.display = "none";
    showHideKeyBtn.style.opacity = "1";
    showHideKeyBtn.style.pointerEvents = "auto";
  });

  // Confirm API key change
  document.getElementById("confirm-api-key").addEventListener("click", () => {
    const newApiKey = currentApiKeyInput.value.trim();
    if (newApiKey && newApiKey.length > 10) { // Basic validation
      chrome.storage.local.set({ geminiApiKey: newApiKey }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving API key:', chrome.runtime.lastError);
          return;
        }
        
        // Show success message briefly
        const checkmarkBtn = document.getElementById("confirm-api-key");
        const originalText = checkmarkBtn.innerHTML;
        checkmarkBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"></polyline></svg>';
        checkmarkBtn.style.backgroundColor = "#005BAA";
        
        setTimeout(() => {
          
          // Reset to readonly state
          currentApiKeyInput.setAttribute('readonly', true);
          
          // Mask the key again
          const maskedKey = newApiKey.substring(0, 8) + "..." + newApiKey.substring(newApiKey.length - 4);
          currentApiKeyInput.value = maskedKey;
          currentApiKeyInput.type = "password";
          
          // Hide confirm and cancel buttons and show change button
          const checkmarkBtn = document.getElementById("confirm-api-key");
          const cancelBtn = document.getElementById("cancel-api-key");
          if (checkmarkBtn) {
            checkmarkBtn.style.display = "none";
            checkmarkBtn.style.backgroundColor = "";
            checkmarkBtn.innerHTML = originalText;
          }
          if (cancelBtn) {
            cancelBtn.style.display = "none";
          }
          changeApiKeyBtn.style.display = "inline-flex";
          
          // Reset eye icon state
          const eyeIcon = showHideKeyBtn.querySelector('.eye-icon');
          const eyeOffIcon = showHideKeyBtn.querySelector('.eye-off-icon');
          eyeIcon.style.display = "block";
          eyeOffIcon.style.display = "none";
          
          // Re-enable the eye icon
          showHideKeyBtn.style.opacity = "1";
          showHideKeyBtn.style.pointerEvents = "auto";
          
          // Reset editing state
          isEditingApiKey = false;
        }, 1000);
      });
    } else {
      // Show error for invalid API key
      currentApiKeyInput.style.borderColor = "#ef4444";
      setTimeout(() => {
        currentApiKeyInput.style.borderColor = "#d1d5db";
      }, 2000);
    }
  });

  // Delete API key
  deleteApiKeyBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete your API key? \n\n Note: This will delete your summarization history and remove access to the summarization feature.")) {
      chrome.storage.local.remove(['geminiApiKey', 'summaries'], () => {
        closeSettingsModal();
        showApiSetup();
      });
    }
  });

  // Clear button
  clearPopupBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete your history? This will delete all the summaries.")) {
      chrome.storage.local.set({ summaries: [] }, () => {
        loadSummaries();
      });
    }
  });

  // Format timestamp on summaries
  function formatTimeAgo(timestamp) {
    if (!timestamp) return "";
    
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return "Just now";
    }
  }

  // Give timestamps on old summaries
  function migrateOldSummaries() {
    chrome.storage.local.get({ summaries: [] }, (data) => {
      const summaries = data.summaries;
      let needsMigration = false;
      
      // Check if any summaries need migration
      summaries.forEach(summary => {
        if (typeof summary === 'string') {
          needsMigration = true;
        }
      });
      
      if (needsMigration) {
        const migratedSummaries = summaries.map(summary => {
          if (typeof summary === 'string') {

            // Convert old string format to new object format
            return {
              text: summary,
              timestamp: Date.now() // Use current time for old summaries
            };
          }
          return summary; // Already in new format
        });
        
        chrome.storage.local.set({ summaries: migratedSummaries }, () => {
          console.log('Migrated old summaries to new format');
        });
      }
    });
  }

  // Close popup
  document.getElementById("close-popup").addEventListener("click", () => {
    window.close();
  });

  // Handle Enter key in API input
  apiKeyInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveApiKeyBtn.click();
    }
  });

  // Show/Hide API key on setup page
  document.getElementById("show-hide-setup-key").addEventListener("click", () => {
    const eyeIcon = document.querySelector("#show-hide-setup-key .eye-icon");
    const eyeOffIcon = document.querySelector("#show-hide-setup-key .eye-off-icon");
    
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      eyeIcon.style.display = "none";
      eyeOffIcon.style.display = "block";
    } else {
      apiKeyInput.type = "password";
      eyeIcon.style.display = "block";
      eyeOffIcon.style.display = "none";
    }
  });

  // Handle Enter key in current API key input for confirming changes
  currentApiKeyInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !currentApiKeyInput.hasAttribute('readonly')) {
      document.getElementById("confirm-api-key").click();
    }
  });
});
