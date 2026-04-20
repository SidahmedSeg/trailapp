import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { get } from '../lib/api';

const EventContext = createContext(null);

export function EventProvider({ children }) {
  const [events, setEvents] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await get('/admin/events');
      const list = res.data || [];
      setEvents(list);

      const active = list.find(e => e.active);
      setActiveEvent(active || null);

      // Default to active event if no selection
      if (!selectedEventId || !list.find(e => e.id === selectedEventId)) {
        setSelectedEventId(active?.id || list[0]?.id || null);
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const switchEvent = useCallback((id) => {
    setSelectedEventId(id);
  }, []);

  const selectedEvent = events.find(e => e.id === selectedEventId) || activeEvent;
  const isViewingHistory = selectedEventId && activeEvent && selectedEventId !== activeEvent.id;

  return (
    <EventContext.Provider value={{
      events,
      activeEvent,
      selectedEvent,
      selectedEventId,
      switchEvent,
      isViewingHistory,
      loading,
      refreshEvents: fetchEvents,
    }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
}
