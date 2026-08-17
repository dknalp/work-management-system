# Active Work

## Now
Completed: dnd-kit DnD folder move + enhanced Bulk Action Bar (1+ selected) + Select All for File Explorer

## Done This Session
- file-breadcrumbs.tsx: Added useDroppable to each breadcrumb segment; drop id = "breadcrumb-{path}"
- file-explorer.tsx: Added DndContext/DragOverlay/DndTableRow wrapper; handleDndDragStart/End; handleSelectAll + allSelected; checkbox column in TableHead; bulk bar threshold changed to >= 1
- file-grid.tsx: Added DndGridCard wrapper (useDraggable + useDroppable); removed old HTML5 drag handlers

## Architecture notes
- dnd-kit drag IDs: "drag-{item.id}" for draggables, "dnd-folder-{item.id}" for folder droppables, "breadcrumb-{path}" for breadcrumb droppables
- handleDndDragEnd moves all selectedPaths if dragged item is in selection, otherwise single item
- bulkMove = Promise.allSettled(ids.map(id => moveFile(id, dest)))