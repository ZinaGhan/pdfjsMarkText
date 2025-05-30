import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

// Configure PDF.js worker for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = './public/pdf.worker.min.js';

// Make PDF.js available globally for our viewer components
(window as any).pdfjsLib = pdfjsLib;

interface MarkedText {
    id: string;
    content: string;
    pageNumber: number;
    timestamp: Date;
}

declare global {
    interface Window {
        SimplePDFViewer: any;
        TextLayerFactory: any;
        EventBus: any;
    }
}

class PDFViewerApp {
    private pdfDocument: PDFDocumentProxy | null = null;
    private pdfViewer: any = null;
    private currentPageNumber = 1;
    private currentScale = 1.0;
    private markedTexts: MarkedText[] = [];
    private eventBus: any = null;
    private textLayerFactory: any = null;

    // DOM elements
    private fileInput!: HTMLInputElement;
    private viewerContainer!: HTMLElement;
    private viewer!: HTMLElement;
    private loadingIndicator!: HTMLElement;
    private dropZone!: HTMLElement;
    private pageInput!: HTMLInputElement;
    private totalPages!: HTMLElement;
    private zoomSelect!: HTMLSelectElement;
    private markedTextList!: HTMLElement;
    private tooltip!: HTMLElement;

    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.initializePDFViewer();
        this.updateUI();
    }

    private initializeElements(): void {
        this.fileInput = document.getElementById('fileInput') as HTMLInputElement;
        this.viewerContainer = document.getElementById('viewerContainer') as HTMLElement;
        this.viewer = document.getElementById('viewer') as HTMLElement;
        this.loadingIndicator = document.getElementById('loadingIndicator') as HTMLElement;
        this.dropZone = document.getElementById('dropZone') as HTMLElement;
        this.pageInput = document.getElementById('pageInput') as HTMLInputElement;
        this.totalPages = document.getElementById('totalPages') as HTMLElement;
        this.zoomSelect = document.getElementById('zoomSelect') as HTMLSelectElement;
        this.markedTextList = document.getElementById('markedTextList') as HTMLElement;
        this.tooltip = document.getElementById('tooltip') as HTMLElement;
    }

    private initializePDFViewer(): void {
        // Wait for viewer.js to load
        if (typeof window.SimplePDFViewer === 'undefined') {
            console.log('Waiting for viewer.js to load...');
            setTimeout(() => this.initializePDFViewer(), 100);
            return;
        }

        console.log('Initializing PDF viewer components...');
        this.eventBus = new window.EventBus();
        this.textLayerFactory = new window.TextLayerFactory();

        this.pdfViewer = new window.SimplePDFViewer({
            container: this.viewerContainer,
            viewer: this.viewer,
            eventBus: this.eventBus,
            textLayerFactory: this.textLayerFactory
        });

        console.log('PDF viewer initialized:', this.pdfViewer);

        // Listen for pages initialization
        this.eventBus.on('pagesinit', () => {
            console.log('Pages initialized, setting scale:', this.currentScale);
            this.pdfViewer.currentScaleValue = this.currentScale;
        });
    }

    private setupEventListeners(): void {
        // File input
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop
        this.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.dropZone.addEventListener('drop', (e) => this.handleDrop(e));

        // Navigation controls
        document.getElementById('prevPage')?.addEventListener('click', () => this.previousPage());
        document.getElementById('nextPage')?.addEventListener('click', () => this.nextPage());

        // Page input
        this.pageInput.addEventListener('change', () => this.handlePageInput());
        this.pageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handlePageInput();
            }
        });

        // Zoom controls
        document.getElementById('zoomIn')?.addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOut')?.addEventListener('click', () => this.zoomOut());
        this.zoomSelect.addEventListener('change', () => this.handleZoomSelect());

        // Clear marked text
        document.getElementById('clearMarked')?.addEventListener('click', () => this.clearMarkedTexts());

        // Debug toggle
        document.getElementById('debugToggle')?.addEventListener('click', () => this.toggleDebugMode());

        // Enhanced text selection toggle
        document.getElementById('enhancedSelection')?.addEventListener('click', () => this.toggleEnhancedSelection());

        // Text selection events
        document.addEventListener('mouseup', () => this.handleTextSelection());

        // Add event listener for recalculate text layer button
        document.getElementById('recalculateTextLayer')?.addEventListener('click', () => this.recalculateTextLayer());
    }

    private handlePageInput(): void {
        const pageNumber = parseInt(this.pageInput.value);
        if (this.pdfDocument && pageNumber >= 1 && pageNumber <= this.pdfDocument.numPages) {
            this.goToPage(pageNumber);
        } else {
            // Reset to current page if invalid
            this.pageInput.value = this.currentPageNumber.toString();
        }
    }

    private handleZoomSelect(): void {
        const value = this.zoomSelect.value;
        
        if (value === 'auto') {
            this.fitToWidth();
        } else if (value === 'page-fit') {
            this.fitToPage();
        } else {
            const scale = parseFloat(value);
            if (!isNaN(scale)) {
                this.setZoom(scale);
            }
        }
    }

    private fitToWidth(): void {
        if (!this.pdfViewer || !this.pdfDocument) return;
        
        // Calculate scale to fit width
        const containerWidth = this.viewerContainer.clientWidth - 100; // Account for padding
        const pageWidth = 612; // Standard PDF page width in points
        const scale = containerWidth / pageWidth;
        
        this.setZoom(Math.max(0.1, Math.min(scale, 5)));
    }

    private fitToPage(): void {
        if (!this.pdfViewer || !this.pdfDocument) return;
        
        // Calculate scale to fit entire page
        const containerWidth = this.viewerContainer.clientWidth - 100;
        const containerHeight = this.viewerContainer.clientHeight - 100;
        const pageWidth = 612;
        const pageHeight = 792; // Standard PDF page height in points
        
        const scaleX = containerWidth / pageWidth;
        const scaleY = containerHeight / pageHeight;
        const scale = Math.min(scaleX, scaleY);
        
        this.setZoom(Math.max(0.1, Math.min(scale, 5)));
    }

    private setZoom(scale: number): void {
        this.currentScale = scale;
        if (this.pdfViewer) {
            this.pdfViewer.currentScaleValue = scale;
        }
        this.updateZoomDisplay();
    }

    private updateZoomDisplay(): void {
        const percentage = Math.round(this.currentScale * 100);
        
        // Update select if it's a standard value
        const standardValues = ['0.5', '0.75', '1', '1.25', '1.5', '2', '3', '4'];
        const currentValue = this.currentScale.toString();
        
        if (standardValues.includes(currentValue)) {
            this.zoomSelect.value = currentValue;
        } else {
            // Add custom option if not standard
            const customOption = this.zoomSelect.querySelector('option[data-custom]') as HTMLOptionElement;
            if (customOption) {
                customOption.value = currentValue;
                customOption.textContent = `${percentage}%`;
                this.zoomSelect.value = currentValue;
            } else {
                const option = document.createElement('option');
                option.value = currentValue;
                option.textContent = `${percentage}%`;
                option.setAttribute('data-custom', 'true');
                this.zoomSelect.appendChild(option);
                this.zoomSelect.value = currentValue;
            }
        }
    }

    private async handleFileSelect(event: Event): Promise<void> {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file && file.type === 'application/pdf') {
            await this.loadPDF(file);
        }
    }

    private handleDragOver(event: DragEvent): void {
        event.preventDefault();
        this.dropZone.classList.add('drag-over');
    }

    private handleDragLeave(event: DragEvent): void {
        event.preventDefault();
        this.dropZone.classList.remove('drag-over');
    }

    private async handleDrop(event: DragEvent): Promise<void> {
        event.preventDefault();
        this.dropZone.classList.remove('drag-over');
        
        const files = event.dataTransfer?.files;
        const file = files?.[0];
        
        if (file && file.type === 'application/pdf') {
            await this.loadPDF(file);
        }
    }

    private async loadPDF(file: File): Promise<void> {
        try {
            this.showLoading(true);
            this.dropZone.classList.add('hidden');

            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            
            this.pdfDocument = await loadingTask.promise;
            
            // Set document in PDF viewer
            if (this.pdfViewer) {
                this.pdfViewer.setDocument(this.pdfDocument);
                this.currentPageNumber = 1;
                this.updateUI();
            }
            
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.showError('Failed to load PDF file');
        } finally {
            this.showLoading(false);
        }
    }

    private handleTextSelection(): void {
        const selection = window.getSelection();
        console.log('Selection event triggered:', selection);
        
        if (!selection || selection.isCollapsed) {
            console.log('No selection or collapsed selection');
            return;
        }

        const selectedText = selection.toString().trim();
        console.log('Selected text:', selectedText, 'Length:', selectedText.length);
        
        if (selectedText.length > 0 && selectedText.length < 2000) { // Increased limit for high zoom
            // Check if selection is within a text layer
            const range = selection.getRangeAt(0);
            const textLayer = range.commonAncestorContainer.parentElement?.closest('.textLayer');
            console.log('Text layer found:', !!textLayer);
            console.log('Range details:', range);
            
            if (textLayer) {
                // Enhanced validation for better selection at high zoom
                const isValidSelection = this.validateTextSelection(selectedText, range);
                
                if (isValidSelection) {
                    console.log('Adding marked text:', selectedText);
                    this.addMarkedText(selectedText);
                    this.showTooltip('Text marked successfully!');
                    
                    // Keep selection visible for a moment, then clear
                    setTimeout(() => {
                        selection.removeAllRanges();
                    }, 1500);
                } else {
                    console.log('Selection validation failed, showing hint');
                    this.showTooltip('Try selecting more meaningful text');
                    setTimeout(() => {
                        selection.removeAllRanges();
                    }, 1000);
                }
            } else {
                console.log('Selection not in text layer');
            }
        } else if (selectedText.length >= 2000) {
            console.log('Selection too large');
            this.showTooltip('Selection too large. Please select smaller text portions.');
            selection.removeAllRanges();
        }
    }

    private validateTextSelection(text: string, range: Range): boolean {
        // Improved validation based on GitHub issues findings
        
        // Check minimum length (more flexible for high zoom)
        if (text.length < 1) return false;
        
        // Allow single meaningful words at high zoom
        if (this.currentScale > 2.0 && text.length >= 3 && /\w{3,}/.test(text)) {
            return true;
        }
        
        // For normal zoom, require at least 2 characters or meaningful content
        if (text.length >= 2 || /\w+/.test(text)) {
            return true;
        }
        
        // Check if it's a meaningful selection (not just whitespace or single chars)
        const meaningfulContent = text.replace(/\s+/g, '');
        if (meaningfulContent.length >= 2) {
            return true;
        }
        
        // Check if selection spans multiple text nodes (likely intentional)
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        if (startContainer !== endContainer) {
            return true;
        }
        
        return false;
    }

    private addMarkedText(content: string): void {
        console.log('addMarkedText called with:', content);
        
        const markedText: MarkedText = {
            id: Date.now().toString(),
            content: content,
            pageNumber: this.currentPageNumber,
            timestamp: new Date()
        };

        this.markedTexts.push(markedText);
        console.log('Marked texts array:', this.markedTexts);
        this.updateMarkedTextsList();
    }

    private updateMarkedTextsList(): void {
        if (this.markedTexts.length === 0) {
            this.markedTextList.innerHTML = '<p class="empty-state">No text marked yet. Select text in the PDF to mark it.</p>';
            return;
        }

        this.markedTextList.innerHTML = this.markedTexts
            .map(text => `
                <div class="marked-text-item" data-id="${text.id}">
                    <div class="marked-text-content">${this.escapeHtml(text.content)}</div>
                    <div class="marked-text-meta">
                        <span>Page ${text.pageNumber}</span>
                        <button class="copy-btn" onclick="window.pdfViewerApp.copyText('${text.id}')">Copy</button>
                    </div>
                </div>
            `)
            .join('');
    }

    public copyText(id: string): void {
        const markedText = this.markedTexts.find(text => text.id === id);
        if (markedText) {
            navigator.clipboard.writeText(markedText.content).then(() => {
                this.showTooltip('Text copied to clipboard!');
            }).catch(() => {
                this.showTooltip('Failed to copy text');
            });
        }
    }

    private clearMarkedTexts(): void {
        this.markedTexts = [];
        this.updateMarkedTextsList();
        this.showTooltip('All marked texts cleared');
    }

    private previousPage(): void {
        if (this.currentPageNumber > 1) {
            this.currentPageNumber--;
            this.goToPage(this.currentPageNumber);
        }
    }

    private nextPage(): void {
        if (this.pdfDocument && this.currentPageNumber < this.pdfDocument.numPages) {
            this.currentPageNumber++;
            this.goToPage(this.currentPageNumber);
        }
    }

    private goToPage(pageNumber: number): void {
        if (this.pdfViewer) {
            this.pdfViewer.currentPageNumber = pageNumber;
            this.currentPageNumber = pageNumber;
            this.updateUI();
        }
    }

    private zoomIn(): void {
        console.log('Zoom in clicked, current scale:', this.currentScale);
        const newScale = Math.min(this.currentScale * 1.2, 5.0);
        this.setZoom(newScale);
    }

    private zoomOut(): void {
        console.log('Zoom out clicked, current scale:', this.currentScale);
        const newScale = Math.max(this.currentScale / 1.2, 0.1);
        this.setZoom(newScale);
    }

    private applyZoom(): void {
        console.log('Applying zoom, new scale:', this.currentScale);
        if (this.pdfViewer) {
            this.pdfViewer.currentScaleValue = this.currentScale;
            this.updateZoomDisplay();
            
            // Force text layer regeneration after a short delay
            setTimeout(() => {
                console.log('Forcing text layer regeneration after zoom');
                const textLayers = document.querySelectorAll('.textLayer');
                textLayers.forEach(layer => {
                    console.log('Text layer spans count:', layer.children.length);
                });
            }, 100);
        }
    }

    private updateUI(): void {
        // Update page info
        const totalPages = this.pdfDocument?.numPages || 1;
        this.totalPages.textContent = totalPages.toString();
        this.pageInput.value = this.currentPageNumber.toString();
        this.pageInput.max = totalPages.toString();

        // Update zoom display
        this.updateZoomDisplay();

        // Update button states
        const prevBtn = document.getElementById('prevPage') as HTMLButtonElement;
        const nextBtn = document.getElementById('nextPage') as HTMLButtonElement;
        
        if (prevBtn) prevBtn.disabled = this.currentPageNumber <= 1;
        if (nextBtn) nextBtn.disabled = !this.pdfDocument || this.currentPageNumber >= this.pdfDocument.numPages;
    }

    private showLoading(show: boolean): void {
        if (show) {
            this.loadingIndicator.classList.remove('hidden');
        } else {
            this.loadingIndicator.classList.add('hidden');
        }
    }

    private showError(message: string): void {
        this.showTooltip(message);
        console.error(message);
    }

    private showTooltip(message: string): void {
        this.tooltip.textContent = message;
        this.tooltip.classList.add('visible');
        
        setTimeout(() => {
            this.tooltip.classList.remove('visible');
        }, 2000);
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    private toggleDebugMode(): void {
        const textLayers = document.querySelectorAll('.textLayer');
        if (textLayers.length === 0) {
            this.showTooltip('No text layers found. Load a PDF first.');
            return;
        }
        
        // Check if debug mode is currently active by looking at the first text layer
        const firstLayer = textLayers[0] as HTMLElement;
        const isDebugMode = firstLayer.style.opacity !== '0' && firstLayer.style.opacity !== '';
        
        console.log('Toggle debug mode. Current state:', isDebugMode ? 'ON' : 'OFF');
        
        textLayers.forEach(layer => {
            const layerElement = layer as HTMLElement;
            if (isDebugMode) {
                // Disable debug mode
                layerElement.style.opacity = '0';
                layerElement.style.background = '';
                layer.querySelectorAll('span').forEach(span => {
                    const spanElement = span as HTMLElement;
                    spanElement.style.background = '';
                    spanElement.style.border = '';
                    spanElement.style.color = 'transparent';
                });
            } else {
                // Enable debug mode
                layerElement.style.opacity = '0.3';
                layerElement.style.background = 'rgba(0, 255, 0, 0.1)';
                layer.querySelectorAll('span').forEach(span => {
                    const spanElement = span as HTMLElement;
                    spanElement.style.background = 'rgba(255, 0, 0, 0.2)';
                    spanElement.style.border = '1px solid rgba(255, 0, 0, 0.5)';
                    spanElement.style.color = 'rgba(0, 0, 0, 0.8)';
                });
            }
        });
        
        // Store debug state for newly created text layers
        (window as any).debugModeEnabled = !isDebugMode;
        
        const debugBtn = document.getElementById('debugToggle') as HTMLButtonElement;
        if (debugBtn) {
            debugBtn.textContent = isDebugMode ? 'Debug' : 'Debug ON';
            debugBtn.style.background = isDebugMode ? '#805ad5' : '#e53e3e';
        }
        
        this.showTooltip(isDebugMode ? 'Debug mode disabled' : 'Debug mode enabled');
    }

    private toggleEnhancedSelection(): void {
        const textLayers = document.querySelectorAll('.textLayer');
        if (textLayers.length === 0) {
            this.showTooltip('No text layers found. Load a PDF first.');
            return;
        }
        
        // Check if enhanced selection is currently active
        const firstLayer = textLayers[0] as HTMLElement;
        const isEnhanced = firstLayer.style.pointerEvents === 'none';
        
        console.log('Toggle enhanced selection. Current state:', isEnhanced ? 'ON' : 'OFF');
        
        textLayers.forEach(layer => {
            const layerElement = layer as HTMLElement;
            if (isEnhanced) {
                // Disable enhanced selection - revert to normal
                layerElement.style.pointerEvents = 'auto';
                layerElement.style.overflow = 'hidden';
                layer.querySelectorAll('span').forEach(span => {
                    const spanElement = span as HTMLElement;
                    spanElement.style.pointerEvents = 'auto';
                    spanElement.style.minHeight = '';
                    spanElement.style.paddingRight = '2px';
                    spanElement.style.paddingBottom = '1px';
                });
            } else {
                // Enable enhanced selection - apply GitHub issue solutions
                layerElement.style.pointerEvents = 'none';
                layerElement.style.overflow = 'visible';
                layer.querySelectorAll('span').forEach(span => {
                    const spanElement = span as HTMLElement;
                    spanElement.style.pointerEvents = 'all';
                    const fontSize = parseFloat(spanElement.style.fontSize) || 12;
                    spanElement.style.minHeight = fontSize + 'px';
                    spanElement.style.paddingRight = Math.max(2, fontSize * 0.1) + 'px';
                    spanElement.style.paddingBottom = Math.max(1, fontSize * 0.05) + 'px';
                });
            }
        });
        
        // Store enhanced selection state for newly created text layers
        (window as any).enhancedSelectionEnabled = !isEnhanced;
        
        const enhancedBtn = document.getElementById('enhancedSelection') as HTMLButtonElement;
        if (enhancedBtn) {
            enhancedBtn.textContent = isEnhanced ? 'Enhanced Selection' : 'Enhanced Selection ON';
            enhancedBtn.style.background = isEnhanced ? '#38a169' : '#e53e3e';
        }
        
        this.showTooltip(isEnhanced ? 'Enhanced selection disabled' : 'Enhanced selection enabled');
    }

    // Implement the recalculateTextLayer method
    private recalculateTextLayer(): void {
        console.log('Recalculating text layer...');
        if (this.pdfViewer && this.pdfDocument) {
            // Force complete re-render of all pages with current scale
            this.pdfViewer.currentScaleValue = this.currentScale;
            this.showTooltip('Text layer recalculated');
        } else {
            this.showTooltip('No PDF loaded');
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new PDFViewerApp();
    // Make app available globally for copy function
    (window as any).pdfViewerApp = app;
}); 