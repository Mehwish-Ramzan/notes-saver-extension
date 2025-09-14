// popup.js — includes locked notes modal + in-popup settings for PIN
(function() {
  function dbg(msg) { console.log("[NotesSaver-debug]", msg); }

  document.addEventListener("DOMContentLoaded", () => {
    dbg("popup DOMContentLoaded");

    // DOM
    const noteInput = document.getElementById("noteInput");
    const saveBtn = document.getElementById("saveBtn");
    const notesList = document.getElementById("notesList");
    const darkToggleWrap = document.getElementById("darkToggleWrap");
    const settingsWrap = document.getElementById("settingsWrap");
    const darkModeToggle = document.getElementById("darkModeToggle");
    const searchInput = document.getElementById("searchInput");
    const recycleBinBtn = document.getElementById("recycleBinBtn");
    const lockedNotesBtn = document.getElementById("lockedNotesBtn");
    const emptyPlaceholder = document.getElementById("emptyPlaceholder");

    // modals
    const modalOverlay = document.getElementById("modalOverlay");
    const modalContent = document.getElementById("modalContent");
    const modalTitle = document.getElementById("modalTitle");
    const modalUnlockBtn = document.getElementById("modalUnlockBtn");
    const modalEditBtn = document.getElementById("modalEditBtn");
    const modalDeleteBtn = document.getElementById("modalDeleteBtn");
    const modalCloseBtn = document.getElementById("modalCloseBtn");

    const recycleModalOverlay = document.getElementById("recycleModalOverlay");
    const recycleList = document.getElementById("recycleList");
    const recycleEmpty = document.getElementById("recycleEmpty");
    const emptyRecycleBtn = document.getElementById("emptyRecycleBtn");
    const closeRecycleBtn = document.getElementById("closeRecycleBtn");

    const lockedModalOverlay = document.getElementById("lockedModalOverlay");
    const lockedList = document.getElementById("lockedList");
    const lockedEmpty = document.getElementById("lockedEmpty");
    const closeLockedBtn = document.getElementById("closeLockedBtn");

    // settings modal (in-popup)
    const settingsModalOverlay = document.getElementById("settingsModalOverlay");
    const popupPinInput = document.getElementById("popupPinInput");
    const setPinBtn = document.getElementById("setPinBtn");
    const clearPinBtn = document.getElementById("clearPinBtn");
    const popupPinStatus = document.getElementById("popupPinStatus");
    const closeSettingsBtn = document.getElementById("closeSettingsBtn");

    if (!notesList) {
      dbg("ERROR: notesList missing - abort");
      return;
    }

    // ensure overlays hidden on startup
    modalOverlay && modalOverlay.classList.add("hidden");
    recycleModalOverlay && recycleModalOverlay.classList.add("hidden");
    lockedModalOverlay && lockedModalOverlay.classList.add("hidden");
    settingsModalOverlay && settingsModalOverlay.classList.add("hidden");

    // hash function
    async function hashPin(pin) {
      const enc = new TextEncoder();
      const data = enc.encode(pin);
      const buf = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    }

    // ---- load & render notes (exclude locked notes from main list) ----
    function updateLockedCountUI(count) {
      if (lockedNotesBtn) lockedNotesBtn.textContent = `Locked Notes (${count})`;
    }

    function loadNotes() {
      chrome.storage.local.get(["notes"], (res) => {
        notesList.innerHTML = "";
        const notes = res.notes || [];
        // newest first
        notes.sort((a,b) => new Date(b.date) - new Date(a.date));

        // filter: exclude locked notes from main list
        const visible = notes.filter(n => !n.locked);

        // search
        const q = (searchInput?.value || "").toLowerCase();
        const filtered = visible.filter(n => n.text.toLowerCase().includes(q));

        emptyPlaceholder && (emptyPlaceholder.style.display = filtered.length === 0 ? "block" : "none");

        // update locked notes count
        const lockedCount = notes.filter(n => n.locked).length;
        updateLockedCountUI(lockedCount);

        filtered.forEach(note => {
          const li = document.createElement("li");
          const noteDiv = document.createElement("div");
          noteDiv.className = "noteText";
          noteDiv.textContent = note.text;
          noteDiv.title = note.text;

          noteDiv.addEventListener("click", () => showModal(note.id));

          const actions = document.createElement("div");
          actions.className = "noteActions";

          // lock icon: clicking locks the note (but require PIN exist)
          const lockIcon = document.createElement("img");
          lockIcon.className = "lockIcon";
          lockIcon.src = "unlock.png";
          lockIcon.title = "Lock this note";
          lockIcon.addEventListener("click", (e) => {
            e.stopPropagation();
            // check if pin exists
            chrome.storage.local.get(["pinHash"], (r) => {
              if (!r.pinHash) {
                // open settings modal to set PIN
                openSettingsModal("You must set a PIN before locking notes.");
                return;
              }
              // lock
              toggleLock(note.id, true);
            });
          });

          const editIcon = document.createElement("img");
          editIcon.src = "edit.png";
          editIcon.title = "Edit";
          editIcon.addEventListener("click", (e) => {
            e.stopPropagation();
            editNote(note.id);
          });

          const copyIcon = document.createElement("img");
          copyIcon.src = "copy.png";
          copyIcon.title = "Copy";
          copyIcon.addEventListener("click", (e) => {
            e.stopPropagation();
            copyNote(note.id);
          });

          const deleteIcon = document.createElement("img");
          deleteIcon.src = "delete.png";
          deleteIcon.title = "Delete";
          deleteIcon.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteNote(note.id);
          });

          actions.append(lockIcon, editIcon, copyIcon, deleteIcon);
          li.appendChild(noteDiv);
          li.appendChild(actions);
          notesList.appendChild(li);
        });
      });
    }

    // ---- save / update ----
    saveBtn && saveBtn.addEventListener("click", () => {
      const text = (noteInput?.value || "").trim();
      if (!text) return alert("Note cannot be empty");
      chrome.storage.local.get(["notes"], (res) => {
        const notes = res.notes || [];
        const editId = saveBtn.dataset.editId ? parseInt(saveBtn.dataset.editId, 10) : null;
        if (editId) {
          const idx = notes.findIndex(n => n.id === editId);
          if (idx > -1) {
            notes[idx].text = text;
            notes[idx].date = new Date().toISOString();
          }
          delete saveBtn.dataset.editId;
        } else {
          notes.push({ id: Date.now(), text, date: new Date().toISOString(), locked: false });
        }
        chrome.storage.local.set({ notes }, () => {
          if (noteInput) noteInput.value = "";
          loadNotes();
        });
      });
    });

    // ---- edit / copy / delete / lock toggle ----
    function editNote(id) {
      chrome.storage.local.get(["notes"], (res) => {
        const notes = res.notes || [];
        const note = notes.find(n => n.id === id);
        if (!note) return;
        noteInput.value = note.text;
        saveBtn.dataset.editId = id;
        noteInput.focus();
      });
    }
    function copyNote(id) {
      chrome.storage.local.get(["notes"], (res) => {
        const notes = res.notes || [];
        const note = notes.find(n => n.id === id);
        if (!note) return;
        navigator.clipboard.writeText(note.text).then(() => alert("Copied to clipboard!")).catch(() => alert("Copy failed"));
      });
    }
    function deleteNote(id) {
      chrome.storage.local.get(["notes","deletedNotes"], (res) => {
        const notes = res.notes || [];
        const deleted = res.deletedNotes || [];
        const idx = notes.findIndex(n => n.id === id);
        if (idx === -1) return;
        const [removed] = notes.splice(idx, 1);
        if (removed) deleted.push(removed);
        chrome.storage.local.set({ notes, deletedNotes: deleted }, loadNotes);
      });
    }
    function toggleLock(id, lockState) {
      chrome.storage.local.get(["notes"], (res) => {
        const notes = res.notes || [];
        const idx = notes.findIndex(n => n.id === id);
        if (idx === -1) return;
        notes[idx].locked = !!lockState;
        chrome.storage.local.set({ notes }, loadNotes);
      });
    }

    // ---- full note modal ----
    let modalShownNoteId = null;
    function showModal(id) {
      if (!modalOverlay || !modalContent || !modalTitle) return;
      chrome.storage.local.get(["notes"], (res) => {
        const notes = res.notes || [];
        const note = notes.find(n => n.id === id);
        if (!note) return;
        modalContent.textContent = note.text;
        modalTitle.textContent = `Note (${new Date(note.date).toLocaleString()})`;
        // if locked (should not show here), guard — but main list excludes locked
        modalOverlay.classList.remove("hidden");
        modalShownNoteId = id;
      });
    }
    modalCloseBtn && modalCloseBtn.addEventListener("click", () => { modalOverlay.classList.add("hidden"); modalShownNoteId = null; });
    modalOverlay && modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) modalOverlay.classList.add("hidden"); });
    modal && modal.addEventListener("click", (e) => e.stopPropagation());
    modalDeleteBtn && modalDeleteBtn.addEventListener("click", () => { if (!modalShownNoteId) return; deleteNote(modalShownNoteId); modalOverlay.classList.add("hidden"); modalShownNoteId = null; });
    modalEditBtn && modalEditBtn.addEventListener("click", () => { if (!modalShownNoteId) return; modalOverlay.classList.add("hidden"); editNote(modalShownNoteId); });

    // ---- recycle modal logic (same as before) ----
    function openRecycleModal() {
      if (!recycleModalOverlay || !recycleList) return;
      recycleList.innerHTML = "";
      chrome.storage.local.get(["deletedNotes"], (res) => {
        const deleted = res.deletedNotes || [];
        deleted.sort((a,b) => new Date(b.date) - new Date(a.date));
        if (deleted.length === 0) recycleEmpty && (recycleEmpty.style.display = "block"); else recycleEmpty && (recycleEmpty.style.display = "none");
        deleted.forEach(note => {
          const li = document.createElement("li");
          const txt = document.createElement("div"); txt.className = "noteText"; txt.textContent = note.text; txt.title = note.text;
          const actions = document.createElement("div"); actions.className = "noteActions";
          const restoreBtn = document.createElement("button"); restoreBtn.className = "button-small btn-restore"; restoreBtn.textContent = "Restore";
          restoreBtn.addEventListener("click", () => restoreDeleted(note.id));
          const delBtn = document.createElement("button"); delBtn.className = "button-small btn-delete"; delBtn.textContent = "Delete Permanently";
          delBtn.addEventListener("click", () => deleteForever(note.id));
          actions.append(restoreBtn, delBtn);
          li.append(txt, actions);
          recycleList.appendChild(li);
        });
        recycleModalOverlay.classList.remove("hidden");
      });
    }
    function closeRecycleModal() { recycleModalOverlay && recycleModalOverlay.classList.add("hidden"); }
    function restoreDeleted(id) {
      chrome.storage.local.get(["notes","deletedNotes"], (res) => {
        const notes = res.notes || []; let deleted = res.deletedNotes || [];
        const idx = deleted.findIndex(n => n.id === id); if (idx === -1) return;
        const [restored] = deleted.splice(idx,1); if (restored) notes.push(restored);
        chrome.storage.local.set({ notes, deletedNotes: deleted }, () => { openRecycleModal(); loadNotes(); });
      });
    }
    function deleteForever(id) {
      chrome.storage.local.get(["deletedNotes"], (res) => {
        let deleted = res.deletedNotes || []; deleted = deleted.filter(n => n.id !== id);
        chrome.storage.local.set({ deletedNotes: deleted }, () => openRecycleModal());
      });
    }
    emptyRecycleBtn && emptyRecycleBtn.addEventListener("click", () => {
      const ok = confirm("Empty Recycle Bin? This will permanently delete all deleted notes.");
      if (!ok) return;
      chrome.storage.local.set({ deletedNotes: [] }, () => openRecycleModal());
    });
    closeRecycleBtn && closeRecycleBtn.addEventListener("click", closeRecycleModal);
    recycleModalOverlay && recycleModalOverlay.addEventListener("click", (e) => { if (e.target === recycleModalOverlay) closeRecycleModal(); });
    const recycleModal = document.getElementById("recycleModal"); recycleModal && recycleModal.addEventListener("click", (e)=>e.stopPropagation());

    // ---- locked notes modal logic ----
    async function openLockedModalWithAuth() {
      // ask for PIN first
      const pin = prompt("Enter PIN to view locked notes:");
      if (pin === null) return;
      const ph = await hashPin(pin);
      chrome.storage.local.get(["pinHash"], (res) => {
        if (!res.pinHash) {
          alert("No PIN set. Please set a PIN in Settings first.");
          openSettingsModal();
          return;
        }
        if (ph !== res.pinHash) {
          alert("Incorrect PIN.");
          return;
        }
        // authorized -> open modal and show locked notes
        lockedList.innerHTML = "";
        chrome.storage.local.get(["notes"], (r2) => {
          const notes = (r2.notes || []).filter(n => n.locked).sort((a,b)=> new Date(b.date)-new Date(a.date));
          if (notes.length === 0) lockedEmpty && (lockedEmpty.style.display = "block"); else lockedEmpty && (lockedEmpty.style.display = "none");
          notes.forEach(note => {
            const li = document.createElement("li");
            const txt = document.createElement("div"); txt.className = "noteText"; txt.textContent = note.text; txt.title = note.text;
            const actions = document.createElement("div"); actions.className = "noteActions";
            const unlockBtn = document.createElement("button"); unlockBtn.className = "button-small btn-restore"; unlockBtn.textContent = "Unlock";
            unlockBtn.addEventListener("click", () => {
              toggleLock(note.id, false); openLockedModalWithAuth(); // refresh modal after unlocking
            });
            const delBtn = document.createElement("button"); delBtn.className = "button-small btn-delete"; delBtn.textContent = "Delete";
            delBtn.addEventListener("click", () => {
              // delete moves to deletedNotes
              deleteNote(note.id); openLockedModalWithAuth();
            });
            actions.append(unlockBtn, delBtn);
            li.append(txt, actions);
            lockedList.appendChild(li);
          });
          lockedModalOverlay.classList.remove("hidden");
        });
      });
    }
    lockedNotesBtn && lockedNotesBtn.addEventListener("click", openLockedModalWithAuth);
    closeLockedBtn && closeLockedBtn.addEventListener("click", () => lockedModalOverlay.classList.add("hidden"));
    lockedModalOverlay && lockedModalOverlay.addEventListener("click", (e) => { if (e.target === lockedModalOverlay) lockedModalOverlay.classList.add("hidden"); });
    const lockedModal = document.getElementById("lockedModal"); lockedModal && lockedModal.addEventListener("click", (e) => e.stopPropagation());

    // ---- settings modal (PIN) in-popup ----
    async function updatePopupPinStatus() {
      chrome.storage.local.get(["pinHash"], (res) => {
        popupPinStatus.textContent = res.pinHash ? "PIN is set." : "No PIN set.";
      });
    }
    function openSettingsModal(message) {
      // show message if provided (use alert for simplicity)
      if (message) alert(message);
      updatePopupPinStatus();
      settingsModalOverlay && settingsModalOverlay.classList.remove("hidden");
    }
    closeSettingsBtn && closeSettingsBtn.addEventListener("click", () => settingsModalOverlay && settingsModalOverlay.classList.add("hidden"));
    settingsModalOverlay && settingsModalOverlay.addEventListener("click", (e) => { if (e.target === settingsModalOverlay) settingsModalOverlay.classList.add("hidden"); });
    const settingsModal = document.getElementById("settingsModal"); settingsModal && settingsModal.addEventListener("click", (e) => e.stopPropagation());

    setPinBtn && setPinBtn.addEventListener("click", async () => {
      const pin = (popupPinInput?.value || "").trim();
      if (!pin) return alert("Enter a PIN");
      const ph = await hashPin(pin);
      chrome.storage.local.set({ pinHash: ph }, () => {
        popupPinInput.value = "";
        alert("PIN saved ✅");
        updatePopupPinStatus();
      });
    });
    clearPinBtn && clearPinBtn.addEventListener("click", () => {
      const ok = confirm("Remove PIN? Locked notes will be viewable without a PIN.");
      if (!ok) return;
      chrome.storage.local.remove(["pinHash"], () => { alert("PIN removed."); updatePopupPinStatus(); });
    });
    // settingsWrap opens settings modal instead of options page
    settingsWrap && settingsWrap.addEventListener("click", (e) => { e.stopPropagation(); closeAllTooltips(); settingsWrap.classList.toggle("tooltip-open"); openSettingsModal(); });

    // ---- dark toggle & tooltips behavior ----
    darkToggleWrap && darkToggleWrap.addEventListener("click", (e) => {
      e.stopPropagation();
      document.body.classList.toggle("dark-mode");
      if (darkModeToggle) darkModeToggle.src = document.body.classList.contains("dark-mode") ? "toggle-on.png" : "toggle-off.png";
      closeAllTooltips();
      darkToggleWrap.classList.toggle("tooltip-open");
    });
    function closeAllTooltips() { document.querySelectorAll(".icon.tooltip-open").forEach(el => el.classList.remove("tooltip-open")); }
    document.addEventListener("click", () => closeAllTooltips());

    // ---- recycle modal controls attach ----
    recycleBinBtn && recycleBinBtn.addEventListener("click", openRecycleModal);
    // already set other handlers above

    // ---- initial load and search ----
    searchInput && searchInput.addEventListener("input", loadNotes);
    loadNotes();
    updatePopupPinStatus();

    dbg("popup initialized");
  }); // DOMContentLoaded
})();
