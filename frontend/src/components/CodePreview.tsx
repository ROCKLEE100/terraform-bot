import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Download } from 'lucide-react';
import { FileTabs } from './FileTabs';

interface CodePreviewProps {
    files: Record<string, string>;
    threadId?: string | null;
}

export const CodePreview: React.FC<CodePreviewProps> = ({ files, threadId }) => {
    const [activeFile, setActiveFile] = useState<string>(Object.keys(files)[0] || '');
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!activeFile) return;
        navigator.clipboard.writeText(files[activeFile]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        if (!threadId) return;
        window.location.href = `http://localhost:8000/chat/${threadId}/download`;
    };

    if (!files || Object.keys(files).length === 0) return null;

    // Ensure activeFile is still valid if files change
    const currentFile = files[activeFile] ? activeFile : Object.keys(files)[0];

    return (
        <div className="mt-6 rounded-xl overflow-hidden border border-white/10 bg-[#1a1a23] shadow-2xl">
            <div className="bg-[#13131a] px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/50 text-indigo-400 text-xs font-medium hover:bg-indigo-500/20 transition-all"
                        title="Download as ZIP"
                    >
                        <Download size={14} />
                        Download as Folder
                    </button>
                    <button
                        onClick={handleCopy}
                        className="p-1.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                        title="Copy to Clipboard"
                    >
                        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                </div>
            </div>

            <div className="p-4">
                <FileTabs
                    files={files}
                    activeFile={currentFile}
                    onFileSelect={setActiveFile}
                />
                <div className="rounded-lg overflow-hidden bg-black/20">
                    <SyntaxHighlighter
                        language="hcl"
                        style={dracula}
                        customStyle={{
                            margin: 0,
                            padding: '1.5rem',
                            background: 'transparent',
                            fontSize: '0.9rem',
                            lineHeight: '1.5'
                        }}
                    >
                        {files[currentFile] || ''}
                    </SyntaxHighlighter>
                </div>
            </div>
        </div>
    );
};
