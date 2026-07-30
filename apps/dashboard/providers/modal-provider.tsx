'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LazyMount = ({
  useStore,
  children,
}: {
  useStore: () => { isOpen: boolean }
  children: React.ReactNode
}) => {
  const { isOpen } = useStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) setMounted(true)
  }, [isOpen])

  return mounted ? <>{children}</> : null
}

const emptySubscribe = () => () => {}

const useMounted = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )

export const ModalProvider = () => {
  const mounted = useMounted()

  if (!mounted) return null

  return (
    <>
      {/* Add your dialogs here using the LazyMount pattern:
       *
       * <LazyMount useStore={useMyDialog}>
       *   <MyDialog />
       * </LazyMount>
       */}
    </>
  )
}
