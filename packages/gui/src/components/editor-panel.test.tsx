import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EditorPanel } from './editor-panel';

vi.mock('./monaco-wrapper', () => ({
  MonacoWrapper: () => <div data-testid="monaco-wrapper" />,
  detectLanguage: () => 'markdown',
}));

describe('EditorPanel layout', () => {
  it('keeps the editor area constrained inside the available panel height', () => {
    const markup = renderToStaticMarkup(
      <EditorPanel
        filePath="CLAUDE.md"
        content="# Test"
        onContentChange={() => {}}
        onSave={() => {}}
        isDirty={false}
      />,
    );

    expect(markup).toContain('data-testid="editor-panel"');
    expect(markup).toContain('min-h-0');
    expect(markup).toContain('min-w-0');
    expect(markup).toContain('overflow-hidden');
    expect(markup).toContain('relative');
    expect(markup).toContain('bg-background');
  });
});
