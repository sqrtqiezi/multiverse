import { ChevronDown, ChevronRight, File, Folder } from 'lucide-react';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ConfigFile, ConfigGroup } from '@/types';

interface ConfigTreeProps {
  groups: ConfigGroup[];
  selectedFile: string | null;
  onFileSelect: (basePath: string, file: ConfigFile) => void;
}

function TreeGroup({
  group,
  selectedFile,
  onFileSelect,
}: {
  group: ConfigGroup;
  selectedFile: string | null;
  onFileSelect: (basePath: string, file: ConfigFile) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-2">
      <button
        type="button"
        className="flex w-full items-center gap-1 px-2 py-1 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent rounded"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Folder className="h-4 w-4" />
        <span>{group.label}</span>
      </button>
      {expanded && (
        <div className="ml-4">
          {group.files.map((file) => {
            const fullPath = `${group.basePath}/${file.path}`;
            const isSelected = selectedFile === fullPath;
            return (
              <button
                type="button"
                key={fullPath}
                className={`flex w-full items-center gap-1 px-2 py-1 text-sm rounded ${
                  isSelected
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
                onClick={() => onFileSelect(group.basePath, file)}
              >
                <File className="h-3 w-3" />
                <span>{file.path}</span>
              </button>
            );
          })}
          {group.files.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">无配置文件</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ConfigTree({ groups, selectedFile, onFileSelect }: ConfigTreeProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <h2 className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          配置
        </h2>
        {groups.map((group) => (
          <TreeGroup
            key={group.label}
            group={group}
            selectedFile={selectedFile}
            onFileSelect={onFileSelect}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
