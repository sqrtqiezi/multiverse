import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import type { ConfigFile, ConfigGroup } from '@/types';
import { ConfigTree } from './config-tree';
import { EditorPanel } from './editor-panel';

interface AppLayoutProps {
  groups: ConfigGroup[];
  selectedFile: string | null;
  fileContent: string;
  isDirty: boolean;
  onCreateFile: (basePath: string, filePath: string) => void;
  onFileSelect: (basePath: string, file: ConfigFile) => void;
  onContentChange: (content: string) => void;
  onSave: () => void;
}

export function AppLayout({
  groups,
  selectedFile,
  fileContent,
  isDirty,
  onCreateFile,
  onFileSelect,
  onContentChange,
  onSave,
}: AppLayoutProps) {
  return (
    <div className="dark h-screen w-screen overflow-hidden bg-background text-foreground">
      <ResizablePanelGroup direction="horizontal" className="overflow-hidden">
        <ResizablePanel
          defaultSize="25%"
          minSize="15%"
          maxSize="40%"
          className="min-h-0 min-w-64 overflow-hidden"
        >
          <div className="h-full bg-sidebar-background border-r">
            <ConfigTree
              groups={groups}
              selectedFile={selectedFile}
              onCreateFile={onCreateFile}
              onFileSelect={onFileSelect}
            />
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="75%" className="min-h-0 min-w-0 overflow-hidden">
          <EditorPanel
            filePath={selectedFile}
            content={fileContent}
            onContentChange={onContentChange}
            onSave={onSave}
            isDirty={isDirty}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
