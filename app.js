// Global State
let isAuthenticated = false;
let userData = null;
let currentTool = null;
let selectedPin = null;
let notes = [];
let pins = [];
let strings = [];
let activeColor = '#000';
let isDragging = false;
let draggedElement = null;
let offsetX, offsetY;
let nextNoteId = 1;
let nextPinId = 1;
let nextStringId = 1;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const workspace = document.getElementById('workspace');
const userNameEl = document.getElementById('user-name');
const userAvatarEl = document.getElementById('user-avatar');

// Event Listeners Setup
document.addEventListener('DOMContentLoaded', () => {
    const addNoteBtn = document.getElementById('add-note-btn');
    const addPinBtn = document.getElementById('add-pin-btn');
    const addStringBtn = document.getElementById('add-string-btn');
    const clearSelectionBtn = document.getElementById('clear-selection-btn');
    const logoutBtn = document.getElementById('logout-btn');

    addNoteBtn.addEventListener('click', () => setCurrentTool('note'));
    addPinBtn.addEventListener('click', () => setCurrentTool('pin'));
    addStringBtn.addEventListener('click', () => setCurrentTool('string'));
    clearSelectionBtn.addEventListener('click', clearSelection);
    
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('click', handleClick);
});

// Google Auth Functions
function onSignIn(googleUser) {
    // Get user profile data
    const profile = googleUser.getBasicProfile();
    userData = {
        id: profile.getId(),
        name: profile.getName(),
        email: profile.getEmail(),
        avatar: profile.getImageUrl(),
        token: googleUser.getAuthResponse().id_token
    };
    
    isAuthenticated = true;
    userNameEl.textContent = userData.name;
    userAvatarEl.src = userData.avatar;
    
    loginScreen.style.display = 'none';
    workspace.style.display = 'block';
    
    // Load user data
    loadUserData();
}

function signOut() {
    const auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(() => {
        console.log('User signed out.');
        
        // Reset state
        isAuthenticated = false;
        userData = null;
        notes = [];
        pins = [];
        strings = [];
        
        // Clear the workspace
        const notesElements = document.querySelectorAll('.sticky-note');
        const pinsElements = document.querySelectorAll('.pin');
        const stringsElements = document.querySelectorAll('.string');
        
        notesElements.forEach(note => note.remove());
        pinsElements.forEach(pin => pin.remove());
        stringsElements.forEach(string => string.remove());
        
        // Show login screen
        loginScreen.style.display = 'flex';
        workspace.style.display = 'none';
    });
}

