// State
let goals = {
    calories: 2000,
    protein: 150
};

let foods = [];
let currentDate = new Date().toISOString().split('T')[0];

// DOM Elements
const elements = {
    dateDisplay: document.getElementById('current-date'),
    
    // Calorie elements
    calConsumed: document.getElementById('cal-consumed'),
    calGoal: document.getElementById('cal-goal'),
    calRemaining: document.getElementById('cal-remaining'),
    calProgressRing: document.getElementById('cal-progress-ring'),
    
    // Protein elements
    proConsumed: document.getElementById('pro-consumed'),
    proGoal: document.getElementById('pro-goal'),
    proRemainingVal: document.getElementById('pro-remaining-val'),
    proProgressBar: document.getElementById('pro-progress-bar'),
    
    // Form and List
    addFoodForm: document.getElementById('add-food-form'),
    foodNameInput: document.getElementById('food-name'),
    foodCalInput: document.getElementById('food-cal'),
    foodProInput: document.getElementById('food-pro'),
    foodsList: document.getElementById('foods-list'),
    
    // Settings Modal
    settingsBtn: document.getElementById('settings-btn'),
    closeModalBtn: document.getElementById('close-modal'),
    modal: document.getElementById('settings-modal'),
    settingsForm: document.getElementById('settings-form'),
    goalCalInput: document.getElementById('goal-cal'),
    goalProInput: document.getElementById('goal-pro')
};

// Initialize App
function init() {
    setupDate();
    loadData();
    setupEventListeners();
    updateUI();
    injectSVGDefs();
}

function setupDate() {
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    elements.dateDisplay.textContent = new Date().toLocaleDateString('en-US', options);
}

// Data Management
function loadData() {
    const savedGoals = localStorage.getItem('caltrack_goals');
    if (savedGoals) {
        goals = JSON.parse(savedGoals);
    }
    
    const savedFoods = localStorage.getItem(`caltrack_foods_${currentDate}`);
    if (savedFoods) {
        foods = JSON.parse(savedFoods);
    }
}

function saveData() {
    localStorage.setItem('caltrack_goals', JSON.stringify(goals));
    localStorage.setItem(`caltrack_foods_${currentDate}`, JSON.stringify(foods));
}

// Event Listeners
function setupEventListeners() {
    // Add Food
    elements.addFoodForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = elements.foodNameInput.value.trim();
        const cal = parseFloat(elements.foodCalInput.value);
        const pro = parseFloat(elements.foodProInput.value);
        
        if (name && !isNaN(cal) && !isNaN(pro)) {
            addFood({ id: Date.now().toString(), name, calories: cal, protein: pro });
            elements.addFoodForm.reset();
            elements.foodNameInput.focus();
        }
    });
    
    // Settings Modal
    elements.settingsBtn.addEventListener('click', () => {
        elements.goalCalInput.value = goals.calories;
        elements.goalProInput.value = goals.protein;
        elements.modal.classList.add('active');
    });
    
    elements.closeModalBtn.addEventListener('click', () => {
        elements.modal.classList.remove('active');
    });
    
    elements.settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        goals.calories = parseFloat(elements.goalCalInput.value);
        goals.protein = parseFloat(elements.goalProInput.value);
        saveData();
        updateUI();
        elements.modal.classList.remove('active');
    });

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === elements.modal) {
            elements.modal.classList.remove('active');
        }
    });
}

// Core Logic
function addFood(food) {
    foods.push(food);
    saveData();
    updateUI();
}

function deleteFood(id) {
    foods = foods.filter(f => f.id !== id);
    saveData();
    updateUI();
}

function calculateTotals() {
    return foods.reduce((acc, food) => {
        return {
            calories: acc.calories + food.calories,
            protein: acc.protein + food.protein
        };
    }, { calories: 0, protein: 0 });
}

// UI Updates
function updateUI() {
    const totals = calculateTotals();
    
    // Format numbers
    const calTotal = Math.round(totals.calories);
    const proTotal = Math.round(totals.protein * 10) / 10;
    
    // Update text elements
    elements.calConsumed.textContent = calTotal;
    elements.calGoal.textContent = goals.calories;
    
    const calRemaining = Math.max(0, goals.calories - calTotal);
    elements.calRemaining.textContent = calRemaining;
    
    elements.proConsumed.textContent = proTotal;
    elements.proGoal.textContent = goals.protein;
    
    const proRemaining = Math.max(0, Math.round((goals.protein - proTotal) * 10) / 10);
    elements.proRemainingVal.textContent = proRemaining;
    
    // Update progress visualizations
    
    // Calories Ring
    const radius = elements.calProgressRing.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    const calPercent = Math.min(100, Math.max(0, (calTotal / goals.calories) * 100));
    const offset = circumference - (calPercent / 100) * circumference;
    
    elements.calProgressRing.style.strokeDasharray = `${circumference} ${circumference}`;
    elements.calProgressRing.style.strokeDashoffset = offset;
    
    // Color change for over-limit
    if (calTotal > goals.calories) {
        elements.calProgressRing.style.stroke = 'var(--danger)';
        elements.calConsumed.style.background = 'var(--danger)';
        elements.calConsumed.style.webkitBackgroundClip = 'text';
    } else {
        elements.calProgressRing.style.stroke = 'url(#cal-gradient)';
        elements.calConsumed.style.background = 'var(--accent-cal-gradient)';
        elements.calConsumed.style.webkitBackgroundClip = 'text';
    }
    
    // Protein Bar
    const proPercent = Math.min(100, Math.max(0, (proTotal / goals.protein) * 100));
    elements.proProgressBar.style.width = `${proPercent}%`;
    
    if (proTotal >= goals.protein) {
        elements.proProgressBar.style.background = 'var(--success)';
        elements.proProgressBar.style.boxShadow = '0 0 10px rgba(46, 160, 67, 0.4)';
    } else {
        elements.proProgressBar.style.background = 'var(--accent-pro-gradient)';
        elements.proProgressBar.style.boxShadow = '0 0 10px rgba(0, 210, 255, 0.4)';
    }
    
    renderFoodList();
}

function renderFoodList() {
    elements.foodsList.innerHTML = '';
    
    if (foods.length === 0) {
        elements.foodsList.innerHTML = `
            <div class="food-item" style="justify-content: center; color: var(--text-secondary); font-size: 14px;">
                No foods added yet today. Let's eat!
            </div>
        `;
        return;
    }
    
    // Render in reverse order (newest first)
    [...foods].reverse().forEach(food => {
        const foodEl = document.createElement('div');
        foodEl.className = 'food-item';
        foodEl.innerHTML = `
            <div class="food-info">
                <h4>${food.name}</h4>
                <div class="food-stats">
                    <span><strong class="c-label">${food.calories}</strong> kcal</span>
                    <span><strong class="p-label">${food.protein}</strong>g protein</span>
                </div>
            </div>
            <button class="delete-btn" onclick="deleteFood('${food.id}')" title="Delete">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;
        elements.foodsList.appendChild(foodEl);
    });
}

// Inject SVG Gradient Definitions dynamically
function injectSVGDefs() {
    const svgDefs = `
        <svg style="width:0;height:0;position:absolute;" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="cal-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ff7b00" />
              <stop offset="100%" stop-color="#ff0055" />
            </linearGradient>
          </defs>
        </svg>
    `;
    document.body.insertAdjacentHTML('afterbegin', svgDefs);
}

// Start app
document.addEventListener('DOMContentLoaded', init);
