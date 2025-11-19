/**
 * Visual S-Curve Editor Component
 * Renders an interactive canvas to manipulate S-curve parameters visually.
 */
class VisualSCurveEditor {
    constructor(container, params, onChange) {
        this.container = container;
        this.params = { ...params }; // targetShare, targetYear, kValue, midpointYear, startYear, endYear, baseValue
        this.onChange = onChange;

        // State for dragging
        this.isDraggingTarget = false;
        this.isDraggingMidpoint = false;
        this.dragStartX = 0;
        this.dragStartY = 0;

        // Dimensions
        this.width = 0;
        this.height = 200;
        this.padding = { top: 20, right: 30, bottom: 30, left: 40 };

        this.init();
    }

    init() {
        console.log("VisualSCurveEditor initializing...");
        this.container.innerHTML = '';
        this.container.className = 'visual-editor-container';

        // Canvas
        this.canvasWrapper = document.createElement('div');
        this.canvasWrapper.className = 'canvas-wrapper';
        this.canvas = document.createElement('canvas');
        this.canvasWrapper.appendChild(this.canvas);
        this.container.appendChild(this.canvasWrapper);
        this.ctx = this.canvas.getContext('2d');

        // Steepness Slider
        this.controlsDiv = document.createElement('div');
        this.controlsDiv.className = 'editor-controls';

        const sliderLabel = document.createElement('label');
        sliderLabel.textContent = 'Transition Speed (Steepness):';
        this.kSlider = document.createElement('input');
        this.kSlider.type = 'range';
        this.kSlider.min = '0.05';
        this.kSlider.max = '0.5';
        this.kSlider.step = '0.01';
        this.kSlider.value = this.params.kValue;
        this.kSlider.oninput = (e) => {
            this.params.kValue = parseFloat(e.target.value);
            this.draw();
            this.notifyChange();
        };

        this.controlsDiv.appendChild(sliderLabel);
        this.controlsDiv.appendChild(this.kSlider);
        this.container.appendChild(this.controlsDiv);

        // Event Listeners
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        window.addEventListener('mousemove', this.handleMouseMove.bind(this));
        window.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // Initial Resize & Draw
        // Use ResizeObserver to handle container resizing
        this.resizeObserver = new ResizeObserver(() => {
            // console.log("ResizeObserver triggered");
            this.resize();
        });
        this.resizeObserver.observe(this.canvasWrapper); // Observe wrapper, not main container

        // Force initial resize attempt
        setTimeout(() => this.resize(), 50);
    }

    resize() {
        const rect = this.canvasWrapper.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return;
        }

        // Prevent resize loop: only update if dimensions actually changed significantly
        // if (Math.abs(this.width - rect.width) < 1 && Math.abs(this.height - 200) < 1) {
        //     return;
        // }

        // Update dimensions to match the wrapper's actual size
        this.width = rect.width;
        this.height = rect.height;

