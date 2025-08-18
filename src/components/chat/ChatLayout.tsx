'use client';

import Sidebar from "./Sidebar";
import Header from "./Header";
import MessageList from "./MessageList";
import Composer from "./Composer";

export default function ChatLayout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <MessageList />
        <Composer />
      </div>
    </div>
  );
}
