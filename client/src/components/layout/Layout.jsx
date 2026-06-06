import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Layout({ children }) {
  return (
    <div className="flex flex-row h-screen overflow-hidden w-full">
      <Sidebar />

      <div
        id="main"
        className="flex-1 flex flex-col overflow-hidden min-w-0"
      >
        <Topbar />

        <div
          id="content"
          className="flex-1 overflow-y-auto p-6 bg-canvas"
        >
          {children}
        </div>
      </div>
    </div>
  )
}
