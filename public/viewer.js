// Simplified PDF.js viewer components for text layer support
// Based on PDF.js viewer.js but simplified for our use case

class EventBus {
    constructor() {
        this._listeners = Object.create(null);
    }

    on(eventName, listener) {
        const eventListeners = this._listeners[eventName];
        if (!eventListeners) {
            this._listeners[eventName] = [listener];
        } else {
            eventListeners.push(listener);
        }
    }

    off(eventName, listener) {
        const eventListeners = this._listeners[eventName];
        if (!eventListeners) {
            return;
        }
        const index = eventListeners.indexOf(listener);
        if (index >= 0) {
            eventListeners.splice(index, 1);
        }
    }

    dispatch(eventName, data) {
        const eventListeners = this._listeners[eventName];
        if (!eventListeners || eventListeners.length === 0) {
            return;
        }
        const event = Object.assign(Object.create(null), {
            source: this,
            type: eventName
        }, data);
        
        eventListeners.slice(0).forEach(listener => {
            listener(event);
        });
    }
}

class PDFPageView {
    constructor(options) {
        this.id = options.id;
        this.scale = options.scale || 1;
        this.rotation = options.rotation || 0;
        this.viewport = null;
        this.pdfPage = null;
        this.div = null;
        this.canvas = null;
        this.textLayer = null;
        this.eventBus = options.eventBus;
        this.renderingState = 0; // NOT_RENDERED
        this.textLayerFactory = options.textLayerFactory;
    }

    setPdfPage(pdfPage) {
        this.pdfPage = pdfPage;
        this.pdfPageRotate = pdfPage.rotate || 0;
        const totalRotation = (this.rotation + this.pdfPageRotate) % 360;
        this.viewport = pdfPage.getViewport({
            scale: this.scale,
            rotation: totalRotation
        });
    }

    reset() {
        console.log('PDFPageView.reset() called for page', this.id);
        this.renderingState = 0;
        
        if (this.div) {
            this.div.style.width = Math.floor(this.viewport.width) + 'px';
            this.div.style.height = Math.floor(this.viewport.height) + 'px';
        }
        
        if (this.canvas) {
            this.canvas.width = this.viewport.width;
            this.canvas.height = this.viewport.height;
            this.canvas.style.width = this.viewport.width + 'px';
            this.canvas.style.height = this.viewport.height + 'px';
        }
        
        if (this.textLayer) {
            console.log('Canceling existing text layer for page', this.id);
            this.textLayer.cancel();
            this.textLayer = null;
        }
        
        // Clear the text layer div
        if (this.textLayerDiv) {
            this.textLayerDiv.innerHTML = '';
            this.textLayerDiv.style.width = this.viewport.width + 'px';
            this.textLayerDiv.style.height = this.viewport.height + 'px';
        }
    }

    update(scale, rotation) {
        this.scale = scale || this.scale;
        this.rotation = (rotation !== undefined) ? rotation : this.rotation;

        if (this.pdfPage) {
            const totalRotation = (this.rotation + this.pdfPageRotate) % 360;
            this.viewport = this.pdfPage.getViewport({
                scale: this.scale,
                rotation: totalRotation
            });
        }
        this.reset();
    }

    async draw() {
        console.log('PDFPageView.draw() called for page', this.id, 'with scale', this.scale);
        
        if (this.renderingState !== 0) {
            console.log('Page', this.id, 'already rendering or rendered, resetting...');
            this.renderingState = 0; // Force re-render
        }
        this.renderingState = 1; // RUNNING

        const pdfPage = this.pdfPage;
        const viewport = this.viewport;
        const canvas = this.canvas;
        const ctx = canvas.getContext('2d');

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        try {
            console.log('Rendering canvas for page', this.id);
            await pdfPage.render(renderContext).promise;
            this.renderingState = 3; // FINISHED
            
            // Always re-render text layer
            if (this.textLayerFactory) {
                console.log('Getting text content for page', this.id);
                const textContent = await pdfPage.getTextContent();
                
                // Cancel existing text layer
                if (this.textLayer) {
                    this.textLayer.cancel();
                }
                
                console.log('Creating new text layer for page', this.id);
                this.textLayer = this.textLayerFactory.createTextLayerBuilder(
                    this.textLayerDiv,
                    this.id - 1,
                    viewport
                );
                this.textLayer.setTextContent(textContent);
                this.textLayer.render();
            }
        } catch (error) {
            this.renderingState = 2; // ERROR
            console.error('Error rendering page', this.id, error);
            throw error;
        }
    }
}

