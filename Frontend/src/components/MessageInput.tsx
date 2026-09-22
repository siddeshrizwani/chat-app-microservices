import { Loader2, Paperclip, Send, X } from "lucide-react";
import React, { useState } from "react";

interface MessageInputProps {
  selectedUser: string | null;
  message: string;
  setMessage: (message: string) => void;
  handleMessageSend: (
    e: React.FormEvent<HTMLFormElement>,
    imageFile?: File | null
  ) => void;
}

const MessageInput = ({
  selectedUser,
  message,
  setMessage,
  handleMessageSend,
}: MessageInputProps) => {
  // the picked image stays local to this component, the parent only receives it on submit
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // nothing to send
    if (!message.trim() && !imageFile) return;

    // isUploading disables the button so the same image can't be sent twice
    setIsUploading(true);
    await handleMessageSend(e, imageFile);
    setImageFile(null);
    setIsUploading(false);
  };

  // no chat open, no input bar
  if (!selectedUser) return null;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 border-t border-gray-700 pt-2"
    >
      {/* local preview of the picked image before it is uploaded */}
      {imageFile && (
        <div className="relative w-fit">
          {/* createObjectURL gives a local url for the file, nothing is uploaded yet */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={URL.createObjectURL(imageFile)}
            alt="preview"
            className="w-24 h-24 object-cover rounded-lg border border-gray-600"
          />
          <button
            type="button"
            className="absolute -top-2 -right-2 bg-black rounded-full p-1"
            onClick={() => setImageFile(null)}
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* the real file input is hidden, the label turns the paperclip into the trigger */}
        <label className="cursor-pointer bg-gray-700 hover:bg-gray-600 rounded-lg px-3 py-2 transition-colors">
          <Paperclip size={18} className="text-gray-300" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // double check the mime type, accept alone is easy to bypass
              if (file && file.type.startsWith("image/")) {
                setImageFile(file);
              }
            }}
          />
        </label>

        {/* setMessage is the parent's typing handler, it also fires the socket typing event */}
        <input
          type="text"
          className="flex-1 bg-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400"
          placeholder={imageFile ? "Add a caption..." : "Type a message..."}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button
          type="submit"
          disabled={(!imageFile && !message) || isUploading}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed text-white"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </form>
  );
};

export default MessageInput;
