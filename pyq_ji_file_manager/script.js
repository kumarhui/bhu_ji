const CONFIG = {
    jsonPath: 'drive_files.json'
};

// State for Card View Navigation
let fullFileTree = null;
let breadcrumbPath = [];

// State for Admin functionality
let isAdminLoggedIn = false;
let isEditMode = true;
const selectedItems = new Set();

// --- HELPER FUNCTIONS ---

/**
 * Formats file size in bytes to a human-readable string (KB, MB, GB).
 * @param {number} bytes - The file size in bytes.
 * @returns {string} A formatted size string or an empty string if input is invalid.
 */
function formatSize(bytes) {
    if (bytes === undefined || bytes === null || bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Returns an emoji icon based on the node's type (folder or file mime type).
 * @param {object} node - The file/folder node object.
 * @returns {string} An emoji character.
 */
function getIcon(node) {
    if (node.IsDir) return '📁';
    const mime = (node.MimeType || '').toLowerCase();
    if (mime.includes('pdf')) return '📕';
    if (mime.startsWith('image')) return '🖼️';
    if (mime.startsWith('video')) return '🎬';
    if (mime.startsWith('audio')) return '🎵';
    if (mime.includes('zip') || mime.includes('compressed') || mime.includes('rar')) return '📦';
    if (mime.includes('word') || mime.includes('document')) return '📝';
    if (mime.includes('sheet') || mime.includes('excel')) return '📊';
    return '📄';
}

/**
 * Builds a nested tree structure from a flat array of file/folder items.
 * @param {Array<object>} items - The array of items from the JSON file.
 * @returns {object} The root of the constructed tree.
 */
function buildTree(items) {
    const root = { Name: "Root", IsDir: true, children: {} };
    
    items.forEach(item => {
        const parts = item.Path.split('/').filter(p => p.length > 0);
        let current = root;

        parts.forEach((part, index) => {
            if (!current.children[part]) {
                current.children[part] = {
                    Name: part,
                    IsDir: true, // Assume folder until specified otherwise
                    children: {}
                };
            }
            current = current.children[part];

            if (index === parts.length - 1) {
                Object.assign(current, item);
            }
        });
    });
    return root;
}

/**
 * Converts the in-memory tree back to a flat list for saving.
 * @param {object} node - The current node in the tree to process.
 * @param {string} currentPath - The path accumulated so far.
 * @returns {Array<object>} A flat array of file/folder items.
 */
function flattenTree(node, currentPath = '') {
    let items = [];
    const children = node.children ? Object.values(node.children) : [];

    for (const child of children) {
        const newPath = currentPath ? `${currentPath}/${child.Name}` : child.Name;
        
        // Create a clean item without the 'children' property
        const { children: _, ...itemData } = child;
        itemData.Path = newPath;

        items.push(itemData);

        if (child.IsDir && child.children) {
            items = items.concat(flattenTree(child, newPath));
        }
    }
    return items;
}

// --- RENDERING FUNCTIONS ---

/**
 * Creates a DOM element for a file/folder in the tree view.
 * @param {object} node - The node from the tree structure.
 * @param {number} depth - The current depth in the tree for indentation.
 * @returns {HTMLElement} The created DOM element for the node.
 */
function createTreeNodeElement(node, depth = 0) {
    const container = document.createElement('div');
    
    const row = document.createElement('div');
    row.className = 'tree-row';
    row.style.paddingLeft = `${depth * 24 + 16}px`;

    if (isAdminLoggedIn && isEditMode) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'item-checkbox';
        checkbox.dataset.path = node.Path;
        checkbox.checked = selectedItems.has(node.Path);
        checkbox.onclick = (e) => {
            e.stopPropagation();
            toggleSelection(node.Path, e.target.checked);
        };
        row.appendChild(checkbox);
    }

    const toggleIcon = document.createElement('span');
    toggleIcon.className = 'toggle-icon';
    const hasChildren = node.children && Object.keys(node.children).length > 0;
    if (node.IsDir && hasChildren) {
        toggleIcon.textContent = '▶';
    } else {
        toggleIcon.classList.add('invisible');
        toggleIcon.textContent = '▶';
    }
    row.appendChild(toggleIcon);

    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = getIcon(node);
    row.appendChild(icon);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = node.Name;
    row.appendChild(nameSpan);

    if (!node.IsDir) {
        const sizeSpan = document.createElement('span');
        sizeSpan.className = 'file-size';
        sizeSpan.textContent = formatSize(node.Size);
        row.appendChild(sizeSpan);
    }

    container.appendChild(row);

    let childrenContainer = null;

    row.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (isAdminLoggedIn && isEditMode) {
            const checkbox = row.querySelector('.item-checkbox');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                toggleSelection(node.Path, checkbox.checked);
            }
            return;
        }

        if (node.IsDir) {
            if (!hasChildren) return;

            if (!childrenContainer) {
                // Lazy render children on first click
                childrenContainer = document.createElement('div');
                childrenContainer.className = 'tree-children';
                
                const sortedChildren = Object.values(node.children).sort((a, b) => {
                    if (a.IsDir !== b.IsDir) return a.IsDir ? -1 : 1;
                    return a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' });
                });

                sortedChildren.forEach(child => {
                    childrenContainer.appendChild(createTreeNodeElement(child, depth + 1));
                });
                container.appendChild(childrenContainer);
            }

            const isExpanded = toggleIcon.classList.toggle('expanded');
            childrenContainer.style.display = isExpanded ? 'block' : 'none';
            icon.textContent = isExpanded ? '📂' : '📁';

        } else {
            if (node.ID) {
                window.open(`https://drive.google.com/file/d/${node.ID}/view`, '_blank');
            } else {
                alert('No ID available for this file.');
            }
        }
    });

    return container;
}

