import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ScriptFile, ChatMessage, AppState, Suggestion } from './types';
import { Chat, Type } from '@google/genai';
import { ai } from './services/geminiService';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Fix: Add type definition for the non-standard showDirectoryPicker API to satisfy TypeScript.
declare global {
  interface Window {
    showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
  }
}


// --- Icon Components ---
const FolderIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
);
const FileIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
);
const SpinnerIcon = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
);
const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" /></svg>
);
const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v3.043c0 .317-.1.619-.275.868M15.666 3.888c1.333.39-1.167 3.89-7.332 3.89M9 17.25h3.375c1.03 0 1.9-.693 2.166-1.638a2.25 2.25 0 0 0-1.166-2.529M9 17.25v-3.043c0-.317.1-.619.275-.868M9 17.25c-1.333.39 1.167-3.89 7.332-3.89" /></svg>
);
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>;
const XIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>;


// --- Helper Components ---

const ProjectSelector: React.FC<{ onProjectSelect: () => void; isUnsupported: boolean; error: string | null; }> = ({ onProjectSelect, isUnsupported, error }) => (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-slate-300">
        <div className="text-center p-8 border-2 border-dashed border-slate-600 rounded-lg max-w-lg">
            <h1 className="text-4xl font-bold text-slate-100 mb-2">Unity AI Assistant</h1>
            {isUnsupported ? (
                <p className="mb-6 text-yellow-400">Your browser does not support the File System Access API. Please use a modern browser like Chrome or Edge.</p>
            ) : (
                <>
                  <p className="mb-6">Select your Unity project folder to grant read/write permissions.</p>
                  <div className="mb-6 flex justify-center"><FolderIcon /></div>
                  {error && (
                    <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-md mb-4 text-left text-sm">
                      <p className='font-bold mb-1'>Could not access directory</p>
                      <p>{error}</p>
                    </div>
                  )}
                  <button onClick={onProjectSelect} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300">Select Project Folder</button>
                </>
            )}
        </div>
    </div>
);


const LoadingOverlay: React.FC<{ message: string }> = ({ message }) => (
  <div className="absolute inset-0 bg-slate-900 bg-opacity-80 flex flex-col items-center justify-center z-50"><SpinnerIcon /><p className="text-slate-200 mt-4 text-lg">{message}</p></div>
);

const FileExplorer: React.FC<{ scripts: ScriptFile[]; selectedScript: ScriptFile | null; onSelect: (script: ScriptFile) => void; }> = ({ scripts, selectedScript, onSelect }) => (
  <div className="bg-slate-800/50 p-4 rounded-lg overflow-y-auto h-full"><h2 className="text-lg font-semibold text-slate-100 mb-4 border-b border-slate-600 pb-2">Project Scripts</h2><ul>{scripts.map((script) => (<li key={script.name}><button onClick={() => onSelect(script)} className={`w-full text-left p-2 rounded-md flex items-center gap-2 transition-colors duration-200 ${selectedScript?.name === script.name ? 'bg-blue-600/30 text-blue-300' : 'hover:bg-slate-700/50 text-slate-300'}`}><FileIcon className="flex-shrink-0" /><span className="truncate">{script.name}</span></button></li>))}</ul></div>
);

const CodeViewer: React.FC<{ script: ScriptFile | null; }> = ({ script }) => (
  <div className="bg-slate-800/50 rounded-lg flex flex-col h-full"><div className="p-4 border-b border-slate-600 flex-shrink-0"><h2 className="text-lg font-semibold text-slate-100 truncate">{script?.name || "Select a script to view"}</h2></div><div className="overflow-auto flex-grow"><SyntaxHighlighter language="csharp" style={vscDarkPlus} showLineNumbers customStyle={{ margin: 0, height: '100%', backgroundColor: 'transparent', fontSize: '0.875rem' }} codeTagProps={{ style: { fontFamily: "monospace" }}}>{script?.content || "// No script selected or script is empty."}</SyntaxHighlighter></div></div>
);

