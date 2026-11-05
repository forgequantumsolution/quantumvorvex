import Sidebar from './Sidebar'
import Topbar from './Topbar'
import BottomNav from './BottomNav'
import PageHeader from './PageHeader'

// App shell. #content is the one vertical scroller; its padding (index.css)
// adapts per breakpoint and reserves room for the phone bottom bar.
export default function Layout({ children }) {
  return (
    <div className="flex flex-row h-[100dvh] overflow-hidden w-full">
      <Sidebar />

      <div
        id="main"
        className="flex-1 flex flex-col overflow-hidden min-w-0"
      >
        <Topbar />

        <main
          id="content"
          className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-canvas"
        >
          <PageHeader />
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