// --- CARD VIEW FUNCTIONS ---

/**
 * Renders the breadcrumb navigation bar.
 */
function renderBreadcrumbs() {
    const container = document.getElementById('breadcrumbs');
    if (!container) return;
    
    container.innerHTML = '';
    
    breadcrumbPath.forEach((node, index) => {
        const span = document.createElement('span');
        span.className = 'breadcrumb-item';
        // Use a home icon for the root
        span.textContent = index === 0 ? '🏠 Home' : node.Name;
        
        if (index < breadcrumbPath.length - 1) {
            span.onclick = () => {
                // Navigate back to this node
                breadcrumbPath = breadcrumbPath.slice(0, index + 1);
                renderCardView(node);
            };
        }
        container.appendChild(span);
        
        if (index < breadcrumbPath.length - 1) {
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = '/';
            container.appendChild(separator);
        }
    });
}

/**
 * Creates a DOM element for a file/folder in the card view.
 * @param {object} node - The node from the tree structure.
 * @returns {HTMLElement} The created card element.
 */
function createCardElement(node) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.title = node.Name;

    if (isAdminLoggedIn && isEditMode) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'card-checkbox';
        checkbox.dataset.path = node.Path;
        checkbox.checked = selectedItems.has(node.Path);
        checkbox.onclick = (e) => {
            e.stopPropagation();
            toggleSelection(node.Path, e.target.checked);
        };
        card.appendChild(checkbox);
    }

    const icon = document.createElement('div');
    icon.className = 'card-icon';
    icon.textContent = getIcon(node);
    card.appendChild(icon);

    const name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = node.Name;
    card.appendChild(name);

    card.addEventListener('click', () => {
        if (isAdminLoggedIn && isEditMode) {
            const checkbox = card.querySelector('.card-checkbox');
            checkbox.checked = !checkbox.checked;
            toggleSelection(node.Path, checkbox.checked);
            return;
        }

        if (!node.IsDir && node.ID) {
            window.open(`https://drive.google.com/file/d/${node.ID}/view`, '_blank');
        } else if (node.IsDir) {
            breadcrumbPath.push(node);
            renderCardView(node);
        }
    });

    return card;
}

/**
 * Renders the card view for a specific folder node.
 * @param {object} node - The folder node to render.
 */
function renderCardView(node) {
    const cardContainer = document.getElementById('card-view');
    cardContainer.innerHTML = ''; // Clear current content
    
    renderBreadcrumbs();

    const children = node.children ? Object.values(node.children) : [];    
    
    if (children.length === 0) {
        cardContainer.innerHTML = '<div class="loading">Folder is empty.</div>';
        return;
    }

    const sortedChildren = children.sort((a, b) => {
        if (a.IsDir !== b.IsDir) return a.IsDir ? -1 : 1;
        return a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' });
    });

    sortedChildren.forEach(child => {
        cardContainer.appendChild(createCardElement(child));
    });
}

