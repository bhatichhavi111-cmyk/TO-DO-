class TodoApp {
    constructor() {
        this.tasks = [];
        this.taskIdCounter = 1;
        this.timers = {};
        this.completedTasks = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTasksFromStorage();
        this.updatePerformanceBoard();
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });

        // Drag and drop for each column
        this.setupDragAndDrop('todoTasks');
        this.setupDragAndDrop('doingTasks');
        this.setupDragAndDrop('doneTasks');
    }

    setupDragAndDrop(containerId) {
        const container = document.getElementById(containerId);
        
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.classList.add('drag-over');
        });

        container.addEventListener('dragleave', () => {
            container.classList.remove('drag-over');
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            
            const taskId = e.dataTransfer.getData('taskId');
            const newStatus = this.getStatusFromContainer(containerId);
            this.moveTask(taskId, newStatus);
        });
    }

    getStatusFromContainer(containerId) {
        switch(containerId) {
            case 'todoTasks': return 'todo';
            case 'doingTasks': return 'doing';
            case 'doneTasks': return 'done';
            default: return 'todo';
        }
    }

    addTask() {
        const titleInput = document.getElementById('taskTitle');
        const timeInput = document.getElementById('taskTime');
        
        const title = titleInput.value.trim();
        const timeLimit = parseInt(timeInput.value);
        
        if (!title || !timeLimit) return;
        
        const task = {
            id: this.taskIdCounter++,
            title: title,
            timeLimit: timeLimit,
            timeRemaining: timeLimit * 60, // Convert to seconds
            status: 'todo',
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null
        };
        
        this.tasks.push(task);
        this.renderTask(task);
        this.startTimer(task.id);
        this.saveTasksToStorage();
        
        // Clear form
        titleInput.value = '';
        timeInput.value = '';
        titleInput.focus();
        
        this.updatePerformanceBoard();
    }

    renderTask(task) {
        const taskElement = document.createElement('div');
        taskElement.className = 'task';
        taskElement.id = `task-${task.id}`;
        taskElement.draggable = true;
        
        // Create task content
        const taskContent = document.createElement('div');
        taskContent.className = 'task-content';
        taskContent.innerHTML = `
            <div class="task-title">${task.title}</div>
            <div class="task-timer" id="timer-${task.id}">${this.formatTime(task.timeRemaining)}</div>
            <button class="delete-btn" onclick="todoApp.deleteTask(${task.id})">🗑️</button>
        `;
        
        taskElement.appendChild(taskContent);
        
        // Add drag event listeners
        taskElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('taskId', task.id.toString());
            taskElement.classList.add('dragging');
        });
        
        taskElement.addEventListener('dragend', () => {
            taskElement.classList.remove('dragging');
        });
        
        // Add to appropriate container
        const container = this.getContainerForStatus(task.status);
        container.appendChild(taskElement);
    }

    getContainerForStatus(status) {
        switch(status) {
            case 'todo': return document.getElementById('todoTasks');
            case 'doing': return document.getElementById('doingTasks');
            case 'done': return document.getElementById('doneTasks');
            default: return document.getElementById('todoTasks');
        }
    }

    startTimer(taskId) {
        if (this.timers[taskId]) {
            clearInterval(this.timers[taskId]);
        }
        
        this.timers[taskId] = setInterval(() => {
            const task = this.tasks.find(t => t.id === taskId);
            if (!task) {
                clearInterval(this.timers[taskId]);
                return;
            }
            
            // Only countdown if task is in 'doing' status
            if (task.status === 'doing') {
                task.timeRemaining--;
                
                const timerElement = document.getElementById(`timer-${taskId}`);
                if (timerElement) {
                    timerElement.textContent = this.formatTime(task.timeRemaining);
                    
                    // Add urgent class when time is running out
                    if (task.timeRemaining <= 60) {
                        timerElement.classList.add('urgent');
                    } else {
                        timerElement.classList.remove('urgent');
                    }
                }
                
                // Auto-move to done if time runs out
                if (task.timeRemaining <= 0) {
                    this.moveTask(taskId, 'done', true);
                }
            }
        }, 1000);
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    deleteTask(taskId) {
        // Remove task from array
        this.tasks = this.tasks.filter(task => task.id !== taskId);
        
        // Clear timer if exists
        if (this.timers[taskId]) {
            clearInterval(this.timers[taskId]);
            delete this.timers[taskId];
        }
        
        // Remove from DOM
        const taskElement = document.getElementById(`task-${taskId}`);
        if (taskElement) {
            taskElement.remove();
        }
        
        // Save and update
        this.saveTasksToStorage();
        this.updatePerformanceBoard();
    }

    moveTask(taskId, newStatus, timeExpired = false) {
        const task = this.tasks.find(t => t.id === parseInt(taskId));
        if (!task) return;
        
        const oldStatus = task.status;
        task.status = newStatus;
        
        // Handle timing
        if (oldStatus !== 'doing' && newStatus === 'doing') {
            // Task started
            task.startedAt = Date.now();
        } else if (oldStatus === 'doing' && newStatus === 'done') {
            // Task completed
            task.completedAt = Date.now();
            this.completedTasks.push({
                ...task,
                timeLimit: task.timeLimit,
                actualTime: (task.timeLimit * 60 - task.timeRemaining) / 60 // in minutes
            });
            clearInterval(this.timers[taskId]);
        } else if (oldStatus !== 'doing' && newStatus !== 'doing') {
            // Task moved between non-doing states
            if (this.timers[taskId]) {
                clearInterval(this.timers[taskId]);
            }
        }
        
        // Move DOM element
        const taskElement = document.getElementById(`task-${taskId}`);
        if (taskElement) {
            const newContainer = this.getContainerForStatus(newStatus);
            newContainer.appendChild(taskElement);
            
            // Restart timer if moved back to doing
            if (newStatus === 'doing') {
                this.startTimer(taskId);
            }
        }
        
        this.saveTasksToStorage();
        this.updatePerformanceBoard();
    }

    updatePerformanceBoard() {
        const completedCount = this.completedTasks.length;
        const productivityScore = this.calculateProductivityScore();
        const averageTime = this.calculateAverageTime();
        const efficiency = this.calculateEfficiency();
        
        document.getElementById('productivityScore').textContent = productivityScore;
        document.getElementById('tasksCompleted').textContent = completedCount;
        document.getElementById('averageTime').textContent = `${averageTime}m`;
        document.getElementById('efficiency').textContent = `${efficiency}%`;
    }

    calculateProductivityScore() {
        if (this.completedTasks.length === 0) return 0;
        
        let totalScore = 0;
        this.completedTasks.forEach(task => {
            const efficiency = task.actualTime / task.timeLimit;
            let taskScore = 0;
            
            if (efficiency <= 1) {
                // Completed within time limit
                taskScore = 100;
                if (efficiency <= 0.8) taskScore += 20; // Bonus for early completion
                if (efficiency <= 0.5) taskScore += 30; // Extra bonus for very fast completion
            } else if (efficiency <= 1.5) {
                // Slightly over time
                taskScore = 70;
            } else if (efficiency <= 2) {
                // Moderately over time
                taskScore = 40;
            } else {
                // Significantly over time
                taskScore = 20;
            }
            
            totalScore += Math.min(taskScore, 100); // Cap at 100 per task
        });
        
        return Math.round(totalScore / this.completedTasks.length);
    }

    calculateAverageTime() {
        if (this.completedTasks.length === 0) return 0;
        
        const totalTime = this.completedTasks.reduce((sum, task) => sum + task.actualTime, 0);
        return Math.round(totalTime / this.completedTasks.length);
    }

    calculateEfficiency() {
        if (this.completedTasks.length === 0) return 0;
        
        const totalTimeLimit = this.completedTasks.reduce((sum, task) => sum + task.timeLimit, 0);
        const totalActualTime = this.completedTasks.reduce((sum, task) => sum + task.actualTime, 0);
        
        const efficiency = (totalTimeLimit / totalActualTime) * 100;
        return Math.round(Math.min(efficiency, 200)); // Cap at 200%
    }

    saveTasksToStorage() {
        const data = {
            tasks: this.tasks,
            completedTasks: this.completedTasks,
            taskIdCounter: this.taskIdCounter
        };
        localStorage.setItem('todoAppData', JSON.stringify(data));
    }

    loadTasksFromStorage() {
        const storedData = localStorage.getItem('todoAppData');
        if (storedData) {
            const data = JSON.parse(storedData);
            this.tasks = data.tasks || [];
            this.completedTasks = data.completedTasks || [];
            this.taskIdCounter = data.taskIdCounter || 1;
            
            // Clear existing DOM tasks
            document.getElementById('todoTasks').innerHTML = '';
            document.getElementById('doingTasks').innerHTML = '';
            document.getElementById('doneTasks').innerHTML = '';
            
            // Render existing tasks
            this.tasks.forEach(task => {
                this.renderTask(task);
                // Restart timer for tasks in doing status that still have time remaining
                if (task.status === 'doing' && task.timeRemaining > 0) {
                    this.startTimer(task.id);
                }
            });
            
            // Update performance board with completed tasks
            this.updatePerformanceBoard();
        }
    }
}

// Initialize the app when DOM is loaded
let todoApp;
document.addEventListener('DOMContentLoaded', () => {
    todoApp = new TodoApp();
});
