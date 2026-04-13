import { useCallback, useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { AppLayout } from './components/app-layout';
import { createConfigListParams } from './config-list-params';
import { rpcCall } from './lib/rpc';
import type { ConfigFile, ConfigGroup } from './types';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function App() {
  const [groups, setGroups] = useState<ConfigGroup[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [savedContent, setSavedContent] = useState('');

  const isDirty = fileContent !== savedContent;

  const loadFileTree = useCallback(async () => {
    let lastError: unknown;
    try {
      for (let attempt = 0; attempt < 80; attempt += 1) {
        try {
          const result = await rpcCall<{ groups: ConfigGroup[] }>(
            'config.listFiles',
            createConfigListParams(),
          );
          setGroups(result.groups);
          return;
        } catch (error) {
          lastError = error;
          await delay(250);
        }
      }
    } catch (error) {
      lastError = error;
    }
    toast.error(`加载配置树失败: ${lastError}`);
  }, []);

  const handleFileSelect = useCallback(async (basePath: string, file: ConfigFile) => {
    try {
      const result = await rpcCall<{ content: string }>('config.readFile', {
        templateId: basePath,
        filePath: file.path,
      });
      setSelectedFile(`${basePath}:${file.path}`);
      setSelectedTemplateId(basePath);
      setSelectedFilePath(file.path);
      setFileContent(result.content);
      setSavedContent(result.content);
    } catch (error) {
      toast.error(`读取文件失败: ${error}`);
    }
  }, []);

  const handleCreateFile = useCallback(
    async (basePath: string, filePath: string) => {
      const file = { path: filePath, type: 'markdown' } satisfies ConfigFile;
      try {
        await rpcCall('config.writeFile', {
          templateId: basePath,
          filePath,
          content: '# Claude Configuration\n',
        });
        await loadFileTree();
        await handleFileSelect(basePath, file);
      } catch (error) {
        toast.error(`创建配置文件失败: ${error}`);
      }
    },
    [handleFileSelect, loadFileTree],
  );

  const handleSave = useCallback(async () => {
    if (!selectedTemplateId || !selectedFilePath) return;
    try {
      await rpcCall('config.writeFile', {
        templateId: selectedTemplateId,
        filePath: selectedFilePath,
        content: fileContent,
      });
      setSavedContent(fileContent);
      toast.success('保存成功');
    } catch (error) {
      toast.error(`保存失败: ${error}`);
    }
  }, [selectedTemplateId, selectedFilePath, fileContent]);

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
        onCreateFile={handleCreateFile}
        onFileSelect={handleFileSelect}
        onContentChange={setFileContent}
        onSave={handleSave}
      />
      <Toaster position="bottom-right" />
    </>
  );
}

export default App;
