import { cpSync } from 'node:fs';

cpSync('docs', 'dist/docs', { recursive: true });
