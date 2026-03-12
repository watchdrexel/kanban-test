import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// State management
let supabase = null;
let tasks = [];
let boards = [];
let currentBoard = null;
let user = null;
let isSignUp = false;

// DOM Elements
const addTaskBtn = document.getElementById('addTaskBtn');
const taskModal = document.getElementById('taskModal');
const closeModal = document.querySelector('.close');
const taskForm = document.getElementById('taskForm');
const modalTitle = document.getElementById('modalTitle');

const authOverlay = document.getElementById('authOverlay');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const authSubmit = document.getElementById('authSubmit');
const toggleAuth = document.getElementById('toggleAuth');
const forceLogout = document.getElementById('forceLogout');
const projectInfo = document.getElementById('projectInfo');
const projectUrlDisplay = document.getElementById('projectUrl');
const connectionStatus = document.getElementById('connectionStatus');
const toggleDebug = document.getElementById('toggleDebug');
const debugLog = document.getElementById('debugLog');
const dbErrorNotice = document.getElementById('dbErrorNotice');
const viewSqlBtn = document.getElementById('viewSqlBtn');
const sqlModal = document.getElementById('sqlModal');
const closeSqlModal = document.querySelector('.close-sql');
const sqlCode = document.getElementById('sqlCode');
const copySqlBtn = document.getElementById('copySqlBtn');
const userProfile = document.getElementById('userProfile');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const boardList = document.getElementById('boardList');
const currentBoardName = document.getElementById('currentBoardName');
const addBoardBtn = document.getElementById('addBoardBtn');
const shareBoardBtn = document.getElementById('shareBoardBtn');
const boardModal = document.getElementById('boardModal');
const boardForm = document.getElementById('boardForm');
const closeBoardModal = document.querySelector('.close-board');

const shareModal = document.getElementById('shareModal');
const shareForm = document.getElementById('shareForm');
const closeShareModal = document.querySelector('.close-share');
const shareEmailInput = document.getElementById('shareEmail');

const columnsModal = document.getElementById('columnsModal');
const closeColumnsModal = document.querySelector('.close-columns');
const columnsList = document.getElementById('columnsList');
const addColumnBtn = document.getElementById('addColumnBtn');
const newColumnName = document.getElementById('newColumnName');
const saveColumnsBtn = document.getElementById('saveColumnsBtn');
const manageColumnsBtn = document.getElementById('manageColumnsBtn');

const emptyState = document.getElementById('emptyState');
const boardMain = document.getElementById('boardMain');
const createBoardPromptBtn = document.getElementById('createBoardPromptBtn');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Fetch config from server
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        
        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            console.error('Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY in Secrets.');
            showAuthMessage('Configuration error. Please check server logs.', 'error');
            projectInfo.textContent = 'Project: Missing Config';
            projectUrlDisplay.textContent = 'URL: Not configured';
            connectionStatus.textContent = '❌ Disconnected';
            connectionStatus.className = 'status-tag error';
            return;
        }

        const projectRef = config.supabaseUrl.match(/https:\/\/(.*)\.supabase\.co/)?.[1] || 'Unknown';
        projectInfo.textContent = `Project: ${projectRef}`;
        projectUrlDisplay.textContent = `URL: ${config.supabaseUrl.substring(0, 15)}...supabase.co`;
        connectionStatus.textContent = '✅ Connected';
        connectionStatus.className = 'status-tag success';
        
        console.log('Auth Debug: Initializing Supabase with project:', projectRef);

        supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

        const { data } = await supabase.auth.getSession();
        handleAuthStateChange(data.session);

        supabase.auth.onAuthStateChange((_event, session) => {
            handleAuthStateChange(session);
        });
    } catch (err) {
        console.error('Initialization error:', err);
    }
});

async function handleAuthStateChange(session) {
    user = session?.user || null;
    if (user) {
        authOverlay.style.display = 'none';
        userProfile.style.display = 'block';
        userEmail.textContent = user.email;
        await fetchBoards();
    } else {
        authOverlay.style.display = 'flex';
        userProfile.style.display = 'none';
        boardList.innerHTML = '';
        currentBoardName.textContent = 'Select a Board';
        emptyState.style.display = 'flex';
        boardMain.style.display = 'none';
        tasks = [];
        renderBoard();
    }
}

// Auth Handlers
toggleAuth.onclick = (e) => {
    e.preventDefault();
    isSignUp = !isSignUp;
    authTitle.textContent = isSignUp ? 'Sign Up' : 'Login';
    authSubmit.textContent = isSignUp ? 'Sign Up' : 'Login';
    toggleAuth.textContent = isSignUp ? 'Login' : 'Sign Up';
};

authForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!supabase) {
        showAuthMessage('Application is still initializing. Please wait...', 'info');
        return;
    }
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const submitBtn = authForm.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.textContent = isSignUp ? 'Signing Up...' : 'Logging In...';
    showAuthMessage('', 'info'); // Clear previous messages

    console.log(`Auth Debug: Attempting ${isSignUp ? 'Sign Up' : 'Login'} for email:`, email);
    debugLog.textContent = 'Waiting for response...';

    try {
        if (isSignUp) {
            const { data, error } = await supabase.auth.signUp({ 
                email, 
                password
            });
            
            debugLog.textContent = JSON.stringify({ data, error }, null, 2);
            console.log('Auth Debug: Sign Up result:', { data, error });
            
            if (error) throw error;
            
            if (data?.user && data?.session) {
                showAuthMessage('Account created and logged in!', 'success');
            } else {
                showAuthMessage('Check your email for confirmation link! (Check spam too)', 'success');
            }
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            debugLog.textContent = JSON.stringify({ data, error }, null, 2);
            console.log('Auth Debug: Login result:', { data, error });
            if (error) throw error;
        }
    } catch (error) {
        console.error('Auth Debug: Error caught:', error);
        showAuthMessage(error.message, 'error');
        if (error.message.includes('Database error saving new user')) {
            dbErrorNotice.style.display = 'block';
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isSignUp ? 'Sign Up' : 'Login';
    }
};

toggleDebug.onclick = (e) => {
    e.preventDefault();
    const isHidden = debugLog.style.display === 'none';
    debugLog.style.display = isHidden ? 'block' : 'none';
    toggleDebug.textContent = isHidden ? 'Hide Debug Log' : 'Show Debug Log';
};

forceLogout.onclick = async (e) => {
    e.preventDefault();
    if (supabase) {
        await supabase.auth.signOut();
        localStorage.clear();
        window.sessionStorage.clear();
        window.location.reload();
    }
};

viewSqlBtn.onclick = async () => {
    try {
        const res = await fetch('/setup.sql');
        const sql = await res.text();
        sqlCode.value = sql;
        sqlModal.style.display = 'block';
    } catch (err) {
        alert('Failed to load SQL script');
    }
};

closeSqlModal.onclick = () => sqlModal.style.display = 'none';
copySqlBtn.onclick = () => {
    sqlCode.select();
    document.execCommand('copy');
    copySqlBtn.textContent = 'Copied!';
    setTimeout(() => copySqlBtn.textContent = 'Copy to Clipboard', 2000);
};

window.onclick = (event) => {
    if (event.target == taskModal) taskModal.style.display = "none";
    if (event.target == boardModal) boardModal.style.display = "none";
    if (event.target == shareModal) shareModal.style.display = "none";
    if (event.target == sqlModal) sqlModal.style.display = "none";
    if (event.target == columnsModal) columnsModal.style.display = "none";
};

// Column Management
manageColumnsBtn.onclick = () => {
    renderColumnsConfig();
    columnsModal.style.display = 'block';
};

closeColumnsModal.onclick = () => columnsModal.style.display = 'none';

let tempColumns = [];

function renderColumnsConfig() {
    tempColumns = [...(currentBoard.columns || ['todo', 'in-progress', 'done'])];
    updateColumnsList();
}

function updateColumnsList() {
    columnsList.innerHTML = '';
    tempColumns.forEach((col, index) => {
        const item = document.createElement('div');
        item.className = 'column-config-item';
        item.innerHTML = `
            <span>${col}</span>
            <button class="btn-icon delete" onclick="removeTempColumn(${index})"><i class="fas fa-times"></i></button>
        `;
        columnsList.appendChild(item);
    });
}

window.removeTempColumn = (index) => {
    tempColumns.splice(index, 1);
    updateColumnsList();
};

addColumnBtn.onclick = () => {
    const name = newColumnName.value.trim().toLowerCase().replace(/\s+/g, '-');
    if (name && !tempColumns.includes(name)) {
        tempColumns.push(name);
        newColumnName.value = '';
        updateColumnsList();
    }
};

saveColumnsBtn.onclick = async () => {
    if (tempColumns.length === 0) {
        alert('Board must have at least one column.');
        return;
    }
    
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`/api/boards/${currentBoard.id}/columns`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ columns: tempColumns })
        });
        
        if (!response.ok) throw new Error('Failed to save columns');
        
        currentBoard.columns = tempColumns;
        columnsModal.style.display = 'none';
        renderBoard();
    } catch (err) {
        alert('Error saving columns: ' + err.message);
    }
};

