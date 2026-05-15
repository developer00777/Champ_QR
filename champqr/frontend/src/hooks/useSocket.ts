import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function useSocket() {
  const ref = useRef<Socket | null>(null)

  useEffect(() => {
    if (!socket) {
      socket = io('/', { withCredentials: true, path: '/socket.io' })
    }
    ref.current = socket
    return () => { /* keep socket alive across remounts */ }
  }, [])

  return ref.current
}
