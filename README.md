<<<<<<< HEAD
# pdfjsMarkText
=======
# PDF Viewer with Text Marking

A modern PDF viewer built with TypeScript, PDF.js, and Vite that allows users to mark and copy text from PDF documents.

## Features

- 📄 Load PDF files via file input or drag & drop
- 🔍 Zoom controls (50%-300%)
- 📖 Page navigation
- ✏️ Text marking and copying
- 🎯 Debug mode for text layer visualization
- ⚡ Enhanced text selection mode
- 📱 Responsive design

## Key Technical Insights

### Why Zoom Was Problematic

Based on research from [this excellent Medium article](https://medium.com/@9haroon_dev/understanding-pdf-js-layers-and-how-to-use-them-in-react-js-6e761d796c2f), the main issues with text selection at different zoom levels were:

1. **Missing Scale Factor**: PDF.js uses a CSS custom property `--total-scale-factor` to handle text layer scaling
2. **Improper Layer Architecture**: Text layers need to be properly structured and positioned
3. **Viewport Scaling**: Text positioning must scale proportionally with the canvas viewport

### Our Solution

We implemented the proper PDF.js layer architecture:

```javascript
// Critical: Set the scale factor for proper zoom handling
const { scale } = this.viewport;
this.textLayerDiv.style.setProperty("--total-scale-factor", `${scale}`);
```

```css
.textLayer {
    --total-scale-factor: 1;
}

.textLayer > span {
    transform: scale(var(--total-scale-factor));
}
```

This ensures text layers scale correctly with zoom changes, maintaining perfect alignment between the canvas and text selection areas.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Copy PDF.js worker:**
   ```bash
   cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.js
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to the local server URL

## Usage

1. **Load a PDF**: Click "Choose PDF File" or drag & drop a PDF file
2. **Navigate**: Use Previous/Next buttons or page controls
3. **Zoom**: Use +/- buttons to zoom in/out
4. **Mark Text**: Select text in the PDF to mark it
5. **Debug Mode**: Click "Debug" to visualize text layer positioning
6. **Enhanced Selection**: Click "Enhanced Selection" for improved text selection behavior

## Technical Architecture

### PDF.js Layers

Our implementation uses the proper PDF.js layer structure:

1. **Canvas Layer**: Renders the visual PDF content
2. **Text Layer**: Handles text selection and searching (with proper scaling)
3. **Structural Layer**: Manages layout and coordinates between layers

### Key Components

- `src/main.ts` - Main application logic and text selection handling
- `public/viewer.js` - PDF.js viewer components and text layer builder
- `src/styles.css` - Styling with proper text layer scaling support
- `index.html` - HTML structure with layer containers

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies

- PDF.js v5.2.133
- TypeScript
- Vite
- Modern CSS (Flexbox/Grid)

## License

MIT License 
>>>>>>> 52e429d (Your commit message here)
