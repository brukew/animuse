# AniMuse - Your Friendly Animation Assistant

## Overview
AniMuse is an interactive web-based animation assistant developed as the final project for MIT's 6.8510 course. It provides an intuitive interface for creating and manipulating animations through various input methods including voice commands and direct manipulation.

## Project Structure

### Core Files
- `index.html` - Main entry point of the application containing the core HTML structure

### JavaScript Files (`js/`)
- `main.js` - Core application logic and initialization
- `llmController.js` - Language model integration for natural language processing
- `animations.js` - Core animation logic and rendering functions
- `animationInteractions.js` - Handles user interactions with animations
- `animationPanel.js` - UI panel for animation controls and settings
- `canvasSetup.js` - Canvas initialization and setup
- `canvasResize.js` - Handles canvas resizing and responsive behavior
- `interactionPanel.js` - Main interaction UI panel
- `speechRecognition.js` - Voice command processing and recognition
- `stateHistory.js` - Manages animation state history and undo/redo functionality
- `toolbar.js` - Application toolbar and tools implementation

### Styles (`styles/`)
- `animationPanel.css` - Styles for animation control panel
- `canvas.css` - Canvas and drawing area styles
- `interactionPanel.css` - Interaction panel styling
- `llm.css` - Language model interface styles
- `speechRecognition.css` - Speech recognition UI styles

## Setup Instructions

### System Requirements
- Web Browser: Latest version of Chrome/Firefox/Safari with WebGL support
- Internet Connection: Required for LLM features and voice recognition

### Installation Steps
1. Clone the repository

2. Modify llmController.js and add your Open AI API key

3. Create a live browswer and run index.html
