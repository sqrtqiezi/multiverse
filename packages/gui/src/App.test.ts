import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppLayout } from './components/app-layout';

describe('App WebView compatibility', () => {
  it('does not reference the Node process global', async () => {
    const source = await fs.readFile(path.join(import.meta.dirname, 'App.tsx'), 'utf8');

    expect(source).not.toMatch(/\bprocess\b/);
  });

  it('constrains resizable panel roots so editor content cannot overlap the sidebar', async () => {
    const source = await fs.readFile(path.join(import.meta.dirname, 'globals.css'), 'utf8');

    expect(source).toContain("[data-group='true'][direction='horizontal'] > [data-panel='true']");
    expect(source).toContain('min-width: 0;');
    expect(source).toContain('overflow: hidden;');
  });

  it('uses percentage-based panel sizes so the sidebar does not collapse to pixels', () => {
    const markup = renderToStaticMarkup(
      React.createElement(AppLayout, {
        groups: [],
        selectedFile: null,
        fileContent: '',
        isDirty: false,
        onCreateFile: () => {},
        onFileSelect: () => {},
        onContentChange: () => {},
        onSave: () => {},
      }),
    );

    expect(markup).toContain('flex-basis:25%');
    expect(markup).toContain('flex-basis:75%');
  });
});