class SimplePDFViewer {
    constructor(options) {
        this.container = options.container;
        this.viewer = options.viewer;
        this.eventBus = options.eventBus || new EventBus();
        this.pdfDocument = null;
        this.pagesCount = 0;
        this.currentPageNumber = 1;
        this.currentScale = 1.0;
        this.pagesRotation = 0;
        this._pages = [];
        this.textLayerFactory = options.textLayerFactory;
    }

    setDocument(pdfDocument) {
        this.pdfDocument = pdfDocument;
        this.pagesCount = pdfDocument.numPages;
        this._resetView();
        this._setupPages();
    }

    _resetView() {
        this.viewer.innerHTML = '';
        this._pages = [];
    }

    _setupPages() {
        for (let pageNum = 1; pageNum <= this.pagesCount; pageNum++) {
            const pageView = new PDFPageView({
                id: pageNum,
                scale: this.currentScale,
                rotation: this.pagesRotation,
                eventBus: this.eventBus,
                textLayerFactory: this.textLayerFactory
            });

            this._pages.push(pageView);
            this._setupPageView(pageView, pageNum);
        }
    }

    async _setupPageView(pageView, pageNum) {
        const div = document.createElement('div');
        div.className = 'page';
        div.style.position = 'relative';
        div.style.margin = '10px auto';
        div.style.display = 'block';
        
        const canvas = document.createElement('canvas');
        canvas.style.display = 'block';
        
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.position = 'absolute';
        textLayerDiv.style.top = '0';
        textLayerDiv.style.left = '0';
        textLayerDiv.style.opacity = '0';
        textLayerDiv.style.pointerEvents = 'none';
        
        div.appendChild(canvas);
        div.appendChild(textLayerDiv);
        this.viewer.appendChild(div);

        pageView.div = div;
        pageView.canvas = canvas;
        pageView.textLayerDiv = textLayerDiv;

        const pdfPage = await this.pdfDocument.getPage(pageNum);
        pageView.setPdfPage(pdfPage);
        pageView.reset();
        
        if (pageNum === this.currentPageNumber) {
            await pageView.draw();
        }
    }

    async update() {
        console.log('SimplePDFViewer.update() called with scale:', this.currentScale);
        for (const pageView of this._pages) {
            pageView.update(this.currentScale, this.pagesRotation);
            // Re-render all pages to ensure text layers are updated
            console.log('Re-rendering page', pageView.id, 'after zoom change');
            await pageView.draw();
        }
    }

    get currentScaleValue() {
        return this.currentScale;
    }

    set currentScaleValue(val) {
        if (typeof val === 'number') {
            this.currentScale = val;
        } else if (val === 'page-width') {
            // Calculate scale to fit page width
            const containerWidth = this.container.clientWidth - 40; // padding
            if (this._pages.length > 0 && this._pages[0].viewport) {
                this.currentScale = containerWidth / this._pages[0].viewport.width;
            }
        }
        this.update();
    }

    recalculateTextLayer() {
        console.log('Recalculating text layer for all pages...');
        this.update();
    }
}

class TextLayerBuilder {
    constructor(textLayerDiv, pageIndex, viewport) {
        this.textLayerDiv = textLayerDiv;
        this.pageIndex = pageIndex;
        this.viewport = viewport;
        this.textContent = null;
        this.renderingDone = false;
        this.renderTask = null;
    }

    setTextContent(textContent) {
        this.textContent = textContent;
    }

