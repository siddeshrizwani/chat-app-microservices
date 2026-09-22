"use client";
import ChatSidebar from "@/components/ChatSidebar";
import Loading from "@/components/Loading";
import { chat_service, useAppData, User } from "@/context/AppContext";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import axios from "axios";
import ChatHeader from "@/components/ChatHeader";
import ChatMessages from "@/components/ChatMessages";
import MessageInput from "@/components/MessageInput";
import { SocketData } from "@/context/SocketContext";

// shape of a message as the chat service returns it
// lives here because the chat page owns the messages state,
// the message components import this type from it
export interface Message {
  _id: string;
  chatId: string;
  sender: string;
  text?: string;
  image?: {
    url: string;
    publicId: string;
  };
  messageType: "text" | "image";
  seen: boolean;
  seenAt?: string;
  createdAt: string;
}

const ChatApp = () => {
  const {
    loading,
    isAuth,
    logoutUser,
    chats,
    user: loggedInUser,
    users,
    fetchChats,
    setChats,
  } = useAppData();

  // live socket plus the list of user ids currently connected
  const { onlineUsers, socket } = SocketData();

  // selectedUser holds the chatId of the open conversation, not a userId
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [siderbarOpen, setSiderbarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[] | null>(null);
  // the other person in the open chat, returned alongside the messages
  const [user, setUser] = useState<User | null>(null);
  const [showAllUser, setShowAllUser] = useState(false);
  // true while the other person is typing in the open chat
  const [isTyping, setIsTyping] = useState(false);
  // holds the pending "stopTyping" timer so it can be cancelled and restarted
  const [typingTimeOut, setTypingTimeOut] = useState<NodeJS.Timeout | null>(
    null
  );

  const router = useRouter();

  // kick the user out once we know for sure they are not logged in
  useEffect(() => {
    if (!isAuth && !loading) {
      router.push("/login");
    }
  }, [isAuth, router, loading]);

  const handleLogout = () => logoutUser();

  // opens a chat — this call also marks the other person's messages as seen
  async function fetchChat() {
    const token = Cookies.get("token");
    try {
      const { data } = await axios.get(
        `${chat_service}/api/v1/message/${selectedUser}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessages(data.messages);
      setUser(data.user);
      // refresh the sidebar so the unseen badge clears
      await fetchChats();
    } catch (error) {
      console.log(error);
      toast.error("Failed to load messages");
    }
  }

  // pulls a chat to the top of the sidebar and updates its preview text,
  // so we don't have to refetch the whole list after every message
  const moveChatToTop = (
    chatId: string,
    // text is optional because a socket Message for an image has an empty text
    newMessage: { text?: string; sender: string },
    updatedUnseenCount = true
  ) => {
    setChats((prev) => {
      if (!prev) return null;

      const updatedChats = [...prev];
      const chatIndex = updatedChats.findIndex(
        (chat) => chat.chat._id === chatId
      );

      if (chatIndex !== -1) {
        // pull it out, then push it back on the front
        const [moveChat] = updatedChats.splice(chatIndex, 1);

        const updatedChat = {
          ...moveChat,
          chat: {
            ...moveChat.chat,
            latestMessage: {
              // image only messages carry no text, show a label instead of a blank row
              text: newMessage.text || "📷 image",
              sender: newMessage.sender,
            },
            updatedAt: new Date().toString(),

            // only bump the badge for messages someone else sent
            unseenCount:
              updatedUnseenCount && newMessage.sender !== loggedInUser?._id
                ? (moveChat.chat.unseenCount || 0) + 1
                : moveChat.chat.unseenCount || 0,
          },
        };

        updatedChats.unshift(updatedChat);
      }

      return updatedChats;
    });
  };

  // clears the badge locally the moment a chat is opened
  const resetUnseenCount = (chatId: string) => {
    setChats((prev) => {
      if (!prev) return null;

      return prev.map((chat) => {
        if (chat.chat._id === chatId) {
          return {
            ...chat,
            chat: {
              ...chat.chat,
              unseenCount: 0,
            },
          };
        }
        return chat;
      });
    });
  };

  // backend returns the existing chatId if these two already have a chat
  async function createChat(u: User) {
    try {
      const token = Cookies.get("token");
      const { data } = await axios.post(
        `${chat_service}/api/v1/chat/new`,
        {
          userId: loggedInUser?._id,
          otherUserId: u._id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setSelectedUser(data.chatId);
      setShowAllUser(false);
      await fetchChats();
    } catch (error) {
      console.log(error);
      toast.error("Failed to start chat");
    }
  }

  const handleMessageSend = async (
    e: React.FormEvent<HTMLFormElement>,
    imageFile?: File | null
  ) => {
    e.preventDefault();

    if (!message.trim() && !imageFile) return;

    if (!selectedUser) return;

    // socket work — sending means we are done typing, so cancel the pending
    // timer and tell the other side immediately
    if (typingTimeOut) {
      clearTimeout(typingTimeOut);
      setTypingTimeOut(null);
    }

    socket?.emit("stopTyping", {
      chatId: selectedUser,
      userId: loggedInUser?._id,
    });

    const token = Cookies.get("token");

    try {
      // FormData because an image may ride along — multer reads it on the backend
      const formData = new FormData();

      formData.append("chatId", selectedUser);

      if (message.trim()) {
        formData.append("text", message);
      }

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const { data } = await axios.post(
        `${chat_service}/api/v1/message`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      // append the saved message, guarding against a duplicate
      setMessages((prev) => {
        const currentMessages = prev || [];
        const messageExists = currentMessages.some(
          (msg) => msg._id === data.message._id
        );

        if (!messageExists) {
          return [...currentMessages, data.message];
        }
        return currentMessages;
      });

      setMessage("");

      const displayText = imageFile ? "📷 image" : message;

      // false — my own message should never raise my own unseen count
      moveChatToTop(
        selectedUser,
        {
          text: displayText,
          sender: data.sender,
        },
        false
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to send message");
      } else {
        toast.error("Failed to send message");
      }
    }
  };

  const handleTyping = (value: string) => {
    setMessage(value);

    if (!selectedUser || !socket) return;

    // socket setup — announce typing on every keystroke that isn't empty
    if (value.trim()) {
      socket.emit("typing", {
        chatId: selectedUser,
        userId: loggedInUser?._id,
      });
    }

    // debounce: each keystroke cancels the previous timer, so "stopTyping"
    // only fires once the user has been idle for 2 seconds
    if (typingTimeOut) {
      clearTimeout(typingTimeOut);
    }

    const timeout = setTimeout(() => {
      socket.emit("stopTyping", {
        chatId: selectedUser,
        userId: loggedInUser?._id,
      });
    }, 2000);

    setTypingTimeOut(timeout);
  };

  // all incoming realtime events land here
  useEffect(() => {
    socket?.on("newMessage", (message: Message) => {
      console.log("Recieved new message:", message);

      // the message belongs to the chat I am looking at
      if (selectedUser === message.chatId) {
        setMessages((prev) => {
          const currentMessages = prev || [];
          // the sender already appended it from the post response
          const messageExists = currentMessages.some(
            (msg) => msg._id === message._id
          );

          if (!messageExists) {
            return [...currentMessages, message];
          }
          return currentMessages;
        });

        // chat is open, so nothing is unread — don't bump the badge
        moveChatToTop(message.chatId, message, false);
      } else {
        // message for some other chat, bump its unread badge
        moveChatToTop(message.chatId, message, true);
      }
    });

    socket?.on(
      "messagesSeen",
      (data: { chatId: string; seenBy: string; messageIds?: string[] }) => {
        console.log("Message seen by:", data);

        if (selectedUser === data.chatId) {
          // flip my own messages to seen so the tick turns blue
          setMessages((prev) => {
            if (!prev) return null;
            return prev.map((msg) => {
              if (
                msg.sender === loggedInUser?._id &&
                data.messageIds &&
                data.messageIds.includes(msg._id)
              ) {
                return {
                  ...msg,
                  seen: true,
                  seenAt: new Date().toString(),
                };
              } else if (msg.sender === loggedInUser?._id && !data.messageIds) {
                // no ids given means everything in this chat was seen
                return {
                  ...msg,
                  seen: true,
                  seenAt: new Date().toString(),
                };
              }
              return msg;
            });
          });
        }
      }
    );

    socket?.on("userTyping", (data: { chatId: string; userId: string }) => {
      console.log("recieved user typing", data);
      // ignore the echo of my own typing
      if (data.chatId === selectedUser && data.userId !== loggedInUser?._id) {
        setIsTyping(true);
      }
    });

    socket?.on(
      "userStoppedTyping",
      (data: { chatId: string; userId: string }) => {
        console.log("recieved user stopped typing", data);
        if (data.chatId === selectedUser && data.userId !== loggedInUser?._id) {
          setIsTyping(false);
        }
      }
    );

    // remove the old listeners before re-registering with a new selectedUser,
    // otherwise they stack up and fire multiple times
    return () => {
      socket?.off("newMessage");
      socket?.off("messagesSeen");
      socket?.off("userTyping");
      socket?.off("userStoppedTyping");
    };
  }, [socket, selectedUser, setChats, loggedInUser?._id]);

  // load the conversation whenever a different chat is picked
  useEffect(() => {
    if (selectedUser) {
      fetchChat();
      setIsTyping(false);

      resetUnseenCount(selectedUser);

      // joining the room is what tells the backend I am looking at this chat,
      // which is how incoming messages get marked seen straight away
      socket?.emit("joinChat", selectedUser);

      return () => {
        socket?.emit("leaveChat", selectedUser);
        setMessages(null);
      };
    }
  }, [selectedUser, socket]);

  // don't leave a pending timer behind when the page unmounts
  useEffect(() => {
    return () => {
      if (typingTimeOut) {
        clearTimeout(typingTimeOut);
      }
    };
  }, [typingTimeOut]);

  if (loading) return <Loading />;
  return (
    <div className="min-h-screen flex bg-gray-900 text-white relative overflow-hidden">
      <ChatSidebar
        sidebarOpen={siderbarOpen}
        setSidebarOpen={setSiderbarOpen}
        showAllUsers={showAllUser}
        setShowAllUsers={setShowAllUser}
        users={users}
        loggedInUser={loggedInUser}
        chats={chats}
        selectedUser={selectedUser}
        setSelectedUser={setSelectedUser}
        handleLogout={handleLogout}
        createChat={createChat}
        onlineUsers={onlineUsers}
      />
      <div className="flex-1 flex flex-col justify-between p-4 backdrop-blur-xl bg-white/5 border-1 border-white/10">
        <ChatHeader
          user={user}
          setSidebarOpen={setSiderbarOpen}
          isTyping={isTyping}
          onlineUsers={onlineUsers}
        />

        <ChatMessages
          selectedUser={selectedUser}
          messages={messages}
          loggedInUser={loggedInUser}
        />

        <MessageInput
          selectedUser={selectedUser}
          message={message}
          setMessage={handleTyping}
          handleMessageSend={handleMessageSend}
        />
      </div>
    </div>
  );
};

export default ChatApp;
