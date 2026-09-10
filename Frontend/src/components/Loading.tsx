import React from "react";

// full screen spinner, used while auth state or chats are still being fetched
const Loading = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 min-h-screen">
      {/* a circle with one transparent border side, spun by tailwind's animate-spin */}
      <div className="h-12 w-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default Loading;