// --- ADMIN & SELECTION LOGIC ---

function toggleSelection(path, isSelected) {
    if (isSelected) {
        selectedItems.add(path);
    } else {
        selectedItems.delete(path);
    }
    updateAdminButtons();
    highlightSelected();
}

function updateAdminButtons() {
    const selectionCount = selectedItems.size;
    document.getElementById('delete-btn').disabled = selectionCount === 0;
    document.getElementById('open-file-btn').disabled = selectionCount !== 1;
    document.getElementById('rename-btn').disabled = selectionCount !== 1;
    document.getElementById('open-file-btn').style.display = isEditMode ? 'inline-block' : 'none';
}

function highlightSelected() {
    document.querySelectorAll('.tree-row, .file-card').forEach(el => {
        const checkbox = el.querySelector('input[type="checkbox"]');
        if (checkbox && selectedItems.has(checkbox.dataset.path)) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });
}

function clearSelections() {
    selectedItems.clear();
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateAdminButtons();
    highlightSelected();
}

function getCurrentNode() {
    return breadcrumbPath[breadcrumbPath.length - 1];
}

function refreshViews() {
    const currentNode = getCurrentNode();
    renderCardView(currentNode); // Re-render card view

    // Full re-render of tree view is complex due to lazy loading,
    // so for now we just focus on the more interactive card view.
    // A full implementation would require rebuilding the tree view's DOM.
    const treeContainer = document.getElementById('file-tree');
    treeContainer.innerHTML = '';
    const sortedRootItems = Object.values(fullFileTree.children).sort((a, b) => {
        if (a.IsDir !== b.IsDir) return a.IsDir ? -1 : 1;
        return a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' });
    });
    sortedRootItems.forEach(node => {
        treeContainer.appendChild(createTreeNodeElement(node, 0));
    });
}

function setupAdminActions() {
    document.getElementById('add-folder-btn').onclick = async () => {
        try {
            const inputs = await showDialog({
                title: 'Create New Folder',
                inputs: [{ name: 'folderName', placeholder: 'Folder Name', required: true }]
            });
            const folderName = inputs.folderName;
            const currentNode = getCurrentNode();
            const newPath = currentNode.Path ? `${currentNode.Path}/${folderName}` : folderName;

            if (currentNode.children[folderName]) {
                alert("A folder with this name already exists.");
                return;
            }

            currentNode.children[folderName] = {
                Name: folderName,
                Path: newPath,
                IsDir: true,
                children: {}
            };
            refreshViews();
        } catch (error) {
            // User cancelled
        }
    };

    document.getElementById('add-file-btn').onclick = async () => {
        try {
            const inputs = await showDialog({
                title: 'Create New File',
                inputs: [
                    { name: 'fileName', placeholder: 'File Name (e.g., report.pdf)', required: true },
                    { name: 'fileId', placeholder: 'Google Drive File ID', required: true }
                ]
            });
            const { fileName, fileId } = inputs;
            const currentNode = getCurrentNode();
            const newPath = currentNode.Path ? `${currentNode.Path}/${fileName}` : fileName;

            if (currentNode.children[fileName]) {
                alert("A file with this name already exists.");
                return;
            }

            currentNode.children[fileName] = {
                Name: fileName,
                Path: newPath,
                ID: fileId,
                IsDir: false,
                Size: 0,
                MimeType: 'application/octet-stream',
                ModTime: new Date().toISOString()
            };
            refreshViews();
        } catch (error) {
            // User cancelled
        }
    };

    document.getElementById('delete-btn').onclick = async () => {
        if (selectedItems.size === 0) return;
        try {
            await showDialog({
                title: 'Confirm Deletion',
                message: `Are you sure you want to delete ${selectedItems.size} item(s)? This action cannot be undone.`,
                confirmText: 'Delete'
            });

            const currentNode = getCurrentNode();
            selectedItems.forEach(path => {
                const name = path.split('/').pop();
                delete currentNode.children[name];
            });
            
            clearSelections();
            refreshViews();
        } catch (error) {
            // User cancelled
        }
    };

    document.getElementById('open-file-btn').onclick = () => {
        if (selectedItems.size !== 1) return;
        const path = selectedItems.values().next().value;
        const name = path.split('/').pop();
        const parentNode = getCurrentNode();
        const node = parentNode.children[name];

        if (node && node.ID) {
            window.open(`https://drive.google.com/file/d/${node.ID}/view`, '_blank');
        } else {
            alert('This item does not have a valid ID to open.');
        }
    };

    document.getElementById('rename-btn').onclick = async () => {
        if (selectedItems.size !== 1) return;

        const oldPath = selectedItems.values().next().value;
        const oldName = oldPath.split('/').pop();

        try {
            const inputs = await showDialog({
                title: 'Rename Item',
                inputs: [{ name: 'newName', placeholder: 'New Name', value: oldName, required: true }]
            });
            const { newName } = inputs;

            if (!newName || newName === oldName) return;

            const currentNode = getCurrentNode();
            if (currentNode.children[newName]) {
                alert("An item with this name already exists.");
                return;
            }

            const nodeToRename = currentNode.children[oldName];
            nodeToRename.Name = newName;
            delete currentNode.children[oldName];
            currentNode.children[newName] = nodeToRename;

            clearSelections();
            refreshViews();
        } catch (error) {
            // User cancelled
        }
    };

    document.getElementById('select-all-btn').onclick = () => {
        const currentNode = getCurrentNode();
        const children = currentNode.children ? Object.values(currentNode.children) : [];
        children.forEach(child => {
            selectedItems.add(child.Path);
        });
        refreshViews();
    };

    document.getElementById('deselect-all-btn').onclick = () => {
        clearSelections();
        // No need to refresh, clearSelections updates the UI efficiently
    };

    document.getElementById('logout-btn').onclick = () => {
        sessionStorage.removeItem('admin-token');
        window.location.reload();
    };

    document.getElementById('edit-mode-toggle').onchange = (e) => {
        isEditMode = e.target.checked;
        if (!isEditMode) {
            clearSelections();
        }
        // Re-render the current view to show/hide checkboxes
        refreshViews();
    };
}

