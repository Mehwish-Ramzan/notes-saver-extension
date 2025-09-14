// background.js

// Run when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log("✅ Notes Saver Plus Installed and Ready!");

  // Create context menu item for saving selected text
  chrome.contextMenus.create({
    id: "saveNote",
    title: "Save selected text as note",
    contexts: ["selection"]
  });

  // Example alarm: reminder every hour (can be customized in future)
  chrome.alarms.create("noteReminder", { periodInMinutes: 60 });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "saveNote" && info.selectionText) {
    const text = info.selectionText.trim();
    if (!text) return;

    chrome.storage.local.get(["notes"], (result) => {
      const notes = result.notes || [];
      notes.push({ 
        text, 
        tags: ["from-context-menu"], 
        date: new Date().toISOString() 
      });
      chrome.storage.local.set({ notes }, () => {
        console.log("✅ Note saved from context menu:", text);
      });
    });
  }
});


