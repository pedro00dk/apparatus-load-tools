declare global {
    interface DOMStringMap extends OverlayOptions {}
}

/**
 * Overlay `dataset` options that can be injected through element data attributes.
 */
export type OverlayOptions = {
    /** Display overlay. */
    ov?: `${boolean}`
}

/**
 * Create a default overlay element.
 */
export const createOverlay = () => {
    const overlay = document.createElement('x-overlay')
    overlay.style.display = 'grid'
    overlay.style.placeItems = 'center'
    overlay.style.background = '#FFF8'
    const spinnerTemplate = document.createElement('template')
    spinnerTemplate.innerHTML = `<svg fill="none" width="50" height="50" stroke="#1A2126" stroke-width="6">
            <circle cx="25" cy="25" r="22" opacity=".3"/>
            <path d="M25 3a22 22 0 0 1 22 22" stroke-linecap="round" />
        </svg>`
    const spinner = overlay.appendChild(spinnerTemplate.content.firstChild as SVGElement)
    spinner.animate({ rotate: '1turn' }, { duration: 1000, iterations: Infinity })
    return overlay
}

/**
 * Listen for {@linkcode element}'s `[data-ov]` and inject overlay.
 *
 * The overlay is generated using {@linkcode configuration.factory}.
 *
 * Elements side effects:
 * - `element.style.position`: Set to `relative` if `static`.
 * - `element.inert`: Set to `true` when overlay is enabled.
 * - `element.children`: Overlay appended when enabled.
 *
 * A cleanup function is returned to remove the overlay.
 *
 * @param element Root element to listen for overlay candidates.
 * @param createOverlay_ Factory function to create the overlay element. Defaults to {@linkcode createOverlay}.
 */
export const injectOverlay = (element: HTMLElement, createOverlay_ = createOverlay) => {
    const position = getComputedStyle(element).position
    element.style.position = !position || position === 'static' ? 'relative' : position

    const overlay = createOverlay_()
    overlay.style.position = 'absolute'
    overlay.style.inset = '0'
    overlay.style.zIndex = '1'
    overlay.style.opacity = '1'

    const options: KeyframeAnimationOptions = { duration: 200, easing: 'ease-in-out', fill: 'forwards' }

    const inject = () => {
        element.inert = true
        element.append(overlay)
        if (!element.isConnected) return
        requestAnimationFrame(() => overlay.animate({ opacity: [0, 1] }, options))
    }

    const eject = () => {
        element.inert = false
        setTimeout(() => element.dataset.ov !== 'true' && overlay.remove(), 250)
        if (!element.isConnected) return
        requestAnimationFrame(() => overlay.animate({ opacity: 0 }, options))
    }

    const overlayObserver = new MutationObserver(() => (element.dataset.ov === 'true' ? inject() : eject()))
    overlayObserver.observe(element, { attributes: true, attributeFilter: ['data-ov'] })
    if (element.dataset.ov === 'true') inject()

    return () => {
        overlayObserver.disconnect()
        overlay.remove()
    }
}
