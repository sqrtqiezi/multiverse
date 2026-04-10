import { MonacoWrapper, detectLanguage } from './monaco-wrapper';

interface EditorPanelProps {
  filePath: string | null;
  content: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  isDirty: boolean;
}

export function EditorPanel({ filePath, content, onContentChange, onSave, isDirty }: EditorPanelProps) {
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-medium">
          {fileName}
          {isDirty && <span className="text-muted-foreground ml-1">*</span>}
        </span>
        <button
          type="button"
          className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          onClick={onSave}
          disabled={!isDirty}
        >
          保存
        </button>
      </div>
      <div className="flex-1">
        <MonacoWrapper value={content} language={language} onChange={onContentChange} />
      </div>
      <div className="border-t px-4 py-1 text-xs text-muted-foreground flex gap-4">
        <span>{isDirty ? '未保存' : '已保存'}</span>
        <span>UTF-8</span>
        <span>{language}</span>
      </div>
    </div>
  );
}