const ChatWindow: React.FC<{ 
    messages: ChatMessage[]; 
    onSendMessage: (message: string) => void; 
    isLoading: boolean;
    onSuggestionAction: (messageId: string, action: 'approved' | 'declined') => void;
}> = ({ messages, onSendMessage, isLoading, onSuggestionAction }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const CodeBlock = ({ code }: { code: string }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="bg-slate-800 rounded-md overflow-hidden my-2 text-sm">
            <div className="flex justify-between items-center px-4 py-1 bg-slate-900/70 text-xs text-slate-400">
                <span className='font-sans'>C# Code</span>
                <button onClick={handleCopy} className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-700 transition-colors">
                    <CopyIcon /> {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
                <SyntaxHighlighter language="csharp" style={vscDarkPlus} customStyle={{ margin: 0, padding: '1rem', backgroundColor: 'transparent' }} codeTagProps={{ style: { fontFamily: "monospace" } }}>
                    {code}
                </SyntaxHighlighter>
            </div>
        </div>
    );
  };
  
  const SuggestionMessage: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const { suggestion } = message;
    if (!suggestion) return null;

    return (
        <div className='bg-slate-700 rounded-lg p-3 text-slate-200'>
             <p className='whitespace-pre-wrap font-medium border-b border-slate-600 pb-2 mb-2'>{suggestion.explanation}</p>
             {suggestion.type === 'edit' && suggestion.changes && (
                <div className="mb-2">
                    <p className="text-sm font-semibold text-slate-300">Changes:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 pl-2">
                        {suggestion.changes.map((change, index) => <li key={index}>{change}</li>)}
                    </ul>
                </div>
             )}
             <CodeBlock code={suggestion.code} />
             {suggestion.status === 'pending' && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-600">
                    {/* Fix: Corrected typo 'decline' to 'declined' to match the type definition. */}
                    <button onClick={() => onSuggestionAction(message.id, 'declined')} className="px-4 py-1.5 text-sm font-semibold rounded-md bg-slate-600 hover:bg-slate-500 transition-colors flex items-center gap-1.5"><XIcon/>Decline</button>
                    <button onClick={() => onSuggestionAction(message.id, 'approved')} className="px-4 py-1.5 text-sm font-semibold rounded-md bg-green-600 hover:bg-green-500 transition-colors flex items-center gap-1.5"><CheckIcon/>Approve</button>
                </div>
             )}
             {suggestion.status === 'approved' && <p className='text-green-400 text-sm font-semibold pt-2 border-t border-slate-600'>✅ Approved and saved to {suggestion.scriptName}</p>}
             {suggestion.status === 'declined' && <p className='text-red-400 text-sm font-semibold pt-2 border-t border-slate-600'>❌ Suggestion declined.</p>}
        </div>
    )
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-lg flex flex-col h-full"><h2 className="text-lg font-semibold text-slate-100 p-4 border-b border-slate-600">AI Assistant</h2><div className="flex-grow p-4 overflow-y-auto space-y-4">{messages.map((msg) => (<div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-xs md:max-w-md lg:max-w-2xl rounded-lg ${msg.sender === 'user' ? 'bg-blue-600 text-white p-3' : ''}`}>{msg.suggestion ? <SuggestionMessage message={msg} /> : <p className='whitespace-pre-wrap'>{msg.text}</p>}</div></div>))} <div ref={messagesEndRef} /></div><div className="p-4 border-t border-slate-600 flex items-center gap-2"><input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="Create, edit, or ask a question..." className="flex-grow bg-slate-700 border border-slate-600 rounded-lg p-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isLoading} /><button onClick={handleSend} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-500 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors">{isLoading ? <SpinnerIcon /> : <SendIcon/>}</button></div></div>
  );
};

const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);
    return (<div className="fixed top-5 right-5 bg-green-600 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-down z-50">{message}</div>);
};

// --- File System Utilities ---
async function getDirectoryFiles(dirHandle: FileSystemDirectoryHandle): Promise<ScriptFile[]> {
    const files: ScriptFile[] = [];
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.cs')) {
            const fileHandle = await dirHandle.getFileHandle(entry.name);
            const file = await fileHandle.getFile();
            const content = await file.text();
            files.push({ name: entry.name, content, handle: fileHandle });
        } else if (entry.kind === 'directory') {
            // Note: This simple version doesn't recurse into subdirectories.
            // For a full Unity project, a recursive function would be needed.
        }
    }
    return files;
}

