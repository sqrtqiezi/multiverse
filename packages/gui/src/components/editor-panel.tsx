import { detectLanguage, MonacoWrapper } from './monaco-wrapper';

interface EditorPanelProps {
  filePath: string | null;
  content: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  isDirty: boolean;
}

export function EditorPanel({
  filePath,
  content,
  onContentChange,
  onSave,
  isDirty,
}: EditorPanelProps) {
  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        选择一个配置文件开始编辑
      </div>
    );
  }

  const fileName = filePath.split('/').pop() ?? filePath;
  const language = detectLanguage(filePath);

  return (
    <div
      className="relative flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden bg-background text-foreground"
      data-testid="editor-panel"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background px-4 py-2">
        <span className="truncate text-sm font-medium" title={fileName}>
          {fileName}
          {isDirty && <span className="text-muted-foreground ml-1">*</span>}
        </span>
        <button
          type="button"
          data-testid="save-button"
          className="shrink-0 rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          onClick={onSave}
          disabled={!isDirty}
        >
          保存
        </button>
      </div>
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <MonacoWrapper value={content} language={language} onChange={onContentChange} />
      </div>
      <div className="shrink-0 bg-background border-t px-4 py-1 text-xs text-muted-foreground flex gap-4">
        <span>{isDirty ? '未保存' : '已保存'}</span>
        <span>UTF-8</span>
        <span>{language}</span>
      </div>
    </div>
  );
}
