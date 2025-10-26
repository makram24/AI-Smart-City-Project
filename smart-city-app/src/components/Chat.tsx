"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MapPin, Navigation } from "lucide-react";
import { ChatMessage } from "@/lib/api";

interface ChatProps {
  onSendMessage: (message: string) => void;
  messages: ChatMessage[];
  isLoading?: boolean;
}

export default function Chat({ onSendMessage, messages, isLoading }: ChatProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const handleQuickAction = (action: string) => {
    setInputValue(action);
  };

  const quickActions = [
    { text: "Find pharmacies near me", icon: MapPin },
    { text: "Best route to city center", icon: Navigation },
    { text: "Open restaurants nearby", icon: MapPin },
  ];

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Chat Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">AI City Assistant</h2>
        <p className="text-sm text-muted-foreground">
          Ask me anything about Budapest!
        </p>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-border">
        <p className="text-sm text-muted-foreground mb-2">Quick actions:</p>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action.text)}
                className="text-xs"
              >
                <Icon className="w-3 h-3 mr-1" />
                {action.text}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground mt-8">
            <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Welcome! I can help you find places, get directions, and discover what's happening in Budapest.</p>
            <p className="text-sm mt-2">Try asking me something like "Find pharmacies near me" or "Best way to get to Buda Castle".</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  message.sender === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
                {message.isLoading && (
                  <div className="flex items-center mt-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                    <span className="ml-2 text-xs">Thinking...</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me about Budapest..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={!inputValue.trim() || isLoading}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