// Data Management
async function loadUserData() {
    try {
        // Try to get data from backend
        const response = await fetch(`https://your-api.workers.dev/user-data?userId=${userData.id}`, {
            headers: {
                'Authorization': `Bearer ${userData.token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            notes = data.notes || [];
            pins = data.pins || [];
            strings = data.strings || [];
        } else {
            // Fallback to localStorage if API fails
            const savedData = localStorage.getItem(`stickyNotes_${userData.id}`);
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                notes = parsedData.notes || [];
                pins = parsedData.pins || [];
                strings = parsedData.strings || [];
            }
        }
        
        // Restore elements on the page
        notes.forEach(createNoteElement);
        pins.forEach(createPinElement);
        strings.forEach(createStringElement);
        
        // Set the next IDs
        if (notes.length > 0) {
            nextNoteId = Math.max(...notes.map(note => parseInt(note.id.replace('note-', '')))) + 1;
        }
        
        if (pins.length > 0) {
            nextPinId = Math.max(...pins.map(pin => parseInt(pin.id.replace('pin-', '')))) + 1;
        }
        
        if (strings.length > 0) {
            nextStringId = Math.max(...strings.map(string => parseInt(string.id.replace('string-', '')))) + 1;
        }
    } catch (error) {
        console.error('Error loading data:', error);
        // Start with empty state if everything fails
        notes = [];
        pins = [];
        strings = [];
    }
}

async function saveUserData() {
    if (!isAuthenticated || !userData) return;
    
    const dataToSave = {
        notes: notes,
        pins: pins,
        strings: strings,
        lastUpdated: new Date().toISOString()
    };
    
    try {
        // Try to save to backend
        const response = await fetch('https://your-api.workers.dev/save-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userData.token}`
            },
            body: JSON.stringify(dataToSave)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save data');
        }
    } catch (error) {
        console.error('Error saving data:', error);
        // Fallback to localStorage
        localStorage.setItem(`stickyNotes_${userData.id}`, JSON.stringify(dataToSave));
    }
}

// Tool Functions
function setCurrentTool(tool) {
    currentTool = tool;
    document.body.style.cursor = tool === 'note' || tool === 'pin' ? 'crosshair' : 'default';
    
    // Reset selected pin when changing tools
    if (tool !== 'string' && selectedPin) {
        selectedPin.classList.remove('selected-pin');
        selectedPin = null;
    }
    
    // Highlight the active tool button
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(btn => btn.style.backgroundColor = '#f8f8f8');
    
    if (tool === 'note') {
        document.getElementById('add-note-btn').style.backgroundColor = '#e0e0e0';
    } else if (tool === 'pin') {
        document.getElementById('add-pin-btn').style.backgroundColor = '#e0e0e0';
    } else if (tool === 'string') {
        document.getElementById('add-string-btn').style.backgroundColor = '#e0e0e0';
    }
}

function clearSelection() {
    currentTool = null;
    document.body.style.cursor = 'default';
    
    if (selectedPin) {
        selectedPin.classList.remove('selected-pin');
        selectedPin = null;
    }
    
    // Reset all tool buttons
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(btn => btn.style.backgroundColor = '#f8f8f8');
}

// Mouse Event Handlers
function handleMouseDown(e) {
    if (!isAuthenticated) return;
    
    // Check if we're clicking on a draggable element
    if (e.target.classList.contains('sticky-note') || 
        e.target.closest('.sticky-note') || 
        e.target.classList.contains('pin')) {
        
        const element = e.target.classList.contains('sticky-note') || e.target.classList.contains('pin') ? 
                        e.target : 
                        e.target.closest('.sticky-note');
        
        // Don't start dragging if clicking on a textarea or delete button
        if (e.target.tagName === 'TEXTAREA' || e.target.classList.contains('delete-btn') || 
            e.target.classList.contains('color-option')) {
            return;
        }
        
        isDragging = true;
        draggedElement = element;
        
        // Calculate offset for smooth dragging
        const rect = element.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        // Bring element to front
        element.style.zIndex = getHighestZIndex() + 1;
    }
}

function handleMouseMove(e) {
    if (!isAuthenticated || !isDragging || !draggedElement) return;
    
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    
    draggedElement.style.left = `${x}px`;
    draggedElement.style.top = `${y}px`;
    
    // Update the element's position in our data structures
    if (draggedElement.classList.contains('sticky-note')) {
        const noteId = draggedElement.id;
        const noteIndex = notes.findIndex(note => note.id === noteId);
        if (noteIndex !== -1) {
            notes[noteIndex].x = x;
            notes[noteIndex].y = y;
        }
    } else if (draggedElement.classList.contains('pin')) {
        const pinId = draggedElement.id;
        const pinIndex = pins.findIndex(pin => pin.id === pinId);
        if (pinIndex !== -1) {
            pins[pinIndex].x = x;
            pins[pinIndex].y = y;
        }
        
        // Update connected strings
        updateConnectedStrings(pinId, x, y);
    }
}

function handleMouseUp(e) {
    if (!isAuthenticated) return;
    
    if (isDragging && draggedElement) {
        isDragging = false;
        draggedElement = null;
        
        // Save the updated positions
        saveUserData();
    }
}

function handleClick(e) {
    if (!isAuthenticated) return;
    
    // Handle adding new elements based on current tool
    if (currentTool === 'note' && !e.target.closest('.sticky-note') && 
        !e.target.closest('.toolbar') && !e.target.closest('.user-info')) {
        
        addNote(e.clientX, e.clientY);
        clearSelection();
    } else if (currentTool === 'pin' && !e.target.closest('.pin') && 
              !e.target.closest('.toolbar') && !e.target.closest('.user-info')) {
        
        addPin(e.clientX, e.clientY);
        clearSelection();
    } else if (currentTool === 'string' && e.target.classList.contains('pin')) {
        handlePinSelection(e.target);
    }
    
    // Handle color palette
    if (e.target.classList.contains('color-option')) {
        const color = e.target.style.backgroundColor;
        const note = e.target.closest('.sticky-note');
        const textarea = note.querySelector('.sticky-note-content');
        textarea.style.color = color;
        
        // Update the note in our data structures
        const noteId = note.id;
        const noteIndex = notes.findIndex(note => note.id === noteId);
        if (noteIndex !== -1) {
            notes[noteIndex].color = color;
            saveUserData();
        }
    }
    
    // Handle delete button
    if (e.target.classList.contains('delete-btn')) {
        const element = e.target.closest('.sticky-note') || e.target.closest('.pin');
        if (element) {
            deleteElement(element);
        }
    }
}

// Note Functions
function addNote(x, y) {
    const noteId = `note-${nextNoteId++}`;
    const rotation = Math.random() * 6 - 3; // Random rotation between -3 and 3 degrees
    
    const noteData = {
        id: noteId,
        x: x - 100, // Center the note on the click
        y: y - 100,
        content: '',
        color: '#000',
        rotation: rotation
    };
    
    notes.push(noteData);
    createNoteElement(noteData);
    saveUserData();
}

function createNoteElement(noteData) {
    const note = document.createElement('div');
    note.className = 'sticky-note';
    note.id = noteData.id;
    note.style.left = `${noteData.x}px`;
    note.style.top = `${noteData.y}px`;
    note.style.transform = `rotate(${noteData.rotation}deg)`;
    note.style.zIndex = getHighestZIndex() + 1;
    
    const textarea = document.createElement('textarea');
    textarea.className = 'sticky-note-content';
    textarea.value = noteData.content;
    textarea.style.color = noteData.color;
    
    textarea.addEventListener('click', function(e) {
        // Show color palette on click
        const palette = note.querySelector('.color-palette');
        palette.style.display = 'block';
        e.stopPropagation();
    });
    
    textarea.addEventListener('blur', function() {
        // Hide color palette when textarea loses focus
        setTimeout(() => {
            const palette = note.querySelector('.color-palette');
            palette.style.display = 'none';
        }, 200);
        
        // Save the content
        const noteIndex = notes.findIndex(note => note.id === noteData.id);
        if (noteIndex !== -1) {
            notes[noteIndex].content = textarea.value;
            saveUserData();
        }
    });
    
    textarea.addEventListener('input', function() {
        // Auto-update content as user types
        const noteIndex = notes.findIndex(note => note.id === noteData.id);
        if (noteIndex !== -1) {
            notes[noteIndex].content = textarea.value;
        }
    });
    
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '×';
    
    const colorPalette = document.createElement('div');
    colorPalette.className = 'color-palette';
    
    const colors = [
        { id: 'color-black', color: '#000' },
        { id: 'color-yellow', color: '#FFC107' },
        { id: 'color-blue', color: '#2196F3' },
        { id: 'color-red', color: '#F44336' },
        { id: 'color-green', color: '#4CAF50' }
    ];
    
    colors.forEach(colorData => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option';
        colorOption.id = colorData.id;
        colorOption.style.backgroundColor = colorData.color;
        colorPalette.appendChild(colorOption);
    });
    
    note.appendChild(textarea);
    note.appendChild(deleteBtn);
    note.appendChild(colorPalette);
    
    workspace.appendChild(note);
}

