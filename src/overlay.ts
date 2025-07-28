declare global {
    interface DOMStringMap extends OverlayOptions {}
}

/**
 * Overlay `dataset` options that can be injected through element data attributes.
 */
export type OverlayOptions = {
    /** Display overlay. */
    ov?: `${boolean}`
    /** Set overlay slot for custom elements. */
    ovSlot?: string
    /** Fade in duration. */
    ovIn?: `${number}`
    /** Fade out duration. */
    ovOut?: `${number}`
    /** Overlay z-index. */
    ovZ?: `${number}`
}

/**
 * Module configuration, includes default {@linkcode OverlayOptions}, and a overlay factory.
 */
const configuration = {
    /** Default {@linkcode OverlayOptions}. */
    defaults: { ovIn: '200', ovOut: '200', ovZ: '1' } satisfies OverlayOptions,
    /** Overlay factory. */
    factory: () => {
        const overlay = document.createElement('i')
        overlay.style.position = 'absolute'
        overlay.style.display = 'grid'
        overlay.style.placeItems = 'center'
        overlay.style.background = '#FFFFFFC0'
        overlay.style.inset = '0'
        const spinnerTemplate = document.createElement('template')
        spinnerTemplate.innerHTML = `<svg fill="none" width="50" height="50" stroke="#1A2126" stroke-width="6">
            <circle cx="25" cy="25" r="22" opacity=".3"/>
            <path d="M25 3a22 22 0 0 1 22 22" stroke-linecap="round" />
        </svg>`
        const spinner = overlay.appendChild(spinnerTemplate.content.firstChild as SVGElement)
        spinner.animate({ rotate: ['0turn', '1turn'] }, { duration: 1000, iterations: Infinity })
        return overlay
    },
}

/**
 * Set module {@linkcode configuration}.
 *
 * @param overrides Configuration parts to override.
 */
export const setOverlayConfiguration = (overrides: Partial<typeof configuration>) => {
    const defaults = { ...configuration.defaults, ...overrides.defaults }
    Object.assign(configuration, overrides, { defaults })
}

/**
 * Create a overlay using {@linkcode configuration.factory} and add layout properties.
 *
 * @param options Element's resolved {@linkcode OverlayOptions}.
 */
const createOverlay = (options: OverlayOptions) => {
    const overlay = configuration.factory()
    overlay.slot = options.ovSlot ?? ''
    overlay.style.position = 'absolute'
    overlay.style.inset = '0'
    overlay.style.zIndex = options.ovZ!
    overlay.slot = options.ovSlot ?? ''
    return overlay
}

/**
 * Listen for {@linkcode element}'s `[data-ov]` and inject overlay.
 *
 * The overlay is generated using {@linkcode configuration.factory}.
 *
 * Elements side effects:
 * - `element.children`: Overlay appended.
 * - `element.style.position`: Set to `relative`.
 *
 * Overlay side effects:
 * - `overlay.slot`: If required using `dataset` options.
 * - `overlay.style`: Several positioning properties.
 *
 * A cleanup function is returned to unsubscribe listeners and remove the overlay.
 *
 * @param element Root element to listen for overlay candidates.
 */
export const injectOverlay = (element: HTMLElement) => {
    let overlayElement!: HTMLElement | undefined

    const inject = (animate: boolean) => {
        const options = { ...configuration.defaults, ...element.dataset }
        const overlay = createOverlay(options)
        overlayElement = overlay
        element.append(overlay)
        removedObserver.observe(element)
        const duration = +options.ovIn * +animate
        requestAnimationFrame(() => overlay.animate({ opacity: [0, 1] }, { duration, easing: 'ease-out' }))
    }

    const eject = (animate: boolean) => {
        const options = { ...configuration.defaults, ...element.dataset }
        const overlay = overlayElement
        overlayElement = undefined
        removedObserver.unobserve(element)
        const duration = +options.ovOut * +animate
        requestAnimationFrame(() =>
            overlay
                ?.animate({ opacity: [1, 0] }, { duration, easing: 'ease-in' })
                .finished.then(() => overlay?.remove()),
        )
    }

    const enabledObserver = new MutationObserver(() => {
        const options = { ...configuration.defaults, ...element.dataset }
        if (options.ov === 'true') inject(true)
        else eject(true)
    })

    const removedObserver = new ResizeObserver(
        ([{ borderBoxSize: size }]) => size[0].blockSize === 0 && size[0].inlineSize === 0 && eject(false),
    )

    const position = getComputedStyle(element).position
    element.style.position = position === 'static' ? 'relative' : position
    enabledObserver.observe(element, { attributes: true, attributeFilter: ['data-ov'] })
    if (element.dataset.ov === 'true') inject(true)

    return () => {
        enabledObserver.disconnect()
        removedObserver.disconnect()
        overlayElement?.remove()
    }
}
