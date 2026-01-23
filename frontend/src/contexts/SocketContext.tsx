import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppSelector, useAppDispatch, conversationsActions, uiActions } from '../store';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendTypingIndicator: (conversationId: string, isTyping: boolean) => void;
  updateAgentStatus: (status: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  joinConversation: () => {},
  leaveConversation: () => {},
  sendTypingIndicator: () => {},
  updateAgentStatus: () => {},
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { token, isAuthenticated } = useAppSelector(state => state.auth);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
      newSocket.emit('agent:auth', { token });
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('agent:authenticated', (data: { success: boolean; error?: string }) => {
      if (data.success) {
        console.log('Agent authenticated on socket');
      } else {
        console.error('Socket auth failed:', data.error);
      }
    });

    // Conversation events
    newSocket.on('conversation:message', (data: { conversationId: string; message: any }) => {
      dispatch(conversationsActions.updateConversation({
        id: data.conversationId,
        lastMessageAt: data.message.createdAt,
        messageCount: (window as any).__messageCount || 0 + 1,
      }));
      dispatch(uiActions.addNotification({
        type: 'info',
        title: 'New Message',
        message: `New message in conversation`,
      }));
    });

    newSocket.on('conversation:state_changed', (data: { conversationId: string; status: string }) => {
      dispatch(conversationsActions.updateConversation({
        id: data.conversationId,
        status: data.status as any,
      }));
    });

    newSocket.on('conversation:assigned', (data: { conversationId: string; agentId: string }) => {
      dispatch(conversationsActions.updateConversation({
        id: data.conversationId,
        assignedTo: data.agentId,
      }));
    });

    newSocket.on('resolution:update', (data: any) => {
      dispatch(uiActions.addNotification({
        type: 'info',
        title: 'Resolution Update',
        message: `Resolution ${data.id} status changed to ${data.status}`,
      }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, token, dispatch]);

  const joinConversation = useCallback((conversationId: string) => {
    if (socket && isConnected) {
      socket.emit('agent:join_conversation', { conversationId });
    }
  }, [socket, isConnected]);

  const leaveConversation = useCallback((conversationId: string) => {
    if (socket && isConnected) {
      socket.emit('agent:leave_conversation', { conversationId });
    }
  }, [socket, isConnected]);

  const sendTypingIndicator = useCallback((conversationId: string, isTyping: boolean) => {
    if (socket && isConnected) {
      socket.emit('agent:typing', { conversationId, isTyping });
    }
  }, [socket, isConnected]);

  const updateAgentStatus = useCallback((status: string) => {
    if (socket && isConnected) {
      socket.emit('agent:status', { status });
    }
  }, [socket, isConnected]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinConversation,
        leaveConversation,
        sendTypingIndicator,
        updateAgentStatus,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
