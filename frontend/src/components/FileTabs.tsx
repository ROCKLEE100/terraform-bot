import React from 'react';
import { FileCode } from 'lucide-react';

interface FileTabsProps {
    files: Record<string, string>;
    activeFile: string;
    onFileSelect: (filename: string) => void;
}

export const FileTabs: React.FC<FileTabsProps> = ({ files, activeFile, onFileSelect }) => {
    const filenames = Object.keys(files);

    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-white/5 mb-4">
            {filenames.map((filename) => (
                <button
                    key={filename}
                    onClick={() => onFileSelect(filename)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${activeFile === filename
                            ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                            : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10'
                        }`}
                >
                    <FileCode size={14} />
                    {filename}
                </button>
            ))}
        </div>
    );
};
