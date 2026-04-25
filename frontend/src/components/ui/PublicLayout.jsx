import { useState, useEffect, createContext, useContext } from 'react';
import { get } from '../../lib/api';
import Header from './Header';
import Footer from './Footer';

const PublicEventContext = createContext(null);

export function usePublicEvent() {
  return useContext(PublicEventContext);
}

export default function PublicLayout({ title, children }) {
  const [eventConfig, setEventConfig] = useState(null);

  useEffect(() => {
    get('/settings/public')
      .then((data) => setEventConfig(data))
      .catch(() => {});
  }, []);

  const brandColor = eventConfig?.primaryColor || '#C42826';

  return (
    <PublicEventContext.Provider value={eventConfig}>
      <div
        className="min-h-screen flex flex-col bg-gray-100"
        style={{ '--brand': brandColor }}
      >
        <div className="print:hidden">
          <Header title={title === 'event' ? (eventConfig?.eventName || '') : title} event={eventConfig} />
        </div>
        <main className="flex-1">{children}</main>
        <div className="print:hidden">
          <Footer event={eventConfig} />
        </div>
      </div>
    </PublicEventContext.Provider>
  );
}
