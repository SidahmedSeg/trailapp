import Header from './Header';
import Footer from './Footer';

export default function PublicLayout({ title, children }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Header title={title} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