function showAuthMessage(message, type) {
    const msgDiv = document.getElementById('authMessage');
    if (!message) {
        msgDiv.style.display = 'none';
        return;
    }
    msgDiv.textContent = message;
    msgDiv.className = `auth-message ${type}`;
    msgDiv.style.display = 'block';
}

logoutBtn.onclick = () => supabase.auth.signOut();

// Board Functions
async function fetchBoards() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const response = await fetch('/api/boards', {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch boards');
        }
        boards = await response.json();
        dbErrorNotice.style.display = 'none';
        renderBoardList();
        if (boards.length > 0 && !currentBoard) {
            selectBoard(boards[0]);
        }
    } catch (err) {
        console.error('Fetch boards error:', err);
        if (err.message.includes('infinite recursion') || err.message.includes('relation "boards" does not exist')) {
            dbErrorNotice.style.display = 'block';
        }
    }
}

function renderBoardList() {
    boardList.innerHTML = '';
    boards.forEach(board => {
        const li = document.createElement('li');
        li.className = `board-item ${currentBoard?.id === board.id ? 'active' : ''}`;
        li.textContent = board.name;
        li.onclick = () => selectBoard(board);
        boardList.appendChild(li);
    });
}

async function selectBoard(board) {
    currentBoard = board;
    currentBoardName.textContent = board.name;
    addTaskBtn.disabled = false;
    shareBoardBtn.style.display = 'flex';
    manageColumnsBtn.style.display = 'flex';
    emptyState.style.display = 'none';
    boardMain.style.display = 'grid';
    renderBoardList();
    tasks = [];
    renderBoard();
    await fetchTasks();
}

addBoardBtn.onclick = () => {
    if (!supabase) {
        alert('Application is still initializing. Please wait a moment.');
        return;
    }
    boardModal.style.display = 'block';
};

createBoardPromptBtn.onclick = () => addBoardBtn.onclick();

closeBoardModal.onclick = () => {
    boardModal.style.display = 'none';
    boardForm.reset();
};

boardForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('boardName').value;
    if (!name) return;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert('Your session has expired. Please log in again.');
            return;
        }
        
        const response = await fetch('/api/boards', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ name })
        });
        if (!response.ok) {
            const errorData = await response.json();
            handleDbError(errorData.error || 'Failed to create board');
            return;
        }
        const newBoard = await response.json();
        boards.push(newBoard);
        renderBoardList();
        selectBoard(newBoard);
        boardModal.style.display = 'none';
        boardForm.reset();
    } catch (err) {
        console.error('Add board error:', err);
    }
};

shareBoardBtn.onclick = () => {
    if (!currentBoard) return;
    shareModal.style.display = 'block';
};

closeShareModal.onclick = () => {
    shareModal.style.display = 'none';
    shareForm.reset();
};

shareForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = shareEmailInput.value;
    if (!email) return;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert('Your session has expired. Please log in again.');
            return;
        }

        const response = await fetch(`/api/boards/${currentBoard.id}/share`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ email })
        });
        
        if (response.ok) {
            alert('Board shared successfully!');
            shareModal.style.display = 'none';
            shareForm.reset();
        } else {
            const err = await response.json();
            handleDbError(err.error || 'Failed to share board');
        }
    } catch (err) {
        console.error('Share board error:', err);
        handleDbError('An error occurred while sharing the board.');
    }
};

function handleDbError(message) {
    console.error('Database Error:', message);
    if (message.includes('infinite recursion') || message.includes('relation "boards" does not exist')) {
        dbErrorNotice.style.display = 'block';
    } else {
        alert(message);
    }
}

// Event Listeners
if (addTaskBtn) addTaskBtn.onclick = () => {
    if (!currentBoard) {
        alert('Please select or create a board first.');
        return;
    }
    openModal();
};
if (closeModal) closeModal.onclick = () => closeModalFunc();

window.onclick = (event) => {
    if (event.target == taskModal) closeModalFunc();
    if (event.target == boardModal) {
        boardModal.style.display = 'none';
        boardForm.reset();
    }
    if (event.target == shareModal) {
        shareModal.style.display = 'none';
        shareForm.reset();
    }
};

taskForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!supabase) {
        alert('Application is still initializing.');
        return;
    }
    if (!currentBoard) {
        alert('No board selected.');
        return;
    }
    
    const taskId = document.getElementById('taskId').value;
    const taskData = {
        title: document.getElementById('title').value,
        priority: document.getElementById('priority').value,
        status: document.getElementById('status').value,
        note: document.getElementById('note').value,
        board_id: currentBoard.id
    };

    try {
        if (taskId) {
            await updateTask(taskId, taskData);
        } else {
            await createTask(taskData);
        }
        closeModalFunc();
    } catch (err) {
        console.error('Submit error:', err);
    }
};

