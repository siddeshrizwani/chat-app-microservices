"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { chat_service, useAppData } from "./AppContext";

interface SocketContextType {
  socket: Socket | null;
  onlineUsers: string[];
}

// default value keeps consumers safe before the connection is up
const SocketContext = createContext<SocketContextType>({
  socket: null,
  onlineUsers: [],
});

interface ProviderProps {
  children: ReactNode;
}

export const SocketProvider = ({ children }: ProviderProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { user } = useAppData();
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    // wait until we know who is logged in, the backend needs the userId
    // to map this socket to a user
    if (!user?._id) return;

    const newSocket = io(chat_service, {
      query: {
        userId: user._id,
      },
    });

    setSocket(newSocket);

    // server broadcasts this on every connect and disconnect
    newSocket.on("getOnlineUser", (users: string[]) => {
      setOnlineUsers(users);
    });

    // close the old connection when the user changes or the app unmounts,
    // otherwise sockets pile up
    return () => {
      newSocket.disconnect();
    };
  }, [user?._id]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};

export const SocketData = () => useContext(SocketContext);