async function writeFile(dirHandle: FileSystemDirectoryHandle, fileName: string, content: string): Promise<FileSystemFileHandle> {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return fileHandle;
}


// --- Main App Component ---
const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.SELECTING);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [scripts, setScripts] = useState<ScriptFile[]>([]);
  const [selectedScript, setSelectedScript] = useState<ScriptFile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [toast, setToast] = useState<string>('');
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const chat = useRef<Chat | null>(null);
  
  useEffect(() => {
      if (!('showDirectoryPicker' in window)) {
          setAppState(AppState.UNSUPPORTED);
      }
  }, []);

  const getSystemInstruction = useCallback((currentScripts: ScriptFile[]) => {
    const scriptContext = currentScripts.map(s => `// ${s.name}\n\n${s.content}`).join('\n\n---\n\n');
    return `You are a helpful Unity AI Assistant. The user has loaded a Unity project. You have full access to the content of all scripts.
      Current project scripts:
      ${scriptContext}
      
      When asked to create or modify a script, you MUST respond with a single JSON object.
      For CREATING a script: Respond with { "explanation": "...", "code": "..." }.
      For EDITING a script: Respond with { "explanation": "...", "changes": ["...", "..."], "code": "..." }.
      Do not use markdown fences or any other text outside the JSON object.`;
  }, []);

  useEffect(() => {
      if(appState === AppState.READY && scripts.length > 0) {
          chat.current = ai.chats.create({
              model: 'gemini-2.5-flash',
              history: [],
              config: {
                systemInstruction: getSystemInstruction(scripts),
              }
          });
      }
  }, [appState, scripts, getSystemInstruction]);

  const handleProjectSelect = async () => {
    setSelectionError(null);
    try {
        const handle = await window.showDirectoryPicker();
        setDirectoryHandle(handle);
        setAppState(AppState.SCANNING);
        setLoadingMessage(`Scanning project files...`);
        const loadedScripts = await getDirectoryFiles(handle);
        setScripts(loadedScripts);
        setAppState(AppState.READY);
        setMessages([{ id: Date.now().toString(), sender: 'ai', text: `Hello! I've scanned ${loadedScripts.length} C# scripts and I'm ready to help. How can I assist you?` }]);
    } catch(err) {
        const error = err as Error;
        console.error("Error selecting directory:", err);
        if (error.name !== 'AbortError') {
           if (error.message.includes("Cross origin sub frames")) {
               setSelectionError("Host Environment Error: This app is in a restricted frame (iframe) that blocks the directory picker. This is a security feature of the host environment. The app requested permission, but it was denied. This is not a bug in the app, but a limitation of the platform it's running on.");
           } else {
              setSelectionError(`An unexpected error occurred: ${error.message}`);
           }
        }
    }
  };
  
  const refreshScripts = async () => {
    if (!directoryHandle) return;
    const loadedScripts = await getDirectoryFiles(directoryHandle);
    setScripts(loadedScripts);
    // If selected script was updated, refresh its content in the viewer
    if (selectedScript) {
      const updatedSelected = loadedScripts.find(s => s.name === selectedScript.name);
      setSelectedScript(updatedSelected || null);
    }
  }

  const handleSuggestionAction = async (messageId: string, action: 'approved' | 'declined') => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.suggestion || !directoryHandle) return;

    if (action === 'approved') {
        setIsLoading(true);
        setLoadingMessage(`Saving ${message.suggestion.scriptName}...`);
        try {
            await writeFile(directoryHandle, message.suggestion.scriptName, message.suggestion.code);
            setToast(`${message.suggestion.scriptName} saved successfully!`);
            await refreshScripts();
        } catch (e) {
            console.error("Error writing file:", e);
            setToast(`Error saving ${message.suggestion.scriptName}.`);
        }
        setIsLoading(false);
        setLoadingMessage('');
    }
    
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, suggestion: { ...m.suggestion!, status: action } } : m));
  };


  const handleSendMessage = useCallback(async (messageText: string) => {
    const userMessage: ChatMessage = { id: Date.now().toString(), sender: 'user', text: messageText };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const scriptNameMatch = messageText.match(/([a-zA-Z0-9_]+)\.cs/);
    const scriptName = scriptNameMatch ? scriptNameMatch[0] : null;
    const createRegex = /create|make|generate/i;
    const editRegex = /edit|update|change|modify|optimize|rewrite|add|remove/i;

    if ((createRegex.test(messageText) || editRegex.test(messageText)) && scriptName) {
        setLoadingMessage(createRegex.test(messageText) ? `Generating ${scriptName}...` : `Analyzing ${scriptName}...`);
        
        try {
            const suggestionSchema = {
                type: Type.OBJECT,
                properties: {
                    explanation: { type: Type.STRING },
                    code: { type: Type.STRING },
                    changes: { 
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ['explanation', 'code']
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: messageText,
                config: {
                    systemInstruction: getSystemInstruction(scripts),
                    responseMimeType: 'application/json',
                    responseSchema: suggestionSchema
                }
            });
            
            const responseJson = JSON.parse(response.text);
            
            const suggestion: Suggestion = {
                type: createRegex.test(messageText) ? 'create' : 'edit',
                scriptName: scriptName,
                code: responseJson.code,
                explanation: responseJson.explanation,
                changes: responseJson.changes,
                status: 'pending',
            };
            
            const aiMessage: ChatMessage = {
                id: `${Date.now()}-ai-sugg`,
                sender: 'ai',
                text: '', // Text is unused for suggestion messages
                suggestion: suggestion
            };
            setMessages(prev => [...prev, aiMessage]);

        } catch (e) {
            console.error("Failed to parse AI JSON response:", e);
            const fallbackMsg: ChatMessage = { id: `${Date.now()}-ai-fallback`, sender: 'ai', text: "Sorry, I couldn't generate a valid response. Please try again."};
            setMessages(prev => [...prev, fallbackMsg]);
        }
        setLoadingMessage('');

    } else { // General chat - use streaming
        if (!chat.current) return;
        const aiMessageId = `${Date.now()}-ai`;
        setMessages(prev => [...prev, { id: aiMessageId, sender: 'ai', text: '▍' }]);
        
        try {
            const stream = await chat.current.sendMessageStream({ message: messageText });
            let fullResponse = "";
            for await (const chunk of stream) {
                fullResponse += chunk.text;
                setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: fullResponse + '▍' } : m));
            }
            setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: fullResponse } : m));
        } catch (error) {
            console.error("Streaming chat error:", error);
            setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: "Sorry, an error occurred." } : m));
        }
    }

    setIsLoading(false);

  }, [scripts, getSystemInstruction]);
  
  if (appState === AppState.SELECTING || appState === AppState.UNSUPPORTED) return <ProjectSelector onProjectSelect={handleProjectSelect} isUnsupported={appState === AppState.UNSUPPORTED} error={selectionError} />;

  return (
    <div className="h-screen w-screen bg-slate-900 text-slate-300 p-4 flex flex-col">
       {toast && <Toast message={toast} onClose={() => setToast('')} />}
       <header className="mb-4 flex-shrink-0"><h1 className="text-2xl font-bold text-slate-100">Unity AI Assistant</h1></header>
      <main className="flex-grow grid grid-cols-1 md:grid-cols-10 gap-4 min-h-0">
        {(appState === AppState.SCANNING || (isLoading && loadingMessage)) && <LoadingOverlay message={loadingMessage} />}
        <div className="md:col-span-2 h-full min-h-0"><FileExplorer scripts={scripts} selectedScript={selectedScript} onSelect={setSelectedScript} /></div>
        <div className="md:col-span-4 h-full min-h-0"><CodeViewer script={selectedScript} /></div>
        <div className="md:col-span-4 h-full min-h-0"><ChatWindow messages={messages} onSendMessage={handleSendMessage} isLoading={isLoading} onSuggestionAction={handleSuggestionAction} /></div>
      </main>
    </div>
  );
};

export default App;