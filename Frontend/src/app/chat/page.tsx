import React from 'react'

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

const page = () => {
  return (
    <div>chat app</div>
  )
}

export default page
