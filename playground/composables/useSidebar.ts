export const useSidebar = () => {
  const isCollapsed = useCookie<boolean>('sidebar-collapsed', {
    default: () => false,
  })
  const isMobileOpen = useState<boolean>('sidebar-mobile-open', () => false)

  const toggleCollapsed = () => {
    isCollapsed.value = !isCollapsed.value
  }

  const openMobile = () => {
    isMobileOpen.value = true
  }

  const closeMobile = () => {
    isMobileOpen.value = false
  }

  const toggleMobile = () => {
    isMobileOpen.value = !isMobileOpen.value
  }

  return {
    isCollapsed,
    isMobileOpen,
    toggleCollapsed,
    openMobile,
    closeMobile,
    toggleMobile,
  }
}
