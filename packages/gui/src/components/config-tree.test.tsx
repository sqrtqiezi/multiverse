import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConfigTree } from './config-tree';

describe('ConfigTree', () => {
  it('explains when no templates are available', () => {
    const markup = renderToStaticMarkup(
      <ConfigTree
        groups={[]}
        selectedFile={null}
        onCreateFile={() => {}}
        onFileSelect={() => {}}
      />,
    );

    expect(markup).toContain('未找到模板');
    expect(markup).toContain('multiverse template create default');
  });

  it('offers to create CLAUDE.md when a config group is empty', () => {
    const markup = renderToStaticMarkup(
      <ConfigTree
        groups={[{ label: '项目配置', basePath: '/tmp/project', files: [] }]}
        selectedFile={null}
        onCreateFile={() => {}}
        onFileSelect={() => {}}
      />,
    );

    expect(markup).toContain('创建 CLAUDE.md');
  });

  it('keeps long file paths on a single truncated line and preserves the full path in a title', () => {
    const longPath =
      '.claude/plugins/cache/buddy-hunter/1.4.0/skills/buddy-hunter/marketplace/dsquery/4.6.0/index.json';
    const markup = renderToStaticMarkup(
      <ConfigTree
        groups={[
          {
            label: '模板: default',
            basePath: 'default-template',
            files: [{ path: longPath, type: 'json' }],
          },
        ]}
        selectedFile={null}
        onCreateFile={() => {}}
        onFileSelect={() => {}}
      />,
    );

    expect(markup).toContain(`title="${longPath}"`);
    expect(markup).toContain('truncate');
    expect(markup).not.toContain('break-all');
  });

  it('marks a file selected when the key uses templateId:filePath', () => {
    const markup = renderToStaticMarkup(
      <ConfigTree
        groups={[
          {
            label: '模板: default',
            basePath: 'default-template',
            files: [{ path: '.claude/RTK.md', type: 'markdown' }],
          },
        ]}
        selectedFile="default-template:.claude/RTK.md"
        onCreateFile={() => {}}
        onFileSelect={() => {}}
      />,
    );

    expect(markup).toContain('bg-sidebar-accent text-sidebar-accent-foreground');
  });
});