        // Ensure canvas internal dimensions match display dimensions (1:1 resolution)
        this.canvas.width = this.width;
        this.canvas.height = this.height; // Fixed height from constructor
        this.draw();
    }

    // Coordinate Conversions
    yearToX(year) {
        const range = this.params.endYear - this.params.startYear;
        const availableWidth = this.width - this.padding.left - this.padding.right;
        return this.padding.left + ((year - this.params.startYear) / range) * availableWidth;
    }

    xToYear(x) {
        const range = this.params.endYear - this.params.startYear;
        const availableWidth = this.width - this.padding.left - this.padding.right;
        const relativeX = x - this.padding.left;
        let year = this.params.startYear + (relativeX / availableWidth) * range;
        return Math.max(this.params.startYear, Math.min(this.params.endYear + 5, year)); // Allow slightly past end
    }

    shareToY(share) {
        const availableHeight = this.height - this.padding.top - this.padding.bottom;
        return this.height - this.padding.bottom - (share / 100) * availableHeight;
    }

    yToShare(y) {
        const availableHeight = this.height - this.padding.top - this.padding.bottom;
        const relativeY = this.height - this.padding.bottom - y;
        let share = (relativeY / availableHeight) * 100;
        return Math.max(0, Math.min(100, share));
    }

    // S-Curve Logic (Normalized Logistic Function)
    calculateSCurve(year) {
        const targetShare = this.params.targetShare;
        const baseValue = this.params.baseValue;
        const k = this.params.kValue;
        const t0 = this.params.midpointYear;
        const startYear = this.params.startYear;
        const targetYear = this.params.targetYear;

        // Logistic function f(t)
        const f = (t) => 1 / (1 + Math.exp(-k * (t - t0)));

        const vStart = f(startYear);
        const vTarget = f(targetYear);

        // Avoid division by zero if targetYear is too close to startYear
        if (Math.abs(vTarget - vStart) < 0.0001) {
            // Fallback to linear interpolation or just base value
            return baseValue;
        }

        // Normalized function: N(t) = (f(t) - f(start)) / (f(target) - f(start))
        // S(t) = Base + (Target - Base) * N(t)

        const ft = f(year);
        const Nt = (ft - vStart) / (vTarget - vStart);

        return baseValue + (targetShare - baseValue) * Nt;
    }

    draw() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // 1. Grid & Axes
        ctx.beginPath();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        // Horizontal lines (0, 50, 100)
        [0, 50, 100].forEach(val => {
            const y = this.shareToY(val);
            ctx.moveTo(this.padding.left, y);
            ctx.lineTo(this.width - this.padding.right, y);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px Poppins';
            ctx.fillText(val + '%', 5, y + 3);
        });
        // Vertical lines (Start, End)
        [this.params.startYear, this.params.endYear].forEach(year => {
            const x = this.yearToX(year);
            ctx.moveTo(x, this.padding.top);
            ctx.lineTo(x, this.height - this.padding.bottom);
            ctx.fillText(year, x - 10, this.height - 10);
        });
        ctx.stroke();

        // 2. Draw S-Curve
        ctx.beginPath();
        ctx.strokeStyle = '#10b981'; // Ember Green
        ctx.lineWidth = 3;
        // Draw with higher resolution for smoothness
        for (let y = this.params.startYear; y <= this.params.endYear; y += 0.2) {
            const x = this.yearToX(y);
            const val = this.calculateSCurve(y);
            const yPos = this.shareToY(val);
            if (y === this.params.startYear) ctx.moveTo(x, yPos);
            else ctx.lineTo(x, yPos);
        }
        ctx.stroke();

        // 3. Draw Midpoint Handle (Vertical Line)
        const midX = this.yearToX(this.params.midpointYear);
        ctx.beginPath();
        ctx.strokeStyle = '#64748b'; // Dark Grey
        ctx.setLineDash([5, 5]);
        ctx.moveTo(midX, this.padding.top);
        ctx.lineTo(midX, this.height - this.padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Midpoint Handle Knob
        ctx.beginPath();
        ctx.fillStyle = '#64748b';
        ctx.arc(midX, this.height - this.padding.bottom + 5, 5, 0, Math.PI * 2);
        ctx.fill();
        // Label
        ctx.fillStyle = '#64748b';
        ctx.fillText(`t0: ${Math.round(this.params.midpointYear)}`, midX + 8, this.height - this.padding.bottom - 10);


        // 4. Draw Target Handle (Dot)
        const targetX = this.yearToX(this.params.targetYear);
        const targetY = this.shareToY(this.params.targetShare);

        ctx.beginPath();
        ctx.fillStyle = '#10b981';
        ctx.arc(targetX, targetY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 11px Poppins';
        ctx.fillText(`${Math.round(this.params.targetShare)}% @ ${Math.round(this.params.targetYear)}`, targetX - 40, targetY - 15);
    }

    // Interaction Handlers
    handleMouseDown(e) {
        e.preventDefault(); // Prevent text selection/default behavior
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check Target Handle
        const targetX = this.yearToX(this.params.targetYear);
        const targetY = this.shareToY(this.params.targetShare);
        const distTarget = Math.sqrt((x - targetX) ** 2 + (y - targetY) ** 2);

        if (distTarget < 30) { // Increased hit area
            this.isDraggingTarget = true;
            this.dragOffsetX = targetX - x;
            this.dragOffsetY = targetY - y;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        // Check Midpoint Handle
        const midX = this.yearToX(this.params.midpointYear);
        if (Math.abs(x - midX) < 20) { // Increased hit area
            this.isDraggingMidpoint = true;
            this.dragOffsetX = midX - x;
            this.canvas.style.cursor = 'col-resize';
            return;
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Handle Dragging
        if (this.isDraggingTarget) {
            // Apply offset to keep handle relative to mouse
            const newX = x + this.dragOffsetX;
            const newY = y + this.dragOffsetY;

            // Use float precision for smooth movement (1 decimal place)
            let newTargetYear = parseFloat(this.xToYear(newX).toFixed(1));
            // Clamp target year to be at least startYear + 1 to ensure valid curve
            newTargetYear = Math.max(this.params.startYear + 1, newTargetYear);

            this.params.targetYear = newTargetYear;
            this.params.targetShare = parseFloat(this.yToShare(newY).toFixed(1));

            this.draw();
            this.notifyChange();
            return;
        } else if (this.isDraggingMidpoint) {
            const newX = x + this.dragOffsetX;
            this.params.midpointYear = parseFloat(this.xToYear(newX).toFixed(1));
            this.draw();
            this.notifyChange();
            return;
        }

        // Handle Hover Cursor
        const targetX = this.yearToX(this.params.targetYear);
        const targetY = this.shareToY(this.params.targetShare);
        const distTarget = Math.sqrt((x - targetX) ** 2 + (y - targetY) ** 2);

        const midX = this.yearToX(this.params.midpointYear);
        const distMid = Math.abs(x - midX);

        if (distTarget < 30) {
            this.canvas.style.cursor = 'grab';
        } else if (distMid < 20) {
            this.canvas.style.cursor = 'col-resize';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    handleMouseUp() {
        this.isDraggingTarget = false;
        this.isDraggingMidpoint = false;
        this.canvas.style.cursor = 'default';
        // Re-check hover to set correct cursor immediately after drop
        // (Optional, but nice polish)
    }

    notifyChange() {
        if (this.onChange) {
            this.onChange(this.params);
        }
    }
}
