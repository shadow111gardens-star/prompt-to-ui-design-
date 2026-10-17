# Canvas drawing toolbar — live test report

Date: 16 October 2026. Scope: the bottom drawing toolbar in the supplied screenshot, plus adjacent Undo/Redo and Zoom controls. This is not a full audit of the separate Style Guide tab.

## Result
All 13 drawing tools were exercised in the local browser using the disposable Toolbar QA project (`cmvay7lkr0000uguy8zpr032r`). The original FitTrack project was not used for destructive drawing tests. The last sparkle icon is Laser Pointer, not AI generation.

| Tool | Actual live check | Result |
| --- | --- | --- |
| Select | Click/select, drag/move rectangle, marquee selecting seven shapes, Delete and Undo | Pass |
| Pan | Canvas drag moved the rendered rectangle by 20px while keeping its world geometry | Pass |
| Frame | Created Frame 2 with its frame actions visible; remained after reload | Pass |
| Rectangle | Drag created approximately 100×80px on screen; resized to approximately 120×100px | Pass |
| Ellipse | Drag created approximately 100×80px ellipse; remained after reload | Pass |
| Free Draw | Drag created a polyline; persisted after reload | Pass |
| Arrow | Diagonal and exactly vertical arrows produced rendered line/arrow geometry | Pass |
| Line | Diagonal and exactly horizontal lines produced rendered geometry | Pass |
| Connector | Linked rectangle and ellipse; SVG endpoints followed rectangle movement | Pass |
| Text | Entered “Canvas tools verified”, committed with Enter; persisted after reload | Pass |
| Sticky Note | Entered “QA sticky note”, committed with Ctrl+Enter; persisted after reload | Pass |
| Eraser | Removed rectangle and its connector; Undo restored both. Locked rectangle survived erase | Pass |
| Laser Pointer | Visible glow cursor and eight temporary trail segments observed; switching tools removed the cursor and trail expired | Pass |

Additional checks:
- Undo moved rectangle back to x≈390; Redo returned it to x≈410.
- Locked rectangle survived keyboard Delete, and Unlock was available.
- Marquee selected seven shapes; Delete removed both geometric boxes; Undo restored them.
- Zoom In changed 38% to 45%; Zoom Out restored the previous level. Custom 50% applied. Fit-to-screen adjusted the view (selected content and then all content).
- Save/reload retained two geometric boxes, one connector, one freehand stroke, Frame 2, the text and note.
- All 13 drawing buttons were measured inside the current browser viewport after the layout fix.

## Bugs fixed
1. Toolbar controls previously overflowed the narrow window, hiding late tools and zoom controls. The toolbar now wraps/reorders at narrow widths while retaining a single-row layout at wide widths.
2. Tool icon buttons lacked accessible names and selected-state announcements. Added labels, pressed state and a named drawing toolbar. Undo/Redo are no longer hidden from accessibility tools and have explicit labels.
3. Horizontal or vertical lines/arrows were rejected because drawing required both non-zero width and height. Line/arrow creation now validates length, while area shapes still require both dimensions. Zero-length drawings are ignored.
4. Deleting a connected shape left an orphan connector in saved state. Erase and selection deletion now remove its linked connectors and stale selections in the same undoable action.

## Automated verification
- `npm test`: 27 passed, zero failed.
- New regression checks cover horizontal/vertical drawing geometry, zero-size rejection, connector cleanup, Undo/Redo restoration, and locked selection deletion.
- `npx tsc --noEmit`: passed after these changes.

## Limits and API usage
No AI generation request was needed for this drawing-toolbar test. Normal local save/load requests were used. Frame's separate Generate Design flow and the distinct Style Guide page are outside this screenshot-specific test. The current browser viewport was tested; every possible device/browser and touch/stylus input combination was not exhaustively tested.

Evidence: `canvas-tools-live-test.jpg`. The disposable QA project retains the saved test drawings for inspection. Undo history is intentionally reset by project reload.