// Pin Functions
function addPin(x, y) {
    const pinId = `pin-${nextPinId++}`;
    
    const pinData = {
        id: pinId,
        x: x - 10, // Center the pin on the click
        y: y - 10
    };
    
    pins.push(pinData);
    createPinElement(pinData);
    saveUserData();
}

function createPinElement(pinData) {
    const pin = document.createElement('div');
    pin.className = 'pin';
    pin.id = pinData.id;
    pin.style.left = `${pinData.x}px`;
    pin.style.top = `${pinData.y}px`;
    pin.style.zIndex = getHighestZIndex() + 1;
    
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.style.display = 'none';
    
    pin.appendChild(deleteBtn);
    
    // Show delete button on hover
    pin.addEventListener('mouseenter', () => {
        deleteBtn.style.display = 'flex';
    });
    
    pin.addEventListener('mouseleave', () => {
        deleteBtn.style.display = 'none';
    });
    
    workspace.appendChild(pin);
}

function handlePinSelection(pin) {
    if (!selectedPin) {
        // First pin selection
        selectedPin = pin;
        pin.classList.add('selected-pin');
    } else if (selectedPin === pin) {
        // Deselect if clicking the same pin
        selectedPin.classList.remove('selected-pin');
        selectedPin = null;
    } else {
        // Second pin selected, create string
        const firstPinId = selectedPin.id;
        const secondPinId = pin.id;
        
        // Get pin positions
        const firstPin = pins.find(p => p.id === firstPinId);
        const secondPin = pins.find(p => p.id === secondPinId);
        
        if (firstPin && secondPin) {
            addString(firstPinId, secondPinId);
        }
        
        // Reset selection
        selectedPin.classList.remove('selected-pin');
        selectedPin = null;
        clearSelection();
    }
}

