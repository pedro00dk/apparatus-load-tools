declare global {
    interface DOMStringMap extends OverlayOptions {}
}

/**
 * Overlay `dataset` options that can be injected through element data attributes.
 */
export type OverlayOptions = {
    /** Display overlay. */
    ov?: `${boolean}`
    /** Overlay z-index. */
    ovZ?: `${number}`
    /** Overlay fade-in duration (ms). */
    ovIn?: `${number}`
    /** Overlay fade-out duration (ms). */
    ovOut?: `${number}`
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
 * A cleanup function is returned to remove the overlay listener.
 *
 * @param element Root element to listen for overlay candidates.
 * @param template Factory function to create the overlay element. Defaults to {@linkcode createOverlay}.
 */
export const injectOverlay = (element: HTMLElement, template = createOverlay) => {
    const overlay = template()
    const position = getComputedStyle(element).position
    element.style.position = !position || position === 'static' ? 'relative' : position

    const inject = () => {
        const duration = +(element.dataset.ovIn || 200)
        element.inert = true
        element.append(overlay)
        overlay.style.position = 'absolute'
        overlay.style.opacity = '1'
        overlay.style.inset = '0'
        overlay.style.zIndex = element.dataset.ovZ ?? '1'
        if (!element.isConnected) return
        overlay.animate({ opacity: [0, 1] }, { duration, easing: 'ease-out', fill: 'forwards' })
    }

    const eject = () => {
        const duration = +(element.dataset.ovOut || 200)
        element.inert = false
        setTimeout(() => element.dataset.ov !== 'true' && overlay.remove(), duration + 50)
        if (!element.isConnected) return
        overlay.animate({ opacity: [0] }, { duration, easing: 'ease-in', fill: 'forwards' })
    }

    const overlayObserver = new MutationObserver(() => (element.dataset.ov === 'true' ? inject() : eject()))
    overlayObserver.observe(element, { attributes: true, attributeFilter: ['data-ov'] })
    if (element.dataset.ov === 'true') inject()

    return () => {
        overlayObserver.disconnect()
        overlay.remove()
    }
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
