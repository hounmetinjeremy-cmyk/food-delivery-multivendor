// Web shim for react-native-pager-view — it ships no web build at all, and is
// only reached from the single-vendor "Browse products" screen (see
// ProductExplorer.js), which is disabled by default in production (see
// src/mode/constants.js). Every call site here drives paging imperatively via
// the ref (setPage/setPageWithoutAnimation from a category tap), never by
// swipe-first, so this only needs to reproduce that: show the active page and
// scroll to it on ref calls. onPageSelected keeps firing so the unchanged
// business logic in ProductExplorer.js doesn't need to know it's on web.
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

const PagerView = forwardRef(function PagerView({ children, initialPage = 0, style, onPageSelected }, ref) {
  const containerRef = useRef(null)
  const pages = React.Children.toArray(children)
  const [, setPage] = useState(initialPage)

  const goToPage = (index, animated) => {
    setPage(index)
    containerRef.current?.scrollTo({
      left: index * (containerRef.current?.clientWidth ?? 0),
      behavior: animated ? 'smooth' : 'auto'
    })
    onPageSelected?.({ nativeEvent: { position: index } })
  }

  useImperativeHandle(ref, () => ({
    setPage: (index) => goToPage(index, true),
    setPageWithoutAnimation: (index) => goToPage(index, false)
  }))

  useEffect(() => {
    goToPage(initialPage, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', overflowX: 'hidden', width: '100%', height: '100%', ...style }}
    >
      {pages.map((child, index) => (
        <div key={index} style={{ flex: '0 0 100%', width: '100%' }}>
          {child}
        </div>
      ))}
    </div>
  )
})

export default PagerView
