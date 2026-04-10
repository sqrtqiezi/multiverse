import { useCallback, useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { AppLayout } from './components/app-layout';
import type { ConfigFile, ConfigGroup } from './types';

// Stub RPC — will be replaced with real Tauri invoke in Task 10
async function rpcCall(method: string, params: Record<string, unknown>): Promise<unknown> {
  console.log('RPC stub:', method, params);
  return null;
}

function App() {
  const [groups, setGroups] = useState<ConfigGroup[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [savedContent, setSavedContent] = useState('');

  const isDirty = fileContent !== savedContent;

  const loadFileTree = useCallback(async () => {
    try {
      const result = (await rpcCall('config.listFiles', {
        projectPath: '/tmp/multiverse-demo',
        homePath: '/tmp/multiverse-demo-home',
      })) as { groups: ConfigGroup[] } | null;
      if (result) {
        setGroups(result.groups);
      }
    } catch (error) {
      toast.error(`加载配置树失败: ${error}`);
    }
  }, []);

  const handleFileSelect = useCallback(async (basePath: string, file: ConfigFile) => {
    const fullPath = `${basePath}/${file.path}`;
    try {
      const result = (await rpcCall('config.readFile', { filePath: fullPath })) as {
        content: string;
      } | null;
      if (result) {
        setSelectedFile(fullPath);
        setFileContent(result.content);
        setSavedContent(result.content);
      }
    } catch (error) {
      toast.error(`读取文件失败: ${error}`);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedFile) return;
    try {
      await rpcCall('config.writeFile', { filePath: selectedFile, content: fileContent });
      setSavedContent(fileContent);
      toast.success('保存成功');
    } catch (error) {
      toast.error(`保存失败: ${error}`);
    }
  }, [selectedFile, fileContent]);

  // Load file tree on mount
  useEffect(() => {
    loadFileTree();
  }, [loadFileTree]);

  return (
    <>
      <AppLayout
        groups={groups}
        selectedFile={selectedFile}
        fileContent={fileContent}
        isDirty={isDirty}
        onFileSelect={handleFileSelect}
        onContentChange={setFileContent}
        onSave={handleSave}
      />
      <Toaster position="bottom-right" />
    </>
  );
}

export default App;
