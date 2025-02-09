# Project Knowledge

## Package Management

- Use `npx yarn` to run yarn commands when yarn is not installed globally
- Project uses yarn as package manager, but is installed as a dependency

## development

After any changes to the code, run `npx yarn test` to run the tests and linters

## Project Structure

- React application for animating Excalidraw drawings
- Converts drawings to animated SVGs
- Core animation logic in src/animate.ts
- Loading/SVG handling in src/useLoadSvg.ts

## Testing

- Run tests with `npx yarn test`
- Jest testing framework
- Test files co-located with source files (\*.test.ts)

When writing tests, use the minimal amount of input data / code to demonstrate the desired behavior.

## SVG Structure

Excalidraw exports frames with specific SVG structure:
- Frames are in `g` elements with `transform` and `stroke-linecap="round"` attributes
- Text elements are in separate `g` elements with `transform` and `text` children
- Frame content is grouped within the frame's `g` element
- Each group needs its own opacity animations to fade in/out properly
