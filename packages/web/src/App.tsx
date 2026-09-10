import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import "./App.css";

const API_URL =
  "http://localhost:3000";

const WS_URL =
  "ws://localhost:8080";

/* =====================================================
   TYPES
   ===================================================== */

type User = {
  id: string;
  name: string;
  email: string;
};

type Workspace = {
  id: string;
  name: string;
};

type WorkspaceResponse = {
  workspaces: Workspace[];
}

type Channel = {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
};

type ChannelResponse = {
  channels: Channel[];
}

type ChatMessage = {
  eventId?: string;
  event_id?: string;

  type?: string;

  workspaceId?: string;
  workspace_id?: string;

  channelId?: string;
  channel_id?: string;

  messageId?: string;
  message_id?: string;

  userId?: string;
  user_id?: string;

  userName?: string;
  user_name?: string;

  message: string;

  timestamp?: string;
  ts?: string;

  edgeId?: string;
};

/* =====================================================
   HELPERS
   ===================================================== */

function getMessageId(
  message: ChatMessage
) {
  return (
    message.messageId ??
    message.message_id ??
    message.eventId ??
    message.event_id ??
    crypto.randomUUID()
  );
}

function getUserId(
  message: ChatMessage
) {
  return (
    message.userId ??
    message.user_id ??
    "unknown"
  );
}

function getUserName(
  message: ChatMessage,
  currentUser: User | null
) {
  const userId =
    getUserId(message);

  if (
    currentUser &&
    userId === currentUser.id
  ) {
    return "You";
  }

  return (
    message.userName ??
    message.user_name ??
    "Unknown user"
  );
}

function getTimestamp(
  message: ChatMessage
) {
  return (
    message.timestamp ??
    message.ts ??
    new Date().toISOString()
  );
}

function getInitials(
  name: string
) {
  if (!name) {
    return "?";
  }

  const parts =
    name
      .trim()
      .split(/\s+/);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}

