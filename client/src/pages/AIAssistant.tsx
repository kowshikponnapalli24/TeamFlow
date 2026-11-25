import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Bot,
  Send,
  Sparkles,
  UserRound,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock3,
  ListTodo,
  FolderKanban,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type AssistantResponse = {
  success: boolean;
  reply: string;
  mode: "provider" | "local";
  metrics: {
    projectCount: number;
    memberCount: number;
    taskCount: number;
    completedTasks: number;
    inProgressTasks: number;
    reviewTasks: number;
    blockedTasks: number;
    overdueTasks: number;
    urgentTasks: number;
  };
};

const suggestions = [
  "Give me a summary of this workspace",
  "Which tasks are overdue?",
  "What tasks are blocked?",
  "What should the team prioritize next?",
];

const createWelcomeMessage = (): ChatMessage => ({
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm your TeamFlow assistant. I can help you understand project progress, find overdue or blocked tasks, and identify what needs attention. Ask me about your active workspace.",
});

export default function AIAssistant() {
  const { activeOrganizationId, activeOrganization } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([createWelcomeMessage()]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"provider" | "local" | null>(null);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState<AssistantResponse["metrics"] | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([createWelcomeMessage()]);
    setMode(null);
    setMetrics(null);
    setError("");
  }, [activeOrganizationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const sendMessage = async (event?: FormEvent<HTMLFormElement>, prompt?: string) => {
    event?.preventDefault();
    const question = (prompt ?? input).trim();

    if (!question || !activeOrganizationId || loading) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: question,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await apiRequest<AssistantResponse>(
        `/organizations/${activeOrganizationId}/ai/chat`,
        {
          method: "POST",
          body: JSON.stringify({ message: question }),
        }
      );

      setMode(response.mode);
      setMetrics(response.metrics);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: response.reply,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant could not respond.");
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = () => {
    setMessages([createWelcomeMessage()]);
    setMode(null);
    setMetrics(null);
    setError("");
  };

  return (
    <div className="ai-page">
      <div className="page-heading ai-page-heading">
        <div>
          <span className="eyebrow">WORKSPACE INTELLIGENCE</span>
          <h1>AI Assistant</h1>
          <p>Ask questions about projects, tasks, deadlines and team workload.</p>
        </div>
        <button className="ai-clear-button" type="button" onClick={clearConversation}>
          <RefreshCw size={15} />
          New conversation
        </button>
      </div>

      <div className="ai-workspace-name">
        <span className="ai-workspace-dot" />
        <span>Using workspace: <strong>{activeOrganization?.name ?? "No workspace selected"}</strong></span>
        {mode && (
          <span className={`ai-mode-pill ${mode === "provider" ? "ai-mode-live" : ""}`}>
            {mode === "provider" ? <Sparkles size={12} /> : <AlertCircle size={12} />}
            {mode === "provider" ? "AI connected" : "Local insights mode"}
          </span>
        )}
      </div>

      {metrics && (
        <div className="ai-metrics-grid">
          <div className="ai-metric-card">
            <FolderKanban size={17} />
            <span>Projects</span>
            <strong>{metrics.projectCount}</strong>
          </div>
          <div className="ai-metric-card">
            <ListTodo size={17} />
            <span>Tasks</span>
            <strong>{metrics.taskCount}</strong>
          </div>
          <div className="ai-metric-card">
            <CheckCircle2 size={17} />
            <span>Completed</span>
            <strong>{metrics.completedTasks}</strong>
          </div>
          <div className="ai-metric-card">
            <Clock3 size={17} />
            <span>Overdue</span>
            <strong>{metrics.overdueTasks}</strong>
          </div>
        </div>
      )}

      <section className="ai-chat-card">
        <div className="ai-chat-header">
          <div className="ai-chat-avatar"><Bot size={20} /></div>
          <div>
            <strong>TeamFlow Assistant</strong>
            <span>Workspace-aware project support</span>
          </div>
          <span className="ai-online-indicator">Ready</span>
        </div>

        <div className="ai-messages" aria-live="polite">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`ai-message-row ${message.role === "user" ? "ai-message-user" : ""}`}
            >
              <div className={`ai-message-avatar ${message.role === "user" ? "ai-user-avatar" : ""}`}>
                {message.role === "user" ? <UserRound size={16} /> : <Bot size={17} />}
              </div>
              <div className="ai-message-bubble">
                <span className="ai-message-author">
                  {message.role === "user" ? "You" : "TeamFlow Assistant"}
                </span>
                <p>{message.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="ai-message-row">
              <div className="ai-message-avatar"><Bot size={17} /></div>
              <div className="ai-message-bubble ai-typing">
                <span className="ai-message-author">TeamFlow Assistant</span>
                <p>Reviewing your workspace data...</p>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <div className="ai-error"><AlertCircle size={15} />{error}</div>}

        <div className="ai-suggestions">
          <span>Try asking</span>
          <div>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={loading || !activeOrganizationId}
                onClick={() => void sendMessage(undefined, suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <form className="ai-composer" onSubmit={(event) => void sendMessage(event)}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about your projects, tasks or team..."
            maxLength={2000}
            disabled={!activeOrganizationId || loading}
            aria-label="Message the TeamFlow assistant"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || !activeOrganizationId}
            aria-label="Send message"
          >
            <Send size={17} />
          </button>
        </form>
        <p className="ai-disclaimer">
          Workspace information is used to answer your question. Verify important decisions with your team.
        </p>
      </section>

      {!activeOrganizationId && (
        <div className="ai-empty-state">Select a workspace to start using the assistant.</div>
      )}
    </div>
  );
}