// --- MAIN INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    checkSessionLogin();

    const treeContainer = document.getElementById('file-tree');
    const cardContainer = document.getElementById('card-view');
    const breadcrumbsContainer = document.getElementById('breadcrumbs');
    const statusEl = document.getElementById('status');
    const toggleBtn = document.getElementById('view-toggle-btn');
    let isTreeView = false;

    // Show loading state
    cardContainer.innerHTML = '<div class="loading">Loading drive_files.json...</div>';
    treeContainer.innerHTML = '<div class="loading">Loading drive_files.json...</div>';

    try {
        const response = await fetch(CONFIG.jsonPath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        statusEl.textContent = `${data.length} items loaded`;
        
        const treeRoot = buildTree(data);
        fullFileTree = treeRoot; // Store the complete tree
        
        // Initialize breadcrumb path with root
        breadcrumbPath = [treeRoot];

        // Get and sort top-level items
        const sortedRootItems = Object.values(treeRoot.children).sort((a, b) => {
            if (a.IsDir !== b.IsDir) return a.IsDir ? -1 : 1; // Folders first
            return a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' });
        });

        // --- Render Tree View ---
        treeContainer.innerHTML = ''; // Clear loading message
        sortedRootItems.forEach(node => {
            treeContainer.appendChild(createTreeNodeElement(node, 0));
        });

        // --- Initial Card View Render (Root) ---
        renderCardView(treeRoot);

        // --- View Toggling Logic ---
        toggleBtn.addEventListener('click', () => {
            isTreeView = !isTreeView;
            if (isTreeView) {
                treeContainer.style.display = 'block';
                cardContainer.style.display = 'none';
                breadcrumbsContainer.style.display = 'none';
                toggleBtn.textContent = '📇';
                toggleBtn.title = 'Switch to Card View';
            } else {
                treeContainer.style.display = 'none';
                cardContainer.style.display = 'flex';
                breadcrumbsContainer.style.display = 'flex';
                toggleBtn.textContent = '📄';
                toggleBtn.title = 'Switch to List View';
            }
        });

    } catch (err) {
        console.error(err);
        const errorMsg = `<div class="error">Failed to load ${CONFIG.jsonPath}.<br>Ensure you are running this on a local server (e.g. VS Code Live Server) or allow local file access.<br>Error: ${err.message}</div>`;
        treeContainer.innerHTML = errorMsg;
        cardContainer.innerHTML = errorMsg;
    }
}

