declare global {
    interface DOMStringMap extends OverlayOptions {}
}

/**
 * Overlay `dataset` options that can be injected through element data attributes.
 */
export type OverlayOptions = {
    /** Display overlay decoration. */
    ov?: `${boolean}`
    /** Overlay decoration z-index. */
    ovZ?: `${number}`
    /** Fade in duration. */
    ovIn?: `${number}`
    /** Fade out duration. */
    ovOut?: `${number}`
    /** Set overlay decoration slot. */
    ovSlot?: string
}

/**
 * Module configuration, includes default {@linkcode OverlayOptions}, and render functions.
 */
const configuration = {
    /** Default {@linkcode OverlayOptions} for all elements. */
    defaults: { ovIn: '200', ovOut: '200', ovZ: '1' } satisfies OverlayOptions,
    /** Render function for the overlay decoration element. */
    createDecoration: () => {
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
 * Listen for elements that want to display an overlays, and inject overlay decorations.
 *
 * In order to display an overlay decoration, the element must opt-in by setting the `[data-ov]` attribute.
 *
 * Overlay containers and decorations are generated using {@linkcode configuration.createDecoration}.
 *
 * Elements side effects:
 * - `element.style.position`: Set to `relative`.
 * - `element.children`: Decoration appended.
 *
 * Decorations side effects:
 * - `decoration.style`: Several positioning properties.
 *
 * A cleanup function is returned to unsubscribe listeners and remove the overlay container from {@linkcode target}.
 *
 * @param root Root element to listen for overlay candidates.
 * @param options.subtree Listen for overlay candidates in the entire subtree.
 */
export const injectOverlay = (root: HTMLElement, options?: { subtree?: boolean }) => {
    const { subtree = false } = options ?? {}
    const decorations = new WeakMap<HTMLElement, HTMLElement>()

    const inject = (element: HTMLElement, animate: boolean) => {
        const options = { ...configuration.defaults, ...element.dataset }
        const decoration = configuration.createDecoration()
        decoration.slot = options.ovSlot ?? ''
        decoration.style.position = 'absolute'
        decoration.style.inset = '0'
        element.append(decoration)
        resizeObserver.observe(element)
        decorations.set(element, decoration)
        decoration.animate({ opacity: [0, 1] }, { duration: +options.ovIn * +animate, easing: 'ease-out' })
    }

    const eject = (element: HTMLElement, animate: boolean) => {
        const decoration = decorations.get(element)
        const options = { ...configuration.defaults, ...element.dataset }
        resizeObserver.unobserve(element)
        decorations.delete(element)
        decoration
            ?.animate({ opacity: [1, 0] }, { duration: +options.ovOut * +animate, easing: 'ease-in' })
            .finished.then(() => decoration?.remove())
    }

    const mutationObserver = new MutationObserver(records => {
        records
            .filter(({ target }) => (target as HTMLElement).dataset.ov !== 'true')
            .forEach(({ target }) => eject(target as HTMLElement, true))
        records
            .filter(({ target }) => (target as HTMLElement).dataset.ov === 'true')
            .forEach(({ target }) => inject(target as HTMLElement, true))
    })

    const resizeObserver = new ResizeObserver(entries =>
        entries.forEach(
            entry =>
                entry.borderBoxSize[0].blockSize === 0 &&
                entry.borderBoxSize[0].inlineSize === 0 &&
                eject(entry.target as HTMLElement, false),
        ),
    )

    mutationObserver.observe(root, { subtree, attributes: true, attributeFilter: ['data-ov'] })

    return () => (mutationObserver.disconnect(), resizeObserver.disconnect())
}