// String Functions
function addString(fromPinId, toPinId) {
    const stringId = `string-${nextStringId++}`;
    
    const fromPin = pins.find(pin => pin.id === fromPinId);
    const toPin = pins.find(pin => pin.id === toPinId);
    
    if (!fromPin || !toPin) return;
    
    const stringData = {
        id: stringId,
        fromPinId: fromPinId,
        toPinId: toPinId
    };
    
    strings.push(stringData);
    createStringElement(stringData);
    saveUserData();
}

function createStringElement(stringData) {
    const fromPin = pins.find(pin => pin.id === stringData.fromPinId);
    const toPin = pins.find(pin => pin.id === stringData.toPinId);
    
    if (!fromPin || !toPin) return;
    
    const string = document.createElement('div');
    string.className = 'string';
    string.id = stringData.id;
    
    updateStringPosition(string, fromPin, toPin);
    workspace.appendChild(string);
}

function updateStringPosition(stringElement, fromPin, toPin) {
    // Calculate the center points of the pins
    const fromX = fromPin.x + 10;
    const fromY = fromPin.y + 10;
    const toX = toPin.x + 10;
    const toY = toPin.y + 10;
    
    // Calculate distance and angle
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    // Position the string
    stringElement.style.width = `${distance}px`;
    stringElement.style.left = `${fromX}px`;
    stringElement.style.top = `${fromY}px`;
    stringElement.style.transform = `rotate(${angle}deg)`;
}

function updateConnectedStrings(pinId, x, y) {
    // Find all strings connected to this pin
    const connectedStrings = strings.filter(
        string => string.fromPinId === pinId || string.toPinId === pinId
    );
    
    connectedStrings.forEach(stringData => {
        const stringElement = document.getElementById(stringData.id);
        if (!stringElement) return;
        
        const fromPin = pins.find(pin => pin.id === stringData.fromPinId);
        const toPin = pins.find(pin => pin.id === stringData.toPinId);
        
        if (fromPin && toPin) {
            updateStringPosition(stringElement, fromPin, toPin);
        }
    });
}

// Utility Functions
function deleteElement(element) {
    if (element.classList.contains('sticky-note')) {
        // Remove from data and DOM
        const noteId = element.id;
        notes = notes.filter(note => note.id !== noteId);
        element.remove();
    } else if (element.classList.contains('pin')) {
        // Remove pin and connected strings
        const pinId = element.id;
        
        // Find and remove connected strings
        const connectedStrings = strings.filter(
            string => string.fromPinId === pinId || string.toPinId === pinId
        );
        
        connectedStrings.forEach(stringData => {
            const stringElement = document.getElementById(stringData.id);
            if (stringElement) {
                stringElement.remove();
            }
        });
        
        // Update data
        strings = strings.filter(
            string => string.fromPinId !== pinId && string.toPinId !== pinId
        );
        pins = pins.filter(pin => pin.id !== pinId);
        
        // Remove from DOM
        element.remove();
    }
    
    saveUserData();
}

function getHighestZIndex() {
    const elements = document.querySelectorAll('.sticky-note, .pin');
    let maxZ = 10; // Starting Z-index
    
    elements.forEach(el => {
        const zIndex = parseInt(el.style.zIndex || 0);
        if (zIndex > maxZ) {
            maxZ = zIndex;
        }
    });
    
    return maxZ;
}