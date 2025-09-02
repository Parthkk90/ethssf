"use client";
import { useState } from "react";
import SponsorTab from "@/components/tabs/SponsorTab";
import SearchTab from "@/components/tabs/SearchTab";
import NewPostTab from "@/components/tabs/NewPostTab";
import ReceivedTab from "@/components/tabs/ReceivedTab";
import ProfileTab from "@/components/tabs/ProfileTab";

const TabBar = () => {
  const [activeTab, setActiveTab] = useState(3);

  const renderContent = () => {
    switch (activeTab) {
      case 1:
        return <SponsorTab setActiveTab={setActiveTab} />;
      case 2:
        return <SearchTab />;
      case 3:
        return <NewPostTab />;
      case 4:
        return <ReceivedTab />;
      case 5:
        return <ProfileTab />;
      default:
        return <NewPostTab />;
    }
  };

  const getTabStyle = (tabNumber: any) => {
    const baseStyle = "p-3 rounded-2xl transition-all duration-300 ease-in-out transform hover:scale-110";
    return activeTab === tabNumber
      ? `${baseStyle} bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg text-white scale-110`
      : `${baseStyle} hover:bg-gray-100 text-gray-600 hover:text-gray-800`;
  };

  return (
    <div className="flex flex-col h-screen justify-between">
      <div className="flex-grow">{renderContent()}</div>
      <div className="flex justify-around items-center bg-white bg-opacity-95 backdrop-blur-sm p-3 border-t border-gray-200 bottom-0 fixed w-full shadow-2xl">
        <button
          onClick={() => setActiveTab(1)}
          className={getTabStyle(1)}
          aria-label="Home"
        >
          <span className="text-2xl">{activeTab === 1 ? "🏠" : "🏘️"}</span>
        </button>
        <button
          onClick={() => setActiveTab(2)}
          className={getTabStyle(2)}
          aria-label="Search"
        >
          <span className="text-2xl">{activeTab === 2 ? "🔍" : "🔎"}</span>
        </button>
        <button
          onClick={() => setActiveTab(3)}
          className={getTabStyle(3)}
          aria-label="New Post"
        >
          <span className="text-2xl">{activeTab === 3 ? "✨" : "➕"}</span>
        </button>
        <button
          onClick={() => setActiveTab(4)}
          className={getTabStyle(4)}
          aria-label="Received"
        >
          <span className="text-2xl">{activeTab === 4 ? "💖" : "❤️"}</span>
        </button>
        <button
          onClick={() => setActiveTab(5)}
          className={getTabStyle(5)}
          aria-label="Profile"
        >
          <span className="text-2xl">{activeTab === 5 ? "👨‍💼" : "👤"}</span>
        </button>
      </div>
    </div>
  );
};

export default TabBar;
