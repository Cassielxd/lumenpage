# LumenPage

LumenPage is a minimal MVP for a paginated rich-text editor architecture. It uses a DOM input layer and a canvas rendering layer, with a simple layout engine for line breaking and pagination.

## Structure
- `index.html`: entry page
- `styles.css`: layout and visuals
- `src/main.js`: bootstraps the app
- `src/core`: core modules (document, layout, renderer, input, virtualization)

## Run
Open `index.html` in a local server (ES modules require a server in most browsers).

Example:
```
python -m http.server
```
Then visit `http://localhost:8000`.

## Notes
- This MVP focuses on pagination and canvas rendering.
- Selection, hit-testing, and IME alignment are minimal placeholders.
