import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/chat";
import {
  CONTENT_SUGGESTIONS,
  parseMessageContent,
  type AutocompleteSuggestion,
  type ContentFilterValue,
  type SearchFilter,
  type SearchResult,
  type SortOption,
} from "./types";

export function useSearchLogic() {
  const { activeChat, chatMessages } = useChat();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [view, setView] = useState<"filters" | "results">("filters");
  const [autocomplete, setAutocomplete] = useState<AutocompleteSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);

  const uniqueSenders = useMemo(() => {
    if (!chatMessages) return [];
    const senders = new Map<string, string>();
    chatMessages.forEach((msg) => {
      if (msg.senderName && !msg.isSystem) {
        senders.set(msg.senderId, msg.senderName);
      }
    });
    return Array.from(senders.values());
  }, [chatMessages]);

  const parseQueryForAutocomplete = useCallback(
    (q: string): { filterType: string | null; partial: string } => {
      const colonIdx = q.indexOf(":");
      if (colonIdx === -1) return { filterType: null, partial: q };
      const filterType = q.substring(0, colonIdx).toLowerCase();
      const partial = q.substring(colonIdx + 1).trim();
      return { filterType, partial };
    },
    []
  );

  useEffect(() => {
    const { filterType, partial } = parseQueryForAutocomplete(query);

    if (!filterType) {
      setAutocomplete([]);
      setSelectedSuggestion(0);
      return;
    }

    let suggestions: AutocompleteSuggestion[] = [];

    if (filterType === "from" || filterType === "mentions") {
      const lowerPartial = partial.toLowerCase();
      suggestions = uniqueSenders
        .filter((name) => name.toLowerCase().includes(lowerPartial))
        .slice(0, 6)
        .map((name) => ({ value: name, label: name, icon: "user" }));

      if (user && user.username.toLowerCase().includes(lowerPartial)) {
        const alreadyIncluded = suggestions.some(
          (s) => s.value.toLowerCase() === user.username.toLowerCase()
        );
        if (!alreadyIncluded) {
          suggestions.unshift({
            value: user.username,
            label: `${user.username} (you)`,
            icon: "user",
          });
        }
      }
    } else if (filterType === "has") {
      const lowerPartial = partial.toLowerCase();
      suggestions = CONTENT_SUGGESTIONS.filter(
        (s) =>
          s.value.toLowerCase().includes(lowerPartial) ||
          s.label.toLowerCase().includes(lowerPartial)
      );
    } else if (filterType === "before" || filterType === "after") {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      suggestions = [
        { value: today.toISOString().split("T")[0], label: "Today" },
        { value: yesterday.toISOString().split("T")[0], label: "Yesterday" },
        { value: lastWeek.toISOString().split("T")[0], label: "Last week" },
        { value: lastMonth.toISOString().split("T")[0], label: "Last month" },
      ].filter((s) => s.label.toLowerCase().includes(partial.toLowerCase()) || partial === "");
    }

    setAutocomplete(suggestions);
    setSelectedSuggestion(0);
  }, [query, uniqueSenders, user, parseQueryForAutocomplete]);

  const allSearchableMessages = useMemo(() => {
    if (!chatMessages || !activeChat) return [];
    return chatMessages
      .filter((msg) => !msg.isSystem)
      .map((msg) => {
        const parsed = parseMessageContent(msg.content);
        return {
          id: msg.id,
          conversationId: activeChat.conversationId,
          conversationName: activeChat.isGroup
            ? activeChat.groupName || "Group"
            : activeChat.visitorUsername,
          senderId: msg.senderId,
          senderName: msg.senderName || "Unknown",
          content: msg.content,
          createdAt: msg.createdAt,
          isGroup: activeChat.isGroup || false,
          hasLink: parsed.hasLink,
          hasFile: parsed.hasFile,
          hasImage: parsed.hasImage,
          isGif: parsed.isGif,
        };
      });
  }, [chatMessages, activeChat]);

  const performSearch = useCallback(() => {
    const { filterType } = parseQueryForAutocomplete(query);
    if (filterType && autocomplete.length > 0) return;

    const hasActiveFilters = (query.trim() && !query.includes(":")) || filters.length > 0;
    if (!hasActiveFilters) {
      setResults([]);
      if (view === "results") setView("filters");
      return;
    }

    setIsSearching(true);
    let filtered = [...allSearchableMessages];

    if (query.trim() && !query.includes(":")) {
      const searchTerms = query.toLowerCase().trim();
      filtered = filtered.filter((msg) => {
        const parsed = parseMessageContent(msg.content);
        return parsed.text.toLowerCase().includes(searchTerms);
      });
    }

    const fromFilters = filters.filter((f) => f.type === "from");
    const hasFilters = filters.filter((f) => f.type === "has");
    const mentionsFilters = filters.filter((f) => f.type === "mentions");
    const beforeFilters = filters.filter((f) => f.type === "before");
    const afterFilters = filters.filter((f) => f.type === "after");

    if (fromFilters.length > 0) {
      const fromValues = fromFilters.map((f) => f.value.toLowerCase());
      filtered = filtered.filter((msg) => fromValues.includes(msg.senderName.toLowerCase()));
    }

    if (hasFilters.length > 0) {
      filtered = filtered.filter((msg) => {
        return hasFilters.some((filter) => {
          const ct = filter.value.toLowerCase() as ContentFilterValue;
          if (ct === "link") return msg.hasLink && !msg.isGif;
          if (ct === "file") return msg.hasFile;
          if (ct === "image") return msg.hasImage || msg.isGif;
          if (ct === "gif") return msg.isGif;
          return false;
        });
      });
    }

    if (mentionsFilters.length > 0) {
      filtered = filtered.filter((msg) => {
        const parsed = parseMessageContent(msg.content);
        const text = parsed.text.toLowerCase();
        return mentionsFilters.some((f) => text.includes(`@${f.value.toLowerCase()}`));
      });
    }

    if (beforeFilters.length > 0) {
      const earliestBefore = beforeFilters
        .map((f) => new Date(f.value))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime())[0];
      if (earliestBefore) {
        filtered = filtered.filter((m) => new Date(m.createdAt) < earliestBefore);
      }
    }

    if (afterFilters.length > 0) {
      const latestAfter = afterFilters
        .map((f) => new Date(f.value))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      if (latestAfter) {
        filtered = filtered.filter((m) => new Date(m.createdAt) > latestAfter);
      }
    }

    filtered.sort((a, b) =>
      sortBy === "newest"
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    setResults(filtered);
    setIsSearching(false);
    setView("results");
  }, [
    query,
    filters,
    allSearchableMessages,
    sortBy,
    view,
    autocomplete.length,
    parseQueryForAutocomplete,
  ]);

  useEffect(() => {
    const debounce = setTimeout(performSearch, 150);
    return () => clearTimeout(debounce);
  }, [performSearch]);

  const addFilter = useCallback(
    (type: SearchFilter["type"], value: string, displayValue?: string) => {
      const alreadyExists = filters.some(
        (f) => f.type === type && f.value.toLowerCase() === value.toLowerCase()
      );
      if (alreadyExists) {
        setQuery("");
        setAutocomplete([]);
        return;
      }
      setFilters([...filters, { type, value, displayValue }]);
      setQuery("");
      setAutocomplete([]);
      setView("results");
    },
    [filters]
  );

  const removeFilter = useCallback(
    (index: number) => {
      const updated = filters.filter((_, i) => i !== index);
      setFilters(updated);
      if (updated.length === 0 && !query.trim()) setView("filters");
    },
    [filters, query]
  );

  const clearAll = useCallback(() => {
    setQuery("");
    setFilters([]);
    setResults([]);
    setView("filters");
    setAutocomplete([]);
  }, []);

  const selectSuggestion = useCallback(
    (suggestion: AutocompleteSuggestion) => {
      const { filterType } = parseQueryForAutocomplete(query);
      if (filterType) {
        addFilter(filterType as SearchFilter["type"], suggestion.value, suggestion.label);
      }
    },
    [query, parseQueryForAutocomplete, addFilter]
  );

  return {
    query,
    setQuery,
    filters,
    results,
    isSearching,
    sortBy,
    setSortBy,
    view,
    setView,
    autocomplete,
    selectedSuggestion,
    setSelectedSuggestion,
    addFilter,
    removeFilter,
    clearAll,
    selectSuggestion,
    parseQueryForAutocomplete,
    activeChat,
  };
}
