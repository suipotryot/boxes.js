import { createM2ExampleProject } from './state/Project.js';
import { createProjectStore } from './state/ProjectStore.js';
import { mountEditorView } from './ui/EditorView.js';

const store = createProjectStore(createM2ExampleProject());
mountEditorView(document.getElementById('editor-root'), store);
