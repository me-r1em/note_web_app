document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const themeBtn = document.getElementById('themeBtn');
  const themeIcon = document.getElementById('themeIcon');

  // ---------------- Theme Toggle ----------------
  const savedTheme = localStorage.getItem('cozy_theme');
  if (savedTheme === 'night') {
    body.classList.add('cozy-night');
    themeIcon.textContent = '🌙';
  } else {
    themeIcon.textContent = '☀️';
  }

  themeBtn?.addEventListener('click', () => {
    body.classList.toggle('cozy-night');
    const isNight = body.classList.contains('cozy-night');
    localStorage.setItem('cozy_theme', isNight ? 'night' : 'day');
    themeIcon.textContent = isNight ? '🌙' : '☀️';
  });

  // ---------------- Rich Text Editor ----------------
  function initRichText(editableDiv, toolbarButtons, fontSizeSelector) {
    toolbarButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const command = btn.dataset.command;
        document.execCommand(command, false, null);
        editableDiv.focus();
      });
    });

    fontSizeSelector?.addEventListener('change', () => {
      document.execCommand('fontSize', false, fontSizeSelector.value);
      editableDiv.focus();
    });
  }

  // ---------------- HTML Cleaner ----------------
function cleanHTML(html) {
  // Convert <font size="..."> to <span style="font-size:...">
  html = html.replace(/<font size="(\d+)">([\s\S]*?)<\/font>/gi, (match, size, inner) => {
    const sizeMap = { "1":"10px","2":"12px","3":"14px","4":"18px","5":"24px","6":"32px","7":"48px" };
    return `<span style="font-size:${sizeMap[size] || "14px"}">${inner}</span>`;
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function sanitizeNode(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();

      // Allow only safe formatting tags
      const allowedTags = ['b', 'i', 'u', 'p', 'div', 'span', 'br', 'ul', 'ol', 'li'];
      if (!allowedTags.includes(tag)) {
        node.replaceWith(...node.childNodes);
        return;
      }

      // Only keep safe attributes
      const allowedAttrs = ['style'];
      node.getAttributeNames().forEach(attr => {
        if (!allowedAttrs.includes(attr)) node.removeAttribute(attr);
      });

      // Clean style values to avoid script injections
      if (node.hasAttribute('style')) {
        let safeStyle = node.getAttribute('style');
        safeStyle = safeStyle.replace(/expression|url|javascript/gi, ''); // Remove malicious styles
        node.setAttribute('style', safeStyle);
      }
    }

    node.childNodes.forEach(sanitizeNode);
  }

  doc.body.childNodes.forEach(sanitizeNode);

  // Remove empty spans/divs
  let cleaned = doc.body.innerHTML
    .replace(/<div><br><\/div>/gi, '')
    .replace(/<span[^>]*>\s*<\/span>/gi, '');

  return cleaned;
}

  // ---------------- Add Note ----------------
  const addForm = document.getElementById('addForm');
  if (addForm) {
    const editableDiv = document.getElementById('contentInput');
    const toolbarButtons = document.querySelectorAll('.toolbar button');
    const fontSizeSelector = document.getElementById('fontSizeSelector');
    const titleInput = document.getElementById('titleInput');
    const tagsInput = document.getElementById('tagsInput');
    const pinnedCheck = document.getElementById('pinnedCheck');
    const clearDraft = document.getElementById('clearDraft');
    const DRAFT_KEY = 'cozy_draft';

    initRichText(editableDiv, toolbarButtons, fontSizeSelector);

    addForm.addEventListener('submit', () => {
      let hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.name = 'content';
      hiddenInput.value = cleanHTML(editableDiv.innerHTML);
      addForm.appendChild(hiddenInput);
      localStorage.removeItem(DRAFT_KEY);
      // Also clear the server-side draft
      fetch('/draft', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ title: '', content: '' })
      }).catch(() => {});
    });

    function saveLocalDraft() {
      const draft = {
        title: titleInput?.value || '',
        content: cleanHTML(editableDiv?.innerHTML || ''),
        tags: tagsInput?.value || '',
        pinned: pinnedCheck?.checked || false
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }

    try {
      const savedDraft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
      if (titleInput && !titleInput.value) titleInput.value = savedDraft.title || '';
      if (editableDiv && !editableDiv.innerHTML) editableDiv.innerHTML = savedDraft.content || '';
      if (tagsInput) tagsInput.value = savedDraft.tags || '';
      if (pinnedCheck) pinnedCheck.checked = savedDraft.pinned || false;
    } catch (e) {}

    let timer = null;
    function scheduleSave() {
      saveLocalDraft();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fetch('/draft', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            title: titleInput?.value || '',
            content: cleanHTML(editableDiv?.innerHTML || '')
          })
        }).catch(() => {});
      }, 700);
    }

    [titleInput, editableDiv, tagsInput].forEach(el => el?.addEventListener('input', scheduleSave));

    function showAutosaveToast() {
      let t = document.getElementById('autosaveToast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'autosaveToast';
        t.innerText = 'Draft saved ✨';
        document.body.appendChild(t);
      }
      t.style.display = 'block';
      setTimeout(() => (t.style.display = 'none'), 1200);
    }

    clearDraft?.addEventListener('click', () => {
      localStorage.removeItem(DRAFT_KEY);
      fetch('/draft', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ title: '', content: '' })
      });
      titleInput.value = '';
      editableDiv.innerHTML = '';
      tagsInput.value = '';
      showAutosaveToast();
    });
  }

  // ---------------- Edit Note ----------------
  const editForm = document.getElementById('editForm');
  if (editForm) {
    const editableDiv = document.getElementById('contentInput');
    const toolbarButtons = document.querySelectorAll('.toolbar button');
    const fontSizeSelector = document.getElementById('fontSizeSelect');
    const titleInput = document.getElementById('titleInput');
    const tagsInput = document.getElementById('tagsInput');
    const pinnedCheck = document.getElementById('pinnedCheck');
    const hiddenInput = document.getElementById('contentHidden');
    const DRAFT_KEY = `edit_draft_${editForm.dataset.noteId || 'default'}`;

    initRichText(editableDiv, toolbarButtons, fontSizeSelector);

    editForm.addEventListener('submit', () => {
      const html = cleanHTML(editableDiv.innerHTML);
      hiddenInput.value = html;
      
      // Clear both local and server-side drafts when form is submitted
      localStorage.removeItem(DRAFT_KEY);
      
      // Also clear any server-side draft for this note
      fetch('/draft', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
          noteId: editForm.dataset.noteId,
          title: '', 
          content: '',
          tags: '',
          pinned: false
        })
      }).catch(() => {});
    });

    try {
      const savedDraft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
      // Only load draft if it has content
      if (savedDraft.title && savedDraft.title.trim()) titleInput.value = savedDraft.title;
      if (savedDraft.content && savedDraft.content.trim()) editableDiv.innerHTML = savedDraft.content;
      if (savedDraft.tags) tagsInput.value = savedDraft.tags;
      if (savedDraft.pinned !== undefined) pinnedCheck.checked = savedDraft.pinned;
    } catch (e) {}

    let timer = null;
    function scheduleSave() {
      const draft = {
        noteId: editForm.dataset.noteId,
        title: titleInput?.value || '',
        content: cleanHTML(editableDiv?.innerHTML || ''),
        tags: tagsInput?.value || '',
        pinned: pinnedCheck?.checked || false
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fetch('/draft', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(draft)
        }).catch(() => {});
      }, 700);
    }

    [titleInput, editableDiv, tagsInput].forEach(el => el?.addEventListener('input', scheduleSave));
    
    // Add a clear draft button for edit form too
    const editFormActions = document.querySelector('.form-actions');
    if (editFormActions) {
      const clearEditDraft = document.createElement('button');
      clearEditDraft.type = 'button';
      clearEditDraft.className = 'btn btn-secondary';
      clearEditDraft.innerText = 'Clear Draft';
      clearEditDraft.addEventListener('click', () => {
        // Reload the original content by refreshing the page
        window.location.reload();
      });
      editFormActions.appendChild(clearEditDraft);
    }
  }

  // ---------------- Pin toggle ----------------
  document.querySelectorAll('.toggle-pin').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      fetch(`/toggle_pin/${id}`, { method: 'POST' })
        .then(r => r.json())
        .then(() => window.location.reload());
    });
  });

  // ---------------- Delete note ----------------
  document.querySelectorAll('.delete-note').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      if (!id) return;

      if (confirm('Are you sure you want to delete this note? ❌')) {
        fetch(`/delete_note/${id}`, { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              // Clear any drafts associated with this note
              localStorage.removeItem(`edit_draft_${id}`);
              window.location.reload();
            } else {
              alert('Failed to delete note 😢');
            }
          })
          .catch(() => alert('Error deleting note 😢'));
      }
    });
  });
    // ---------------- Navbar Active Link Highlight ----------------
  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      // Remove .active from all links
      navLinks.forEach(a => a.classList.remove('active'));
      // Add .active to the clicked one
      link.classList.add('active');
    });
  });
  
});
