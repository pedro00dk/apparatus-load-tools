declare global {
    interface DOMStringMap extends OverlayOptions {}
    interface HTMLElement {
        _overlay?: HTMLElement
    }
}

/**
 * Overlay `dataset` options that can be injected through element data attributes.
 */
export type OverlayOptions = {
    /** Display overlay. */
    ov?: `${boolean}`
    /** Overlay z-index. */
    ovZ?: `${number}`
    /** Fade in duration. */
    ovIn?: `${number}`
    /** Fade out duration. */
    ovOut?: `${number}`
    /** Set overlay slot. */
    ovSlot?: string
}

/**
 * Module configuration, includes default {@linkcode OverlayOptions}, and render functions.
 */
const configuration = {
    /** Default {@linkcode OverlayOptions} for all elements. */
    defaults: { ovIn: '200', ovOut: '200', ovZ: '1' } satisfies OverlayOptions,
    /** Render function for the overlay element. */
    create: () => {
        const decoration = document.createElement('i')
        decoration.style.position = 'absolute'
        decoration.style.display = 'grid'
        decoration.style.placeItems = 'center'
        decoration.style.background = '#FFFFFFC0'
        decoration.style.inset = '0'
        const spinnerTemplate = document.createElement('template')
        spinnerTemplate.innerHTML = `<svg fill="none" width="50" height="50" stroke="#1A2126" stroke-width="6">
            <circle cx="25" cy="25" r="22" opacity=".3"/>
            <path d="M25 3a22 22 0 0 1 22 22" stroke-linecap="round" />
        </svg>`
        const spinner = decoration.appendChild(spinnerTemplate.content.firstChild as SVGElement)
        spinner.animate({ rotate: ['0turn', '1turn'] }, { duration: 1000, iterations: Infinity })
        return decoration
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
 * Listen for {@linkcode element}'s `[data-ov]` and inject overlay.
 *
 * The overlay is generated using {@linkcode configuration.create}.
 *
 * Elements side effects:
 * - `element.style.position`: Set to `relative`.
 * - `element.children`: Decoration appended.
 *
 * Decorations side effects:
 * - `decoration.slot`: If required using `dataset` options.
 * - `decoration.style`: Several positioning properties.
 *
 * A cleanup function is returned to unsubscribe listeners and remove the overlay.
 *
 * @param element Root element to listen for overlay candidates.
 */
export const injectOverlay = (element: HTMLElement) => {
    const inject = (animate: boolean) => {
        const options = { ...configuration.defaults, ...element.dataset }
        const decoration = configuration.create()
        decoration.slot = options.ovSlot ?? ''
        decoration.style.position = 'absolute'
        decoration.style.inset = '0'
        decoration.style.zIndex = options.ovZ
        decoration.slot = options.ovSlot ?? ''
        element.style.position = 'relative'
        element._overlay = decoration
        element.append(decoration)
        resizeObserver.observe(element)
        const duration = +options.ovIn * +animate
        requestAnimationFrame(() => decoration.animate({ opacity: [0, 1] }, { duration, easing: 'ease-out' }))
    }

    const eject = (animate: boolean) => {
        const options = { ...configuration.defaults, ...element.dataset }
        const decoration = element._overlay
        element._overlay = undefined
        resizeObserver.unobserve(element)
        const duration = +options.ovOut * +animate
        requestAnimationFrame(() =>
            decoration
                ?.animate({ opacity: [1, 0] }, { duration, easing: 'ease-in' })
                .finished.then(() => decoration?.remove()),
        )
    }

    const mutationObserver = new MutationObserver(() => {
        const options = { ...configuration.defaults, ...element.dataset }
        if (options.ov === 'true') inject(true)
        else eject(true)
    })

    const resizeObserver = new ResizeObserver(
        ([{ borderBoxSize: size }]) => size[0].blockSize === 0 && size[0].inlineSize === 0 && eject(false),
    )

    mutationObserver.observe(element, { attributes: true, attributeFilter: ['data-ov'] })
    if (element.dataset.ov === 'true') inject(true)

    return () => {
        mutationObserver.disconnect()
        resizeObserver.disconnect()
        element._overlay?.remove()
    }
}
