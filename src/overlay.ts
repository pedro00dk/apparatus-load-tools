declare global {
    interface DOMStringMap extends OverlayOptions {}
}

/**
 * Overlay `dataset` options that can be injected through element data attributes.
 */
export type OverlayOptions = {
    /** Overlay enabled for element. */
    ov?: `${boolean}`
    /** Fade in duration. */
    ovIn?: `${number}`
    /** Fade out duration. */
    ovOut?: `${number}`
}

/**
 * Checks if browser supports css anchors. Or if fallback float mode will be used.
 *
 * The fallback mode uses inset positioning based on the parent container. It works as expected but can misbehave when
 * the page is zoomed in or out, and content shifts.
 */
const mode = CSS.supports('anchor-name: --anchor') ? 'anchor' : 'float'

/**
 * Module configuration, includes default {@linkcode OverlayOptions}, and render functions.
 */
const configuration = {
    /** Default {@linkcode OverlayOptions} for all elements. */
    defaults: { ovIn: '200', ovOut: '200' } as OverlayOptions,
    /** Default target element for the overlay container. */
    getTarget: () => document.body as HTMLElement | ShadowRoot,
    /** Render function for the overlay container element. */
    createContainer: () => {
        const container = document.createElement('div') as HTMLElement
        container.style.zIndex = '1'
        return container
    },
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
        const spinner = decoration.appendChild(spinnerTemplate.content.cloneNode(true).firstChild as SVGElement)
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
 * Inject the overlay container into {@linkcode target} of {@linkcode configuration.getTarget} and listen for elements
 * that want to display an overlay decoration.
 *
 * In order to display an overlay decoration, the element must opt-in by setting `[data-ov]='true' attribute`. The
 * overlay decoration can be enabled or disabled by setting the `[inert=false/true]` attribute.
 *
 * Overlay containers and decorations are generated using the {@linkcode configuration.createContainer} and
 * {@linkcode configuration.createDecoration}.
 *
 * Elements side effects:
 * - `element.style.anchorName`: Set for anchor positioning
 *
 * Container and decorations side effects:
 * `container.style`: Several positioning properties.
 * `decoration.style`: Several positioning properties.
 *
 * A cleanup function is returned to unsubscribe listeners and remove the overlay container from {@linkcode target}.
 *
 * @param elements Root elements to listen for overlay candidates in their subtrees.
 */
export const injectOverlay = (elements: HTMLElement[], target?: HTMLElement | ShadowRoot) => {
    target ??= configuration.getTarget()
    const container = target.appendChild(configuration.createContainer())
    container.dataset.about = 'overlay-container'
    container.style.position = mode === 'anchor' ? 'static' : 'absolute'

    const decorations = new WeakMap<HTMLElement, HTMLElement>()

    const mutationObserver = new MutationObserver(records => {
        const elements = records.map(({ target }) => target as HTMLElement)
        const containerRect = container.getBoundingClientRect()

        elements.forEach(async element => {
            const decoration = decorations.get(element)
            if (!decoration || (element.dataset.ov === 'true' && element.inert)) return
            resizeObserver.unobserve(element)
            decorations.delete(element)
            const duration = +(element.dataset.ovOut ?? configuration.defaults.ovOut ?? 0)
            await decoration.animate({ opacity: [1, 0] }, { duration, easing: 'ease-in', fill: 'forwards' }).finished
            decoration.remove()
        })

        elements
            .map(element => {
                if (element.dataset.ov !== 'true' || !element.inert) return
                const elementRect = element.getBoundingClientRect()
                const decoration = createDecoration(elementRect, containerRect)
                return { element, decoration, elementRect }
            })
            .forEach((decorationData, i) => {
                if (!decorationData) return
                const { element, decoration } = decorationData
                element.style.anchorName = decoration.style.positionAnchor = `--load-overlay-${i}`
                container.append(decoration)
                resizeObserver.observe(element)
                decorations.set(element, decoration)
                const duration = +(element.dataset.ovIn ?? configuration.defaults.ovIn ?? 0)
                decoration.animate({ opacity: [0, 1] }, { duration, easing: 'ease-out' })
            })
    })

    const resizeObserver = new ResizeObserver(entries =>
        entries.forEach(({ target, borderBoxSize }) => {
            if (borderBoxSize[0].blockSize > 0 || borderBoxSize[0].inlineSize > 0) return
            const element = target as HTMLElement
            const decoration = decorations.get(element)!
            resizeObserver.unobserve(element)
            decorations.delete(element)
            decoration.remove()
        }),
    )

    elements.forEach(element =>
        mutationObserver.observe(element, { subtree: true, attributes: true, attributeFilter: ['data-ov', 'inert'] }),
    )

    return () => {
        resizeObserver.disconnect()
        mutationObserver.disconnect()
        container.remove()
    }
}

/**
 * Create an overlay decoration element.
 *
 * @param elementRect Element rect required if {@linkcode mode} is `"float"`.
 * @param containerRect Container rect required if {@linkcode mode} is `"float"`.
 */
const createDecoration = (elementRect: DOMRect, containerRect: DOMRect) => {
    const float = +(mode === 'float')
    const decoration = configuration.createDecoration()
    decoration.style.position = 'absolute'
    decoration.style.positionArea = 'center center'
    decoration.style.width = `${elementRect.width}px`
    decoration.style.height = `${elementRect.height}px`
    decoration.style.left = `${float * (elementRect.x - containerRect.x)}px`
    decoration.style.top = `${float * (elementRect.y - containerRect.y)}px`
    return decoration
}
