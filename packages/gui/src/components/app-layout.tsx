import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ConfigTree } from './config-tree';
import { EditorPanel } from './editor-panel';
import type { ConfigFile, ConfigGroup } from '@/types';

interface AppLayoutProps {
  groups: ConfigGroup[];
  selectedFile: string | null;
  fileContent: string;
  isDirty: boolean;
  onFileSelect: (basePath: string, file: ConfigFile) => void;
  onContentChange: (content: string) => void;
  onSave: () => void;
}

export function AppLayout({
  groups,
  selectedFile,
  fileContent,
  isDirty,
  onFileSelect,
  onContentChange,
  onSave,
}: AppLayoutProps) {
  return (
    <div className="h-screen w-screen dark">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
          <div className="h-full bg-sidebar-background border-r">
            <ConfigTree groups={groups} selectedFile={selectedFile} onFileSelect={onFileSelect} />
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={75}>
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
