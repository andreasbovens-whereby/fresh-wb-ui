import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { useWhiteboardSync } from '../lib/useWhiteboardSync'

interface WhiteboardStageProps {
  roomUrl: string
  displayName: string
}

/**
 * Shared Excalidraw canvas. Lazy-loaded by CallRoom (the excalidraw bundle is
 * ~1MB) and mounted only while the board is open — the sync hook connects to
 * the relay on mount and catches up from its snapshot.
 */
export default function WhiteboardStage({ roomUrl, displayName }: WhiteboardStageProps) {
  const sync = useWhiteboardSync(roomUrl, displayName)

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-zinc-900">
      <Excalidraw
        excalidrawAPI={sync.onExcalidrawAPI}
        onChange={sync.onChange}
        onPointerUpdate={sync.onPointerUpdate}
        theme="dark"
        UIOptions={{
          canvasActions: {
            toggleTheme: false,
            loadScene: false,
            saveToActiveFile: false,
          },
        }}
      />
      {!sync.connected && (
        <div className="pop-in absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-amber-500/90 px-3 py-1 text-xs font-semibold text-amber-950">
          Whiteboard sync reconnecting…
        </div>
      )}
    </div>
  )
}
