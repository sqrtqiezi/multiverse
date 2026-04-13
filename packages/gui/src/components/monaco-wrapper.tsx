import Editor from '@monaco-editor/react';

interface MonacoWrapperProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
}

function detectLanguage(filePath: string): string {
  if (filePath.endsWith('.md')) return 'markdown';
  if (filePath.endsWith('.json')) return 'json';
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) return 'yaml';
  return 'plaintext';
}

export { detectLanguage };

export function MonacoWrapper({ value, language, onChange }: MonacoWrapperProps) {
  return (
    <div className="relative h-full min-h-0 min-w-0 w-full overflow-hidden">
      <Editor
        height="100%"
        width="100%"
        language={language}
        value={value}
        onChange={(val) => onChange(val ?? '')}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          overviewRulerLanes: 0,
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  );
}