// API Functions
async function fetchTasks() {
    if (!currentBoard) return;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const response = await fetch(`/api/tasks?board_id=${currentBoard.id}`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Fetch failed');
        }
        tasks = await response.json();
        renderBoard();
    } catch (error) {
        console.error('Error fetching tasks:', error);
    }
}

async function createTask(taskData) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        console.log('Creating task with data:', taskData);
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify(taskData)
        });
        if (!response.ok) {
            const errorData = await response.json();
            handleDbError(errorData.error || 'Create failed');
            return;
        }
        const newTask = await response.json();
        if (newTask && newTask.id) {
            tasks.unshift(newTask);
            renderBoard();
        } else {
            throw new Error('Invalid task data received from server');
        }
    } catch (error) {
        console.error('Error creating task:', error);
    }
}

async function updateTask(id, taskData) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        console.log('Updating task', id, 'with data:', taskData);
        const response = await fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify(taskData)
        });
        if (!response.ok) {
            const errorData = await response.json();
            handleDbError(errorData.error || 'Update failed');
            return;
        }
        const updatedTask = await response.json();
        if (updatedTask && updatedTask.id) {
            tasks = tasks.map(t => t.id == id ? updatedTask : t);
            renderBoard();
        } else {
            throw new Error('Invalid task data received from server');
        }
    } catch (error) {
        console.error('Error updating task:', error);
    }
}

async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const response = await fetch(`/api/tasks/${id}`, { 
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (!response.ok) throw new Error('Delete failed');
        tasks = tasks.filter(t => t.id != id);
        renderBoard();
    } catch (error) {
        console.error('Error deleting task:', error);
    }
}

// UI Functions
function renderBoard() {
    if (!currentBoard) return;
    
    const boardColumns = currentBoard.columns || ['todo', 'in-progress', 'done'];
    boardMain.innerHTML = '';
    
    boardColumns.forEach(colId => {
        const columnEl = document.createElement('div');
        columnEl.className = 'column';
        columnEl.id = colId;
        columnEl.ondrop = drop;
        columnEl.ondragover = allowDrop;
        
        const colTasks = tasks.filter(t => t.status === colId);
        
        columnEl.innerHTML = `
            <div class="column-header">
                <h2>${colId.replace(/-/g, ' ').toUpperCase()}</h2>
                <span class="count">${colTasks.length}</span>
            </div>
            <div class="task-list"></div>
        `;
        
        const listEl = columnEl.querySelector('.task-list');
        colTasks.forEach(task => {
            const card = createTaskCard(task);
            listEl.appendChild(card);
        });
        
        boardMain.appendChild(columnEl);
    });

    // Update status dropdown in task modal
    const statusSelect = document.getElementById('status');
    statusSelect.innerHTML = boardColumns.map(col => 
        `<option value="${col}">${col.replace(/-/g, ' ').toUpperCase()}</option>`
    ).join('');
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.id = task.id;
    card.ondragstart = (e) => e.dataTransfer.setData('text/plain', task.id);

    card.innerHTML = `
        <span class="priority-badge priority-${task.priority}">${task.priority}</span>
        <h3 class="task-title">${task.title}</h3>
        ${task.note ? `<p class="task-note">${task.note}</p>` : ''}
        <div class="task-footer">
            <div class="task-date">
                <i class="far fa-clock"></i> ${new Date(task.created_at).toLocaleDateString()}
            </div>
            <div class="task-actions">
                <button class="btn-icon edit" onclick="editTask(${task.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-icon delete" onclick="deleteTask(${task.id})"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
    `;
    return card;
}

function openModal(task = null) {
    taskModal.style.display = 'block';
    if (task) {
        modalTitle.textContent = 'Edit Task';
        document.getElementById('taskId').value = task.id;
        document.getElementById('title').value = task.title;
        document.getElementById('priority').value = task.priority;
        document.getElementById('status').value = task.status;
        document.getElementById('note').value = task.note || '';
    } else {
        modalTitle.textContent = 'Create New Task';
        taskForm.reset();
        document.getElementById('taskId').value = '';
    }
}

function closeModalFunc() {
    taskModal.style.display = 'none';
    taskForm.reset();
}

window.editTask = (id) => {
    const task = tasks.find(t => t.id == id);
    if (task) openModal(task);
};

window.deleteTask = deleteTask;

// Drag and Drop
function allowDrop(ev) {
    ev.preventDefault();
}

async function drop(ev) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData('text/plain');
    const column = ev.currentTarget.id;
    
    const task = tasks.find(t => t.id == id);
    if (task && task.status !== column) {
        await updateTask(id, { ...task, status: column });
    }
}

window.allowDrop = allowDrop;
window.drop = drop;
