export interface ScriptFile {
  name: string;
  content: string;
  handle: FileSystemFileHandle;
}

export interface Suggestion {
  type: 'create' | 'edit';
  scriptName: string;
  code: string;
  explanation: string;
  changes?: string[];
  status: 'pending' | 'approved' | 'declined';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  suggestion?: Suggestion;
}

export enum AppState {
  UNSUPPORTED,
  SELECTING,
  SCANNING,
  READY,
}
