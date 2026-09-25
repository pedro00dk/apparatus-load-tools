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
 * Inject overlay into {@linkcode element} and listen for its `[data-ov]` attribute.
 *
 * Elements side effects:
 * - `element.style.position`: Set to `relative` if `static`.
 * - `element.inert`: Set to `true` when overlay is enabled.
 * - `element.children`: Overlay appended when enabled.
 *
 * A cleanup function is returned to remove the overlay and listener.
 *
 * @param element Root element to listen for overlay candidates.
 * @param template Factory function to create the overlay element. Defaults to {@linkcode createOverlay}.
 */
export const injectOverlay = (element: HTMLElement, template = createOverlay) => {
    const position = getComputedStyle(element).position
    if (!position || position === 'static') element.style.position = 'relative'

    const { ov = 'false', ovZ = '1', ovIn = '200', ovOut = '200' } = element.dataset
    element.dataset.ov = ov

    const overlay = template()
    overlay.style.position = 'absolute'
    overlay.style.opacity = '1'
    overlay.style.inset = '0'
    overlay.style.zIndex = ovZ

    const inject = () => {
        element.inert = true
        element.append(overlay)
        if (!element.isConnected) return
        overlay.animate({ opacity: [0, 1] }, { duration: +ovIn, easing: 'ease-out', fill: 'forwards' })
    }

    const eject = () => {
        element.inert = false
        setTimeout(() => element.dataset.ov !== 'true' && overlay.remove(), +ovOut + 50)
        if (!element.isConnected) return
        overlay.animate({ opacity: [0] }, { duration: +ovOut, easing: 'ease-in', fill: 'forwards' })
    }

    const enabledObserver = new MutationObserver(() => (element.dataset.ov === 'true' ? inject() : eject()))
    enabledObserver.observe(element, { attributes: true, attributeFilter: ['data-ov'] })
    if (ov === 'true') inject()

    return () => {
        enabledObserver.disconnect()
        overlay.remove()
        eject()
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