function formatTime(
  timestamp: string
) {
  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

/* =====================================================
   APP
   ===================================================== */

function App() {
  /* ===================================================
     AUTH
     =================================================== */

  const [user, setUser] =
    useState<User | null>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [authMode, setAuthMode] =
    useState<
      "login" | "register"
    >("login");

  const [authName, setAuthName] =
    useState("");

  const [authEmail, setAuthEmail] =
    useState("");

  const [authPassword, setAuthPassword] =
    useState("");

  const [authError, setAuthError] =
    useState("");

  /* ===================================================
     WORKSPACE
     =================================================== */

  const [workspaces, setWorkspaces] =
    useState<Workspace[]>([]);

  const [
    activeWorkspaceId,
    setActiveWorkspaceId,
  ] = useState("");

  const [
    showWorkspaceModal,
    setShowWorkspaceModal,
  ] = useState(false);

  const [
    workspaceName,
    setWorkspaceName,
  ] = useState("");

  /* ===================================================
     CHANNEL
     =================================================== */

  const [channels, setChannels] =
    useState<Channel[]>([]);

  const [
    activeChannelId,
    setActiveChannelId,
  ] = useState("");

  const [
    showChannelModal,
    setShowChannelModal,
  ] = useState(false);

  const [
    channelName,
    setChannelName,
  ] = useState("");

  /* ===================================================
     MESSAGES
     =================================================== */

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [input, setInput] =
    useState("");

  /* ===================================================
     UI
     =================================================== */

  const [connected, setConnected] =
    useState(false);

  const [
    loadingWorkspaces,
    setLoadingWorkspaces,
  ] = useState(true);

  const [
    loadingChannels,
    setLoadingChannels,
  ] = useState(false);

  const [
    loadingMessages,
    setLoadingMessages,
  ] = useState(false);

  const [error, setError] =
    useState("");

  /* ===================================================
     REFS
     =================================================== */

  const socketRef =
    useRef<WebSocket | null>(null);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const inputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  /* ===================================================
     CURRENT DATA
     =================================================== */

  const activeWorkspace =
    workspaces.find(
      (workspace) =>
        workspace.id ===
        activeWorkspaceId
    );

  const activeChannel =
    channels.find(
      (channel) =>
        channel.id ===
        activeChannelId
    );

  /* ===================================================
     RESTORE SESSION
     =================================================== */

  useEffect(() => {
    async function restoreSession() {
      const token =
        localStorage.getItem(
          "chat_token"
        );

      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/auth/me`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        if (!response.ok) {
          localStorage.removeItem(
            "chat_token"
          );

          setAuthLoading(false);
          return;
        }

        const data =
          await response.json();

        setUser(data.user);
      } catch (error) {
        console.error(
          "Failed to restore session:",
          error
        );

        localStorage.removeItem(
          "chat_token"
        );
      } finally {
        setAuthLoading(false);
      }
    }

    restoreSession();
  }, []);

  /* ===================================================
     AUTH SUBMIT
     =================================================== */

  async function submitAuth() {
    try {
      setAuthError("");

      if (
        !authEmail.trim() ||
        !authPassword.trim()
      ) {
        setAuthError(
          "Email and password are required"
        );

        return;
      }

      if (
        authMode === "register" &&
        !authName.trim()
      ) {
        setAuthError(
          "Name is required"
        );

        return;
      }

      const endpoint =
        authMode === "login"
          ? "/auth/login"
          : "/auth/register";

      const body =
        authMode === "login"
          ? {
              email:
                authEmail.trim(),
              password:
                authPassword,
            }
          : {
              name:
                authName.trim(),
              email:
                authEmail.trim(),
              password:
                authPassword,
            };

      const response =
        await fetch(
          `${API_URL}${endpoint}`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(body),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setAuthError(
          data.error ??
            "Authentication failed"
        );

        return;
      }

      localStorage.setItem(
        "chat_token",
        data.token
      );

      setUser(data.user);

      setAuthName("");
      setAuthEmail("");
      setAuthPassword("");
      setAuthError("");
    } catch (error) {
      console.error(
        "Authentication error:",
        error
      );

      setAuthError(
        "Unable to connect to server"
      );
    }
  }

  /* ===================================================
     LOGOUT
     =================================================== */

  function logout() {
    localStorage.removeItem(
      "chat_token"
    );

    socketRef.current?.close();

    socketRef.current = null;

    setUser(null);

    setWorkspaces([]);
    setChannels([]);
    setMessages([]);

    setActiveWorkspaceId("");
    setActiveChannelId("");

    setConnected(false);
  }

  /* ===================================================
     SCROLL
     =================================================== */

  const scrollToBottom =
    useCallback(() => {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView(
          {
            behavior: "smooth",
          }
        );
      }, 50);
    }, []);

  /* ===================================================
     LOAD WORKSPACES
     =================================================== */

  useEffect(() => {
    if (!user) {
      return;
    }

    async function loadWorkspaces() {
      try {
        setLoadingWorkspaces(true);
        setError("");

        const token =
          localStorage.getItem(
            "chat_token"
          );

        const response =
          await fetch(
            `${API_URL}/workspaces`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const data: WorkspaceResponse =
          await response.json();
        setWorkspaces(data.workspaces ?? []);

        if (data.workspaces?.length > 0) {
          setActiveWorkspaceId(
            data.workspaces[0].id
          );
        }
      } catch (error) {
        console.error(
          "Failed to load workspaces:",
          error
        );

        setError(
          "Unable to load workspaces"
        );
      } finally {
        setLoadingWorkspaces(false);
      }
    }

    loadWorkspaces();
  }, [user]);

  /* ===================================================
     LOAD CHANNELS
     =================================================== */

  useEffect(() => {
    if (
      !user ||
      !activeWorkspaceId
    ) {
      return;
    }

    async function loadChannels() {
      try {
        setLoadingChannels(true);
        setError("");

        setChannels([]);
        setActiveChannelId("");

        const token =
          localStorage.getItem(
            "chat_token"
          );

        const response =
          await fetch(
            `${API_URL}/workspaces/${activeWorkspaceId}/channels`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const data: ChannelResponse =
          await response.json();

        setChannels(data.channels ?? []);

        if (data.channels?.length > 0) {
          setActiveChannelId(
            data.channels[0].id
          );
        }
      } catch (error) {
        console.error(
          "Failed to load channels:",
          error
        );

        setError(
          "Unable to load channels"
        );
      } finally {
        setLoadingChannels(false);
      }
    }

    loadChannels();
  }, [
    user,
    activeWorkspaceId,
  ]);

  /* ===================================================
     LOAD HISTORY
     =================================================== */

  const loadHistory =
    useCallback(
      async (
        workspaceId: string,
        channelId: string
      ) => {
        if (
          !workspaceId ||
          !channelId ||
          !user
        ) {
          return;
        }

        try {
          setLoadingMessages(
            true
          );

          const token =
            localStorage.getItem(
              "chat_token"
            );

          const response =
            await fetch(
              `${API_URL}/channels/${channelId}/messages?workspace_id=${workspaceId}`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          if (!response.ok) {
            throw new Error(
              `HTTP ${response.status}`
            );
          }

          const data =
            await response.json();

          const history:
            ChatMessage[] =
            data.messages ?? [];

          setMessages(history);

          scrollToBottom();
        } catch (error) {
          console.error(
            "Failed to load messages:",
            error
          );

          setMessages([]);
        } finally {
          setLoadingMessages(
            false
          );
        }
      },
      [
        user,
        scrollToBottom,
      ]
    );

  /* ===================================================
     WEBSOCKET
     =================================================== */

  useEffect(() => {
    if (
      !user ||
      !activeWorkspaceId ||
      !activeChannelId
    ) {
      return;
    }

    socketRef.current?.close();

    setConnected(false);

    const token =
      localStorage.getItem(
        "chat_token"
      );

    if (!token) {
      return;
    }

    /*
     * JWT is sent to Edge.
     *
     * Edge verifies it and obtains
     * the real user identity.
     */

    const wsUrl =
      `${WS_URL}` +
      `?workspaceId=${encodeURIComponent(
        activeWorkspaceId
      )}` +
      `&channelId=${encodeURIComponent(
        activeChannelId
      )}` +
      `&token=${encodeURIComponent(
        token
      )}`;

    const ws =
      new WebSocket(wsUrl);

    socketRef.current = ws;

    ws.onopen = () => {
      console.log(
        "Connected to channel:",
        activeChannel?.name
      );

      setConnected(true);

      inputRef.current?.focus();
    };

    ws.onmessage = (
      event
    ) => {
      try {
        const incoming:
          ChatMessage =
          JSON.parse(
            event.data
          );

        if (
          incoming.type !==
          "message.created"
        ) {
          return;
        }

        const incomingChannel =
          incoming.channelId ??
          incoming.channel_id;

        if (
          incomingChannel !==
          activeChannelId
        ) {
          return;
        }

        setMessages(
          (previous) => {
            const incomingId =
              getMessageId(
                incoming
              );

            const duplicate =
              previous.some(
                (message) =>
                  getMessageId(
                    message
                  ) ===
                  incomingId
              );

            if (duplicate) {
              return previous;
            }

            return [
              ...previous,
              incoming,
            ];
          }
        );

        scrollToBottom();
      } catch (error) {
        console.error(
          "Invalid WebSocket event:",
          error
        );
      }
    };

    ws.onclose = (
      event
    ) => {
      console.log(
        "WebSocket disconnected:",
        event.code,
        event.reason
      );

      setConnected(false);
    };

    ws.onerror = (
      error
    ) => {
      console.error(
        "WebSocket error:",
        error
      );

      setConnected(false);
    };

    loadHistory(
      activeWorkspaceId,
      activeChannelId
    );

    return () => {
      ws.close();

      if (
        socketRef.current ===
        ws
      ) {
        socketRef.current = null;
      }
    };
  }, [
    user,
    activeWorkspaceId,
    activeChannelId,
    activeChannel?.name,
    loadHistory,
    scrollToBottom,
  ]);

  /* ===================================================
     SEND MESSAGE
     =================================================== */

  function sendMessage() {
    const message =
      input.trim();

    if (!message) {
      return;
    }

    const socket =
      socketRef.current;

    if (
      !socket ||
      socket.readyState !==
        WebSocket.OPEN
    ) {
      console.error(
        "WebSocket is not connected"
      );

      return;
    }

    socket.send(
      JSON.stringify({
        type:
          "message.send",

        message,
      })
    );

    setInput("");

    inputRef.current?.focus();
  }

  /* ===================================================
     KEYBOARD
     =================================================== */

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      sendMessage();
    }
  }

  /* ===================================================
     WORKSPACE SWITCH
     =================================================== */

  function selectWorkspace(
    workspaceId: string
  ) {
    if (
      workspaceId ===
      activeWorkspaceId
    ) {
      return;
    }

    setActiveWorkspaceId(
      workspaceId
    );

    setMessages([]);
    setChannels([]);
    setActiveChannelId("");
  }

  /* ===================================================
     CHANNEL SWITCH
     =================================================== */

  function selectChannel(
    channelId: string
  ) {
    if (
      channelId ===
      activeChannelId
    ) {
      return;
    }

    setMessages([]);

    setActiveChannelId(
      channelId
    );

    setInput("");
  }

  /* ===================================================
     CREATE WORKSPACE
     =================================================== */

  async function createWorkspace() {
    if (
      !workspaceName.trim()
    ) {
      return;
    }

    try {
      const token =
        localStorage.getItem(
          "chat_token"
        );

      const response =
        await fetch(
          `${API_URL}/workspaces`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                name:
                  workspaceName.trim(),
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to create workspace"
        );
      }

      setWorkspaces(
        (previous) => [
          ...previous,
          data.workspace,
        ]
      );

      setActiveWorkspaceId(
        data.workspace.id
      );

      setWorkspaceName("");

      setShowWorkspaceModal(
        false
      );
    } catch (error) {
      console.error(
        "Create workspace error:",
        error
      );

      setError(
        "Failed to create workspace"
      );
    }
  }

  /* ===================================================
     CREATE CHANNEL
     =================================================== */

  async function createChannel() {
    if (
      !activeWorkspaceId ||
      !channelName.trim()
    ) {
      return;
    }

    try {
      const token =
        localStorage.getItem(
          "chat_token"
        );

      const response =
        await fetch(
          `${API_URL}/channels`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                workspace_id:
                  activeWorkspaceId,

                name:
                  channelName.trim(),

                type:
                  "public",
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to create channel"
        );
      }

      setChannels(
        (previous) => [
          ...previous,
          data.channel,
        ]
      );

      setActiveChannelId(
        data.channel.id
      );

      setChannelName("");

      setShowChannelModal(
        false
      );
    } catch (error) {
      console.error(
        "Create channel error:",
        error
      );

      setError(
        "Failed to create channel"
      );
    }
  }

  /* ===================================================
     AUTH LOADING
     =================================================== */

  if (authLoading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">
            C
          </div>

          <h1>
            Loading...
          </h1>
        </div>
      </div>
    );
  }

  /* ===================================================
     LOGIN / REGISTER
     =================================================== */

  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-card">

          <div className="auth-logo">
            C
          </div>

          <h1>
            {authMode === "login"
              ? "Welcome back"
              : "Create your account"}
          </h1>

          <p className="auth-subtitle">
            {authMode === "login"
              ? "Sign in to continue to Chat"
              : "Create an account to get started"}
          </p>

          {authMode ===
            "register" && (
            <input
              type="text"
              placeholder="Your name"
              value={authName}
              onChange={(event) =>
                setAuthName(
                  event.target.value
                )
              }
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={authEmail}
            onChange={(event) =>
              setAuthEmail(
                event.target.value
              )
            }
          />

          <input
            type="password"
            placeholder="Password"
            value={authPassword}
            onChange={(event) =>
              setAuthPassword(
                event.target.value
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                "Enter"
              ) {
                submitAuth();
              }
            }}
          />

          {authError && (
            <div className="auth-error">
              {authError}
            </div>
          )}

          <button
            className="auth-submit"
            onClick={
              submitAuth
            }
          >
            {authMode ===
            "login"
              ? "Sign in"
              : "Create account"}
          </button>

          <button
            className="auth-switch"
            onClick={() => {
              setAuthMode(
                authMode ===
                  "login"
                  ? "register"
                  : "login"
              );

              setAuthError("");
            }}
          >
            {authMode ===
            "login"
              ? "Create a new account"
              : "Already have an account? Sign in"}
          </button>

        </div>
      </div>
    );
  }

  /* ===================================================
     MAIN SLACK UI
     =================================================== */

  return (
    <div className="app">

      {/* =================================================
          WORKSPACE BAR
          ================================================= */}

      <aside className="workspace-sidebar">

        <div
          className="workspace-logo"
          title="Chat"
        >
          C
        </div>

        {loadingWorkspaces ? (
          <div className="workspace-icon">
            ...
          </div>
        ) : (
          workspaces.map(
            (workspace) => (
              <button
                key={workspace.id}
                className={
                  workspace.id ===
                  activeWorkspaceId
                    ? "workspace-icon active"
                    : "workspace-icon"
                }
                title={
                  workspace.name
                }
                onClick={() =>
                  selectWorkspace(
                    workspace.id
                  )
                }
              >
                {workspace.name
                  .slice(0, 1)
                  .toUpperCase()}
              </button>
            )
          )
        )}

        <button
          className="workspace-icon"
          title="Create workspace"
          onClick={() =>
            setShowWorkspaceModal(
              true
            )
          }
        >
          +
        </button>

      </aside>

      {/* =================================================
          CHANNEL SIDEBAR
          ================================================= */}

      <aside className="channel-sidebar">

        <div className="workspace-header">

          <div>
            <div className="workspace-name">
              {activeWorkspace?.name ??
                "Workspace"}
            </div>

            <div className="workspace-status">

              <span
                className={
                  connected
                    ? "status-dot online"
                    : "status-dot offline"
                }
              />

              {connected
                ? "Connected"
                : "Disconnected"}

            </div>
          </div>

          <button
            className="header-button"
          >
            ⌄
          </button>

        </div>

        {/* CHANNELS */}

        <div className="sidebar-section">

          <div className="sidebar-title">

            <span>
              Channels
            </span>

            <button
              className="add-channel"
              onClick={() =>
                setShowChannelModal(
                  true
                )
              }
              title="Create channel"
            >
              +
            </button>

          </div>

          {loadingChannels ? (
            <div className="sidebar-loading">
              Loading...
            </div>
          ) : channels.length ===
            0 ? (
            <div className="sidebar-loading">
              No channels
            </div>
          ) : (
            <div className="channel-list">

              {channels.map(
                (channel) => (
                  <button
                    key={channel.id}
                    className={
                      channel.id ===
                      activeChannelId
                        ? "channel active"
                        : "channel"
                    }
                    onClick={() =>
                      selectChannel(
                        channel.id
                      )
                    }
                  >
                    <span className="hash">
                      #
                    </span>

                    <span>
                      {channel.name}
                    </span>
                  </button>
                )
              )}

            </div>
          )}

        </div>

        {/* SIDEBAR BOTTOM */}

        <div className="sidebar-bottom">

          <div className="profile">

            <div className="avatar small">
              {getInitials(
                user.name
              )}
            </div>

            <div className="profile-info">

              <div className="profile-name">
                {user.name}
              </div>

              <div className="profile-status">
                <span className="green-dot" />
                Active
              </div>

            </div>

            <button
              className="profile-menu"
              onClick={logout}
              title="Sign out"
            >
              ⋮
            </button>

          </div>

        </div>

      </aside>

      {/* =================================================
          MAIN CHAT
          ================================================= */}

      <main className="chat">

        {/* HEADER */}

        <header className="chat-header">

          <div className="chat-title">

            <span className="chat-hash">
              #
            </span>

            <strong>
              {activeChannel?.name ??
                "channel"}
            </strong>

            <span className="header-divider">
              |
            </span>

            <span className="channel-description">
              Team conversation
            </span>

          </div>

          <div className="chat-actions">

            <button>
              🔍
            </button>

            <button>
              👥
            </button>

            <button>
              ⋯
            </button>

          </div>

        </header>

        {/* ERROR */}

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        {/* MESSAGES */}

        <section className="messages">

          {loadingMessages && (
            <div className="loading">
              Loading messages...
            </div>
          )}

          {!loadingMessages &&
            messages.length ===
              0 &&
            activeChannel && (
              <div className="empty-state">

                <div className="empty-icon">
                  #
                </div>

                <h2>
                  Welcome to #
                  {
                    activeChannel.name
                  }
                </h2>

                <p>
                  This is the beginning
                  of this channel.
                  Send the first message!
                </p>

              </div>
            )}

          {messages.map(
            (
              message,
              index
            ) => {
              const userId =
                getUserId(
                  message
                );

              const userName =
                getUserName(
                  message,
                  user
                );

              const timestamp =
                getTimestamp(
                  message
                );

              return (
                <div
                  className="message"
                  key={
                    getMessageId(
                      message
                    ) + index
                  }
                >

                  <div className="avatar">
                    {getInitials(
                      userName
                    )}
                  </div>

                  <div className="message-body">

                    <div className="message-meta">

                      <strong>
                        {userName}
                      </strong>

                      <span>
                        {formatTime(
                          timestamp
                        )}
                      </span>

                    </div>

                    <div className="message-text">
                      {
                        message.message
                      }
                    </div>

                  </div>

                </div>
              );
            }
          )}

          <div
            ref={
              messagesEndRef
            }
          />

        </section>

        {/* COMPOSER */}

        <div className="composer-wrapper">

          <div className="composer">

            <button className="composer-button">
              +
            </button>

            <input
              ref={inputRef}
              value={input}
              onChange={(
                event
              ) =>
                setInput(
                  event.target
                    .value
                )
              }
              onKeyDown={
                handleKeyDown
              }
              placeholder={
                activeChannel
                  ? `Message #${activeChannel.name}`
                  : "Select a channel"
              }
              disabled={
                !connected ||
                !activeChannel
              }
            />

            <button
              className="emoji-button"
              type="button"
            >
              😊
            </button>

            <button
              className="send-button"
              onClick={
                sendMessage
              }
              disabled={
                !connected ||
                !input.trim()
              }
            >
              ➤
            </button>

          </div>

          <div className="composer-hint">
            Press Enter to send
          </div>

        </div>

      </main>

      {/* =================================================
          CREATE WORKSPACE MODAL
          ================================================= */}

      {showWorkspaceModal && (
        <div className="modal-backdrop">

          <div className="modal">

            <h2>
              Create workspace
            </h2>

            <p>
              Give your new workspace a name.
            </p>

            <input
              autoFocus
              value={
                workspaceName
              }
              onChange={(
                event
              ) =>
                setWorkspaceName(
                  event.target
                    .value
                )
              }
              placeholder="My Workspace"
              onKeyDown={(
                event
              ) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  createWorkspace();
                }
              }}
            />

            <div className="modal-actions">

              <button
                onClick={() =>
                  setShowWorkspaceModal(
                    false
                  )
                }
              >
                Cancel
              </button>

              <button
                onClick={
                  createWorkspace
                }
                disabled={
                  !workspaceName.trim()
                }
              >
                Create workspace
              </button>

            </div>

          </div>

        </div>
      )}

      {/* =================================================
          CREATE CHANNEL MODAL
          ================================================= */}

      {showChannelModal && (
        <div className="modal-backdrop">

          <div className="modal">

            <h2>
              Create channel
            </h2>

            <p>
              Create a channel in{" "}
              <strong>
                {
                  activeWorkspace?.name
                }
              </strong>
              .
            </p>

            <input
              autoFocus
              value={
                channelName
              }
              onChange={(
                event
              ) =>
                setChannelName(
                  event.target
                    .value
                )
              }
              placeholder="engineering"
              onKeyDown={(
                event
              ) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  createChannel();
                }
              }}
            />

            <div className="modal-actions">

              <button
                onClick={() =>
                  setShowChannelModal(
                    false
                  )
                }
              >
                Cancel
              </button>

              <button
                onClick={
                  createChannel
                }
                disabled={
                  !channelName.trim()
                }
              >
                Create channel
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default App;