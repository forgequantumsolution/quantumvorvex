import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Layout({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100vh',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <Sidebar />

      <div
        id="main"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <Topbar />

        <div
          id="content"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            background: 'var(--main-bg)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