/**
 * Shows a configurable, promise-based modal dialog.
 * @param {object} options - Configuration for the dialog.
 * @param {string} options.title - The title of the dialog.
 * @param {string} [options.message] - An optional message to display.
 * @param {Array<object>} [options.inputs] - An array of input field configurations.
 * @param {string} [options.confirmText='Confirm'] - Text for the confirm button.
 * @param {string} [options.cancelText='Cancel'] - Text for the cancel button.
 * @returns {Promise<object|null>} A promise that resolves with the input values or rejects on cancel.
 */
function showDialog(options) {
    return new Promise((resolve, reject) => {
        const modal = document.getElementById('dialog-modal');
        const titleEl = document.getElementById('dialog-title');
        const messageEl = document.getElementById('dialog-message');
        const inputsContainer = document.getElementById('dialog-inputs');
        const confirmBtn = document.getElementById('dialog-confirm-btn');
        const cancelBtn = document.getElementById('dialog-cancel-btn');

        titleEl.textContent = options.title;
        messageEl.textContent = options.message || '';
        messageEl.style.display = options.message ? 'block' : 'none';
        
        confirmBtn.textContent = options.confirmText || 'Confirm';
        cancelBtn.textContent = options.cancelText || 'Cancel';

        inputsContainer.innerHTML = '';
        if (options.inputs) {
            options.inputs.forEach(inputConf => {
                const input = document.createElement('input');
                input.type = inputConf.type || 'text';
                input.name = inputConf.name;
                input.placeholder = inputConf.placeholder || '';
                input.value = inputConf.value || '';
                input.required = inputConf.required || false;
                inputsContainer.appendChild(input);
            });
        }

        modal.style.display = 'flex';
        const firstInput = inputsContainer.querySelector('input');
        if (firstInput) firstInput.focus();

        function close() {
            modal.style.display = 'none';
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            modal.onclick = null;
        }

        confirmBtn.onclick = () => {
            const values = {};
            if (options.inputs) {
                inputsContainer.querySelectorAll('input').forEach(input => {
                    values[input.name] = input.value;
                });
            }
            close();
            resolve(values);
        };

        cancelBtn.onclick = () => { close(); reject('cancelled'); };
        modal.onclick = (e) => { if (e.target === modal) { close(); reject('cancelled'); } };
    });
}

function handleLogin() {
    const password = document.getElementById('password-input').value;
    const errorEl = document.getElementById('login-error');

    if (password === 'Cvam@Cvam') {
        isAdminLoggedIn = true;
        sessionStorage.setItem('admin-token', 'true'); // Keep logged in for the session
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('admin-toolbar').style.display = 'flex';
        document.getElementById('login-btn').style.display = 'none'; // Hide login button
        errorEl.textContent = '';
        refreshViews();
    } else {
        errorEl.textContent = 'Incorrect password.';
    }
}

function checkSessionLogin() {
    if (sessionStorage.getItem('admin-token') === 'true') {
        isAdminLoggedIn = true;
        document.getElementById('admin-toolbar').style.display = 'flex';
        document.getElementById('edit-mode-toggle').checked = isEditMode;
        document.getElementById('login-btn').style.display = 'none';
    }
}

// Event Listeners
document.getElementById('login-btn').addEventListener('click', () => {
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('password-input').focus();
});

document.getElementById('login-submit-btn').addEventListener('click', handleLogin);
document.getElementById('password-input').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleLogin();
});

// Close modal if clicking outside of it
document.getElementById('login-modal').addEventListener('click', (e) => {
    if (e.target.id === 'login-modal') {
        e.target.style.display = 'none';
    }
});

document.getElementById('dialog-modal').addEventListener('click', (e) => {
    // This is handled by the showDialog function now to allow promise rejection
    if (e.target.id === 'dialog-modal') {
        // The active listener on the modal will handle this
    }
});

document.getElementById('save-btn').addEventListener('click', () => {
    const flatData = flattenTree(fullFileTree);
    const jsonString = JSON.stringify(flatData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drive_files_updated.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('File "drive_files_updated.json" has been downloaded.\nReplace the old drive_files.json with this new file and restart the application to make changes permanent.');
});

setupAdminActions();