    render() {
        console.log('TextLayerBuilder.render() called with proper scaling');
        
        if (!this.textContent || this.renderingDone) {
            console.log('No text content or already rendered');
            return;
        }

        console.log('Rendering text layer with viewport:', this.viewport);
        console.log('Text content items:', this.textContent.items.length);

        // Clear existing content
        this.textLayerDiv.innerHTML = '';
        
        // Set up the container dimensions to match viewport exactly
        this.textLayerDiv.style.width = this.viewport.width + 'px';
        this.textLayerDiv.style.height = this.viewport.height + 'px';
        
        // CRITICAL: Set the scale factor for proper zoom handling
        const { scale } = this.viewport;
        this.textLayerDiv.style.setProperty("--total-scale-factor", `${scale}`);
        
        console.log('Setting scale factor:', scale);

        const textItems = this.textContent.items;
        const textStyles = this.textContent.styles;

        textItems.forEach((item, index) => {
            if (!item.str || !item.str.trim()) return;

            const span = document.createElement('span');
            span.textContent = item.str;
            span.style.position = 'absolute';
            span.style.whiteSpace = 'pre';
            span.style.color = 'transparent';
            span.style.cursor = 'text';
            span.style.userSelect = 'text';
            span.style.pointerEvents = 'all';

            const tx = item.transform;
            const style = textStyles[item.fontName];
            
            // Use PDF.js coordinate system - this is the key from vivin.net article
            const fontSize = Math.abs(tx[0]);
            const fontScale = fontSize / this.viewport.scale;
            
            // Position calculation that accounts for PDF coordinate system
            const x = tx[4];
            const y = this.viewport.height - tx[5];
            
            // Apply positioning - let the CSS transform handle scaling
            span.style.left = x + 'px';
            span.style.top = (y - fontSize) + 'px';
            span.style.fontSize = fontSize + 'px';
            span.style.fontFamily = style ? style.fontFamily : 'sans-serif';
            span.style.transformOrigin = '0% 0%';
            
            // No manual padding - let PDF.js coordinate system work naturally
            span.style.padding = '0';
            span.style.margin = '0';
            span.style.lineHeight = '1';
            
            this.textLayerDiv.appendChild(span);
        });

        this.applyEnhancements();
        this.renderingDone = true;
        console.log('Text layer rendered with', this.textLayerDiv.children.length, 'spans at scale', scale);
    }

    applyEnhancements() {
        // Apply debug mode if enabled
        if (window.debugModeEnabled) {
            console.log('Applying debug mode to text layer');
            this.textLayerDiv.style.opacity = '0.3';
            this.textLayerDiv.style.background = 'rgba(0, 255, 0, 0.1)';
            this.textLayerDiv.querySelectorAll('span').forEach(span => {
                span.style.background = 'rgba(255, 0, 0, 0.2)';
                span.style.border = '1px solid rgba(255, 0, 0, 0.5)';
                span.style.color = 'rgba(0, 0, 0, 0.8)';
            });
        } else {
            this.textLayerDiv.style.opacity = '0';
        }

        // Apply enhanced selection mode if enabled
        if (window.enhancedSelectionEnabled) {
            console.log('Applying enhanced selection mode to text layer');
            this.textLayerDiv.style.pointerEvents = 'none';
            this.textLayerDiv.style.overflow = 'visible';
            this.textLayerDiv.querySelectorAll('span').forEach(span => {
                span.style.pointerEvents = 'all';
                // Don't override positioning - just ensure spans are selectable
                const fontSize = parseFloat(span.style.fontSize) || 12;
                span.style.minHeight = fontSize + 'px';
            });
        }

        console.log('Text layer rendered with', this.textLayerDiv.children.length, 'spans');
    }

    cancel() {
        this.renderingDone = false;
        if (this.renderTask && this.renderTask.cancel) {
            this.renderTask.cancel();
        }
        if (this.textLayerDiv) {
            this.textLayerDiv.innerHTML = '';
        }
    }
}

class TextLayerFactory {
    createTextLayerBuilder(textLayerDiv, pageIndex, viewport) {
        return new TextLayerBuilder(textLayerDiv, pageIndex, viewport);
    }
}

// Export for use
window.SimplePDFViewer = SimplePDFViewer;
window.TextLayerFactory = TextLayerFactory;
window.EventBus = EventBus; 