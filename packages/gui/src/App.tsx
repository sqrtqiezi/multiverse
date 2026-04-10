import { useCallback, useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { AppLayout } from './components/app-layout';
import { rpcCall } from './lib/rpc';
import type { ConfigFile, ConfigGroup } from './types';

function App() {
  const [groups, setGroups] = useState<ConfigGroup[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [savedContent, setSavedContent] = useState('');

  const isDirty = fileContent !== savedContent;

  const loadFileTree = useCallback(async () => {
    try {
      const result = await rpcCall<{ groups: ConfigGroup[] }>('config.listFiles', {
        projectPath: process.cwd?.() ?? '.',
        homePath: process.env?.HOME ?? '~',
      });
      setGroups(result.groups);
    } catch (error) {
      toast.error(`加载配置树失败: ${error}`);
    }
  }, []);

  const handleFileSelect = useCallback(async (basePath: string, file: ConfigFile) => {
    const fullPath = `${basePath}/${file.path}`;
    try {
      const result = await rpcCall<{ content: string }>('config.readFile', { filePath: fullPath });
      setSelectedFile(fullPath);
      setFileContent(result.content);
      setSavedContent(result.content);
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
