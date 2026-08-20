# Active Work

## Now
Files bug fixes + Google Drive import entegrasyonu TAMAMLANDI.

## Done This Session
### Bug Fixes (Backend)
- r2.py: get_event_loop() → get_running_loop() (6 yer) + @lru_cache(maxsize=1) singleton
- files.py: is_starred search fix (FileRecord.starred → FileRecord.is_starred)
- files.py: size=None fallback → size=0 + logging.warning
- file-explorer.tsx: sourceFilter dead code'a TODO yorumu

### Google Drive Entegrasyonu
- requirements.txt: google-auth, google-auth-oauthlib, google-api-python-client eklendi
- backend/app/google_drive.py: yeni modül (metadata fetch + streaming download + Workspace export)
- files.py: POST /import-from-drive endpoint (conflict check, R2/disk, FileRecord)
- frontend/lib/actions/files.ts: importFromDrive() action eklendi
- frontend/hooks/use-drive-picker.ts: useDrivePicker hook (GIS + Picker API, lazy load)
- frontend/components/files/file-client-page.tsx: "Drive'dan İçe Aktar" butonu + handler

## Kalan (Manuel)
- DRIVE-1: Google Cloud Console kurulumu (Drive API + Picker API + OAuth Client + API Key)
- DRIVE-5: backend/.env → GOOGLE_OAUTH_CLIENT_ID
- DRIVE-7: frontend/.env.local → NEXT_PUBLIC_GOOGLE_CLIENT_ID + NEXT_PUBLIC_GOOGLE_PICKER_API_KEY

## Done This Session
- file-breadcrumbs.tsx: Added useDroppable to each breadcrumb segment; drop id = "breadcrumb-{path}"
- file-explorer.tsx: Added DndContext/DragOverlay/DndTableRow wrapper; handleDndDragStart/End; handleSelectAll + allSelected; checkbox column in TableHead; bulk bar threshold changed to >= 1
- file-grid.tsx: Added DndGridCard wrapper (useDraggable + useDroppable); removed old HTML5 drag handlers

## Architecture notes
- dnd-kit drag IDs: "drag-{item.id}" for draggables, "dnd-folder-{item.id}" for folder droppables, "breadcrumb-{path}" for breadcrumb droppables
- handleDndDragEnd moves all selectedPaths if dragged item is in selection, otherwise single item
- bulkMove = Promise.allSettled(ids.map(id => moveFile(id, dest)))